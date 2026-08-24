/**
 * Lighthouse CI — the transfer-side half of the performance budgets (PR-8.5).
 *
 * Specification: `docs/technical/08-testing-quality.md` §7 (every assertion
 * below is quoted from it, and none is this file's invention), §10 (the
 * `lighthouse-preview` and `lighthouse-prod` rows), D-08.9 (the preview URL
 * comes from the `deployment_status` payload) and 09 D-09.4 (previews are
 * protected, so the run carries a bypass header).
 *
 * ## Why this file and not a local byte count
 *
 * 08 §7: "Bundle weight is measured where it is real — the preview's transfer
 * sizes — not re-implemented locally." A build machine has no CDN, no
 * negotiated encoding and no compressor settings, so a transfer budget asserted
 * there is a guess. `pnpm check:budget` takes the half a build directory can
 * decide — font bytes, image bytes, third-party origins, first-load growth —
 * and this file takes the half that only a deployment can answer.
 *
 * ## The matrix, and why it is not a list of URLs
 *
 * INV-08.4: nothing in the matrix is hard-coded per locale. The enabled locales
 * are read from `src/i18n/routing.ts` and the routes from `content/site.json`,
 * so enabling `zh-Hant` or withdrawing it (D-10.12) changes what Lighthouse
 * visits without anybody editing this file. Both readers fail loudly rather
 * than yielding an empty list: a URL matrix that silently collapses to nothing
 * is a Lighthouse run that passes every assertion by measuring no page, which
 * is the failure shape this repository has catalogued seven times.
 *
 * `LHCI_MATRIX` picks which of 08 §7's three runs this invocation is:
 *
 * | value | URLs | runs | 08 §7's words |
 * |---|---|---|---|
 * | `preview` | every home + `/zh-Hans/programs` | 3 | "four URLs, `numberOfRuns: 3`, advisory" |
 * | `prod-home` | every home | 3 | "`numberOfRuns: 3` on the three home URLs, where LCP and CLS are the numbers that matter" |
 * | `prod-detail` | every route x locale | 1 | "`numberOfRuns: 1` on the eighteen detail-page URLs" |
 *
 * `LHCI_PRESET` is `mobile` (the default, and the only preset the preview run
 * uses) or `desktop`; the production job runs every URL on both, which is why
 * the two production values are separate invocations rather than one config.
 *
 * `LHCI_BASE_URL` is the deployment under test — on `deployment_status` that is
 * `github.event.deployment_status.target_url` (D-08.9).
 */

const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const repoRoot = __dirname;

/** Fail the run rather than measure nothing. See the header. */
const die = (message) => {
  throw new Error(`lighthouserc: ${message}`);
};

/**
 * The enabled locales, read from the one file allowed to declare them
 * (02 D-02.1, INV-08.4). This config is CommonJS because Lighthouse CI loads it
 * with `require`, so it cannot import the TypeScript module and reads the
 * declaration out of the source instead — the same move the token-parity test
 * makes against `tokens.css`. The guard below is the whole reason that is safe:
 * a `routing.ts` this regex stops understanding produces an error, never an
 * empty locale list.
 */
const enabledLocales = () => {
  const source = readFileSync(join(repoRoot, "src", "i18n", "routing.ts"), "utf8");
  const block = /\blocales:\s*\[([^\]]*)\]/.exec(source);
  if (block === null) {
    die("could not find `locales: [...]` in src/i18n/routing.ts, so the URL matrix would be empty");
  }
  const locales = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (locales.length === 0) {
    die("src/i18n/routing.ts declares no enabled locale, so there is nothing to measure");
  }
  return locales;
};

/** The detail routes, from the file that owns them (`site.json.routes[]`). */
const detailRoutes = () => {
  const site = JSON.parse(readFileSync(join(repoRoot, "content", "site.json"), "utf8"));
  const routes = Array.isArray(site.routes) ? site.routes.map((r) => r.path) : [];
  if (routes.length === 0) {
    die("content/site.json declares no routes[], so the production matrix would be empty");
  }
  return routes;
};

const baseUrl = (process.env.LHCI_BASE_URL ?? "").replace(/\/+$/, "");
if (baseUrl === "") {
  die("LHCI_BASE_URL is unset. On `deployment_status` it is the payload's target_url (D-08.9).");
}

const matrix = process.env.LHCI_MATRIX ?? "preview";
const locales = enabledLocales();
const homes = locales.map((locale) => `${baseUrl}/${locale}`);

let urls;
let numberOfRuns;
switch (matrix) {
  case "preview":
    // 08 §7: the homes plus one CJK-heavy detail page. `zh-Hans` is named there
    // by id; it is taken from the enabled list so a withdrawal cannot leave a
    // dead URL behind.
    urls = [...homes];
    if (locales.includes("zh-Hans")) urls.push(`${baseUrl}/zh-Hans/programs`);
    numberOfRuns = 3;
    break;
  case "prod-home":
    urls = homes;
    numberOfRuns = 3;
    break;
  case "prod-detail":
    urls = locales.flatMap((locale) => detailRoutes().map((path) => `${baseUrl}/${locale}${path}`));
    numberOfRuns = 1;
    break;
  default:
    die(`LHCI_MATRIX="${matrix}" is not one of preview, prod-home, prod-detail`);
}

if (urls.length === 0) {
  die(`the ${matrix} matrix resolved to no URL, so the run would assert nothing`);
}

/**
 * 08 §7's assertions, verbatim, with `aggregationMethod: median` as that
 * section requires. `error` unless the row says otherwise.
 *
 * `resource-summary:*:size` takes `maxNumericValue` in **bytes** — only a
 * `budgetsFile` is written in KiB [verified: LHCI assertion docs, 2026-08-22] —
 * so the four numbers below are bytes, and `pnpm check:budget` asserts the two
 * a build directory can decide against the same constants.
 */
const median = (options) => ["error", { aggregationMethod: "median", ...options }];
const medianWarn = (options) => ["warn", { aggregationMethod: "median", ...options }];

/* ------------------------------------------------------------------------- *
 * The script-transfer budget, which is per route (08 §7)
 * ------------------------------------------------------------------------- */

/**
 * `resource-summary:script:size`, in bytes, by the kind of route.
 *
 * It is two numbers rather than one because the two kinds of page do not carry
 * the same *first load*: `/{locale}` is the only route that renders the inquiry
 * form, so it is the only route whose own graph contains Zod — 795,572 bytes
 * against a detail page's 634,809. One number for both would either be the home
 * figure, under which the detail pages sit 160 KB inside it and stop being
 * gated in any meaningful sense, or the detail figure, which home cannot meet
 * without deleting client-side validation (07 D-07.3 shares one schema between
 * client and handler, so the client is not free to skip it).
 *
 * 08 §7 records the thing this split does not fix, and it belongs here too: a
 * detail page *fetches* more than its first load, because after hydration the
 * router prefetches `/` and home's route chunk arrives with it. `detail` is a
 * live miss for that reason, kept rather than relaxed.
 */
const SCRIPT_TRANSFER_BYTES = {
  /**
   * 225 KiB, `/{locale}`. Measured on 2026-08-24 at 481d193 with the Zod patch
   * in `patches/zod@4.4.3.patch` applied: **211,282 bytes brotli-11** over the
   * thirteen scripts of `/en` (795,572 raw, 243,800 gzip-9), and that is exactly
   * the set Lighthouse fetches, so it is a budget stated against what the
   * assertion sees.
   *
   * The 19,118 bytes above the measurement are two things, not one. About 7,500
   * is unit conversion rather than headroom: Lighthouse's transfer figure ran
   * 3.1–3.5 % above the same local sum on both builds measured that day
   * (284,120 against 275,614 before the patch, 252,216 against 243,800 after,
   * gzip on both sides), because it counts response headers and the server's
   * compressor is not this one. The remaining ≈ 12 KiB is deliberately on the
   * generous side of the ratchet's calibration, because one term in it is not a
   * regression at all: the CDN's brotli quality is not knowable from here and
   * can only be *lower* than 11, which makes the real transfer figure larger
   * than the number above by an amount nobody has measured yet. What is left
   * still brackets the way `FIRST_LOAD_CEILINGS` does — at this tree's brotli
   * ratio (26.6 %) an ordinary pull request, 08 §7's ≈ 1.2 KiB uncompressed,
   * costs ≈ 0.3 KiB of transfer, while swapping `domAnimation` for `domMax` in
   * `LazyMotion` costs 49.0 KiB uncompressed ≈ 13 KiB of transfer and does not
   * fit. A library arriving in the client graph still reds this; a season of
   * ordinary feature work does not. Re-record it against a real deployment once
   * one has been measured.
   */
  home: 230_400,
  /**
   * 180 KiB, every other route — 08 §7's original figure, kept rather than
   * relaxed. A detail page's own first load is 171,413 bytes brotli-11 (174,406
   * for `/gallery`), 13 KB inside the budget; what it actually fetches is
   * 211,928, because of the prefetch described above. The number stays because
   * the fix for that is on the prefetch side, and because a budget reset to
   * whatever the site scores today is the shape this file's header names.
   */
  detail: 184_320,
};

/** For building a URL pattern out of a base URL that is full of regex syntax. */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const localeAlternation = locales.map(escapeRegExp).join("|");

/**
 * Which of the two budgets a URL is held to, as the regex `matchingUrlPattern`
 * that LHCI tests against `lhr.finalUrl` [verified: `@lhci/utils` 0.15.1,
 * `doesLHRMatchPattern`]. Both are built from `locales`, so INV-08.4 holds here
 * as it does for the matrix: enabling or withdrawing a locale changes which
 * URLs land in which bucket without anybody editing this file.
 *
 * `/{locale}` with nothing after it is home; `/{locale}/anything` is a detail
 * page. A trailing slash and a query or fragment are tolerated on the home
 * pattern because the run against a protected preview carries
 * `x-vercel-set-bypass-cookie` and a redirect through it must not silently
 * move a URL out of its bucket.
 */
const HOME_URL_PATTERN = `^${escapeRegExp(baseUrl)}/(?:${localeAlternation})/?(?:[?#].*)?$`;
const DETAIL_URL_PATTERN = `^${escapeRegExp(baseUrl)}/(?:${localeAlternation})/[^?#]`;

/**
 * A URL in no bucket is asserted against no script budget, and LHCI says
 * nothing about it: `getAllAssertionResultsForUrl` returns early on an empty
 * LHR set, so a pattern that matches nothing passes silently. That is the
 * fail-open shape this repository keeps cataloguing, so the matrix is checked
 * against the patterns here rather than trusted to match at run time.
 */
for (const url of urls) {
  const buckets = [HOME_URL_PATTERN, DETAIL_URL_PATTERN].filter((pattern) =>
    new RegExp(pattern).test(url),
  );
  if (buckets.length !== 1) {
    die(
      `${url} matches ${String(buckets.length)} of the two script-size patterns and must match exactly one, or it would be measured against no script budget at all (or two).`,
    );
  }
}

module.exports = {
  ci: {
    collect: {
      url: urls,
      numberOfRuns,
      settings: {
        preset: process.env.LHCI_PRESET === "desktop" ? "desktop" : undefined,
        // 09 D-09.4: preview deployments are protected, and this is the only
        // job that touches one. The secret is a repository secret, never a
        // value in this file.
        extraHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
          ? JSON.stringify({
              "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
              "x-vercel-set-bypass-cookie": "true",
            })
          : undefined,
      },
    },
    // `assertMatrix` rather than `assertions` because the script budget is per
    // route. LHCI refuses the two together — "Cannot use assertMatrix with
    // other options" — and refuses a sibling `preset`, `budgetsFile` or
    // top-level `aggregationMethod` as well [verified: `@lhci/utils` 0.15.1].
    // Nothing is lost: `median()` already carries `aggregationMethod` per
    // assertion, which is where 08 §7 wanted it anyway. Every entry runs
    // against every URL, filtered by its own `matchingUrlPattern`, so the
    // entries below are three groups of assertions and not three alternatives.
    assert: {
      assertMatrix: [
        {
          // No `matchingUrlPattern`: everything 08 §7 asserts about every page.
          assertions: {
            "categories:performance": median({ minScore: 0.9 }),
            "categories:accessibility": median({ minScore: 1 }),
            "categories:best-practices": median({ minScore: 0.95 }),
            "categories:seo": median({ minScore: 1 }),

            // **There is no `largest-contentful-paint` row, and the absence is
            // the decision.** It carried `2500` until 2026-08-24; 08 §7's
            // closing paragraph is the record and the evidence. In short:
            // measured at `15beead`, the best LCP any URL in this matrix
            // produced was 3,930 ms, and `/privacy` — the lightest route in the
            // site — sits at 3,533 ms while scoring `categories:performance`
            // 0.90, so the floor is the architecture and not the page. It was
            // removed rather than loosened or downgraded to `warn` because a
            // number left in this table reads as enforcement whatever its
            // severity, and a threshold nothing can fail is the shape the
            // header above already names. LCP is not unwatched: it is a
            // weighted input to `categories:performance`, asserted `error`
            // above and medianing 0.81 today, and the number that governs is
            // the Speed Insights field p75 (08 §7, §12.3; the integration is
            // PR-7.1's).

            // 08 §7: this is Lighthouse's whole-page, cold-load, mobile-emulated
            // CLS and is deliberately looser than the animation budget. The 0.02
            // that 03 §3 fixes for reveals, count-up, loops and the locale toggle
            // is asserted separately and per phase by 08 §5's `@perf` tag, and
            // neither number relaxes the other.
            "cumulative-layout-shift": median({ maxNumericValue: 0.05 }),
            "total-blocking-time": median({ maxNumericValue: 200 }),
            "speed-index": medianWarn({ maxNumericValue: 3400 }),

            "resource-summary:image:size": median({ maxNumericValue: 512000 }),
            "resource-summary:font:size": median({ maxNumericValue: 122880 }),
            "resource-summary:third-party:count": median({ maxNumericValue: 3 }),

            "unsized-images": "error",
            "modern-image-formats": "error",
            "uses-responsive-images": "error",
            "offscreen-images": "error",
            "third-party-summary": "warn",
          },
        },
        {
          matchingUrlPattern: HOME_URL_PATTERN,
          assertions: {
            "resource-summary:script:size": median({
              maxNumericValue: SCRIPT_TRANSFER_BYTES.home,
            }),
          },
        },
        {
          matchingUrlPattern: DETAIL_URL_PATTERN,
          assertions: {
            "resource-summary:script:size": median({
              maxNumericValue: SCRIPT_TRANSFER_BYTES.detail,
            }),
          },
        },
      ],
    },
    upload: {
      // Never `temporary-public-storage`: those reports are public, and this
      // one is taken against a protected preview of an unlaunched site (08 §7).
      target: "filesystem",
      outputDir: ".lighthouseci/reports",
      reportFilenamePattern: "%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%",
    },
  },
};
