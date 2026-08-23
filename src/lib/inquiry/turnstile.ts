import { type Locale } from "@/i18n/routing";

/**
 * The client-safe half of Cloudflare Turnstile (07 §1, `D-07.7`).
 *
 * Nothing here is a secret: the widget's site key is public and arrives as
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and the values below are constants. The
 * `siteverify` call and `TURNSTILE_SECRET_KEY` live in `./server/turnstile.ts`,
 * which is one of the two trees INV-07.3 lets read a server secret.
 */

/** The lazily-loaded widget script (07 §1 — never in the initial document). */
export const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/** Where the server verifies a token (07 §2 step 5). */
export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * The widget's `action`. Cloudflare echoes it back in the `siteverify`
 * response, and the handler rejects a token whose action is anything else — so
 * a token minted by another widget on another page cannot be replayed here.
 */
export const TURNSTILE_ACTION = "inquiry";

/** Cloudflare's `siteverify` is not slow; five seconds is generous (07 §2). */
export const TURNSTILE_TIMEOUT_MS = 5000;

/**
 * Site locale → Cloudflare's own language code (07 §1).
 *
 * This is the one place in the project where a locale id meets a vendor's code
 * list, so it is a `Record<Locale, string>` — a lookup keyed by locale id,
 * never a `locale === "zh-Hans"` comparison, which INV-02.9 forbids and
 * `eslint.config.mjs` enforces. A missing entry is a TypeScript error, which is
 * how "adding a locale" is caught here rather than in a parent's browser.
 *
 * `zh-tw` carries assumption A-07.7 — confirm it is on Cloudflare's supported
 * list before the Traditional widget faces a real key. It is inert until then:
 * previews and local development use the test pair (07 §5), which ignores the
 * language.
 */
export const TURNSTILE_LANGUAGE: Record<Locale, string> = {
  en: "en",
  "zh-Hans": "zh-cn",
  "zh-Hant": "zh-tw",
};

/** The shape Cloudflare answers `siteverify` with, as far as we read it. */
export type TurnstileVerifyResponse = {
  readonly success?: unknown;
  readonly action?: unknown;
  readonly hostname?: unknown;
  readonly "error-codes"?: unknown;
};
