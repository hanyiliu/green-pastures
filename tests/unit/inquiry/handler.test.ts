import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { TIME_ZONE, formats } from "@/i18n/formats";
import { loadMessages } from "@/i18n/messages";
import { routing } from "@/i18n/routing";
import { getSite } from "@/content/site";
import { MAX_BODY_BYTES, MIN_SUBMIT_MS } from "@/lib/inquiry/schema";
import { handleInquiry, visitSectionHref } from "@/lib/inquiry/server/handler";
import { RESEND_SEND_URL } from "@/lib/inquiry/server/transport";
import { TURNSTILE_VERIFY_URL } from "@/lib/inquiry/turnstile";

import {
  NOW,
  STARTED_AT,
  fakeFetch,
  formRequest,
  jsonRequest,
  rawSubmission,
  requestBodyOf,
  urlOf,
  type FakeFetchOptions,
} from "./fixtures";

/**
 * The handler, end to end, with no provider reachable (07 §2, §8 *Handler*).
 *
 * `next-intl/server` is mocked because `getTranslations` needs a request scope
 * a Vitest run does not have; the replacement is `createTranslator` over the
 * real message files loaded exactly as production loads them, so the e-mails
 * these cases assert on are the e-mails the site would send.
 */

vi.mock("next-intl/server", () => ({
  getTranslations: async ({
    locale,
    namespace,
  }: {
    locale: "en" | "zh-Hans" | "zh-Hant";
    namespace: "email" | "visit";
  }) => {
    // Production semantics, so a locale whose file is still `{}` renders the
    // English fallback the site would actually send (02 D-02.8). Restored by
    // name rather than with `unstubAllEnvs`, which would drop the key stubs the
    // surrounding test set.
    vi.stubEnv("NODE_ENV", "production");
    const messages = await loadMessages(locale);
    vi.stubEnv("NODE_ENV", "test");
    return createTranslator({ locale, messages, namespace, formats, timeZone: TIME_ZONE });
  },
}));

const site = getSite();

let consoleInfo: MockInstance<typeof console.info>;
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("INQUIRY_TRANSPORT", "resend");
  consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  consoleInfo.mockRestore();
  consoleError.mockRestore();
});

type Submit = {
  readonly overrides?: Record<string, string>;
  readonly headers?: Record<string, string>;
  readonly network?: FakeFetchOptions;
  readonly rateLimiter?: (request: Request) => boolean;
};

async function submit(options: Submit = {}) {
  const impl = fakeFetch(options.network);
  const response = await handleInquiry(
    jsonRequest(rawSubmission(options.overrides), options.headers),
    {
      fetchImpl: impl,
      now: () => NOW,
      requestId: "req-1",
      rateLimiter: options.rateLimiter,
    },
  );
  const body: unknown = await response.clone().json();
  return { response, body, impl, raw: await response.text() };
}

/** The single structured line the handler wrote, parsed. */
function logLine(): Record<string, unknown> {
  const written = [...consoleInfo.mock.calls, ...consoleError.mock.calls]
    .map((call) => String(call[0]))
    .filter((line) => line.startsWith("{") && line.includes('"event"'));
  return JSON.parse(written[written.length - 1] ?? "{}") as Record<string, unknown>;
}

function callsTo(impl: ReturnType<typeof fakeFetch>, url: string) {
  return impl.calls.filter((call) => call.url === url);
}

/* -------------------------------------------------------------------------- *
 * 1 · Guards
 * -------------------------------------------------------------------------- */

describe("guards (07 §2 step 1)", () => {
  it("answers 405 to anything but POST", async () => {
    const request = new Request("https://greenpasturesdaycare.com/api/inquiry", { method: "GET" });
    const response = await handleInquiry(request, { now: () => NOW });
    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toStrictEqual({ ok: false, code: "forbidden" });
  });

  it("answers 415 to a content type that is not on the list", async () => {
    const { response, body } = await submit({ headers: { "content-type": "text/plain" } });
    expect(response.status).toBe(415);
    expect(body).toStrictEqual({ ok: false, code: "forbidden" });
  });

  it("accepts application/json with a charset", async () => {
    const { response } = await submit({
      headers: { "content-type": "application/json; charset=utf-8" },
    });
    expect(response.status).toBe(200);
  });

  it("answers 413 on a declared Content-Length over the cap", async () => {
    const { response, body } = await submit({
      headers: { "content-length": String(MAX_BODY_BYTES + 1) },
    });
    expect(response.status).toBe(413);
    expect(body).toStrictEqual({ ok: false, code: "payload_too_large" });
  });

  it("answers 413 on a body over the cap that declared nothing", async () => {
    const impl = fakeFetch();
    const request = jsonRequest(rawSubmission({ message: "x".repeat(MAX_BODY_BYTES) }));
    request.headers.delete("content-length");
    const response = await handleInquiry(request, { fetchImpl: impl, now: () => NOW });
    expect(response.status).toBe(413);
    expect(impl.calls).toHaveLength(0);
  });

  it("answers 403 to a cross-site origin", async () => {
    const { response, body, impl } = await submit({
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    });
    expect(response.status).toBe(403);
    expect(body).toStrictEqual({ ok: false, code: "forbidden" });
    expect(impl.calls).toHaveLength(0);
  });

  it("accepts a Vercel branch alias as the origin", async () => {
    vi.stubEnv("VERCEL_BRANCH_URL", "gp-git-wave-phase4.vercel.app");
    const { response } = await submit({
      headers: {
        host: "gp-abcdef.vercel.app",
        origin: "https://gp-git-wave-phase4.vercel.app",
      },
      network: {
        turnstile: { success: true, action: "inquiry", hostname: "gp-abcdef.vercel.app" },
      },
    });
    expect(response.status).toBe(200);
  });
});

/* -------------------------------------------------------------------------- *
 * 2 · Validation
 * -------------------------------------------------------------------------- */

describe("validation (07 §2 step 2)", () => {
  it("answers 400 with per-field codes and no form-level code", async () => {
    const { response, body } = await submit({
      overrides: { parentName: "", email: "nope", childAge: "teenager" },
    });

    expect(response.status).toBe(400);
    expect(body).toStrictEqual({
      ok: false,
      fields: { parentName: "required", email: "invalid_email", childAge: "invalid_option" },
    });
    expect(body).not.toHaveProperty("code");
  });

  it("sends nothing when the body does not validate", async () => {
    const { impl } = await submit({ overrides: { email: "" } });
    expect(impl.calls).toHaveLength(0);
  });

  it("treats an unparseable JSON body as an empty submission, not a crash", async () => {
    const request = new Request("https://greenpasturesdaycare.com/api/inquiry", {
      method: "POST",
      headers: { "content-type": "application/json", host: "greenpasturesdaycare.com" },
      body: "{oh no",
    });
    const response = await handleInquiry(request, { now: () => NOW });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { fields: Record<string, string> };
    expect(body.fields.parentName).toBe("required");
  });
});

/* -------------------------------------------------------------------------- *
 * 3 · The decoy
 * -------------------------------------------------------------------------- */

describe("the decoy path (07 §2 step 3)", () => {
  it("answers a honeypot submission byte-identically to a success", async () => {
    const success = await submit();
    const decoy = await submit({ overrides: { website: "https://spam.example" } });

    expect(decoy.response.status).toBe(success.response.status);
    expect(decoy.raw).toBe(success.raw);
    expect(decoy.raw).toBe('{"ok":true}');
  });

  it("sends nothing on the honeypot path", async () => {
    const { impl } = await submit({ overrides: { website: "x" } });
    expect(impl.calls).toHaveLength(0);
  });

  it("answers the same way to a submission that came in too fast", async () => {
    const { response, raw, impl } = await submit({
      overrides: { startedAt: String(NOW.getTime() - (MIN_SUBMIT_MS - 1)) },
    });
    expect(response.status).toBe(200);
    expect(raw).toBe('{"ok":true}');
    expect(impl.calls).toHaveLength(0);
  });

  it("logs it as inquiry.spam, so an operator can still see it", async () => {
    await submit({ overrides: { website: "x" } });
    expect(logLine()).toMatchObject({ event: "inquiry.spam", outcome: "spam", status: 200 });
  });
});

/* -------------------------------------------------------------------------- *
 * 4 · Rate limit
 * -------------------------------------------------------------------------- */

describe("the rate-limit seam (07 §2 step 4)", () => {
  it("passes the request through when no limiter is installed", async () => {
    const { response } = await submit();
    expect(response.status).toBe(200);
  });

  it("answers 429 rate_limited when one refuses", async () => {
    const { response, body, impl } = await submit({ rateLimiter: () => false });
    expect(response.status).toBe(429);
    expect(body).toStrictEqual({ ok: false, code: "rate_limited" });
    expect(impl.calls).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- *
 * 5 · Turnstile
 * -------------------------------------------------------------------------- */

describe("Turnstile (07 §2 step 5)", () => {
  it("answers 400 turnstile_failed when Cloudflare rejects the token", async () => {
    const { response, body, impl } = await submit({
      network: { turnstile: { success: false, "error-codes": ["timeout-or-duplicate"] } },
    });

    expect(response.status).toBe(400);
    expect(body).toStrictEqual({ ok: false, code: "turnstile_failed" });
    expect(callsTo(impl, RESEND_SEND_URL)).toHaveLength(0);
    expect(logLine()).toMatchObject({ turnstileErrorCodes: ["timeout-or-duplicate"] });
  });

  it("fails closed with 503 when Cloudflare cannot be reached", async () => {
    const { response, body, impl } = await submit({ network: { turnstile: "unreachable" } });

    expect(response.status).toBe(503);
    expect(body).toStrictEqual({ ok: false, code: "turnstile_unavailable" });
    expect(callsTo(impl, RESEND_SEND_URL)).toHaveLength(0);
  });

  it("fails closed when the secret is not configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const { response, body } = await submit();
    expect(response.status).toBe(503);
    expect(body).toStrictEqual({ ok: false, code: "turnstile_unavailable" });
  });

  it("verifies before it sends, never after", async () => {
    const { impl } = await submit();
    expect(impl.calls[0]?.url).toBe(TURNSTILE_VERIFY_URL);
    expect(impl.calls[1]?.url).toBe(RESEND_SEND_URL);
  });
});

/* -------------------------------------------------------------------------- *
 * 6 and 7 · Render and send
 * -------------------------------------------------------------------------- */

describe("the happy path (07 §2 steps 6 and 7)", () => {
  it("answers 200 with a body that carries no provider id", async () => {
    const { response, raw } = await submit();
    expect(response.status).toBe(200);
    expect(raw).toBe('{"ok":true}');
  });

  it("resolves from and to from content when nothing is overridden", async () => {
    const { impl } = await submit();
    const sent = requestBodyOf(callsTo(impl, RESEND_SEND_URL)[0]!);

    expect(sent.from).toBe(`"${site.brand.name.en}" <${site.email.fromAddress}>`);
    expect(sent.to).toStrictEqual([site.contact.email]);
  });

  it("lets the environment override win, which is how Preview reaches a test inbox", async () => {
    vi.stubEnv("INQUIRY_TO_EMAIL", "preview@example.com");
    vi.stubEnv("INQUIRY_FROM_EMAIL", "onboarding@resend.dev");

    const { impl } = await submit();
    const sent = requestBodyOf(callsTo(impl, RESEND_SEND_URL)[0]!);

    expect(sent.to).toStrictEqual(["preview@example.com"]);
    expect(sent.from).toBe(`"${site.brand.name.en}" <onboarding@resend.dev>`);
  });

  it("sets reply_to to the address that passed validation, normalised", async () => {
    const { impl } = await submit({ overrides: { email: "  Wei.Chen@Example.COM " } });
    expect(requestBodyOf(callsTo(impl, RESEND_SEND_URL)[0]!).reply_to).toBe("wei.chen@example.com");
  });

  it("tags the message with the source and the submitter's locale", async () => {
    const { impl } = await submit({ overrides: { source: "enroll", locale: "zh-Hant" } });
    expect(requestBodyOf(callsTo(impl, RESEND_SEND_URL)[0]!).tags).toStrictEqual([
      { name: "source", value: "enroll" },
      { name: "locale", value: "zh-Hant" },
    ]);
  });

  it("carries an idempotency key, so a dropped response cannot double-send", async () => {
    const { impl } = await submit();
    const headers = callsTo(impl, RESEND_SEND_URL)[0]?.init?.headers as Record<string, string>;
    expect(headers["idempotency-key"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sends both bodies, with the staff notification in the default locale", async () => {
    const { impl } = await submit({ overrides: { locale: "zh-Hans" } });
    const sent = requestBodyOf(callsTo(impl, RESEND_SEND_URL)[0]!);

    expect(String(sent.text)).toContain("New tour request");
    expect(String(sent.html)).toContain("<table");
    // The parent's own language travels with the request instead.
    expect(String(sent.text)).toContain("简体中文");
  });

  it("answers 502 email_failed when the provider refuses", async () => {
    const { response, body } = await submit({ network: { resend: 422 } });
    expect(response.status).toBe(502);
    expect(body).toStrictEqual({ ok: false, code: "email_failed" });
  });

  it("answers 502 when the provider cannot be reached", async () => {
    const { response, body } = await submit({ network: { resend: "unreachable" } });
    expect(response.status).toBe(502);
    expect(body).toStrictEqual({ ok: false, code: "email_failed" });
  });

  it("answers 502 when RESEND_API_KEY is unset — the state this repository ships in", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { response, body } = await submit();
    expect(response.status).toBe(502);
    expect(body).toStrictEqual({ ok: false, code: "email_failed" });
  });
});

/* -------------------------------------------------------------------------- *
 * 8 · Auto-acknowledgement
 * -------------------------------------------------------------------------- */

describe("the acknowledgement (07 §2 step 8)", () => {
  it("is off by default: one message goes out, to the daycare", async () => {
    const { impl } = await submit();
    expect(callsTo(impl, RESEND_SEND_URL)).toHaveLength(1);
  });

  it("sends a second message to the parent when INQUIRY_AUTOACK=1", async () => {
    vi.stubEnv("INQUIRY_AUTOACK", "1");
    const { response, impl } = await submit();

    expect(response.status).toBe(200);
    const sends = callsTo(impl, RESEND_SEND_URL);
    expect(sends).toHaveLength(2);
    expect(requestBodyOf(sends[1]!).to).toStrictEqual(["wei.chen@example.com"]);
  });

  it("renders the acknowledgement in the parent's locale", async () => {
    vi.stubEnv("INQUIRY_AUTOACK", "1");
    const { impl } = await submit({ overrides: { locale: "zh-Hant" } });
    const ack = requestBodyOf(callsTo(impl, RESEND_SEND_URL)[1]!);
    expect(String(ack.from)).toContain(site.brand.name["zh-Hant"]);
  });

  it("never lets an acknowledgement failure reach the parent's browser", async () => {
    vi.stubEnv("INQUIRY_AUTOACK", "1");
    let call = 0;
    const impl: typeof fetch = (input) => {
      if (urlOf(input) === TURNSTILE_VERIFY_URL) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              action: "inquiry",
              hostname: "greenpasturesdaycare.com",
            }),
          ),
        );
      }
      call += 1;
      return call === 1
        ? Promise.resolve(new Response(JSON.stringify({ id: "ok" })))
        : Promise.reject(new Error("ack failed"));
    };

    const response = await handleInquiry(jsonRequest(rawSubmission()), {
      fetchImpl: impl,
      now: () => NOW,
    });
    expect(response.status).toBe(200);
  });
});

/* -------------------------------------------------------------------------- *
 * 9 · Responding
 * -------------------------------------------------------------------------- */

describe("the response (07 §2 step 9)", () => {
  it("redirects a URL-encoded submission back to the section, whatever happened", async () => {
    const impl = fakeFetch();
    const response = await handleInquiry(formRequest(rawSubmission({ locale: "zh-Hant" })), {
      fetchImpl: impl,
      now: () => NOW,
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/zh-Hant#visit");
  });

  it("redirects a failed URL-encoded submission to the same place", async () => {
    const response = await handleInquiry(formRequest(rawSubmission({ email: "" })), {
      now: () => NOW,
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/en#visit");
  });

  it("builds the redirect with no slash before the fragment (06 D-06.6, ADJ-21)", () => {
    for (const locale of routing.locales) {
      expect(visitSectionHref(locale)).toBe(`/${locale}#visit`);
      expect(visitSectionHref(locale)).not.toContain("/#");
    }
  });

  it("is never cached", async () => {
    const { response } = await submit();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

/* -------------------------------------------------------------------------- *
 * Logging
 * -------------------------------------------------------------------------- */

describe("the structured log (07 §2 *Logging*, INV-07.5)", () => {
  it("writes one line carrying the fields the doc lists", async () => {
    await submit({ overrides: { source: "enroll", childAge: "infant", desiredStart: "2026-10" } });

    expect(logLine()).toMatchObject({
      event: "inquiry.request",
      requestId: "req-1",
      outcome: "accepted",
      status: 200,
      locale: "en",
      source: "enroll",
      childAge: "infant",
      desiredStart: "2026-10",
      transport: "resend",
      resendId: "resend-message-id",
    });
    expect(logLine()).toHaveProperty("durationMs");
  });

  it("never writes the name, the address, the message, the IP or the token", async () => {
    await submit({ overrides: { parentName: "Wei Chen", message: "a secret" } });

    const everything = [...consoleInfo.mock.calls, ...consoleError.mock.calls]
      .map((call) => String(call[0]))
      .join("\n");

    for (const secret of [
      "Wei Chen",
      "wei.chen@example.com",
      "a secret",
      "203.0.113.7",
      "turnstile-token",
    ]) {
      expect(everything).not.toContain(secret);
    }
  });

  it("keeps PII out of the log on the failure paths too", async () => {
    await submit({ network: { resend: 500 } });
    const line = JSON.stringify(logLine());
    expect(line).not.toContain("Wei Chen");
    expect(logLine()).toMatchObject({ outcome: "failed", code: "email_failed", status: 502 });
  });

  it("names the outcome for each guard", async () => {
    await submit({ headers: { "content-type": "text/plain" } });
    expect(logLine()).toMatchObject({ outcome: "rejected", status: 415, code: "forbidden" });

    await submit({ overrides: { email: "" } });
    expect(logLine()).toMatchObject({ outcome: "invalid", status: 400 });

    await submit({ network: { turnstile: "unreachable" } });
    expect(logLine()).toMatchObject({ outcome: "unavailable", status: 503 });
  });
});

describe("idempotency across a retry (INV-07.7)", () => {
  it("gives an identical resubmission the same key and an edited one a new key", async () => {
    const first = await submit();
    const same = await submit();
    const edited = await submit({ overrides: { message: "changed my mind" } });

    const keyOf = (result: Awaited<ReturnType<typeof submit>>) =>
      (callsTo(result.impl, RESEND_SEND_URL)[0]?.init?.headers as Record<string, string>)[
        "idempotency-key"
      ];

    expect(keyOf(same)).toBe(keyOf(first));
    expect(keyOf(edited)).not.toBe(keyOf(first));
  });

  it("uses the mount time the client sent, not the moment the request landed", async () => {
    const { response } = await submit({ overrides: { startedAt: String(STARTED_AT) } });
    expect(response.status).toBe(200);
  });
});
