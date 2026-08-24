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
    assert: {
      assertions: {
        "categories:performance": median({ minScore: 0.9 }),
        "categories:accessibility": median({ minScore: 1 }),
        "categories:best-practices": median({ minScore: 0.95 }),
        "categories:seo": median({ minScore: 1 }),

        // 08 §7: this is Lighthouse's whole-page, cold-load, mobile-emulated
        // CLS and is deliberately looser than the animation budget. The 0.02
        // that 03 §3 fixes for reveals, count-up, loops and the locale toggle
        // is asserted separately and per phase by 08 §5's `@perf` tag, and
        // neither number relaxes the other.
        "largest-contentful-paint": median({ maxNumericValue: 2500 }),
        "cumulative-layout-shift": median({ maxNumericValue: 0.05 }),
        "total-blocking-time": median({ maxNumericValue: 200 }),
        "speed-index": medianWarn({ maxNumericValue: 3400 }),

        "resource-summary:script:size": median({ maxNumericValue: 184320 }),
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
    upload: {
      // Never `temporary-public-storage`: those reports are public, and this
      // one is taken against a protected preview of an unlaunched site (08 §7).
      target: "filesystem",
      outputDir: ".lighthouseci/reports",
      reportFilenamePattern: "%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%",
    },
  },
};
