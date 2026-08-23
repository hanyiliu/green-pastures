import { randomUUID } from "node:crypto";

import { getTranslations } from "next-intl/server";

import { getSite } from "@/content/site";
import { routing, type Locale } from "@/i18n/routing";

import type { InquiryFieldErrors, InquiryFormCode, InquiryResponseBody } from "../codes";
import {
  MAX_BODY_BYTES,
  TURNSTILE_TOKEN_FIELD,
  isBotSignal,
  parseInquiry,
  type Inquiry,
} from "../schema";

import { renderAutoReply, renderStaffNotification } from "./email";
import { autoAcknowledgementEnabled } from "./env";
import { resolveSendingIdentity } from "./identity";
import { logInquiry, type InquiryOutcome } from "./log";
import { acceptableHosts, isSameOrigin } from "./origin";
import {
  InquiryTransportError,
  idempotencyKeyFor,
  selectedTransport,
  sendEmail,
  type OutgoingEmail,
} from "./transport";
import { verifyTurnstile } from "./turnstile";

/**
 * `POST /api/inquiry` (07 §2, `D-07.1`).
 *
 * A pure `Request → Response` function, which is the second of the three
 * reasons `D-07.1` chose a Route Handler over a Server Action: it is testable
 * under Vitest with no React rendering and no server. `src/app/api/inquiry/
 * route.ts` is a handful of lines that call it.
 *
 * The steps are 07 §2's, in its order, and every early exit answers a machine
 * code from `../codes` — never copy (INV-07.1).
 *
 * 1. Guards: method, content type, size, same origin.
 * 2. Parse and normalise with the shared schema (INV-07.2).
 * 3. Decoy: honeypot or too fast → a response byte-identical to success.
 * 4. Rate limit: the Vercel WAF rule acts before this function runs; the seam
 *    for a store-backed limiter is {@link InquiryHandlerOptions.rateLimiter}.
 * 5. Turnstile `siteverify`, fail-closed.
 * 6. Render both e-mails from locale JSON.
 * 7. Send.
 * 8. Auto-acknowledgement, only behind `INQUIRY_AUTOACK`.
 * 9. Respond — JSON, or a 303 back to the section for a URL-encoded body.
 */

const CONTENT_TYPE_JSON = "application/json";
const CONTENT_TYPE_FORM = "application/x-www-form-urlencoded";

/** 07 §2 step 5 sends Cloudflare the IP Vercel puts here; we never log it. */
const REAL_IP_HEADER = "x-real-ip";

/**
 * The rate-limit seam of 07 §2 step 4.
 *
 * The launch limiter is a Vercel WAF rule, which runs before this function and
 * answers 429 itself — so the default here is "allowed", and the handler
 * "behaves correctly with or without it". When the WAF rule proves too coarse,
 * `@upstash/ratelimit` plugs in as this one function and nothing else moves. An
 * in-memory counter must never be written here: function instances do not share
 * memory, so it would count a fraction of the traffic and mean nothing.
 */
export type RateLimiter = (request: Request) => Promise<boolean> | boolean;

export type InquiryHandlerOptions = {
  /** Injected in tests; production passes nothing and uses the global. */
  readonly fetchImpl?: typeof fetch;
  readonly rateLimiter?: RateLimiter;
  /** Fixed in tests so the idempotency key and the log line are assertable. */
  readonly now?: () => Date;
  readonly requestId?: string;
};

type ResponseShape = { readonly status: number; readonly body: InquiryResponseBody };

const OK: ResponseShape = { status: 200, body: { ok: true } };

function failure(status: number, code: InquiryFormCode): ResponseShape {
  return { status, body: { ok: false, code } };
}

function invalidFields(fields: InquiryFieldErrors): ResponseShape {
  return { status: 400, body: { ok: false, fields } };
}

/** The bare media type, without the charset a browser appends. */
function mediaType(request: Request): string {
  const header = request.headers.get("content-type") ?? "";
  return (header.split(";")[0] ?? "").trim().toLowerCase();
}

function declaredLength(request: Request): number {
  const raw = request.headers.get("content-length");
  if (raw === null) return 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

/**
 * URL-encoded and JSON bodies both arrive as a flat record of strings.
 *
 * A body that is not JSON at all becomes `{}` rather than `undefined`, so the
 * schema answers `required` per field instead of one issue at the root: an
 * unparseable submission and an empty one are the same thing to a parent, and
 * the 400 body stays the `Record<field, code>` shape 07 §1's table promises.
 */
function payloadFrom(body: string, type: string): unknown {
  if (type === CONTENT_TYPE_FORM) return Object.fromEntries(new URLSearchParams(body));
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Where the no-JavaScript path is sent back to (07 §2 step 9, 06 `D-06.6`,
 * memo ADJ-21): `/{locale}#visit`, with **no slash before the `#`**, so the
 * redirect does not spend a `trailingSlash` 308 hop before it lands.
 */
export function visitSectionHref(locale: Locale): string {
  return `/${locale}#visit`;
}

function asLocale(payload: unknown): Locale {
  const value = (payload as { locale?: unknown } | null | undefined)?.locale;
  const locales: readonly string[] = routing.locales;
  return typeof value === "string" && locales.includes(value)
    ? (value as Locale)
    : routing.defaultLocale;
}

const OUTCOME_BY_STATUS: Readonly<Record<number, InquiryOutcome>> = {
  200: "accepted",
  400: "invalid",
  403: "rejected",
  405: "rejected",
  413: "rejected",
  415: "rejected",
  429: "rejected",
  502: "failed",
  503: "unavailable",
};

/* -------------------------------------------------------------------------- *
 * The handler
 * -------------------------------------------------------------------------- */

export async function handleInquiry(
  request: Request,
  options: InquiryHandlerOptions = {},
): Promise<Response> {
  const start = Date.now();
  const requestId = options.requestId ?? randomUUID();
  const now = options.now?.() ?? new Date();

  const type = mediaType(request);
  const wantsRedirect = type === CONTENT_TYPE_FORM;

  let result: SubmissionResult;
  let locale: Locale = routing.defaultLocale;
  let inquiry: Inquiry | undefined;

  if (request.method !== "POST") {
    result = { response: failure(405, "forbidden") };
  } else if (type !== CONTENT_TYPE_JSON && type !== CONTENT_TYPE_FORM) {
    result = { response: failure(415, "forbidden") };
  } else if (declaredLength(request) > MAX_BODY_BYTES) {
    result = { response: failure(413, "payload_too_large") };
  } else if (!isSameOrigin(request)) {
    result = { response: failure(403, "forbidden") };
  } else {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
      result = { response: failure(413, "payload_too_large") };
    } else {
      const payload = payloadFrom(body, type);
      locale = asLocale(payload);

      const parsed = parseInquiry(payload);
      if (parsed.ok) {
        inquiry = parsed.inquiry;
        locale = inquiry.locale;
        result = await completeSubmission(request, inquiry, now, options);
      } else {
        result = { response: invalidFields(parsed.fields) };
      }
    }
  }

  const { response } = result;

  logInquiry({
    event: result.spam === true ? "inquiry.spam" : "inquiry.request",
    requestId,
    outcome: result.spam === true ? "spam" : (OUTCOME_BY_STATUS[response.status] ?? "failed"),
    code: response.body.ok ? undefined : response.body.code,
    status: response.status,
    locale,
    source: inquiry?.source,
    childAge: inquiry?.childAge,
    desiredStart: inquiry?.desiredStart,
    durationMs: Date.now() - start,
    transport: result.transport,
    resendId: result.resendId,
    turnstileErrorCodes: result.turnstileErrorCodes,
  });

  if (wantsRedirect) {
    return new Response(null, {
      status: 303,
      headers: { location: visitSectionHref(locale), "cache-control": "no-store" },
    });
  }

  return Response.json(response.body, {
    status: response.status,
    headers: { "cache-control": "no-store" },
  });
}

/* -------------------------------------------------------------------------- *
 * Steps 3 to 8, once the body is a valid inquiry
 * -------------------------------------------------------------------------- */

type SubmissionResult = {
  readonly response: ResponseShape;
  /** True on the decoy path only. Changes the log line, never the response. */
  readonly spam?: boolean;
  readonly transport?: string;
  readonly resendId?: string;
  readonly turnstileErrorCodes?: readonly string[];
};

async function completeSubmission(
  request: Request,
  inquiry: Inquiry,
  now: Date,
  options: InquiryHandlerOptions,
): Promise<SubmissionResult> {
  // 3. Decoy. Identical to success, and nothing is sent. A bot learns nothing.
  if (isBotSignal(inquiry, now.getTime())) return { response: OK, spam: true };

  // 4. Rate limit. The WAF rule already answered 429 if it was going to.
  const allowed = (await options.rateLimiter?.(request)) ?? true;
  if (!allowed) return { response: failure(429, "rate_limited") };

  // 5. Turnstile, fail-closed.
  const verification = await verifyTurnstile({
    token: inquiry[TURNSTILE_TOKEN_FIELD],
    remoteIp: request.headers.get(REAL_IP_HEADER) ?? undefined,
    expectedHosts: acceptableHosts(request),
    fetchImpl: options.fetchImpl,
  });

  if (verification.status === "failed") {
    return {
      response: failure(400, "turnstile_failed"),
      turnstileErrorCodes: verification.errorCodes,
    };
  }
  if (verification.status === "unavailable") {
    return {
      response: failure(503, "turnstile_unavailable"),
      turnstileErrorCodes: verification.errorCodes,
    };
  }

  // 6. Render. The staff notification is written in the site's default locale
  //    (D-07.6); the parent's own locale travels in the preferred-language line.
  const staffLocale = routing.defaultLocale;
  const site = getSite();
  const identity = resolveSendingIdentity(staffLocale, site);

  const notification = renderStaffNotification({
    t: await getTranslations({ locale: staffLocale, namespace: "email" }),
    tVisit: await getTranslations({ locale: staffLocale, namespace: "visit" }),
    locale: staffLocale,
    inquiry,
    submittedAt: now,
  });

  const email: OutgoingEmail = {
    from: identity.from,
    to: identity.to,
    replyTo: inquiry.email,
    subject: notification.subject,
    text: notification.text,
    html: notification.html,
    tags: { source: inquiry.source, locale: inquiry.locale },
    idempotencyKey: idempotencyKeyFor(inquiry),
  };

  // 7. Send.
  let resendId: string | undefined;
  try {
    const sent = await sendEmail(email, { fetchImpl: options.fetchImpl });
    resendId = sent.id;
  } catch (error) {
    if (!(error instanceof InquiryTransportError)) throw error;
    return { response: failure(502, "email_failed"), transport: selectedTransport() };
  }

  // 8. Auto-acknowledgement. Off unless INQUIRY_AUTOACK=1; a failure here is
  //    logged and never surfaced — the parent already has the success panel.
  if (autoAcknowledgementEnabled()) {
    await sendAutoAcknowledgement(inquiry, site, options);
  }

  return { response: OK, transport: selectedTransport(), resendId };
}

async function sendAutoAcknowledgement(
  inquiry: Inquiry,
  site: ReturnType<typeof getSite>,
  options: InquiryHandlerOptions,
): Promise<void> {
  try {
    const identity = resolveSendingIdentity(inquiry.locale, site);
    const reply = renderAutoReply({
      t: await getTranslations({ locale: inquiry.locale, namespace: "email" }),
      inquiry,
      brandName: identity.displayName,
    });

    await sendEmail(
      {
        from: identity.from,
        to: [inquiry.email],
        replyTo: identity.to[0] ?? identity.fromAddress,
        subject: reply.subject,
        text: reply.text,
        html: reply.html,
        tags: { source: inquiry.source, locale: inquiry.locale },
        idempotencyKey: `${idempotencyKeyFor(inquiry).slice(0, 60)}-ack`,
      },
      { fetchImpl: options.fetchImpl },
    );
  } catch {
    console.error(
      JSON.stringify({ event: "inquiry.autoack.failed", submissionId: inquiry.submissionId }),
    );
  }
}
