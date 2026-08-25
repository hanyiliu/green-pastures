import { expect, test } from "@playwright/test";

import { routing } from "@/i18n/routing";

import {
  CONTRAST_EXCEPTIONS,
  expiryGateHasPassed,
  matchException,
  openA11yPage,
  runAxe,
  type ContrastException,
} from "./a11y-support";
import { urlFor } from "./routes-support";
import { VIEWPORTS } from "./visual-support";

/**
 * Every entry in `e2e/axe-exceptions.json` is load-bearing (PR-8.4 · `D-08.8`).
 *
 * ## The defect this file exists because of
 *
 * An exception in `e2e/form-axe.ts` compared its colour pair **unordered**. The
 * entry was written for the submit button — `#ffffff` on `#6f8a5f`, 3.83 — and
 * because the match ran in either direction it also excused sage used as *text*
 * on white: the same two colours, the same ratio, a different element, and a
 * failure 03 §10 had never passed. One entry covering two defects, one of them
 * nobody knew about. It surfaced only because a seat deleted an exception
 * expecting a red run and got a green one.
 *
 * So an allowlist needs two properties, and neither is free:
 *
 * 1. **The match is oriented.** `fg` is matched as the text colour and `bg` as
 *    the ground, never as a set. Pinned below against the exact pair that
 *    caused the defect, for every entry rather than for that one.
 * 2. **Every entry still excuses something.** An entry that matches nothing is
 *    either dead — the design has moved and the entry is stale — or it is
 *    shadowing, which is the first case wearing a disguise. The witness tests
 *    open the route each entry names and assert that this exact entry matched a
 *    real violation there.
 *
 * ## Why that is the deletion proof, and not a proxy for it
 *
 * "Delete the entry and the suite goes red" is a statement about what happens
 * when nothing matches a node. Three facts compose into it:
 *
 * - `e2e/a11y-support.ts` refuses to load a file in which two entries claim the
 *   same oriented pair at the same ratio;
 * - `matchException` returns the first entry that matches, so with the pair
 *   unique the entry that matched a node is the *only* one that could have;
 * - an unmatched `color-contrast` node fails `e2e/a11y-axe.spec.ts`.
 *
 * So an entry proved to have matched a node here is an entry whose removal
 * leaves that node unmatched and the sweep red. The test does not have to
 * delete anything to establish the consequence of deleting it — and unlike a
 * one-off deletion experiment run by hand, it is re-established on every run.
 *
 * ## One page open per route, not per entry
 *
 * Sixteen of the thirty-four entries live on `/`. Opening it sixteen times
 * would be sixteen full page walks to read one axe result each; the entries are
 * grouped by the route and viewport their witness names, and each group is one
 * open and one scan with an assertion per entry inside it.
 */

const WITNESS_LOCALE = routing.defaultLocale;

/** One page open plus one whole-document scan. */
const WITNESS_BUDGET_MS = 150_000;

/** Entries sharing a witness route, at one viewport. */
function entriesOn(route: string, width: number): readonly ContrastException[] {
  return CONTRAST_EXCEPTIONS.filter(
    (entry) => entry.witness.route === route && entry.witness.widths.includes(width),
  );
}

const WITNESS_ROUTES = [...new Set(CONTRAST_EXCEPTIONS.map((entry) => entry.witness.route))].sort();

test.describe("the axe allowlist", () => {
  test("has not outlived its expiry gate @a11y", () => {
    expect(
      expiryGateHasPassed(),
      "OQ-03.2 is answered, so e2e/axe-exceptions.json is past its `expires` gate (D-08.8). " +
        "Re-cut the list against the approved palette: an entry whose pair the decision " +
        "replaces must go, and the token edit that replaces it belongs in the same PR (INV-03.5).",
    ).toBe(false);
  });

  test("matches its pairs in one direction only @a11y", () => {
    for (const entry of CONTRAST_EXCEPTIONS) {
      const upright = matchException({
        target: entry.selector,
        fg: entry.fg,
        bg: entry.bg,
        ratio: entry.ratio,
      });
      expect(upright?.id, `${entry.id} no longer matches its own pair`).toBe(entry.id);

      // The regression itself: the same two colours the other way round is a
      // different defect, and no entry may excuse it.
      const inverted = matchException({
        target: entry.selector,
        fg: entry.bg,
        bg: entry.fg,
        ratio: entry.ratio,
      });
      expect(
        inverted,
        `${entry.id} excuses its own inverse (${entry.bg} as text on ${entry.fg}), ` +
          "which is a separate failure and needs a separate audited entry",
      ).toBeUndefined();
    }
  });
});

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`every allowlist entry is still excusing something · ${name}`, () => {
    test.use({ viewport });
    test.describe.configure({ timeout: WITNESS_BUDGET_MS });

    for (const route of WITNESS_ROUTES) {
      const entries = entriesOn(route, viewport.width);
      if (entries.length === 0) continue;

      test(`${urlFor(WITNESS_LOCALE, route)} still fails on ${String(entries.length)} audited pairs @a11y`, async ({
        page,
      }) => {
        await openA11yPage(page, urlFor(WITNESS_LOCALE, route));

        const { matched } = await runAxe(page);

        for (const entry of entries) {
          // The selector is documentation, and documentation that has rotted is
          // worse than none: it sends the next reader to an element that no
          // longer exists. Asserted separately from the pair, so a red test says
          // which of the two moved.
          await expect(
            page.locator(entry.selector).first(),
            `${entry.id}: its \`selector\` matches nothing on ${route}`,
          ).toBeAttached();

          expect(
            matched,
            `${entry.id} (${entry.fg} on ${entry.bg} at ${String(entry.ratio)}:1) excused nothing ` +
              `on ${route} at ${String(viewport.width)} px. Either the pair has been fixed — ` +
              "delete the entry — or the element has moved and the witness needs updating.",
          ).toContain(entry.id);
        }
      });
    }
  });
}
