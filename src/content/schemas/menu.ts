import { z } from "zod";

import { Id, idEnum, Text } from "./primitives";

/**
 * The `menu` collection (02 `D-02.11`, *Design → Collections → menu*).
 *
 * Day and meal identifiers are locale-agnostic ids; the chip labels ("Mon" /
 * "周一") and long names are **derived** with the `weekdayShort` /
 * `weekdayLong` formats of `src/i18n/formats.ts`, never stored (02 `D-02.6`).
 * The only text here is the dish in each cell and the dietary chip labels.
 */

/* -------------------------------------------------------------------------- *
 * Identifiers
 * -------------------------------------------------------------------------- */

/** The seven weekday ids. `hours.days` and `menu.days` both draw from this set. */
export const DayId = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export type DayId = z.infer<typeof DayId>;

/** The three meals the kitchen serves (02 *Design → Collections*). */
export const MealId = z.enum(["breakfast", "lunch", "snack"]);
export type MealId = z.infer<typeof MealId>;

/* -------------------------------------------------------------------------- *
 * Per-locale text
 * -------------------------------------------------------------------------- */

/** "🥦 Vegetarian options daily" / "🥦 Vegetarian daily" — emoji inline (02 `D-02.5`). */
export const DietaryText = z.strictObject({
  label: Text,
  labelShort: Text.optional(),
});
export type DietaryText = z.infer<typeof DietaryText>;

/**
 * One `menu.json`, cross-referenced against `site.json` in three directions at
 * once: the week has exactly the declared days, each day exactly the declared
 * meals, and `dietary` exactly the declared chips.
 */
export function menuCollectionSchema(shared: MenuShared) {
  const day = idEnum(shared.days);
  const meal = idEnum(shared.meals);
  return z.strictObject({
    week: z.record(day, z.record(meal, Text)),
    dietary: z.record(idEnum(shared.dietary.map((entry) => entry.id)), DietaryText),
  });
}

export type MenuCollection = {
  readonly week: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly dietary: Readonly<Record<string, DietaryText>>;
};

/* -------------------------------------------------------------------------- *
 * Shared data — content/site.json → menu
 * -------------------------------------------------------------------------- */

export const DietaryShared = z.strictObject({
  id: Id,
  /** Whether the chip appears in the home Menu section as well as the page. */
  onHome: z.boolean().default(true),
});
export type DietaryShared = z.infer<typeof DietaryShared>;

export const MenuShared = z.strictObject({
  /** The columns of the sample week, in display order. */
  days: z.array(DayId).min(1),
  /** The rows, in serving order. */
  meals: z.array(MealId).min(1),
  dietary: z.array(DietaryShared).min(1),
});
export type MenuShared = z.infer<typeof MenuShared>;
