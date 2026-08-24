import type { MenuEntries } from "@/content/collections";
import type { DayId, MealId } from "@/content/schemas/menu";

/**
 * One cell of the sample week, for the two structures that render all fifteen
 * of them (`D-04.11`).
 *
 * `SampleLine`'s `dishesFor` answers the home section's question — *this day's
 * three dishes* — and returns a fixed `{breakfast, lunch, snack}` record shaped
 * by `home.menu.sampleLine`'s three ICU arguments. This page asks the other
 * question: it iterates `site.menu.meals` and `site.menu.days` and wants one
 * cell at a time, so a record of three named fields is the wrong shape and
 * hard-codes the three meal ids besides.
 *
 * The throw is `dishesFor`'s, near enough word for word, and for the same
 * reason: `noUncheckedIndexedAccess` makes the lookup `string | undefined`, and
 * an `undefined` rendered into a cell is a blank box that reads as a layout bug
 * rather than as the missing content it is. The Zod schema already forbids the
 * gap (`menuCollectionSchema` cross-references `week` against
 * `site.json`'s `days` and `meals` in both directions), so this path is
 * unreachable while the content gate holds — which is exactly why it should
 * name the file and the key when it is not.
 */
export function dishAt(week: MenuEntries["week"], day: DayId, meal: MealId): string {
  const dish = week[day]?.[meal];

  if (dish === undefined) {
    throw new Error(
      `collections/menu.json has no week.${day}.${meal}, which content/site.json's ` +
        `menu.days and menu.meals both declare (02 D-02.11).`,
    );
  }

  return dish;
}
