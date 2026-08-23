import type { DayId } from "@/content/schemas/menu";

/**
 * The menu's two calendar questions, answered without a clock in the browser
 * (04 `D-04.10`, 02 `D-02.6`, 05 §5.6).
 *
 * ── Why this is a module and not four lines in `MenuSection` ─────────────
 *
 * `D-04.10` names `src/lib/menu-day.ts` by path, and the reason is the row's
 * hardest acceptance criterion: **the default selected day is computed on the
 * server**, so the pre-hydration HTML and the no-JS page already show the right
 * chip and the right sample line. A `new Date()` read inside a client component
 * would answer with the *reader's* zone on the second render and with the
 * server's on the first, which is the classic hydration mismatch — and it would
 * be wrong for every parent outside California as well.
 *
 * Both functions here are pure given their `now` / `day` argument, which is
 * what makes "Saturday selects Monday" a unit test rather than a wall-clock
 * wait.
 *
 * ── The two directions ───────────────────────────────────────────────────
 *
 * {@link defaultMenuDay} goes *from* an instant *to* a day id, in
 * `site.timeZone`. {@link weekdayDate} goes the other way — from a day id to a
 * `Date` that next-intl's `weekdayShort` / `weekdayLong` formats can turn into
 * "Mon" / "Wednesday" / "周三". Weekday names are never stored (02 `D-02.6`),
 * so a component that wants one needs a date to hand the formatter, and this is
 * where that date is minted.
 */

/**
 * The seven day ids in `Date.prototype.getUTCDay()` order — Sunday is 0.
 *
 * The order is the platform's, not the design's: `site.menu.days` decides what
 * the section *draws* (`mon` … `fri`), and this array only decodes an index.
 */
const WEEKDAY_IDS = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const satisfies readonly DayId[];

/**
 * A Monday, at noon UTC.
 *
 * Noon rather than midnight because {@link weekdayDate}'s result is formatted
 * in `site.timeZone` (`America/Los_Angeles`, UTC−7/−8): a midnight-UTC Monday
 * is Sunday afternoon in Fremont and every chip would be labelled a day early.
 * Noon leaves twelve hours of slack on the early side and eleven on the late,
 * which covers every zone from UTC−12 to UTC+11 and comfortably covers the one
 * this site uses.
 *
 * 1 January 2024 is the anchor because it is a Monday, which makes the offsets
 * below read as "Monday plus n" rather than as an arithmetic puzzle.
 */
const ANCHOR_MONDAY_UTC = Date.UTC(2024, 0, 1, 12);

/** Milliseconds in a day. UTC has no DST, so this arithmetic is exact. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The calendar date at `now` in `timeZone`, as the three numbers a UTC
 * timestamp is built from.
 *
 * `formatToParts` rather than `format` on purpose: a formatted string has to be
 * parsed back, and the part order, the separators and the numbering system are
 * all locale-dependent. Reading the parts by `type` depends on none of that.
 * The locale is `en-US` only to pin the numbering system to Latin digits; every
 * value read out is a number, never a name, so no user-visible text passes
 * through here (INV-02.1 has nothing to catch).
 */
function calendarDateIn(timeZone: string, now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const numberOf = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);

  return { year: numberOf("year"), month: numberOf("month"), day: numberOf("day") };
}

/**
 * The day whose chip is selected when the page is first painted.
 *
 * Today in `timeZone` if the sample week has it, and otherwise the first day
 * the week declares.
 *
 * **The fallback is `days[0]`, not the literal `"mon"`.** 04 `D-04.10` words
 * the rule as "weekend → `mon`", and with today's `content/site.json`
 * (`days: ["mon" … "fri"]`) the two spellings pick the same chip. They stop
 * agreeing the day an owner edits that array — a week that opened on Tuesday
 * would send every Saturday reader to a `mon` column that has no dishes in it,
 * and `week["mon"]` would be `undefined` rather than a line. Deriving the
 * fallback from the same array the chips are drawn from cannot dangle, and it
 * generalises the rule without contradicting it: a day the sample week does not
 * carry falls back to the first day it does.
 *
 * @param days      `site.menu.days`, in display order.
 * @param timeZone  `site.timeZone` — 02 `D-02.6`'s fixed zone.
 * @param now       The instant to read. Defaulted so callers need not pass it,
 *                  and injectable so the tests need not wait for Saturday.
 */
export function defaultMenuDay(
  days: readonly DayId[],
  timeZone: string,
  now: Date = new Date(),
): DayId {
  const first = days[0];
  if (first === undefined) {
    throw new Error(
      "defaultMenuDay was given an empty week; content/site.json declares menu.days " +
        "with at least one entry (02 D-02.11).",
    );
  }

  const { year, month, day } = calendarDateIn(timeZone, now);
  const today = WEEKDAY_IDS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return today !== undefined && days.includes(today) ? today : first;
}

/**
 * A `Date` that falls on `day`, for the `weekdayShort` / `weekdayLong` formats
 * to name (02 `D-02.6`: weekday names are derived, never stored).
 *
 * The instant carries no other meaning — only its weekday is ever read — so the
 * anchor week is arbitrary and fixed, which keeps the chip labels identical on
 * every request and in every snapshot.
 */
export function weekdayDate(day: DayId): Date {
  const index = WEEKDAY_IDS.indexOf(day);
  if (index < 0) {
    throw new Error(`weekdayDate was given "${day}", which is not one of the seven day ids.`);
  }

  // WEEKDAY_IDS is Sunday-first and the anchor is a Monday, so Sunday is the
  // *last* day of the anchor week rather than the day before it.
  const offset = index === 0 ? 6 : index - 1;
  return new Date(ANCHOR_MONDAY_UTC + offset * DAY_MS);
}
