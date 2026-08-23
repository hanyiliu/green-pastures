import { RESEND_SEND_URL } from "@/lib/inquiry/server/transport";
import { TURNSTILE_ACTION, TURNSTILE_VERIFY_URL } from "@/lib/inquiry/turnstile";

/**
 * Shared fixtures for the inquiry suite (07 §8).
 *
 * Two things every handler test needs and none should spell twice: a wire
 * payload that passes the schema, and a `fetch` that answers Cloudflare and
 * Resend without either being reachable. `vitest.config.ts` says this endpoint's
 * network is mocked "at the fetch layer" — {@link fakeFetch} is that layer, and
 * it is injected rather than installed globally so one test can make Cloudflare
 * time out while Resend still answers.
 */

/** 12:00 in `America/Los_Angeles`, so the site's day and the UTC day agree. */
export const NOW = new Date("2026-08-23T19:00:00.000Z");

/** A submission that mounted long enough ago to clear the timing floor. */
export const STARTED_AT = NOW.getTime() - 30_000;

export const SUBMISSION_ID = "f81d4fae-7dec-41d0-9525-1d6f0f4a4a10";

export type RawSubmission = Record<string, string>;

/** The wire shape: every value a string, as a URL-encoded body would send it. */
export function rawSubmission(overrides: Partial<RawSubmission> = {}): RawSubmission {
  return {
    parentName: "Wei Chen",
    email: "Wei.Chen@Example.COM",
    childAge: "toddler",
    desiredStart: "asap",
    message: "We would love to see the toddler room.",
    locale: "en",
    source: "home",
    submissionId: SUBMISSION_ID,
    startedAt: String(STARTED_AT),
    website: "",
    "cf-turnstile-response": "turnstile-token",
    ...overrides,
  };
}

const SAME_ORIGIN_HEADERS: Record<string, string> = {
  host: "greenpasturesdaycare.com",
  origin: "https://greenpasturesdaycare.com",
  "sec-fetch-site": "same-origin",
  "x-real-ip": "203.0.113.7",
};

export function jsonRequest(
  payload: unknown,
  headers: Record<string, string> = {},
  init: RequestInit = {},
): Request {
  return new Request("https://greenpasturesdaycare.com/api/inquiry", {
    method: "POST",
    headers: { ...SAME_ORIGIN_HEADERS, "content-type": "application/json", ...headers },
    body: JSON.stringify(payload),
    ...init,
  });
}

export function formRequest(payload: RawSubmission, headers: Record<string, string> = {}): Request {
  return new Request("https://greenpasturesdaycare.com/api/inquiry", {
    method: "POST",
    headers: {
      ...SAME_ORIGIN_HEADERS,
      "content-type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams(payload).toString(),
  });
}

export type FakeFetchOptions = {
  /** What Cloudflare answers. `"unreachable"` throws, as an outage does. */
  readonly turnstile?: Record<string, unknown> | "unreachable" | number;
  /** What Resend answers. A number is an HTTP status; `"unreachable"` throws. */
  readonly resend?: Record<string, unknown> | "unreachable" | number;
};

/** The calls a fake made, so a test can assert the request body Resend saw. */
export type FetchCall = { readonly url: string; readonly init: RequestInit | undefined };

export type FakeFetch = typeof fetch & { readonly calls: FetchCall[] };

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A `fetch` that knows only Cloudflare and Resend, and refuses anything else. */
export function fakeFetch(options: FakeFetchOptions = {}): FakeFetch {
  const calls: FetchCall[] = [];

  const impl: typeof fetch = (input, init) => {
    const url = urlOf(input);
    calls.push({ url, init });

    if (url === TURNSTILE_VERIFY_URL) {
      const answer = options.turnstile ?? {
        success: true,
        action: TURNSTILE_ACTION,
        hostname: "greenpasturesdaycare.com",
      };
      if (answer === "unreachable") return Promise.reject(new Error("network"));
      if (typeof answer === "number") return Promise.resolve(jsonResponse({}, answer));
      return Promise.resolve(jsonResponse(answer));
    }

    if (url === RESEND_SEND_URL) {
      const answer = options.resend ?? { id: "resend-message-id" };
      if (answer === "unreachable") return Promise.reject(new Error("network"));
      if (typeof answer === "number") return Promise.resolve(jsonResponse({}, answer));
      return Promise.resolve(jsonResponse(answer));
    }

    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  };

  return Object.assign(impl, { calls });
}

/** The body a fake `fetch` call carried, parsed. */
export function requestBodyOf(call: FetchCall): Record<string, unknown> {
  const body = call.init?.body;
  if (typeof body !== "string") throw new Error("that call carried no JSON body");
  return JSON.parse(body) as Record<string, unknown>;
}

/** The URL of a `fetch` call, in any of the three shapes the signature allows. */
export function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}
