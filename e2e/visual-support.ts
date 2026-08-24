import { existsSync, readFileSync } from "node:fs";
import { arch, platform } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, type Locator, type Page } from "@playwright/test";

import { routing, type Locale } from "../src/i18n/routing";
import { stubTurnstile } from "./form-support";

/**
 * Shared rig for the visual-regression family (PR-8.6 · 10 §7 · 08 §8 · D-08.10).
 *
 * Two specs sit on it — `visual.spec.ts`, which takes the baseline images, and
 * `visual-heights.spec.ts`, which compares the reference locale's section
 * geometry against each of the others — and everything they share that is not
 * an assertion lives here: the locale × viewport × shot matrix, the
 * stabilisation that has to happen before a pixel is compared, the masks, and
 * the environment guard.
 *
 * ── Why a screenshot suite is worth having, and how it stops being worth it ──
 *
 * A screenshot assertion fails in two directions and only one of them is
 * visible. Too tight and it diffs on antialiasing, everyone learns to
 * regenerate reflexively, and the day a real regression lands it is committed
 * as a new baseline — which is worse than no suite at all, because it launders
 * the defect through a reviewed-looking diff. Too loose and it never flakes and
 * never fires: a tolerance generous enough to absorb a font-rendering wobble is
 * generous enough to absorb the 2 px shift that means a token stopped
 * resolving.
 *
 * The tolerance is therefore **not tuned here**. It is `D-08.10`'s, unchanged:
 * `threshold: 0.2` per pixel (Playwright's YIQ distance, so a pixel has to
 * differ visibly to count at all) and `maxDiffPixelRatio: 0.01` (a shot fails
 * once 1 % of its pixels have moved). INV-08.8 is what keeps it honest: those
 * two numbers move only in a pull request that names the calibration run
 * justifying them, and so does every image under `tests/e2e/__screenshots__/`.
 *
 * ── Determinism is bought here, not paid for in the threshold ──────────────
 *
 * Everything below exists so the tolerance never has to cover for a moving
 * page. Ambient loops are off because reduced motion is emulated and
 * `ambient.css` answers that with `animation: none !important`; entrance
 * reveals are driven to their end state by {@link playEveryReveal} rather than
 * waited out; the Turnstile script is stubbed so the Visit section does not
 * depend on Cloudflare being reachable; web fonts are settled before any
 * capture; and the two genuinely unpinnable regions — the menu's day selection,
 * which is *today* in `America/Los_Angeles`, and the review count-up — are
 * masked (08 §8 names both).
 */

/* -------------------------------------------------------------------------- *
 * The environment the baselines are only valid in
 * -------------------------------------------------------------------------- */

/**
 * `D-08.10` pins the baselines to one font stack: the Playwright Linux image
 * (`mcr.microsoft.com/playwright:v<version>-noble`, which ships WenQuanYi Zen
 * Hei, IPA Gothic and Noto Color Emoji). A macOS host renders CJK and emoji
 * from an entirely different set, so an image generated there is not a weaker
 * baseline — it is a picture of a different website.
 *
 * The architecture half is the same argument one level down, and it is not
 * theoretical. The `e2e` job runs the container on `ubuntu-latest`, which is
 * **x86-64**; a developer on Apple Silicon who runs the same image without
 * `--platform linux/amd64` gets the arm64 build of Chromium, whose glyph
 * rasterisation is close enough to look identical by eye and far enough to move
 * more than 1 % of the pixels in a text-heavy section. Baselines updated that
 * way pass locally and diff on every CI run afterwards.
 *
 * Neither failure announces itself, so this guard does: `@visual` refuses to
 * run anywhere but the environment CI runs in, and says which half is wrong.
 */
const BASELINE_PLATFORM = "linux";
const BASELINE_ARCH = "x64";

/** `null` when the current process may take or compare baselines. */
export function baselineEnvironmentProblem(): string | null {
  if (platform() === BASELINE_PLATFORM && arch() === BASELINE_ARCH) return null;

  return (
    `@visual ran on ${platform()}/${arch()}, and the baselines under ` +
    `tests/e2e/__screenshots__/ are only valid on ${BASELINE_PLATFORM}/${BASELINE_ARCH} — ` +
    "the Playwright container as CI runs it (D-08.10). Use `pnpm test:e2e:docker`, and on " +
    "an Apple Silicon host add `--platform linux/amd64` to that `docker run`: the arm64 " +
    "build of Chromium rasterises every glyph slightly differently, so images written " +
    "there pass locally and diff on ubuntu-latest forever afterwards."
  );
}

/* -------------------------------------------------------------------------- *
 * The matrix
 * -------------------------------------------------------------------------- */

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

/**
 * One `content/site.json` `routes[]` entry (02 `D-02.12`).
 *
 * `homeAnchor` is **optional**, and that is a fact about the site rather than a
 * defensive type. Six routes are the subpage of a home section and name it;
 * `/privacy` (PR-6.9) is a page the footer links to and the home page never
 * opens, so it declares none. A rig that assumed every route had one put
 * `undefined` into the section list and then asked the browser to match it.
 */
export type SiteRoute = {
  readonly id: string;
  readonly path: string;
  readonly homeAnchor?: string;
};

type SiteJson = { readonly routes: readonly SiteRoute[] };

const site = JSON.parse(readFileSync(join(REPO_ROOT, "content", "site.json"), "utf8")) as SiteJson;

/**
 * Derived the way `e2e/smoke.spec.ts` and `e2e/routes-support.ts` derive theirs,
 * and re-derived rather than imported for the reason `routes-support` states: a
 * spec file cannot export to another spec file without registering its tests
 * twice, so the derivation is written again — from the same two sources, so the
 * three families cannot disagree about what the site is.
 *
 * Nothing here is a literal list of routes or locales. `D-10.12` withdrawing
 * `zh-Hant` shrinks this matrix by a third with no edit, and a seventh
 * `routes[]` entry widens it — which is the property PR-8.8's exit criterion
 * asks for ("a `zh-Hant` baseline exists for every `zh-Hans` one, **or** the
 * locale is out of `routing.locales` and the matrix has shrunk on its own").
 */
export const LOCALES: readonly Locale[] = routing.locales;

/** The reference locale every other one is measured against (02 `D-02.1`). */
export const REFERENCE_LOCALE: Locale = routing.defaultLocale;

/** Every enabled locale that is not the reference — the two Chinese rows. */
export const COMPARED_LOCALES: readonly Locale[] = routing.locales.filter(
  (locale) => locale !== routing.defaultLocale,
);

const PAGE_FILE_EXTENSIONS = ["tsx", "ts", "jsx", "js"] as const;

function hasPageFile(routePath: string): boolean {
  return PAGE_FILE_EXTENSIONS.some((extension) =>
    existsSync(join(REPO_ROOT, "src", "app", "[locale]", routePath, `page.${extension}`)),
  );
}

/**
 * The detail routes whose page exists **on this commit**.
 *
 * Two pull requests in this wave add a route — a privacy page and a share-image
 * route — and a third moves a home link. This filter is why none of them
 * arrives here as a mystery failure: a route with no `page.tsx` is not in the
 * matrix, so a route that lands later lands as *missing baselines*, which is a
 * reviewed addition rather than a diff on someone else's pull request.
 */
export const BUILT_DETAIL_ROUTES: readonly SiteRoute[] = site.routes.filter((route) =>
  hasPageFile(route.path),
);

/**
 * The one route that has a lightbox (04 §3.4).
 *
 * A route id rather than a derivation, because there is nothing to derive from:
 * "which page has a lightbox" is a fact about the components, not about
 * `site.json`. It is looked up in {@link BUILT_DETAIL_ROUTES} rather than used
 * as a path, so a gallery route that is renamed or removed fails at collection
 * with a sentence instead of leaving one state silently uncovered.
 */
const LIGHTBOX_ROUTE_ID = "gallery";

export const LIGHTBOX_ROUTE: SiteRoute = (() => {
  const route = BUILT_DETAIL_ROUTES.find((candidate) => candidate.id === LIGHTBOX_ROUTE_ID);
  if (route === undefined) {
    throw new Error(
      `No built route with id "${LIGHTBOX_ROUTE_ID}" in content/site.json routes[]. The ` +
        "lightbox baseline has nowhere to open, and 08 §8 lists it as one of the three " +
        "states this suite covers — so removing that page is a change to " +
        "docs/technical/08-testing-quality.md first.",
    );
  }
  return route;
})();

/** The home page's path in a locale. `localePrefix: 'always'`, no trailing slash. */
export function homeUrlFor(locale: Locale): string {
  return `/${locale}`;
}

/** `/menu` in a locale → `/zh-Hant/menu`. */
export function urlFor(locale: Locale, routePath: string): string {
  return `/${locale}${routePath}`;
}

/**
 * The two viewports 08 §5 and §8 name, applied with `test.use` because the
 * project itself is `chromium-desktop` (`D-08.10` scopes `@visual` to one
 * engine, and note (b) of 08 §5 pins the tag there).
 *
 * 390 is 03 §3.3's narrow reference width; 1280 × 800 is the project's own.
 */
export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

export const VIEWPORT_NAMES = Object.keys(VIEWPORTS) as readonly ViewportName[];

/** The narrow view is the only one that has a hamburger (`lg:hidden`, 04 §3.1). */
export const SHEET_VIEWPORT: ViewportName = "mobile";

/* -------------------------------------------------------------------------- *
 * The home sections
 * -------------------------------------------------------------------------- */

/**
 * The two section ids that are not a route (`Section.tsx`'s `HERO_SECTION_ID`
 * and `VISIT_SECTION_ID`): the hero opens the page and the visit block closes
 * it, and neither has a subpage. Everything between them is
 * `site.json.routes[].homeAnchor` in the owner's order, which is exactly how
 * `SECTION_IDS` is built in `src/components/layout/Section.tsx`.
 *
 * They are spelled here rather than imported because importing that module
 * would pull React and the content loader into the test process — the same
 * trade-off `routes-support.ts` makes with `HOME_PATH`. What keeps the copy
 * honest is not this comment; it is
 * {@link expectHomeSectionsToMatchTheContentTree}, which fails if the served
 * page ever disagrees with the list in either direction.
 */
const HERO_SECTION_ID = "hero";
const VISIT_SECTION_ID = "visit";

/** How many home sections are bookends rather than a `routes[]` entry. */
export const BOOKEND_SECTION_COUNT = 2;

/** The routes that are a home section's subpage — the ones naming an anchor. */
export const ANCHORED_ROUTES: readonly SiteRoute[] = site.routes.filter(
  (route) => route.homeAnchor !== undefined,
);

/**
 * Every home section id, in scroll order (04 `D-04.3`).
 *
 * Built from the routes that *declare* an anchor, not from every route: a route
 * with no `homeAnchor` has no section on the home page, and mapping it in
 * anyway yields an `undefined` the DOM can never match. `/privacy` is the first
 * such route and it arrived while this branch was open — which is the reason
 * this list is derived at all.
 */
export const SECTION_IDS: readonly string[] = [
  HERO_SECTION_ID,
  ...ANCHORED_ROUTES.map((route) => route.homeAnchor ?? ""),
  VISIT_SECTION_ID,
];

/**
 * Assert the served home page carries exactly {@link SECTION_IDS}, in order.
 *
 * A screenshot suite whose shot list is a constant silently stops covering a
 * section the day one is added or renamed: the old baselines keep passing and
 * the new section is simply never photographed. Comparing the derived list
 * against the DOM on every run is what turns that into a failure — and it is
 * the same comparison in both directions, so a section that *leaves* orphans
 * its baseline loudly instead of quietly.
 */
export async function expectHomeSectionsToMatchTheContentTree(page: Page): Promise<void> {
  const rendered = await page
    .locator("main[data-snap-root] > section[id]")
    .evaluateAll((nodes) => nodes.map((node) => node.id));

  expect(rendered).toEqual([...SECTION_IDS]);
}

/* -------------------------------------------------------------------------- *
 * Comparison options
 * -------------------------------------------------------------------------- */

/**
 * `D-08.10`'s two numbers, in one place so no shot can quietly relax them.
 *
 * `threshold` is Playwright's per-pixel YIQ colour distance: below 0.2 a pixel
 * counts as unchanged, which is what absorbs subpixel antialiasing on glyph
 * edges without absorbing a colour that actually changed. `maxDiffPixelRatio`
 * is the share of the shot allowed to differ before the assertion fails — 1 %,
 * which on the smallest shot in this suite is a few hundred pixels and on the
 * largest a few thousand. Both are `D-08.10`'s, and INV-08.8 governs them.
 *
 * `animations: "disabled"` fast-forwards finite animations to their end state
 * and cancels infinite ones; `caret: "hide"` removes the text caret, which
 * blinks and would otherwise be the one thing in this file that could flake on
 * timing alone.
 *
 * `timeout` is stated rather than inherited, and it is not a tolerance. Before
 * `toHaveScreenshot` compares anything it takes the *same* shot twice and
 * requires the two to be identical, which is how it refuses to photograph a
 * page still in motion. The config's blanket 5 s `expect` budget therefore
 * caps how long a *capture* may take, not how long a page may take to settle:
 * a full-page shot that needs three seconds to serialise can never produce two
 * of itself in time, and reports "Timeout 5000ms exceeded" — which reads like a
 * moving page and is a slow one. Observed exactly once, on `/zh-Hant/team` at
 * 390 in the container. Raising it weakens no assertion; the comparison it
 * guards is `maxDiffPixelRatio` and `threshold`, both above and both
 * `D-08.10`'s.
 */
const SHOT_TIMEOUT_MS = 15_000;

export const SHOT = {
  animations: "disabled",
  caret: "hide",
  scale: "css",
  maxDiffPixelRatio: 0.01,
  threshold: 0.2,
  timeout: SHOT_TIMEOUT_MS,
} as const;

/* -------------------------------------------------------------------------- *
 * Masks — the two regions no baseline can pin
 * -------------------------------------------------------------------------- */

/**
 * Everything a shot inside `scope` has to mask. Two regions, both named by
 * 08 §8, and both genuinely unpinnable rather than merely inconvenient.
 *
 * **The menu's day selection.** `src/lib/menu-day.ts` picks *today* in
 * `America/Los_Angeles` on the server, so the selected chip and the sample line
 * it controls both move once a day.
 *
 * Masking only the selected chip does not work, which is worth stating because
 * it is the obvious thing to try. Suppose the baseline was taken on a Wednesday
 * and the run is a Monday: the mask covers Wednesday's chip in the baseline and
 * Monday's in the run, so the images differ at *both* positions — Monday is
 * selected in one and not the other, and Wednesday the reverse. The whole
 * roving row and the panel it controls have to go under the mask together,
 * which is what "mask for … the menu's `today` chip" means in practice.
 *
 * **The review count-up.** `CountUp` guarantees the final value is in the
 * server HTML, so this is not masking a number that might be wrong — that value
 * is asserted in the unit suite. It is masked because the animation is
 * JS-driven rather than CSS, so `animations: "disabled"` has no purchase on the
 * frame it would otherwise be caught in.
 *
 * The masks are **scoped**, never document-wide. A mask that matches nothing is
 * free; a mask that matches something in another section blanks real coverage
 * there, and Playwright paints a solid box over every match. An over-broad mask
 * is exactly as dangerous as a loose threshold and much harder to notice.
 */
export function masksWithin(scope: Locator): Locator[] {
  return [
    scope.locator('[role="tablist"]'),
    scope.locator('[role="tabpanel"]'),
    scope.locator("[data-countup]"),
  ];
}

/* -------------------------------------------------------------------------- *
 * Stabilisation
 * -------------------------------------------------------------------------- */

/**
 * Everything that has to be true of a page before any of it is photographed.
 *
 * Today that is one thing: the Turnstile script is answered by
 * `e2e/form-support.ts`'s stub. 07 §1 loads Cloudflare's script when the Visit
 * section enters the viewport, which is precisely what photographing that
 * section does, and three things follow — each of which would be a defect in a
 * baseline. The shot would depend on Cloudflare being reachable from the runner
 * (INV-08.7's hermetic-run goal rules that out), it would photograph a third
 * party's markup, and — the one that actually bites — a script that *fails* to
 * load is not neutral: `Turnstile` turns a missing API into `onUnavailable()`,
 * and the form answers that with the `turnstile_unavailable` banner and the
 * direct-contact fallback beside it. Blocking the request would baseline the
 * error state, and nobody would notice for a phase.
 *
 * The stub is imported rather than written again. It is not a two-line fake:
 * its `execute` calls back on a later task because `InquiryForm.awaitToken`
 * registers its waiter *after* calling it, and getting that wrong costs a
 * twelve-second timeout rather than a visible failure. `routes-support.ts`
 * re-derives its matrix instead of importing one because a *spec* file cannot
 * export without registering its tests twice; that argument does not reach a
 * support module, and duplicating a stub whose correctness turns on a
 * task-queue detail would be the wrong half of it to copy.
 */
export async function preparePage(page: Page): Promise<void> {
  await stubTurnstile(page);
}

/**
 * The wall-clock a test needs, derived from the work it does.
 *
 * `playwright.config.ts`'s 30 s is a budget for a test that asserts a thing.
 * A test here opens a page, walks it to fire every entrance, waits for the last
 * of them, and then compares *n* images — so its floor is a page budget plus a
 * per-shot budget, and a single number could only be right for one *n*.
 *
 * Stating it as arithmetic rather than a constant is what keeps it honest when
 * the site grows: an eighth home section widens the home-section budget by one
 * shot on its own, and nobody has to notice. And it is a give-up bound rather
 * than a clock being extended to hide a flake (`D-08.13`) — no assertion inside
 * it is weakened, every one of them still has its own `expect` timeout, and the
 * test still ends the moment its last comparison returns.
 */
const PAGE_BUDGET_MS = 90_000;

/**
 * A shot's own ceiling plus the time either side of it. The relationship is the
 * point: a test's budget has to exceed the sum of what its assertions may each
 * take, or the last shot in every test fails for a reason that is about the
 * clock and not about the page.
 */
const SHOT_BUDGET_MS = SHOT_TIMEOUT_MS + 5_000;

export function budgetFor(pageOpens: number, shots: number): number {
  return pageOpens * PAGE_BUDGET_MS + shots * SHOT_BUDGET_MS;
}

/**
 * How long {@link playEveryReveal} waits for the last reveal to finish.
 *
 * This is a bound on a synchronisation, not a sleep, and the difference is
 * `D-08.13`'s: the condition is the observable end state ("every `[data-reveal]`
 * is at opacity 1"), the wait ends the moment it holds, and the number only
 * decides how long to keep asking before reporting that it never did.
 *
 * It is stated rather than left at the config's 5 s `expect` timeout because 5 s
 * is not a bound on this condition — it is a bound on a *fast* machine's version
 * of it. Measured: 49 reveals on `/en` at 1280 all reach opacity 1 within about
 * 1.5 s on a native host, and the same page inside the Playwright container
 * running x86-64 under emulation, with several workers competing, does not.
 * A 5 s ceiling turns that into "35 reveals never played", which is a true
 * statement about the assertion and a false one about the page.
 */
const REVEAL_SETTLE_TIMEOUT_MS = 20_000;

/**
 * How long one step of the walk waits for the reveals it just brought on screen.
 *
 * Long enough for a 750 ms entrance on a machine several times slower than the
 * one it was written on, short enough that a reveal which never fires costs one
 * step rather than the test. The whole-page assertion is what reports that case,
 * and it reports it as a number.
 */
const REVEAL_STEP_TIMEOUT_MS = 5_000;

/**
 * Drive every entrance reveal to its end state.
 *
 * `Reveal` uses Motion's `whileInView`, so a section that has never been in the
 * viewport still sits at its hidden opacity. An element screenshot scrolls the
 * element into view and captures it immediately, which for a tall section means
 * capturing it mid-entrance — or, for children below the fold of that section,
 * not entered at all. Either produces an image that is *stable* (the run and
 * the baseline agree) and *wrong* (it is a picture of the page half-arrived),
 * which is the failure mode a screenshot suite is least able to notice about
 * itself.
 *
 * So the page is walked in viewport-height steps to put every observer's target
 * on screen at least once, and **each step waits for the reveals now on screen
 * before the next one moves**. That second half is not caution; it is the whole
 * mechanism, and leaving it out produced the exact defect this suite exists to
 * catch. A walk that only waits two frames per step outruns
 * `IntersectionObserver`, which coalesces and delivers at most one notification
 * per frame: an element that enters and leaves the viewport between two
 * deliveries is never reported as intersecting at all. Measured on the
 * container, x86-64 under emulation: **32 of 49 reveals stayed at `opacity: 0`
 * with no animation ever created** — permanently, not briefly. On a fast host
 * the same code settled all 49 in about 1.5 s, so the bug is invisible where it
 * is written and certain where it runs. Its baselines would have been perfectly
 * stable pictures of a page that had never arrived.
 *
 * Stepping by a full viewport is enough to reach everything once the wait is
 * there: `Reveal`'s frozen viewport is `amount: 0.16`, and an element shorter
 * than the viewport that straddles a step boundary shows at least half of itself
 * on one side of it, while an element taller than the viewport always covers
 * more than 16 % of itself when the viewport is inside it.
 *
 * The per-step wait is bounded and then gives up, deliberately: an element that
 * never arrives is a finding for the whole-page assertion below to report with
 * a count, not a reason for one step to hang until the test times out.
 */
export async function playEveryReveal(page: Page): Promise<void> {
  await page.evaluate(async (stepDeadlineMs: number) => {
    const frame = () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });

    /** Reveals whose box is on screen right now and that are still hidden. */
    const pendingOnScreen = () =>
      [...document.querySelectorAll("[data-reveal]")].filter((node) => {
        const box = node.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) return false;
        const onScreen = box.bottom > 0 && box.top < window.innerHeight;
        return onScreen && getComputedStyle(node).opacity !== "1";
      }).length;

    const settleStep = async () => {
      const startedAt = performance.now();
      while (pendingOnScreen() > 0 && performance.now() - startedAt < stepDeadlineMs) {
        await frame();
      }
    };

    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await frame();
      await settleStep();
    }
    window.scrollTo(0, 0);
    await frame();
    await settleStep();
  }, REVEAL_STEP_TIMEOUT_MS);

  // Reveals with no box at all are excluded, here and in the per-step wait
  // above, and the exclusion is a fact about the design rather than a
  // convenience. 04 `D-04.5` draws the two views with CSS, so a page renders
  // both and lets `md:` pick — `/menu` carries a card list and a table, one of
  // which is `display: none` at any given width. An element that is not
  // displayed has no box, so it can never intersect, so its entrance can never
  // fire, and demanding one would be demanding something the design does not
  // do. It cost five reveals on `/en/menu` before this line existed.
  await expect
    .poll(
      () =>
        page.locator("[data-reveal]").evaluateAll(
          (nodes) =>
            nodes.filter((node) => {
              const box = node.getBoundingClientRect();
              if (box.width === 0 && box.height === 0) return false;
              return getComputedStyle(node).opacity !== "1";
            }).length,
        ),
      { timeout: REVEAL_SETTLE_TIMEOUT_MS },
    )
    .toBe(0);

  await settleFonts(page);
}

/**
 * Put a section where a reader meets it before photographing it.
 *
 * Without this the shot's scroll position is whatever Playwright's own
 * scroll-into-view left behind, which depends on where the *previous* section
 * put the page — so every section's baseline is coupled to the height of the
 * ones above it, and a deliberate change to one section re-renders the sticky
 * header into a different slice of the next section's image. `Section` carries
 * `scroll-mt-(--nav-h)`, so `scrollIntoView({ block: "start" })` honours that
 * margin and parks the section's top edge exactly under the header instead of
 * behind it: each shot is then a function of its own section and nothing else.
 *
 * The hero is the one section this cannot lift clear of the header, because
 * there is nothing above it to scroll into — which is also true for a reader,
 * so its baseline is right to include the header sitting over it.
 */
export async function scrollSectionIntoPlace(section: Locator): Promise<void> {
  await section.evaluate((node) => {
    node.scrollIntoView({ block: "start" });
  });
  await section.page().evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
}

/** Wait until every web font this document uses has loaded (08 §8). */
export async function settleFonts(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/**
 * Navigate to `url`, stub what has to be stubbed, and settle the page.
 *
 * One function rather than a `beforeEach`, because the stub has to be installed
 * *before* the navigation and the settle has to happen after it, and a hook
 * cannot straddle a `goto` the test itself owns.
 */
export async function openSettled(page: Page, url: string): Promise<void> {
  await preparePage(page);
  await page.goto(url);
  await playEveryReveal(page);
}

/* -------------------------------------------------------------------------- *
 * Section geometry
 * -------------------------------------------------------------------------- */

/** One section's measured box, in CSS pixels. */
export type SectionGeometry = {
  readonly id: string;
  readonly height: number;
  /** The section's own computed `line-height`, the unit the tolerance is in. */
  readonly lineHeight: number;
};

/** Nav height plus every section's height, as one locale renders them. */
export type PageGeometry = {
  readonly navHeight: number;
  readonly sections: readonly SectionGeometry[];
};

/**
 * Measure the nav and every home section.
 *
 * Heights are rounded to whole pixels: a fractional layout height is a real
 * number the browser reports to fifteen decimal places, and comparing those
 * across two documents would fail on arithmetic rather than on layout.
 */
export function measureHomeGeometry(page: Page): Promise<PageGeometry> {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    const sections = [...document.querySelectorAll("main[data-snap-root] > section[id]")];

    return {
      navHeight: header === null ? 0 : Math.round(header.getBoundingClientRect().height),
      sections: sections.map((section) => ({
        id: section.id,
        height: Math.round(section.getBoundingClientRect().height),
        lineHeight: Math.round(Number.parseFloat(getComputedStyle(section).lineHeight)),
      })),
    };
  });
}
