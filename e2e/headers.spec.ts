import { expect, test } from "@playwright/test";

import { routing } from "../src/i18n/routing";

/**
 * The security-header and image-format gate (PR-6.11 · 06 §6.9 · 09 `D-09.18` ·
 * 08 §5 `@headers`).
 *
 * `next.config.ts` is the only place these headers are declared, and a header
 * declared in a config file and asserted nowhere is a header that survives
 * exactly until someone reformats the file. This spec is the assertion.
 *
 * **The expected values below are literals on purpose.** Importing them from
 * `next.config.ts` would make every test here a tautology — the file would be
 * compared to itself and any edit, including deleting the whole block, would
 * still be green. They are transcribed from `D-09.18` instead, so a drift
 * between the config and the decision is a red run and not a shrug. (The
 * *locale* is not a literal: INV-06.2 keeps locale ids inside `src/i18n/`, and
 * 08 §5 scopes this tag to one URL rather than the per-locale matrix, so the
 * one URL is the default locale's home page.)
 *
 * Not `e2e/smoke*` and not `e2e/routes*`: PR-3.6 owns the first and PR-6.10 the
 * second, and 10 §7's rule is that a later PR extends a family rather than
 * editing it. 08 §10 currently spells this tag's home as `e2e/routes*`; 10 §14
 * (iv) already records that the launch checklist's spelling and the plan's are
 * not the same words, and this file is one more input to that reconciliation.
 * Nothing depends on the file name — `lighthouse-prod` selects by tag.
 */

/**
 * 08 §5 `@headers`: "response headers on `/en`". `routing.defaultLocale` is
 * what `/en` means, spelled the way INV-06.2 requires.
 */
const REFERENCE_URL = `/${routing.defaultLocale}`;

/**
 * The run's own origin, resolved exactly as `playwright.config.ts` resolves
 * `baseURL` — `PLAYWRIGHT_BASE_URL` when a job points the suite at a deployment
 * (that is how `lighthouse-prod` re-runs this tag against production), the
 * local `next start` otherwise. Read here rather than from the `baseURL`
 * fixture because the HSTS pair below has to branch at *collection* time.
 */
const REFERENCE_ORIGIN =
  process.env["PLAYWRIGHT_BASE_URL"] ??
  `http://localhost:${process.env["PLAYWRIGHT_PORT"] ?? 3000}`;

/**
 * 09 `D-09.18`, transcribed. Keys are lower-cased because that is how both
 * Playwright's `response.headers()` and HTTP/2 present them.
 *
 * `strict-transport-security` is **not** here. `D-09.18` keeps Vercel's default
 * rather than minting one in `next.config.ts`, so under the plain-HTTP
 * `next start` of `D-08.7` there is nothing to observe — which is what 08 §5's
 * "HSTS on Vercel" means. The HSTS test below has two halves rather than a
 * skip: over TLS the header must be there, and over plain HTTP it must be
 * absent, which is how "kept, not minted here" stays true.
 */
const EXPECTED_HEADERS: ReadonlyMap<string, string> = new Map([
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["permissions-policy", "camera=(), microphone=(), geolocation=()"],
  ["content-security-policy", "frame-ancestors 'none'"],
]);

/**
 * "On every route" (`D-09.18`) is meant literally, so the set below is not one
 * URL but the four shapes a response out of this app can have. Each one is here
 * because a plausible `source` pattern drops exactly it:
 *
 *   - **the bare root**, whose response is the proxy's 307 (`D-06.5`) — the
 *     shape `source: '/:path+'` loses, because `+` needs a segment where `*`
 *     accepts none. Followed redirects would hide it, so this one is requested
 *     with `maxRedirects: 0`;
 *   - **a prerendered page**, the ordinary case and the only one 08 §5 names;
 *   - **a 404**, which `D-06.4` will make the `ƒ Dynamic` catch-all in Phase 6
 *     and which is the root `not-found` until then — either way the one page
 *     rendered on demand;
 *   - **a Route Handler**, `/api/inquiry`, whose 405 to a `GET` is 06 §6.10's
 *     own row and is a response Next composes without a page at all.
 *
 * `/_next/image` is deliberately absent: Next's optimizer sets its own, stricter
 * `Content-Security-Policy: script-src 'none'; frame-src 'none'; sandbox;`, and
 * a later matching header wins [verified: `next.config.js` `headers` docs,
 * "Header Overriding Behavior", Next 16.3.2]. Asserting `frame-ancestors` there
 * would demand that we weaken the framework's own sandbox to satisfy a test.
 */
const ROUTE_SHAPES: readonly {
  readonly label: string;
  readonly url: string;
  readonly maxRedirects?: number;
}[] = [
  { label: "the bare root's locale redirect", url: "/", maxRedirects: 0 },
  { label: "a prerendered page", url: REFERENCE_URL },
  { label: "the 404", url: `${REFERENCE_URL}/no-such-page` },
  { label: "the inquiry route handler", url: "/api/inquiry" },
];

test.describe("security headers", () => {
  for (const shape of ROUTE_SHAPES) {
    test(`${shape.label} carries the D-09.18 set @headers`, async ({ request }) => {
      const response = await request.get(shape.url, {
        failOnStatusCode: false,
        ...(shape.maxRedirects === undefined ? {} : { maxRedirects: shape.maxRedirects }),
      });
      const headers = response.headers();

      for (const [key, value] of EXPECTED_HEADERS) {
        expect(headers[key], `${shape.url} is missing or misspells ${key}`).toBe(value);
      }
    });
  }

  test("the reference page does not announce the framework @headers", async ({ request }) => {
    // 06 §6.9's `poweredByHeader: false`. Asserted as absence rather than as a
    // value, because the defect this catches is the option being dropped, and
    // the header Next then adds carries its version number.
    const response = await request.get(REFERENCE_URL);

    expect(response.headers()["x-powered-by"]).toBeUndefined();
  });

  /**
   * HSTS, in the only two forms it can take — and **not** as a skip.
   *
   * `D-09.18` keeps Vercel's HSTS rather than minting one here, so the header
   * exists on a deployment and cannot exist over the plain-HTTP `next start` of
   * `D-08.7`. A `test.skip` on the local run would leave a gate that never
   * fires anywhere a developer can see it. Both halves assert instead:
   *
   *  - over TLS — `lighthouse-prod` against the production base URL (08 §10,
   *    09 §12.3 item 9) — the header must be on the response;
   *  - over plain HTTP it must be **absent**, which is what "kept, not minted
   *    here" means as an observable. A `Strict-Transport-Security` appearing on
   *    `next start` could only have come from `next.config.ts`, i.e. a
   *    `max-age` nobody reviewed now overriding the platform's, and that reds
   *    on every PR rather than on the launch checklist.
   *
   * The branch is at collection time and not inside a test body, so exactly one
   * of the two tests exists in a run and neither carries a conditional
   * assertion. `PLAYWRIGHT_BASE_URL` is the same variable `playwright.config.ts`
   * resolves `baseURL` from, read the same way.
   */
  const OVER_TLS = new URL(REFERENCE_ORIGIN).protocol === "https:";

  if (OVER_TLS) {
    test("HSTS is on the response, as the platform's default @headers", async ({ request }) => {
      const response = await request.get(REFERENCE_URL);

      expect(response.headers()["strict-transport-security"]).toMatch(/max-age=\d+/);
    });
  } else {
    test("HSTS is nobody's over plain HTTP — this config mints none @headers", async ({
      request,
    }) => {
      const response = await request.get(REFERENCE_URL);

      expect(response.headers()["strict-transport-security"]).toBeUndefined();
    });
  }
});

/**
 * 06 §6.9's `images: { formats: ['image/avif', 'image/webp'] }`, which is
 * observable in exactly one place — the `Content-Type` the optimizer answers a
 * given `Accept` with.
 *
 * Both formats in one test, and no browser. The URL is lifted out of the served
 * HTML rather than composed here, because `/_next/image?url=…&w=…&q=…` has to
 * satisfy the loader's own `deviceSizes` and `qualities` allowlists and a
 * hand-built query outside them would 400 and read as a format failure. Lifting
 * it from the document keeps that honest without a page load: `request` sees
 * the same markup the browser would, and skipping the browser also takes the
 * first (cold, ≈ 10 s) AVIF encode off a parallel worker's clock instead of
 * paying it twice.
 */
test.describe("image optimization", () => {
  test("answers AVIF or WebP by Accept, in that order @headers", async ({ request }) => {
    const html = await (await request.get(REFERENCE_URL)).text();
    const match = /\/_next\/image\?[^"'\s]+/.exec(html);

    expect(
      match,
      `${REFERENCE_URL} renders no next/image, so images.formats is unobservable — ` +
        "this gate needs a page that uses the optimizer (06 §6.9)",
    ).not.toBeNull();

    // `srcset`/`src` arrive HTML-escaped; `&amp;` is the only entity Next emits
    // into these URLs, and an un-decoded one would make the whole query a
    // single malformed parameter.
    const optimized = (match?.[0] ?? "").replaceAll("&amp;", "&");

    const avif = await request.get(optimized, {
      headers: { accept: "image/avif,image/webp,*/*" },
    });
    expect(avif.status()).toBe(200);
    expect(avif.headers()["content-type"]).toBe("image/avif");

    // The second entry, and the reason the array has two: Next resolves the
    // request's `Accept` against it in order, so an AVIF-only config would hand
    // this client the original PNG instead of falling back.
    const webp = await request.get(optimized, { headers: { accept: "image/webp,*/*" } });
    expect(webp.status()).toBe(200);
    expect(webp.headers()["content-type"]).toBe("image/webp");
  });
});
