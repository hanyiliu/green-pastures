import { expect, test } from "@playwright/test";

import { routing } from "../src/i18n/routing";
import {
  VALID_DRAFT,
  fillDraft,
  forceInquiryResponse,
  gotoForm,
  inquiryForm,
  passTimeToSubmitFloor,
  submitButton,
  successPanel,
} from "./form-support";
import {
  ANCHORED_ROUTES,
  BOOKEND_SECTION_COUNT,
  budgetFor,
  BUILT_DETAIL_ROUTES,
  LIGHTBOX_ROUTE,
  LOCALES,
  SECTION_IDS,
  SHEET_VIEWPORT,
  SHOT,
  VIEWPORTS,
  VIEWPORT_NAMES,
  baselineEnvironmentProblem,
  expectHomeSectionsToMatchTheContentTree,
  homeUrlFor,
  masksWithin,
  openSettled,
  playEveryReveal,
  preparePage,
  scrollSectionIntoPlace,
  settleFonts,
  urlFor,
} from "./visual-support";

/**
 * Visual regression baselines (PR-8.6 · 08 §8 · `D-08.10` · `gp-dln.273`).
 *
 * Every enabled locale × two viewports × (each home section, each built detail
 * page's top fold, the hamburger sheet, the lightbox, the inquiry success
 * panel). The counts are not asserted anywhere and are not meant to be: they
 * fall out of `routing.locales` and `content/site.json` `routes[]`, which is
 * what lets `D-10.12` withdraw `zh-Hant` — or this wave's two new routes land —
 * without an edit here.
 *
 * ── What is committed, and why that survives a merge ────────────────────────
 *
 * The baselines are PNGs under `tests/e2e/__screenshots__/`, tracked, one file
 * per shot, exactly where `D-08.10` pins them and `playwright.config.ts`'s
 * `snapshotPathTemplate` writes them.
 *
 * `D-08.20` untracked `reports/content-coverage.md` on a merge argument, and it
 * is worth saying why that argument does not reach here rather than leaving the
 * two decisions looking inconsistent. The coverage report is a **derived
 * aggregate in one text file**: two branches that each add one `en` key both
 * rewrite `keys present` from 325 to 326, git merges two identical edits
 * without a conflict, and the number that lands is wrong. Conflict, or merge to
 * a number that is wrong — there was no third behaviour available.
 *
 * A screenshot baseline is neither aggregate nor shared. Each image is one
 * shot's own file, and nothing in it is computed from anything outside that
 * shot, so two branches that regenerate *different* images touch disjoint paths
 * and merge cleanly and correctly; and two branches that regenerate the *same*
 * image cannot silently average it, because git has no line-wise merge for a
 * PNG. `.gitattributes` says so outright (`merge=binary`) rather than leaving
 * it to content sniffing, in the same idiom `.beads/issues.jsonl` already uses.
 * So the bad half of `D-08.20`'s dilemma is unreachable here and only the loud
 * half remains: a conflict, resolved by regenerating in the container and
 * looking at the picture — which is what INV-08.8 asks a human to do anyway.
 *
 * ── The failure mode this suite has to avoid being ─────────────────────────
 *
 * `visual-support.ts` carries the argument in full. In short: the tolerance is
 * `D-08.10`'s and is not tuned here, and everything that could move between two
 * runs is pinned rather than absorbed — reduced motion (which turns
 * `ambient.css`'s loops off outright), reveals driven to their end state, fonts
 * settled, Turnstile stubbed, the Menu section's weekday driven to one fixed
 * day, and the one region that genuinely cannot be pinned masked.
 *
 * The calendar is on that list because it took the suite down. Every page here
 * is prerendered (06 `D-06.4`), so the Menu section ships whichever weekday the
 * *build* ran on, each weekday's sample line wraps to its own number of lines,
 * and the section is a different height on a Tuesday than on a Monday — which
 * `toHaveScreenshot` reports as an image-size mismatch before it ever consults
 * `threshold`. Re-recording the baseline moves that failure to another weekday
 * rather than removing it. `visual-support.ts`'s `pinMenuDay` is where it is
 * removed, and its header says why a browser clock could not have done it.
 */

/**
 * `@visual` is chromium-only by `D-08.10`, so `playwright.config.ts` pins it to
 * `chromium-desktop` and every other project inverts it. Reduced motion is
 * emulated for the whole file: 08 §8 asks for it, and it is what makes the
 * ambient decoration deterministic — `src/components/motion/ambient.css`
 * answers `prefers-reduced-motion: reduce` with `animation: none !important`,
 * so the leaves, the sun and the scroll cue are not merely fast-forwarded but
 * absent from the frame.
 */
test.use({ contextOptions: { reducedMotion: "reduce" } });

/**
 * Refuse to run outside the environment the baselines were taken in.
 *
 * Without this the suite has two silent failure modes, and both end with a bad
 * image committed: a macOS host renders CJK and emoji from a different font set
 * (`D-08.10`), and an Apple Silicon host running the right container without
 * `--platform linux/amd64` gets the arm64 Chromium, which rasterises glyphs
 * closely enough to fool a reviewer and differently enough to fail on
 * `ubuntu-latest` forever afterwards.
 */
test.beforeEach(() => {
  const problem = baselineEnvironmentProblem();
  if (problem !== null) throw new Error(problem);
});

/* -------------------------------------------------------------------------- *
 * The matrix itself
 * -------------------------------------------------------------------------- */

test.describe("the matrix these baselines cover", () => {
  test("is derived from routing.locales × site.json routes[] @visual", () => {
    // A suite of zero shots is a green run that photographed nothing, and it is
    // the shape both sources fail into — an empty `routing.locales`, a
    // `routes[]` whose pages have all been renamed. Re-deriving the same list
    // and asserting it equals itself would be a tautology; a lower bound on
    // each source, and the arithmetic that ties the section list to the route
    // list, are not.
    expect(LOCALES.length).toBeGreaterThan(0);
    expect(BUILT_DETAIL_ROUTES.length).toBeGreaterThan(0);
    expect(SECTION_IDS).toHaveLength(ANCHORED_ROUTES.length + BOOKEND_SECTION_COUNT);
    expect(LOCALES).toContain(routing.defaultLocale);
  });
});

/* -------------------------------------------------------------------------- *
 * Home, section by section
 * -------------------------------------------------------------------------- */

for (const viewportName of VIEWPORT_NAMES) {
  test.describe(`${viewportName} home sections`, () => {
    test.use({ viewport: VIEWPORTS[viewportName] });
    // One page open, then one shot per section.
    test.describe.configure({ timeout: budgetFor(1, SECTION_IDS.length) });

    for (const locale of LOCALES) {
      test(`${homeUrlFor(locale)} renders every section as baselined @visual`, async ({ page }) => {
        await openSettled(page, homeUrlFor(locale));
        await expectHomeSectionsToMatchTheContentTree(page);

        for (const sectionId of SECTION_IDS) {
          const section = page.locator(`section#${sectionId}`);
          await scrollSectionIntoPlace(section);
          await expect(section).toHaveScreenshot([locale, viewportName, `${sectionId}.png`], {
            ...SHOT,
            mask: masksWithin(section),
          });
        }
      });
    }
  });
}

/* -------------------------------------------------------------------------- *
 * The detail pages, top fold
 * -------------------------------------------------------------------------- */

for (const viewportName of VIEWPORT_NAMES) {
  test.describe(`${viewportName} subpage top folds`, () => {
    test.use({ viewport: VIEWPORTS[viewportName] });
    test.describe.configure({ timeout: budgetFor(1, 1) });

    for (const locale of LOCALES) {
      for (const route of BUILT_DETAIL_ROUTES) {
        test(`${urlFor(locale, route.path)} opens on the baselined fold @visual`, async ({
          page,
        }) => {
          await openSettled(page, urlFor(locale, route.path));

          // The viewport, not the document: 08 §8 asks for the *top fold*, and
          // a full-page shot of a subpage would be one enormous image whose
          // diff could not say which part of the page had moved.
          await expect(page).toHaveScreenshot([locale, viewportName, `${route.id}-fold.png`], {
            ...SHOT,
            mask: masksWithin(page.locator("body")),
          });
        });
      }
    }
  });
}

/* -------------------------------------------------------------------------- *
 * The three states that are not a scroll position
 * -------------------------------------------------------------------------- */

test.describe(`${SHEET_VIEWPORT} hamburger sheet`, () => {
  test.use({ viewport: VIEWPORTS[SHEET_VIEWPORT] });
  test.describe.configure({ timeout: budgetFor(1, 1) });

  for (const locale of LOCALES) {
    // The narrow view only, and that is a property of the design rather than a
    // saving: `Hamburger` is `lg:hidden` (04 §3.1, `D-04.9`), so at 1280 there
    // is no trigger to press and nothing to photograph. 08 §8's own arithmetic
    // ("8 + 6 + 3" at both viewports) counts a shot that cannot exist.
    test(`${homeUrlFor(locale)} opens the sheet as baselined @visual`, async ({ page }) => {
      await preparePage(page);
      await page.goto(homeUrlFor(locale));
      await settleFonts(page);

      // The hamburger is the only control in the header that owns a disclosure:
      // it is the one `aria-expanded` + `aria-controls` pair there, so this
      // locator names it without reading its translated `aria-label`
      // (INV-08.5).
      await page.locator("header button[aria-controls][aria-expanded]").click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();

      // The whole viewport rather than the sheet's own box: the sheet is
      // `fixed inset-x-0 top-(--nav-h) bottom-0`, so what a reader sees is the
      // sheet *and* the header it hangs from, and the seam between them is
      // exactly what a `--nav-h` regression would move.
      await expect(page).toHaveScreenshot([locale, SHEET_VIEWPORT, "nav-sheet.png"], {
        ...SHOT,
        mask: masksWithin(page.locator("body")),
      });
    });
  }
});

for (const viewportName of VIEWPORT_NAMES) {
  test.describe(`${viewportName} gallery lightbox`, () => {
    test.use({ viewport: VIEWPORTS[viewportName] });
    test.describe.configure({ timeout: budgetFor(1, 1) });

    for (const locale of LOCALES) {
      test(`${urlFor(locale, LIGHTBOX_ROUTE.path)} opens the lightbox as baselined @visual`, async ({
        page,
      }) => {
        await openSettled(page, urlFor(locale, LIGHTBOX_ROUTE.path));

        await page.locator("[data-gallery-photo]").first().click();
        await expect(page.getByRole("dialog")).toBeVisible();

        // The viewport again: the modal backdrop is half of what this shot is
        // for — a `::backdrop` that stops dimming is invisible in a picture of
        // the dialog alone.
        await expect(page).toHaveScreenshot([locale, viewportName, "lightbox.png"], {
          ...SHOT,
          mask: masksWithin(page.locator("body")),
        });
      });
    }
  });
}

for (const viewportName of VIEWPORT_NAMES) {
  test.describe(`${viewportName} inquiry success panel`, () => {
    test.use({ viewport: VIEWPORTS[viewportName] });
    // One page open, one submission that has to sit out 07 §1's submit floor,
    // then one shot.
    test.describe.configure({ timeout: budgetFor(2, 1) });

    for (const locale of LOCALES) {
      test(`${homeUrlFor(locale)} shows the baselined success panel @visual`, async ({ page }) => {
        // Driven with `e2e/form-support.ts`'s rig rather than a second copy of
        // it. Reaching this panel means a real submission — hydration barrier,
        // Turnstile token, 07 §1's time-to-submit floor — and a screenshot
        // suite that re-implemented all three would be asserting the form's
        // behaviour by accident and drifting from it by design. The one thing
        // forced here is the *server's* answer: `POST /api/inquiry` would
        // otherwise reach the handler's `siteverify`, which is
        // Node-to-Cloudflare and outside any browser stub.
        await preparePage(page);
        await forceInquiryResponse(page, 200, { ok: true });

        const form = await gotoForm(page, locale);
        await fillDraft(form, VALID_DRAFT);
        await passTimeToSubmitFloor(form);
        await submitButton(form).click();

        const panel = successPanel(page);
        await expect(panel).toBeVisible();
        await expect(inquiryForm(page)).toHaveCount(0);
        await playEveryReveal(page);

        await expect(panel).toHaveScreenshot([locale, viewportName, "inquiry-success.png"], {
          ...SHOT,
          mask: masksWithin(panel),
        });
      });
    }
  });
}
