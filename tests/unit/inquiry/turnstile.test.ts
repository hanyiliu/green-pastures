import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routing } from "@/i18n/routing";
import {
  TURNSTILE_ACTION,
  TURNSTILE_LANGUAGE,
  TURNSTILE_SCRIPT_URL,
  TURNSTILE_VERIFY_URL,
} from "@/lib/inquiry/turnstile";
import { isTurnstileTestingSecret } from "@/lib/inquiry/server/env";
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

/* -------------------------------------------------------------------------- *
 * The testing-secret seam (`gp-dln.232`)
 * -------------------------------------------------------------------------- */

/**
 * Cloudflare's published testing secrets, and the answers it actually gives
 * them.
 *
 * The payloads are transcribed from a live `siteverify` call rather than
 * imagined [verified 2026-08-24, any token string]. The load-bearing detail is
 * the one PR-5.8's mocked `fetch` never saw: a testing secret's success carries
 * **no `action` key at all** and the fixed hostname `example.com`, so both echo
 * checks reject it and the form's happy path was unreachable in every
 * environment 07 §5 describes.
 */
const ALWAYS_PASSES = "1x0000000000000000000000000000000AA";
const ALWAYS_FAILS = "2x0000000000000000000000000000000AA";
const ALREADY_SPENT = "3x0000000000000000000000000000000AA";

const CLOUDFLARE_TESTING_PASS = {
  success: true,
  "error-codes": [],
  hostname: "example.com",
  challenge_ts: "2026-08-24T19:06:27.620Z",
  metadata: { result_with_testing_key: true },
};

/**
 * A secret shaped like the real thing. Turnstile's production secrets begin
 * `0x4AAAAAAA`, which is a different prefix from any testing one — but nothing
 * in the code reads the prefix, and this value is here only to stand for "the
 * secret an operator pastes out of the Cloudflare dashboard".
 */
const PRODUCTION_SECRET = "0x4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("the published testing secrets (07 §5)", () => {
  it("recognises exactly Cloudflare's three and nothing else", () => {
    expect(isTurnstileTestingSecret(ALWAYS_PASSES)).toBe(true);
    expect(isTurnstileTestingSecret(ALWAYS_FAILS)).toBe(true);
    expect(isTurnstileTestingSecret(ALREADY_SPENT)).toBe(true);
  });

  /**
   * The near-misses, which are the whole security surface of the seam: anything
   * an operator could plausibly hold that is *not* one of the three published
   * values must key the seam shut. A prefix or suffix match, a case fold or a
   * pattern would each turn "is this the public test value" into something an
   * attacker could aim at.
   */
  it.each([
    ["a production secret", PRODUCTION_SECRET],
    ["the testing secret with a suffix", `${ALWAYS_PASSES}B`],
    ["the testing secret with a prefix", `X${ALWAYS_PASSES}`],
    ["the testing secret lower-cased", ALWAYS_PASSES.toLowerCase()],
    ["the testing secret upper-cased", ALWAYS_PASSES.toUpperCase()],
    ["the published *site* key, which is not a secret", "1x00000000000000000000AA"],
    ["a fourth digit nobody published", "4x0000000000000000000000000000000AA"],
    ["an empty string", ""],
  ])("does not recognise %s", (_label, secret) => {
    expect(isTurnstileTestingSecret(secret)).toBe(false);
  });
});

describe("verifyTurnstile under a published testing secret", () => {
  it("passes Cloudflare's real testing answer, which carries no action at all", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", ALWAYS_PASSES);
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: fakeFetch({ turnstile: CLOUDFLARE_TESTING_PASS }),
    });
    expect(outcome).toStrictEqual({ status: "passed", hostname: "example.com" });
  });

  it("still requires success — the 2x secret fails, as OPS-7.2 expects", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", ALWAYS_FAILS);
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

  it("still requires success — the 3x secret's spent token fails", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", ALREADY_SPENT);
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: fakeFetch({
        turnstile: { success: false, "error-codes": ["timeout-or-duplicate"] },
      }),
    });
    expect(outcome).toStrictEqual({ status: "failed", errorCodes: ["timeout-or-duplicate"] });
  });

  it("still fails closed on an outage", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", ALWAYS_PASSES);
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: fakeFetch({ turnstile: "unreachable" }),
    });
    expect(outcome).toStrictEqual({ status: "unavailable", errorCodes: ["fetch-failed"] });
  });
});

/**
 * The other half of the same change, and the one that matters: with a secret
 * that is not on Cloudflare's published list, every case above is answered by
 * the code that shipped before `gp-dln.232`.
 *
 * Each case feeds the *testing* payload — the one the seam accepts — to a
 * *production* secret, so a regression that keyed the relaxation on anything
 * looser than an exact match fails here rather than in a parent's inbox.
 */
describe("verifyTurnstile with a real secret is unchanged (INV-07.6)", () => {
  it.each([
    ["a production secret", PRODUCTION_SECRET],
    ["the testing secret with a suffix", `${ALWAYS_PASSES}B`],
    ["the testing secret with a prefix", `X${ALWAYS_PASSES}`],
    ["the testing secret lower-cased", ALWAYS_PASSES.toLowerCase()],
    ["the published site key mistaken for a secret", "1x00000000000000000000AA"],
  ])("rejects the missing action under %s", async (_label, secret) => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", secret);
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: fakeFetch({ turnstile: CLOUDFLARE_TESTING_PASS }),
    });
    expect(outcome).toStrictEqual({ status: "failed", errorCodes: ["action-mismatch"] });
  });

  it("rejects a foreign hostname even when the action is ours", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", PRODUCTION_SECRET);
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: fakeFetch({ turnstile: passing({ hostname: "evil.example" }) }),
    });
    expect(outcome).toStrictEqual({ status: "failed", errorCodes: ["hostname-mismatch"] });
  });

  it("rejects a foreign action even when the hostname is ours", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", PRODUCTION_SECRET);
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: fakeFetch({ turnstile: passing({ action: "newsletter" }) }),
    });
    expect(outcome).toStrictEqual({ status: "failed", errorCodes: ["action-mismatch"] });
  });

  it("still passes a response that echoes both of ours", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", PRODUCTION_SECRET);
    const outcome = await verifyTurnstile({
      token: "t",
      remoteIp: undefined,
      expectedHosts: HOSTS,
      fetchImpl: fakeFetch({ turnstile: passing() }),
    });
    expect(outcome).toStrictEqual({ status: "passed", hostname: HOSTS[0] });
  });
});
