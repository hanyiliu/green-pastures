import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { MenuEntries } from "@/content/collections";
import type { DayId, MealId } from "@/content/schemas/menu";
import { weekdayDate } from "@/lib/menu-day";

import { SAMPLE_LINE, SAMPLE_LINE_DAY } from "./layout";

/**
 * One day's meals as a sentence (04 §4's `SampleLine` row; D L205, M L135).
 *
 * `home.menu.sampleLine` is `"<day>{weekday}</day> — {breakfast} · {lunch} ·
 * {snack}"`. Every visible word in it comes from content: the three dishes from
 * `collections.menu.week.<day>`, and the weekday from the `weekdayLong` format
 * over a date `src/lib/menu-day.ts` mints, because weekday names are derived
 * and never stored (02 `D-02.6`). The em dash and the middots are the
 * translated string's own — nothing is concatenated here.
 *
 * `<day>` is in 02 `D-02.5`'s closed tag list, glossed there as "bold weekday
 * in the menu sample line"; the design draws it in ink against the line's muted
 * `--section-sub` (D L205). The mapping is inline because `richTags()`
 * (`D-04.13`, `components/ui/rich.tsx`) is not built yet; it belongs there when
 * it lands.
 *
 * ── Why `dishes` is a prop, where 04 §4's row lists only `day` ───────────
 *
 * Reading the collection here would make this an `async` component, and 04 §4's
 * row also has it rendered **five times** per page (`D-04.10`). Five awaits of
 * a cached loader is the small cost; the real one is that an async component
 * cannot be rendered by the client renderer at all, so the section's own render
 * test could not mount it and every assertion about the sample line would have
 * to be made against a mock of this file.
 *
 * Taking the three dishes as data keeps it a synchronous RSC — `useTranslations`
 * / `useFormatter`, which is what 04 §5.1 prescribes for one — and puts the
 * loader call where 04 §2's data flow puts it: once, in the section. The prop
 * list is the deviation; the copy, the format and the tag are the row's.
 *
 * ── Rendered five times, one visible (`D-04.10`) ─────────────────────────
 *
 * `MenuSection` builds one of these per weekday and hands the record to
 * `MenuDayChips`. React renders all five on the server — they are server nodes
 * passed as a prop to a client component — and the client mounts whichever the
 * reader has selected. That is what makes the swap instant, keeps the dishes
 * off the client bundle entirely, and leaves the whole week in the RSC payload
 * for a reader who never presses a chip.
 *
 * ── Casing is the content tree's ─────────────────────────────────────────
 *
 * 04 §4 carries 02's "flag for 04" here: the capitalised cells render **as
 * written**, with no CSS `lowercase`. `text-transform` does nothing to Chinese
 * glyphs, so lower-casing the English would make `en` disagree with both
 * Chinese locales on a difference the reader can see; the casing stays 02's to
 * edit.
 */

/** The three dishes the ICU message names by argument. */
export type SampleLineDishes = Readonly<Record<MealId, string>>;

export type SampleLineProps = {
  /** A day id from `site.menu.days` — the weekday the line names. */
  readonly day: DayId;
  /** That day's column of the sample week. */
  readonly dishes: SampleLineDishes;
};

/**
 * One day's column of the sample week, ready for the message's three arguments.
 *
 * The schema cross-checks `week` against `site.menu.days` and `site.menu.meals`
 * in both directions (02 `D-02.11`), so a missing cell cannot survive
 * `pnpm validate:content` — which is exactly why the unreachable case throws
 * with the key rather than printing an empty slot into the sentence and leaving
 * a reader to notice the gap.
 */
export function dishesFor(week: MenuEntries["week"], day: DayId): SampleLineDishes {
  const column = week[day];

  const cell = (meal: MealId): string => {
    const dish = column?.[meal];
    if (dish === undefined) {
      throw new Error(
        `collections/menu.json has no week.${day}.${meal}, which content/site.json's ` +
          `menu.days and menu.meals both declare (02 D-02.11).`,
      );
    }
    return dish;
  };

  return { breakfast: cell("breakfast"), lunch: cell("lunch"), snack: cell("snack") };
}

/** `D-04.13`'s `day`: the weekday, in ink against the line's muted colour. */
function boldDay(chunks: ReactNode) {
  return <b className={SAMPLE_LINE_DAY}>{chunks}</b>;
}

export function SampleLine({ day, dishes }: SampleLineProps) {
  const t = useTranslations("home.menu");
  const format = useFormatter();

  return (
    <p className={SAMPLE_LINE}>
      {t.rich("sampleLine", {
        day: boldDay,
        weekday: format.dateTime(weekdayDate(day), "weekdayLong"),
        ...dishes,
      })}
    </p>
  );
}
