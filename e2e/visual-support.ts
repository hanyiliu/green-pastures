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
 * capture; the menu's day selection is driven to one fixed weekday by
 * {@link pinMenuDay}; and the one region that still cannot be pinned — the
 * review count-up — is masked (08 §8 names it).
 *
 * ── The calendar is a source of movement, and it is not the browser's ──────
 *
 * The Menu section shows *today* in `America/Los_Angeles`, and the sample line
 * for one weekday is not the length of another's — 69 characters on Monday
 * against 58 on Tuesday in `en` — so it wraps to a different number of lines
 * and the section is a different height. Measured in this container at 1280:
 * `en` is 772 px on Mon/Wed/Thu and 748 px on Tue/Fri. A `toHaveScreenshot`
 * whose image is a *different size* from its baseline fails before the
 * tolerance is consulted at all, which is why this arrived as a hard red on a
 * pull request that had changed nothing: `en/desktop/menu.png`, "expected an
 * image 1280px by 773px, received 1280px by 749px", on the first CI run after
 * local midnight.
 *
 * **Masking the day did not and could not fix it.** The mask paints over the
 * chips and the line; it does not stop the box underneath them from changing
 * height, and the height is what breaks the comparison.
 *
 * **Nor can a browser clock fix it.** `src/lib/menu-day.ts` is read on the
 * *server*, and 06 `D-06.4` prerenders every page at build time — the built
 * `/en` HTML ships `aria-selected="true"` on one chip, decided by the clock of
 * the machine that ran `next build`, days before any browser opens it. Verified
 * on this commit: a build run on a Tuesday writes `menu-day-tue` into
 * `.next/server/app/en.html`. Playwright's `page.clock` patches `Date` inside
 * the page, so there is nothing there for it to patch; and the day is not read
 * again during hydration either, because `MenuDayChips` opens `useState` on the
 * server's answer (`D-04.10`). Pinning it at the only other place it is decided
 * would mean pinning the *build's* clock, which is a change to what every
 * reader of the deployed site sees rather than to this suite.
 *
 * So the day is pinned where the suite can reach it: the tabs are driven to
 * {@link PINNED_MENU_DAY} after the page settles and before anything is
 * photographed or measured. See {@link pinMenuDay}.
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

type SiteJson = {
  readonly routes: readonly SiteRoute[];
  /** `site.menu` (02 `D-02.11`) — only its `days` are read here. */
  readonly menu: { readonly days: readonly string[] };
};

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
 * Everything a shot inside `scope` has to mask. Three regions, all named by
 * 08 §8, for two different reasons.
 *
 * **The review count-up**, which is genuinely unpinnable. `CountUp` guarantees
 * the final value is in the server HTML, so this is not masking a number that
 * might be wrong — that value is asserted in the unit suite. It is masked
 * because the animation is JS-driven rather than CSS, so
 * `animations: "disabled"` has no purchase on the frame it would otherwise be
 * caught in.
 *
 * **The menu's roving chip row and the panel it controls**, which are not
 * unpinnable any more. 08 §8 masked them because the selected day was *today*
 * in `America/Los_Angeles` and nothing in a browser could change it;
 * {@link pinMenuDay} now settles the day before any shot is taken, so both are
 * as fixed as the rest of the section.
 *
 * They stay masked here all the same, and the reason is about this pull request
 * rather than about the pixels. Unmasking them is a coverage *increase* — it
 * would put the amber selected chip, the four white ones and the sample line
 * back under assertion, which is most of what the Menu section is — and it
 * re-records six images that INV-08.8 asks a human to look at. A red-CI fix
 * that also rewrites baselines is exactly the shape a bad fix takes, so the two
 * are separated: this change rewrites none, and the images are a reviewer's own
 * decision to make afterwards.
 *
 * Masking the *whole* row and panel, rather than the selected chip alone, was
 * the right call while the day moved and is worth keeping written down. Suppose
 * the baseline was taken on a Wednesday and the run is a Monday: a mask over
 * the selected chip covers Wednesday's in the baseline and Monday's in the run,
 * so the images differ at *both* positions. What that mask never covered, and
 * could not, is the height of the box underneath it — which is the failure that
 * brought the suite down and the reason the day is pinned instead.
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
 * ── The root's two scroll behaviours are pinned off ────────────────────────
 *
 * `globals.css` gives the root `scroll-behavior: smooth` and the home page
 * `scroll-snap-type: y proximity` under `html:has([data-snap-root])` (05 §5.8).
 * Both break the same assumption — that `scrollTo(0, y)` leaves the page at `y`
 * — and every helper here that walks or frames the page makes it. Three
 * mechanisms, all measured on the container rather than reasoned about:
 *
 *   • **Snapping vs the walk.** {@link playEveryReveal} steps by a viewport at
 *     a time; snapped, consecutive steps can resolve to the *same* section
 *     start, so the walk stops advancing and every reveal below it stays at
 *     `opacity: 0`. Eight `@visual` tests failed — the mobile ones by timing
 *     out on that function's whole-page poll, the desktop ones by baselining
 *     sections that had never entered, 9 % of a shot's pixels.
 *   • **Smooth scroll vs the walk.** `scrollTo` then *animates*, and the walk's
 *     two-frame wait does not outlast the animation: each step retargets the
 *     one before it, so the intermediate positions are never visited. This one
 *     is invisible to the `@visual` suite, which emulates reduced motion and so
 *     gets `scroll-behavior: auto` from 05 §5.9 — and fires in `@a11y`, which
 *     photographs nothing but borrows {@link openSettled} and does compare a
 *     default page against a reduced one. It left 35 reveals hidden.
 *   • **Snapping vs the capture.** `toHaveScreenshot` on a section taller than
 *     the viewport has to scroll to capture it. `/zh-Hans`'s Visit section is
 *     846 px in an 800 px viewport: unsnapped the capture scroll rests at 5823,
 *     snapped at 5843, and the sticky nav lands 20 px further down the section
 *     in one than the other.
 *
 * Pinning both costs the suite nothing it was measuring. They decide a *scroll
 * position*; a baseline is a picture of *layout*, and no section paints
 * differently for having been snapped or smoothly arrived at.
 * `scroll-margin-top` — the part of 05 §5.8 a shot can actually see, because it
 * is why a section clears the sticky nav — is honoured by `scrollIntoView`
 * either way, so {@link scrollSectionIntoPlace} still frames every section
 * exactly as before. This is the trade the rest of this file already makes: pin
 * what could move between two runs rather than widen the tolerance to cover it.
 *
 * Neither behaviour is left untested; they are simply not a screenshot's job.
 * `e2e/a11y-reduced-motion.spec.ts` asserts both against 05 §5.9, and lifts
 * this pin to do it.
 *
 * ── The Turnstile stub ─────────────────────────────────────────────────────
 *
 * The Turnstile script is answered by
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
  await pinRootScrolling(page);
  await stubTurnstile(page);
}

/**
 * Hold the root's two scroll behaviours off for every document this page loads.
 *
 * An init script rather than an injected stylesheet, because it has to survive
 * the navigations the tests make after `preparePage` has run, and an inline
 * `!important` on the root element beats `globals.css`'s rules without
 * depending on where a `<style>` would land in the cascade. `documentElement`
 * already exists when an init script runs at document-start; the listener is
 * the belt-and-braces half for any document where it does not.
 *
 * A test that needs to read what the *stylesheet* says about either property
 * has to lift the pin first — `e2e/a11y-reduced-motion.spec.ts` is the one that
 * does, and it says so where it reads them.
 */
async function pinRootScrolling(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pin = () => {
      const root = document.documentElement.style;
      root.setProperty("scroll-snap-type", "none", "important");
      root.setProperty("scroll-behavior", "auto", "important");
    };

    if (document.documentElement) pin();
    else document.addEventListener("DOMContentLoaded", pin, { once: true });
  });
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
 * **That argument assumes `scrollTo(0, y)` leaves the page at `y`**, which is
 * true only because {@link preparePage} pins `scroll-snap-type: none`. On the
 * live home page it is false, and the walk stalls where two steps resolve to
 * one snap point; that function carries the measurement and the reasoning.
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

/* -------------------------------------------------------------------------- *
 * The menu's day — the one thing on this page that moves on its own
 * -------------------------------------------------------------------------- */

/**
 * The weekday every `@visual` run renders the Menu section on.
 *
 * **Derived, not spelled.** `site.menu.days[0]` is the same expression
 * `defaultMenuDay` falls back to for a day the sample week does not carry
 * (`src/lib/menu-day.ts`), so this constant and the site agree by construction
 * rather than by a comment: an owner who opens the week on Tuesday moves both
 * at once, and a literal `"mon"` here would quietly start pinning a chip that
 * no longer exists.
 *
 * **Why the first day and not the longest line.** Three reasons, in order.
 *
 * It is what the site *itself* shows on three days in seven — `D-04.10`'s
 * weekend rule sends Saturday and Sunday to `days[0]`, and Monday is `days[0]`
 * — so the pinned page is the page a reader gets more often than any other
 * single day, and a build run on any of those three days needs no correcting at
 * all.
 *
 * It is the day the committed baselines were taken on, so pinning here changes
 * no image: `en/desktop/menu.png` stays 1280 × 773. That matters more than
 * tidiness. A pull request that fixes a date-dependent baseline by *rewriting*
 * the baseline is indistinguishable, in a diff, from one that fixes it
 * properly; one that rewrites nothing cannot be mistaken for the first.
 *
 * And it is not the degenerate case. In `en` at 1280 the Monday line already
 * wraps to two lines (772 px against 748 px on Tuesday and Friday), so the shot
 * covers a wrapped sample line rather than a single-line one.
 *
 * The one thing it is *not* is the most adversarial choice for
 * `visual-heights.spec.ts`. Measured in this container at 1280: Wednesday and
 * Thursday are the only days on which the Chinese sections (785 px) stand
 * *taller* than `en` (772 px), 13 px into that spec's 24 px one-line tolerance,
 * and on Monday `zh` is 14 px shorter instead. Pinning to `wed` would put that
 * spec's own failure mode under test on every run. It would also re-dimension
 * six baselines and narrow a live margin, which is a deliberate trade for its
 * own pull request rather than a rider on a red-CI fix.
 */
export const PINNED_MENU_DAY: string = (() => {
  const [first] = site.menu.days;
  if (first === undefined) {
    throw new Error(
      "content/site.json declares no menu.days, so @visual has no weekday to pin the Menu " +
        "section to (02 D-02.11). `defaultMenuDay` throws on the same emptiness.",
    );
  }
  return first;
})();

/**
 * Put the Menu section on {@link PINNED_MENU_DAY}, whatever day the build ran.
 *
 * The module header carries the argument for why this is where the pin has to
 * go. In short: the day is baked into prerendered HTML by `next build`, so it
 * is decided long before a browser or a `page.clock` exists, and the only place
 * a test can still change it is the control the design already gives a reader —
 * the day chips.
 *
 * `dispatchEvent` rather than `click`, and the difference is not stylistic. A
 * real click scrolls the chip into view and focuses it, which would leave every
 * later shot's scroll position a function of where the Menu section happens to
 * sit and put a `:focus-visible` outline (`tokens.css`, `D-03.11`) on one chip
 * in the frame. A dispatched click runs the same React handler and does
 * neither, so the page after this call differs from the page before it in
 * exactly one respect: which day is selected.
 *
 * Hydration is already guaranteed by the time this runs. {@link openSettled}
 * calls it after {@link playEveryReveal}, and a reveal only reaches opacity 1
 * because Motion drove it in the client — so a page whose reveals have played
 * is a page whose handlers are attached, and one dispatch is enough.
 *
 * A page with no tablist has no Menu section — every {@link BUILT_DETAIL_ROUTES}
 * fold and the gallery lightbox open through {@link openSettled} too — and there
 * is nothing to pin, so it returns. A page that *has* the tablist and not the
 * pinned day is a different matter and fails with the reason: `site.menu.days`
 * and the rendered chips have disagreed, which no baseline should paper over.
 */
export async function pinMenuDay(page: Page): Promise<void> {
  const tablist = page.locator('[role="tablist"]');
  if ((await tablist.count()) === 0) return;

  const chip = tablist.locator(`[data-day="${PINNED_MENU_DAY}"]`);
  await expect(
    chip,
    `The Menu section renders no chip for "${PINNED_MENU_DAY}", which is ` +
      "content/site.json's own menu.days[0]. @visual pins the day there because the built " +
      "HTML carries whichever day the build ran on (06 D-06.4).",
  ).toHaveCount(1);

  await chip.dispatchEvent("click");

  // Both halves, because they are two different failures: an `aria-selected`
  // that never flips is a handler that never ran, and a panel still showing the
  // old key is `WordSwap`'s exit still in flight (`AnimatePresence mode="wait"`
  // empties the panel for the length of one 200 ms fade before the new line
  // mounts, and that intermediate state is a third height).
  await expect(chip).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(`[data-word-swap="${PINNED_MENU_DAY}"]`)).toBeVisible();
}

/**
 * Navigate to `url`, stub what has to be stubbed, and settle the page.
 *
 * One function rather than a `beforeEach`, because the stub has to be installed
 * *before* the navigation and the settle has to happen after it, and a hook
 * cannot straddle a `goto` the test itself owns.
 *
 * {@link pinMenuDay} is last, and it has to be: it drives a control that only
 * responds once React has hydrated, and {@link playEveryReveal} returning is
 * the proof that it has. Both `visual.spec.ts` and `visual-heights.spec.ts`
 * reach the home page through here, which is what makes one pin cover the
 * screenshots and the section-height comparison alike.
 */
export async function openSettled(page: Page, url: string): Promise<void> {
  await preparePage(page);
  await page.goto(url);
  await playEveryReveal(page);
  await pinMenuDay(page);
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
