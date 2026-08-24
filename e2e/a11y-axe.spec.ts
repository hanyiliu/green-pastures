import { expect, test } from "@playwright/test";

import { routing } from "@/i18n/routing";

import {
  describeViolations,
  notFoundUrlFor,
  openA11yPage,
  restScroll,
  scanAxe,
  settleMotion,
} from "./a11y-support";
import { BUILT_PAIRS, homeUrlFor, urlFor } from "./routes-support";
import { VIEWPORTS } from "./visual-support";

/**
 * axe over every route × locale × viewport, and over the states only an
 * interaction produces (PR-8.4 · 08 §6 · `D-08.8`).
 *
 * ## The matrix is three loops, and only two of them are in this file
 *
 * Routes and locales are read from `content/site.json` and
 * `src/i18n/routing.ts` (INV-08.4), so enabling or withdrawing a locale changes
 * what is scanned without anybody editing this file. The third axis — viewport
 * — is the Playwright **project**: `chromium-desktop` runs these at 1280 and
 * `webkit-mobile` at 390 (08 §5), so the sweep never names a size. Running the
 * same test in two projects is what makes it a matrix; a third loop inside one
 * project would only be the same page twice in one engine. The one describe
 * that does pin a viewport is the hamburger's, and the note there says why.
 *
 * ## The interactive states, and why they are separate tests
 *
 * 08 §6 lists them: "`/` with hamburger open (390), lightbox open, menu day
 * switched; the form idle / error / success; 404". Each is a different DOM —
 * the sheet adds a `role="dialog"` with a focus cycle in it, the lightbox adds
 * a modal `<dialog>` with three buttons, the day switch re-labels a `tabpanel`
 * — so scanning the page at rest and calling it covered would miss exactly the
 * markup that only exists once someone has touched something.
 *
 * The form's three states are **not** repeated here. PR-5.10 already scans them
 * in `e2e/form-a11y.spec.ts`, through the same allowlist and the same runner
 * (`e2e/form-axe.ts` re-exports this family's module), and a second copy would
 * be a second thing to keep in step.
 *
 * ## What "clean" means
 *
 * Zero violations of WCAG 2.2 AA, with one allowlist and no per-rule disables
 * (`D-08.8`). A `color-contrast` violation matching an audited pair in
 * `e2e/axe-exceptions.json` is annotated into the report; anything else fails.
 * `e2e/a11y-exceptions.spec.ts` is the other half of that bargain — it proves
 * every entry in the file is still excusing something real.
 */

/**
 * The wall-clock one of these tests needs, stated as arithmetic.
 *
 * A test here opens a page, walks it top to bottom so every `IntersectionObserver`
 * fires, waits for the last entrance and the web fonts, and then runs axe over
 * the whole document — which on `/` is about 1,500 nodes against 100-odd rules.
 * `playwright.config.ts`'s 30 s is a budget for a test that asserts a thing; this
 * is a budget for a page plus a scan, and it is a give-up bound rather than a
 * clock being extended to hide a flake (`D-08.13`): every assertion inside it
 * keeps its own `expect` timeout and the test ends the moment its last scan
 * returns.
 */
const PAGE_BUDGET_MS = 90_000;
const SCAN_BUDGET_MS = 30_000;

/** Text under 24px (or under 18.66px bold) needs 4.5:1 (03 §10). */
const AA_NORMAL = 4.5;

function budgetFor(pageOpens: number, scans: number): number {
  return pageOpens * PAGE_BUDGET_MS + scans * SCAN_BUDGET_MS;
}

test.describe("axe · every route × locale × viewport", () => {
  test.describe.configure({ timeout: budgetFor(1, 1) });

  for (const pair of BUILT_PAIRS) {
    test(`${pair.url} is clean @a11y`, async ({ page }, info) => {
      await openA11yPage(page, pair.url);
      const { unexpected } = await scanAxe(page, info);
      expect(unexpected, describeViolations(unexpected)).toEqual([]);
    });
  }

  for (const locale of routing.locales) {
    test(`${notFoundUrlFor(locale)} is clean @a11y`, async ({ page }, info) => {
      await openA11yPage(page, notFoundUrlFor(locale));
      const { unexpected } = await scanAxe(page, info);
      expect(unexpected, describeViolations(unexpected)).toEqual([]);
    });
  }
});

/**
 * The sheet is `lg:hidden` on both halves — trigger and panel (04 `D-04.9`) — so
 * the viewport is pinned rather than inherited. Inheriting it would mean this
 * test could only run in one project and would have to skip itself in the
 * other; pinning runs the same interaction in **both** engines, which is more
 * coverage than the project matrix gave it and no branch in the test.
 */
test.describe("axe · the hamburger sheet", () => {
  test.use({ viewport: VIEWPORTS.mobile });
  test.describe.configure({ timeout: budgetFor(1, 1) });

  for (const locale of routing.locales) {
    test(`${homeUrlFor(locale)} with the hamburger sheet open is clean @a11y`, async ({
      page,
    }, info) => {
      await openA11yPage(page, homeUrlFor(locale));

      const trigger = page.locator("header button[aria-expanded]");
      await trigger.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await settleMotion(page);

      const { unexpected } = await scanAxe(page, info);
      expect(unexpected, describeViolations(unexpected)).toEqual([]);
    });
  }
});

test.describe("axe · the states an interaction produces", () => {
  test.describe.configure({ timeout: budgetFor(1, 2) });

  for (const locale of routing.locales) {
    test(`${homeUrlFor(locale)} with another menu day selected is clean @a11y`, async ({
      page,
    }, info) => {
      await openA11yPage(page, homeUrlFor(locale));

      const tabs = page.getByRole("tab");
      const second = tabs.nth(1);
      await second.click();
      await expect(second).toHaveAttribute("aria-selected", "true");
      await settleMotion(page);
      // Clicking a chip scrolls it into view, and the sticky header's 92 %-opaque
      // background makes the ground under its text a function of scroll — see
      // `restScroll`.
      await restScroll(page);

      const { unexpected } = await scanAxe(page, info);
      expect(unexpected, describeViolations(unexpected)).toEqual([]);
    });

    test(`${urlFor(locale, "/gallery")} filtered, and with the lightbox open, is clean @a11y`, async ({
      page,
    }, info) => {
      const url = urlFor(locale, "/gallery");
      await openA11yPage(page, url);

      // A filter that removes photographs re-renders the grid; the lightbox's
      // arrows then walk the *filtered* list, so the two states are scanned in
      // that order rather than independently.
      const filters = page.locator("[data-filter]");
      await filters.nth(1).click();
      await expect(filters.nth(1)).toHaveAttribute("aria-pressed", "true");
      await settleMotion(page);
      await restScroll(page);
      const filtered = await scanAxe(page, info);
      expect(filtered.unexpected, describeViolations(filtered.unexpected)).toEqual([]);

      const thumbnail = page.locator("[data-gallery-photo]").first();
      await thumbnail.click();
      await expect(page.locator("dialog[open]")).toBeVisible();
      await settleMotion(page);
      const lightbox = await scanAxe(page, info);
      expect(lightbox.unexpected, describeViolations(lightbox.unexpected)).toEqual([]);
    });
  }
});

/**
 * The one contrast question axe can only answer by accident.
 *
 * The sticky header paints no background of its own: a sibling layer at `-z-10`
 * carries `--color-nav-bg`, which is `rgb(251 248 240 / 92%)` (03 §2.4). Eight
 * per cent of whatever is scrolled underneath therefore shows through the nav's
 * ground, and a page-level axe run only ever measures the one ground the page
 * happened to be scrolled to. That is not a check; it is a sample.
 *
 * So the question is asked as arithmetic instead, over every ground the page can
 * put there — every distinct painted background on the route — and the answer
 * does not depend on where the scan was taken. It is the check that would fail
 * if a future section were dark: `--color-nav-link` is `#4a5040`, which clears
 * AA on cream at 7.87:1 (03 §10) and would not clear it against a nav ground
 * composited over forest.
 */
test.describe("the sticky nav over every ground it can overlap", () => {
  test.describe.configure({ timeout: budgetFor(1, 0) });

  for (const pair of BUILT_PAIRS) {
    test(`${pair.url} keeps the nav readable at any scroll @a11y`, async ({ page }) => {
      await openA11yPage(page, pair.url);

      const measured = await page.evaluate(() => {
        const channels = (value: string): number[] => (value.match(/[\d.]+/g) ?? []).map(Number);

        const luminance = ([r = 0, g = 0, b = 0]: number[]): number => {
          const [lr, lg, lb] = [r, g, b].map((channel) => {
            const scaled = channel / 255;
            return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * (lr ?? 0) + 0.7152 * (lg ?? 0) + 0.0722 * (lb ?? 0);
        };

        const ratio = (fore: number[], back: number[]): number => {
          const a = luminance(fore);
          const b = luminance(back);
          return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
        };

        /** `over` at `alpha`, composited on `under`. */
        const composite = (over: number[], under: number[], alpha: number): number[] =>
          [0, 1, 2].map((index) => (over[index] ?? 0) * alpha + (under[index] ?? 0) * (1 - alpha));

        const layer = document.querySelector("header [aria-hidden]");
        const link = document.querySelector("header a");
        if (layer === null || link === null) return null;

        const navGround = channels(getComputedStyle(layer).backgroundColor);
        const alpha = navGround.length === 4 ? (navGround[3] ?? 1) : 1;
        const linkColour = channels(getComputedStyle(link).color);

        // Every distinct opaque background the document paints — the grounds a
        // reader can scroll under the header.
        const grounds = new Map<string, number[]>();
        for (const node of document.querySelectorAll("body, section, footer, [data-section], dl")) {
          const painted = getComputedStyle(node).backgroundColor;
          if (/rgba\(0, 0, 0, 0\)|transparent/.test(painted)) continue;
          grounds.set(painted, channels(painted));
        }

        return [...grounds.entries()].map(([name, ground]) => ({
          ground: name,
          ratio: ratio(linkColour, composite(navGround, ground, alpha)),
        }));
      });

      expect(measured, "the header has no background layer or no link to measure").not.toBeNull();
      expect(measured?.length ?? 0).toBeGreaterThan(1);

      const unreadable = (measured ?? []).filter((row) => row.ratio < AA_NORMAL);
      expect(
        unreadable,
        unreadable.map((row) => `nav link over ${row.ground} = ${String(row.ratio)}:1`).join("\n"),
      ).toEqual([]);
    });
  }
});
