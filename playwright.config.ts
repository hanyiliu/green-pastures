import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright (PR-2.5, 08 §5 / D-08.7, D-08.10, D-08.13).
 *
 * The suite runs against a **local production build** (`next build` +
 * `next start`), never against a Vercel preview, so the required check is
 * deterministic and independent of Vercel timing (D-08.7).
 *
 * Specs live in `e2e/` and grow one family per phase (10 §7: `e2e/smoke*`
 * PR-3.6, `e2e/form*` PR-5.10, `e2e/routes*` PR-6.10, `e2e/a11y*` PR-8.4,
 * `e2e/visual*` PR-8.6). Visual baselines are written to
 * `tests/e2e/__screenshots__/` because D-08.10 pins them there, and they are
 * only ever generated inside the Playwright Linux image — a macOS host renders
 * CJK and emoji differently, so a local baseline is invalid.
 */

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

/**
 * D-08.7: `firefox-desktop` and `chromium-mobile` run on push to `main` and
 * nightly, not on every PR. The `e2e-full` job sets `E2E_FULL=1`.
 */
const isFullMatrix = process.env.E2E_FULL === "1";

/**
 * Note (b) of 08 §5: four tags observe something only Chromium has, so a run
 * in another engine would report a pass having measured nothing. They are
 * pinned to `chromium-desktop`; every other project inverts them.
 * `@nav-instant` is deliberately not a `@motion-vt` substring so it survives.
 *
 * `@a11y-keys` (PR-8.4) is the fourth, and it is here for the opposite reason
 * to the other three: not something only Chromium *has*, but something WebKit
 * deliberately does not do. Safari ships with Full Keyboard Access off, so its
 * default tab sequence contains text fields and popup menus and **no links and
 * no buttons** — measured in this project's own engine, the first `Tab` on `/`
 * lands on `#menu-day-mon` and never on the skip link. A Tab-driven assertion
 * about the skip link, the nav order, the sheet's focus cycle, the lightbox's
 * trap or the gallery filters therefore measures a browser preference rather
 * than this site, and would red on a page with nothing wrong with it. Every
 * other `@a11y` test — the axe sweep, the allowlist witnesses, the no-JS page,
 * reduced-motion parity, and the keyboard paths that move focus with `focus()`
 * and `Enter` rather than `Tab` — runs in every project.
 */
const CHROMIUM_ONLY = /@perf|@visual|@motion-vt|@motion-obs|@a11y-keys/;

/** D-08.13: quarantined tests run only in the `flaky-known` project. */
const FLAKY_KNOWN = /@flaky-known/;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // D-08.13: a failing check is fixed, never re-run to green.
  retries: 0,
  fullyParallel: true,
  forbidOnly: isCI,

  reporter: isCI
    ? [["github"], ["html", { open: "never" }], ["blob"]]
    : [["list"], ["html", { open: "never" }]],

  // D-08.10: baselines live where 08 pins them, one directory per project.
  snapshotPathTemplate: "tests/e2e/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}",

  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "off",
    // Explicit rather than defaulted: the `@motion` and `@hover` suites compare
    // a `reducedMotion: 'reduce'` run against this one, so "default" has to be a
    // stated value and not whatever the runner's OS happens to prefer. In
    // Playwright 1.62 this is a context option, not a top-level `use` option —
    // the reduced-motion halves of those suites override it with
    // `test.use({ contextOptions: { reducedMotion: 'reduce' } })`.
    contextOptions: { reducedMotion: "no-preference" },
  },

  projects: [
    {
      // 1280 × 800 (08 §5). Carries `@perf`, `@visual`, `@motion-vt` and
      // `@motion-obs`, each of which uses `test.use` for its own viewport.
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      grepInvert: FLAKY_KNOWN,
    },
    {
      // 390 wide (08 §5, 03 §3.3).
      name: "webkit-mobile",
      use: { ...devices["iPhone 14"] },
      grepInvert: new RegExp(`${CHROMIUM_ONLY.source}|${FLAKY_KNOWN.source}`),
    },
    ...(isFullMatrix
      ? [
          {
            name: "firefox-desktop",
            use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 800 } },
            grepInvert: new RegExp(`${CHROMIUM_ONLY.source}|${FLAKY_KNOWN.source}`),
          },
          {
            name: "chromium-mobile",
            use: { ...devices["Pixel 7"] },
            grepInvert: new RegExp(`${CHROMIUM_ONLY.source}|${FLAKY_KNOWN.source}`),
          },
        ]
      : []),
    {
      // D-08.13: the only project with a retry, and only for tests whose tag
      // names an open bead. The tag lint (PR-2.6) fails a PR whose tag has no id
      // or names a closed bead.
      name: "flaky-known",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      grep: FLAKY_KNOWN,
      retries: 1,
    },
  ],

  webServer: {
    // Locally this needs a `pnpm build` first; in CI the `build` job's `.next`
    // artifact is downloaded and `next start` serves it (D-08.7).
    command: `pnpm start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      // 08 §5 / 07 §5. No real key ever reaches a PR run (INV-08.7):
      // Cloudflare's published always-pass test pair and the log transport.
      INQUIRY_TRANSPORT: "log",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
      INQUIRY_TO_EMAIL: "inbox@example.test",
      NEXT_PUBLIC_SITE_URL: baseURL,
    },
  },
});
