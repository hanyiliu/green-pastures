import { getFormatter, getTranslations } from "next-intl/server";

import { Reveal } from "@/components/motion/Reveal";
import type { MenuEntries } from "@/content/collections";
import { weekdayDate } from "@/lib/menu-day";

import {
  MEAL_CELL,
  MEAL_LABEL,
  mealClass,
  MENU_CELL,
  MENU_TABLE,
  MENU_TABLE_CARD,
  MENU_TABLE_LABEL_COL,
  MENU_TH_DAY,
  MENU_TH_MEAL,
} from "./layout";
import { dishAt } from "./week";

/**
 * The sample week as a table — meals down, Mon–Fri across (04 §3.6, `D-04.11`;
 * D L443–472).
 *
 * ── A real table, and why that matters ──────────────────────────────────
 *
 * Fifteen dishes only mean something as a grid: "Wednesday, lunch" is the
 * question a parent has, and answering it needs the row and the column both.
 * So this is a `<table>` with `<th scope="col">` days and `<th scope="row">`
 * meals — a screen reader announces "Wednesday, Lunch, tofu and veggie
 * stir-fry" when the reader arrives in the cell, which no stack of `<div>`s can
 * do. The reference draws it as a CSS grid; the 7px gutters and the 120px label
 * column are reproduced with `border-spacing` and `table-fixed` instead
 * (`layout.ts`), so the drawing is unchanged and the semantics survive.
 *
 * The caption is `menu.eyebrow` — "This week's menu" — rendered `sr-only`
 * because the design draws no visible caption and the eyebrow above the table
 * already carries the words. Reusing the key rather than adding one keeps the
 * table's accessible name and the page's own eyebrow from ever disagreeing.
 *
 * ── Weekday names are derived, never stored (02 `D-02.6`) ───────────────
 *
 * The column headers are `weekdayShort` over `weekdayDate(day)` —
 * `src/lib/menu-day.ts`, the module PR-5.3 put on that path precisely so this
 * page could reuse it rather than mint a second answer to "what date names
 * Wednesday". Nothing in `content/` spells "Mon" in any locale.
 *
 * ── It is `≥ md` only ───────────────────────────────────────────────────
 *
 * `D-04.11`: the mobile drawing is a *transpose* of this one — a card per day
 * rather than a column per day — and a transpose cannot be reached from one DOM
 * with CSS. So `DayCards` renders the same fifteen strings a second time and
 * `display: none` hides whichever of the two the viewport does not want, which
 * also takes it out of the accessibility tree. That is the stated cost of the
 * decision, not an oversight.
 */

/** The `Reveal` registry key for the table (`"<page>.<slot>"`, 05 §5.1). */
const TABLE_REVEAL_ID = "menu.table";

export type WeeklyMenuTableProps = {
  /** `getMenu(locale)` — the days, the meals and the sample week. */
  readonly menu: MenuEntries;
};

export async function WeeklyMenuTable({ menu }: WeeklyMenuTableProps) {
  const t = await getTranslations("menu");
  const format = await getFormatter();

  return (
    <Reveal id={TABLE_REVEAL_ID} variant="rise" className={MENU_TABLE_CARD}>
      <table className={MENU_TABLE}>
        <caption className="sr-only">{t("eyebrow")}</caption>

        <colgroup>
          {/*
            The label column is fixed at 120px and the five day columns divide
            what is left, which is the reference's `120px repeat(5, 1fr)`
            (D L444) under `table-fixed`.
          */}
          <col className={MENU_TABLE_LABEL_COL} />
          {menu.days.map((day) => (
            <col key={day} />
          ))}
        </colgroup>

        <thead>
          <tr>
            {/*
              The empty corner the reference draws (D L444). It is a `<td>`, not
              a `<th>`: it labels nothing, and an empty header cell is announced
              as one.
            */}
            <td />

            {menu.days.map((day) => (
              <th key={day} scope="col" data-day={day} className={MENU_TH_DAY}>
                {format.dateTime(weekdayDate(day), "weekdayShort")}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {menu.meals.map((meal) => (
            <tr key={meal}>
              <th
                scope="row"
                data-meal={meal}
                className={`${MENU_TH_MEAL} ${mealClass(MEAL_LABEL, meal)}`}
              >
                {t(`meals.${meal}`)}
              </th>

              {menu.days.map((day) => (
                <td key={day} className={`${MENU_CELL} ${mealClass(MEAL_CELL, meal)}`}>
                  {dishAt(menu.week, day, meal)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Reveal>
  );
}
