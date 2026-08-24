import { expect, test } from "@playwright/test";

import {
  COMPARED_LOCALES,
  REFERENCE_LOCALE,
  SECTION_IDS,
  VIEWPORTS,
  VIEWPORT_NAMES,
  baselineEnvironmentProblem,
  budgetFor,
  homeUrlFor,
  measureHomeGeometry,
  openSettled,
  type PageGeometry,
  type SectionGeometry,
} from "./visual-support";

/**
 * Section heights, the reference locale against every other one
 * (PR-8.6 · 10's PR-8.6 row · `gp-dln.273`).
 *
 * ── Why this is not a stored baseline ──────────────────────────────────────
 *
 * 08 §5's `@perf` row describes a different check with a similar name: nav
 * height and each `section[id]` height, per locale, written to
 * `reports/section-heights.json` and compared against a committed file. That
 * file is `@perf`'s, it does not exist yet, and this spec deliberately does not
 * write it. Two suites regenerating one JSON aggregate is exactly the shape
 * `D-08.20` untracked `reports/content-coverage.md` for — a derived total that
 * two branches can both rewrite and git can merge to a number that is wrong —
 * and a second writer would make that worse rather than merely duplicate it.
 *
 * What 10's PR-8.6 row asks for is the *cross-locale* comparison — "section
 * height `en` vs each Chinese locale" — and that needs no stored expectation at
 * all. Both sides are measured in the same run, on the same build, in the same
 * browser, so the comparison is self-calibrating: it cannot go stale, it cannot
 * drift, it has no merge behaviour, and it does not have to be regenerated when
 * a design changes on purpose. It fails on exactly one thing, which is the
 * thing the row is about — a locale whose text does not fit the box the design
 * gives it.
 *
 * ── Why the tolerance is a line-height, and why it is one-sided ────────────
 *
 * 08 §5 states the unit for the `@perf` variant — "a delta > one line-height of
 * that section fails" — and it is the right one here too, because the failure
 * being hunted is *a line that wrapped*.
 *
 * The two directions are not symmetric and are asserted separately. Chinese
 * sets more compactly than English for the same sentence, so a Chinese section
 * is expected to be shorter or equal, and an `abs()` would have fired on the
 * one difference that is correct. What must never happen is a Chinese section
 * growing *past* the reference: 04's sections carry `min-height`, so a section
 * that exceeds the reference is one whose copy has outgrown the box rather than
 * one that has merely stopped filling it.
 *
 * `zh-Hant` is the row this exists for. It carries the same sentences as
 * `zh-Hans` in denser glyph forms (02's CJK section, HD-10), so it is the
 * locale most likely to overflow a fixed-height box and the one no reviewer
 * would catch by eye against its Simplified twin.
 */

test.use({ contextOptions: { reducedMotion: "reduce" } });

test.beforeEach(() => {
  const problem = baselineEnvironmentProblem();
  if (problem !== null) throw new Error(problem);
});

/**
 * How far a compared locale's section may exceed the reference's, in
 * line-heights of that section. 08 §5's unit and 08 §5's number.
 *
 * INV-08.8 governs it: it moves in a pull request that names the design change
 * or calibration run justifying the move, never in the one that happened to
 * break it.
 */
const OVERFLOW_TOLERANCE_LINES = 1;

function sectionOf(geometry: PageGeometry, id: string): SectionGeometry {
  const section = geometry.sections.find((candidate) => candidate.id === id);
  if (section === undefined) {
    throw new Error(`No section#${id} on the rendered home page (04 D-04.3's list).`);
  }
  return section;
}

for (const viewportName of VIEWPORT_NAMES) {
  test.describe(`${viewportName} section geometry`, () => {
    test.use({ viewport: VIEWPORTS[viewportName] });
    // Two page opens — the reference locale and the compared one — and no shots.
    test.describe.configure({ timeout: budgetFor(2, 0) });

    for (const locale of COMPARED_LOCALES) {
      test(`${homeUrlFor(locale)} fits the boxes ${homeUrlFor(REFERENCE_LOCALE)} defines @visual`, async ({
        page,
      }) => {
        await openSettled(page, homeUrlFor(REFERENCE_LOCALE));
        const reference = await measureHomeGeometry(page);

        await openSettled(page, homeUrlFor(locale));
        const compared = await measureHomeGeometry(page);

        // The nav is a token-fixed height (`--nav-h`) and every locale's labels
        // have to live inside it. An equality rather than a tolerance, on
        // purpose: a nav one pixel taller in one locale is a label that
        // wrapped, and there is no design in which that is intended.
        expect(compared.navHeight).toBe(reference.navHeight);

        expect(compared.sections.map((section) => section.id)).toEqual([...SECTION_IDS]);

        for (const id of SECTION_IDS) {
          const here = sectionOf(compared, id);
          const there = sectionOf(reference, id);
          const allowed = there.height + there.lineHeight * OVERFLOW_TOLERANCE_LINES;

          expect(
            here.height,
            `section#${id} at ${viewportName} is ${String(here.height)}px in ${locale} against ` +
              `${String(there.height)}px in ${REFERENCE_LOCALE}, past the ` +
              `${String(OVERFLOW_TOLERANCE_LINES)}-line-height (${String(there.lineHeight)}px) ` +
              "tolerance. Either the copy has outgrown the box, or the section needs the " +
              "min-height 10's PR-8.6 row calls for.",
          ).toBeLessThanOrEqual(allowed);
        }
      });
    }
  });
}
