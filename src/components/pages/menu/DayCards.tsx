import { getFormatter, getTranslations } from "next-intl/server";

import { Reveal, RevealItem } from "@/components/motion/Reveal";
import type { MenuEntries } from "@/content/collections";
import { weekdayDate } from "@/lib/menu-day";

import {
  DAY_CARD,
  DAY_CARD_DISH,
  DAY_CARD_LIST,
  DAY_CARD_MEAL,
  DAY_CARD_MEALS,
  DAY_CARD_ROW,
  DAY_CARD_TITLE,
  MEAL_LABEL,
  mealClass,
} from "./layout";
import { dishAt } from "./week";

/**
 * The sample week as five cards — one per day (04 §3.6, `D-04.11`; M L332–371).
 *
 * The transpose of `WeeklyMenuTable`: where the table gives a day a column,
 * this gives it a card, with the three meals as a description list inside.
 * `D-04.11` renders both structures on the server and hides one with
 * `display: none` precisely because that transpose is not reachable from one
 * DOM — the cost is fifteen short strings twice, and the benefit is that the
 * narrow view is the design's rather than a squeezed table.
 *
 * ── The markup 04 §3.6 asks for ─────────────────────────────────────────
 *
 * "`<section>` per day with `h2`, `<dl>` meal → dish". The `h2` sits under the
 * page's `h1` exactly as the Programs page's room names do, and the `<dl>` is
 * what says *breakfast is the name of this dish* rather than leaving two spans
 * side by side. Each `<div>` inside the `<dl>` groups one `<dt>`/`<dd>` pair,
 * which is the grouping element the spec provides and what lets the pair be a
 * flex row without breaking the list.
 *
 * The `<section>`s are `aria-labelledby` their own `h2` — a `<section>` with no
 * accessible name is not exposed as a region, so naming them is what makes the
 * five days navigable as landmarks on a screen reader.
 *
 * ── Weekday names ───────────────────────────────────────────────────────
 *
 * `weekdayLong` here against the table's `weekdayShort` (04 §3.6), over the same
 * `weekdayDate()` from `src/lib/menu-day.ts`. Still derived, still never stored
 * (02 `D-02.6`).
 *
 * ── The entrance ────────────────────────────────────────────────────────
 *
 * `riseChild` stagger (04 §3.6): one `Reveal stagger` over five `RevealItem`s,
 * one observer for the group (INV-05.9), 110 ms apart in DOM order.
 */

/** The `Reveal` registry key for the card stack (`"<page>.<slot>"`, 05 §5.1). */
const CARDS_REVEAL_ID = "menu.days";

/** One day's heading id, so its `<section>` can point `aria-labelledby` at it. */
function dayTitleId(day: string): string {
  return `menu-day-${day}-title`;
}

export type DayCardsProps = {
  /** `getMenu(locale)` — the days, the meals and the sample week. */
  readonly menu: MenuEntries;
};

export async function DayCards({ menu }: DayCardsProps) {
  const t = await getTranslations("menu");
  const format = await getFormatter();

  return (
    <Reveal id={CARDS_REVEAL_ID} stagger className={DAY_CARD_LIST}>
      {menu.days.map((day, index) => {
        const titleId = dayTitleId(day);

        return (
          <RevealItem key={day} variant="riseChild" index={index}>
            <section aria-labelledby={titleId} data-day={day} className={DAY_CARD}>
              <h2 id={titleId} className={DAY_CARD_TITLE}>
                {format.dateTime(weekdayDate(day), "weekdayLong")}
              </h2>

              <dl className={DAY_CARD_MEALS}>
                {menu.meals.map((meal) => (
                  <div key={meal} className={DAY_CARD_ROW}>
                    <dt className={`${DAY_CARD_MEAL} ${mealClass(MEAL_LABEL, meal)}`}>
                      {t(`meals.${meal}`)}
                    </dt>
                    <dd className={DAY_CARD_DISH}>{dishAt(menu.week, day, meal)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </RevealItem>
        );
      })}
    </Reveal>
  );
}
