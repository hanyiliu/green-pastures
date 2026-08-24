import { randomUUID } from "node:crypto";

import {
  TURNSTILE_ACTION,
  TURNSTILE_TIMEOUT_MS,
  TURNSTILE_VERIFY_URL,
  type TurnstileVerifyResponse,
} from "../turnstile";

import { isTurnstileTestingSecret, turnstileSecretKey } from "./env";

/**
 * Server-side Turnstile verification (07 §2 step 5, `D-07.7`, INV-07.6).
 *
 * Every accepted submission passed a **single-use** token verified here against
 * Cloudflare; there is no production bypass flag. Three conditions must all
 * hold: `success === true`, the echoed `action` is ours, and the echoed
 * `hostname` is one of our hosts. The last two are what stop a token minted by
 * some other widget on some other site from being replayed at this endpoint.
 *
 * **The failure mode is closed.** A network error, a timeout or a non-2xx from
 * Cloudflare returns `unavailable`, which the handler turns into 503 — never a
 * pass. Spam protection that switches itself off during an outage is not spam
 * protection, and this is the one place in the handler where the cautious
 * branch costs a real parent a retry.
 *
 * **The one relaxation, and why it is not a bypass** (`gp-dln.232`). The two
 * echo checks are skipped — and only they — when `TURNSTILE_SECRET_KEY` is
 * literally one of Cloudflare's three published testing secrets
 * ({@link isTurnstileTestingSecret}). They have to be, because Cloudflare's
 * answer to a testing secret carries **no `action` at all** and the fixed
 * hostname `example.com`, so both checks reject it and a genuine successful
 * submission was unreachable in every environment 07 §5 and 08 §5 describe —
 * local development, preview, and the Playwright run that INV-08.7 keeps
 * key-free. `success === true` is still required, so the `2x…` and `3x…` test
 * secrets still fail exactly as OPS-7.2 expects.
 *
 * Production is untouched by construction rather than by intention: with a real
 * secret the condition is false and the code below this point is the code that
 * shipped. And the relaxation grants nothing even where it does apply, because
 * a testing secret already makes `siteverify` answer from the secret and not
 * from the token — a deployment holding one has no spam protection to bypass.
 *
 * Nothing is provisioned. `TURNSTILE_SECRET_KEY` is unset in this repository and
 * belongs to the human's Cloudflare account (09); with it unset this returns
 * `unavailable`, which is the same closed answer as an outage and exactly what
 * should happen when the guard does not exist yet.
 */

export type TurnstileOutcome =
  | { readonly status: "passed"; readonly hostname: string | undefined }
  | { readonly status: "failed"; readonly errorCodes: readonly string[] }
  | { readonly status: "unavailable"; readonly errorCodes: readonly string[] };

export type VerifyTurnstileOptions = {
  readonly token: string;
  /** Vercel's `x-real-ip`. Sent to Cloudflare, never logged (INV-07.5). */
  readonly remoteIp: string | undefined;
  /** The hosts the echoed `hostname` may be one of. */
  readonly expectedHosts: readonly string[];
  /** Injected in tests; production passes nothing and uses the global. */
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
};

function stringsOf(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

export async function verifyTurnstile(options: VerifyTurnstileOptions): Promise<TurnstileOutcome> {
  const secret = turnstileSecretKey();
  if (secret === undefined) {
    return { status: "unavailable", errorCodes: ["missing-secret"] };
  }

  const body = new URLSearchParams({
    secret,
    response: options.token,
    // Cloudflare de-duplicates a retried verification by this key, so a request
    // we send twice cannot burn a single-use token (07 §2 step 5).
    idempotency_key: randomUUID(),
  });
  if (options.remoteIp !== undefined) body.set("remoteip", options.remoteIp);

  const doFetch = options.fetchImpl ?? fetch;

  let payload: TurnstileVerifyResponse;
  try {
    const response = await doFetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(options.timeoutMs ?? TURNSTILE_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { status: "unavailable", errorCodes: [`http-${String(response.status)}`] };
    }
    payload = (await response.json()) as TurnstileVerifyResponse;
  } catch {
    return { status: "unavailable", errorCodes: ["fetch-failed"] };
  }

  const errorCodes = stringsOf(payload["error-codes"]);
  if (payload.success !== true) return { status: "failed", errorCodes };

  const hostname =
    typeof payload.hostname === "string" ? payload.hostname.toLowerCase() : undefined;

  // The two echo checks — the half of this function that stops a token minted
  // by another widget on another site being replayed here. Skipped only under a
  // published testing secret, which cannot be a production one; see the header.
  if (!isTurnstileTestingSecret(secret)) {
    if (payload.action !== TURNSTILE_ACTION) {
      return { status: "failed", errorCodes: [...errorCodes, "action-mismatch"] };
    }

    if (hostname === undefined || !options.expectedHosts.includes(hostname)) {
      return { status: "failed", errorCodes: [...errorCodes, "hostname-mismatch"] };
    }
  }

  return { status: "passed", hostname };
}
