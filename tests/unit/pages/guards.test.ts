import { describe, expect, it } from "vitest";

import { MEAL_CELL, MEAL_LABEL, mealClass } from "@/components/pages/menu/layout";
import { dishAt } from "@/components/pages/menu/week";
import { chipToneFor } from "@/components/pages/programs/layout";
import type { MenuEntries } from "@/content/collections";
import { getSite } from "@/content/site";

/**
 * The three pure helpers behind this row's two pages, and — the point of the
 * file — the guards they fail through.
 *
 * Each of the three sits on a path the content gate already forbids: the Zod
 * schemas cross-reference `collections/menu.json`'s week against
 * `content/site.json`'s `menu.days` and `menu.meals` in both directions, and
 * `site.programs[]` cannot be empty. So none of these throws can fire while
 * `pnpm validate:content` passes.
 *
 * They are tested anyway, because the alternative to each of them is a *silent*
 * wrong render — a blank table cell, a white unstyled pill, a chip in the wrong
 * palette — and a guard nobody has ever executed is a guard nobody knows the
 * message of. `src/content/collections.ts` makes the same trade and states it
 * the same way.
 */

const site = getSite();

describe("chipToneFor", () => {
  it("gives the three rooms the three tones the reference draws", () => {
    expect(site.programs.map((_, index) => chipToneFor(index))).toEqual([
      "lavender",
      "gold",
      "sage-soft",
    ]);
  });

  it("cycles rather than dangling, so a fourth room still gets a palette", () => {
    // Position, not identity (INV-04.4): the table is indexed, so it cannot
    // return `undefined` for a room `content/site.json` adds later.
    expect(chipToneFor(3)).toBe(chipToneFor(0));
    expect(chipToneFor(97)).toBe(chipToneFor(1));
  });
});

describe("mealClass", () => {
  it("answers for every meal site.json declares, in both maps", () => {
    for (const meal of site.menu.meals) {
      expect(mealClass(MEAL_LABEL, meal)).toContain(`--color-dot-label-${meal}`);
      expect(mealClass(MEAL_CELL, meal)).toContain(`--color-dot-label-${meal}`);
    }
  });

  it("mixes the label at 15 % and the cell at 5 % of the meal's own colour", () => {
    // One formula with one parameter per role — see the note in `layout.ts`.
    for (const meal of site.menu.meals) {
      expect(mealClass(MEAL_LABEL, meal)).toContain("_15%,var(--color-white)");
      expect(mealClass(MEAL_CELL, meal)).toContain("_5%,var(--color-white)");
    }
  });

  it("throws by name for a meal with no row, rather than rendering a white box", () => {
    expect(() => mealClass(MEAL_LABEL, "brunch")).toThrowError(/no colours for the meal "brunch"/u);
  });
});

describe("dishAt", () => {
  const week: MenuEntries["week"] = {
    mon: { breakfast: "Oatmeal", lunch: "Rice bowl", snack: "Apple" },
  };

  it("returns the cell the sample week declares", () => {
    expect(dishAt(week, "mon", "lunch")).toBe("Rice bowl");
  });

  it("names the file and the key when a day is missing", () => {
    expect(() => dishAt(week, "tue", "lunch")).toThrowError(/no week\.tue\.lunch/u);
  });

  it("names the file and the key when a meal is missing from a day", () => {
    expect(() => dishAt({ mon: { lunch: "Rice bowl" } }, "mon", "snack")).toThrowError(
      /no week\.mon\.snack/u,
    );
  });
});
