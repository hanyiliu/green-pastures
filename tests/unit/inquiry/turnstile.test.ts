import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routing } from "@/i18n/routing";
import {
  TURNSTILE_ACTION,
  TURNSTILE_LANGUAGE,
  TURNSTILE_SCRIPT_URL,
  TURNSTILE_VERIFY_URL,
} from "@/lib/inquiry/turnstile";
import { verifyTurnstile } from "@/lib/inquiry/server/turnstile";

import { fakeFetch, type FetchCall } from "./fixtures";

/** `siteverify` is form-encoded, so the recorded body is a `URLSearchParams`. */
function searchParamsOf(call: FetchCall | undefined): URLSearchParams {
  const body = call?.init?.body;
  if (!(body instanceof URLSearchParams)) throw new Error("that call was not form-encoded");
  return body;
}

/**
 * Turnstile (07 §1, §2 step 5, INV-07.6; 07 §8: "`turnstile_failed`;
 * `turnstile_unavailable` fails closed").
 *
 * Cloudflare is never reached: `fetch` is injected. No account, widget or
 * secret exists in this repository — `TURNSTILE_SECRET_KEY` is stubbed per test
 * and belongs to the human's Cloudflare account (09).
 */

const HOSTS = ["greenpasturesdaycare.com"];

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function passing(overrides: Record<string, unknown> = {}) {
  return { success: true, action: TURNSTILE_ACTION, hostname: HOSTS[0], ...overrides };
}

describe("the language map (07 §1, INV-02.9)", () => {
  it("has one entry per enabled locale and no others", () => {
    expect(Object.keys(TURNSTILE_LANGUAGE)).toStrictEqual([...routing.locales]);
  });

  it("maps each locale to Cloudflare's own code", () => {
    expect(TURNSTILE_LANGUAGE).toStrictEqual({ en: "en", "zh-Hans": "zh-cn", "zh-Hant": "zh-tw" });
  });

  it("keeps the two Cloudflare endpoints on Cloudflare", () => {
    expect(new URL(TURNSTILE_SCRIPT_URL).hostname).toBe("challenges.cloudflare.com");
    expect(new URL(TURNSTILE_VERIFY_URL).hostname).toBe("challenges.cloudflare.com");
  });
});

describe("verifyTurnstile", () => {
  it("passes when success, action and hostname all agree", async () => {
    const impl = fakeFetch({ turnstile: passing() });
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: "203.0.113.7",
      expectedHosts: HOSTS,
      fetchImpl: impl,
    });
    expect(outcome.status).toBe("passed");
  });

  it("sends the secret, the token, the IP and a fresh idempotency key", async () => {
    const impl = fakeFetch({ turnstile: passing() });
    await verifyTurnstile({
      token: "token-value",
      remoteIp: "203.0.113.7",
      expectedHosts: HOSTS,
      fetchImpl: impl,
    });

    const sent = searchParamsOf(impl.calls[0]);
    expect(sent.get("secret")).toBe("test-secret");
    expect(sent.get("response")).toBe("token-value");
    expect(sent.get("remoteip")).toBe("203.0.113.7");
    expect(sent.get("idempotency_key")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("omits remoteip when the platform did not give one", async () => {
    const impl = fakeFetch({ turnstile: passing() });
    await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: impl,
    });
    expect(searchParamsOf(impl.calls[0]).has("remoteip")).toBe(false);
  });

  it("fails when Cloudflare says the token is bad, and keeps its error codes", async () => {
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: fakeFetch({
        turnstile: { success: false, "error-codes": ["invalid-input-response"] },
      }),
    });
    expect(outcome).toStrictEqual({ status: "failed", errorCodes: ["invalid-input-response"] });
  });

  it("fails on an action from some other widget", async () => {
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: fakeFetch({ turnstile: passing({ action: "newsletter" }) }),
    });
    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.errorCodes).toContain("action-mismatch");
  });

  it("fails on a hostname that is not one of ours", async () => {
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: fakeFetch({ turnstile: passing({ hostname: "evil.example" }) }),
    });
    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.errorCodes).toContain("hostname-mismatch");
  });

  it("compares the hostname without regard to case", async () => {
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: fakeFetch({ turnstile: passing({ hostname: "GreenPasturesDaycare.com" }) }),
    });
    expect(outcome.status).toBe("passed");
  });

  it("fails closed when Cloudflare is unreachable", async () => {
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: fakeFetch({ turnstile: "unreachable" }),
    });
    expect(outcome).toStrictEqual({ status: "unavailable", errorCodes: ["fetch-failed"] });
  });

  it("fails closed on a non-2xx from Cloudflare", async () => {
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: fakeFetch({ turnstile: 502 }),
    });
    expect(outcome).toStrictEqual({ status: "unavailable", errorCodes: ["http-502"] });
  });

  it("fails closed when the secret is not configured — the state we ship in", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const impl = fakeFetch({ turnstile: passing() });
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: impl,
    });
    expect(outcome).toStrictEqual({ status: "unavailable", errorCodes: ["missing-secret"] });
    expect(impl.calls).toHaveLength(0);
  });

  it("never treats an unparseable answer as a pass", async () => {
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: () => Promise.resolve(new Response("not json")),
    });
    expect(outcome.status).toBe("unavailable");
  });
});
