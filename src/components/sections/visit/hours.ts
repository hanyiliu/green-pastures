import type { DayId } from "@/content/schemas/menu";

/**
 * The two instants the opening-hours panel needs, so that not one word of
 * "Monday – Friday · 7:30 am – 6:00 pm" is ever typed (02 `D-02.6`, PR-5.7's
 * acceptance: *hours derived from `site.hours`, never typed*).
 *
 * `content/site.json` stores the hours as **data**: five day ids and two
 * wall-clock strings, `"07:30"` and `"18:00"`. Everything a parent reads is
 * produced from them at render time — the weekday names by the `weekdayLong`
 * format, the times by `timeShort`, and the two dashes by
 * `common.format.dayRange` / `common.format.timeRange`. A new locale therefore
 * gets its own hours line for free, and an owner who opens on Saturday edits
 * one array.
 *
 * `Intl` names a weekday and a time only from a `Date`, so this module's whole
 * job is to mint the two `Date`s that stand for values which are not instants.
 * `src/lib/menu-day.ts` already does that for a weekday
 * ({@link weekdayDate}); {@link openingTimeDate} is the same trick for a time
 * of day, and the reason it is not as simple lives in its docstring.
 */

/* -------------------------------------------------------------------------- *
 * The anchor
 * -------------------------------------------------------------------------- */

/**
 * The calendar day every derived instant sits on: 1 January 2024.
 *
 * Only the *time* of the result is ever formatted, so the date is arbitrary and
 * fixed — which is what keeps the panel identical on every request and in every
 * snapshot. Mid-winter is not arbitrary, though: {@link openingTimeDate} reads
 * the zone's UTC offset once, and a day with no daylight-saving transition
 * within a few hours of it is a day where reading it once is exact.
 */
const ANCHOR = { year: 2024, month: 0, day: 1 } as const;

/** `HH:MM`, the shape `TimeOfDay` in `src/content/schemas/primitives.ts` admits. */
const TIME_OF_DAY = /^(?<hours>\d{2}):(?<minutes>\d{2})$/u;

/* -------------------------------------------------------------------------- *
 * Times
 * -------------------------------------------------------------------------- */

/**
 * How far `timeZone` is ahead of UTC at `instant`, in milliseconds.
 *
 * The `formatToParts` shape is `menu-day.ts`'s, for its reasons: a formatted
 * string would have to be parsed back through locale-dependent separators and
 * numbering systems, while reading parts by `type` depends on neither. `en-US`
 * pins the digits to Latin; every value read out is a number, never a name, so
 * no user-visible text passes through here (INV-02.1 has nothing to catch).
 */
function zoneOffsetMs(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const numberOf = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);

  const asUtc = Date.UTC(
    numberOf("year"),
    numberOf("month") - 1,
    numberOf("day"),
    numberOf("hour"),
    numberOf("minute"),
    numberOf("second"),
  );

  return asUtc - instant.getTime();
}

/**
 * The instant whose clock reads `time` in `timeZone` — the `Date` the
 * `timeShort` format turns into "7:30 AM" / "上午7:30".
 *
 * **Why an offset is involved at all.** `site.hours.open` is a *wall clock*,
 * not a moment: 7:30 in Fremont, every day of the year. The request config
 * formats every date in `site.timeZone` (02 `D-02.6`), so handing the formatter
 * a naive `Date.UTC(…, 7, 30)` would print 11:30 pm the previous day — the
 * zone conversion is applied whether or not the value ever meant one. Shifting
 * the naive timestamp back by the zone's offset makes the conversion a
 * round trip, and the panel prints the clock the owner typed.
 *
 * The zone comes from `site.timeZone` rather than from a constant here: it is
 * the same field the hours themselves are quoted against, so a daycare that
 * moves states edits one line of content and nothing else.
 *
 * @param time      `HH:MM`, from `site.hours.open` / `site.hours.close`.
 * @param timeZone  `site.timeZone`.
 */
export function openingTimeDate(time: string, timeZone: string): Date {
  const match = TIME_OF_DAY.exec(time);
  const hours = Number(match?.groups?.hours);
  const minutes = Number(match?.groups?.minutes);

  if (match === null || hours > 23 || minutes > 59) {
    throw new Error(
      `openingTimeDate was given "${time}", which is not the 24-hour HH:MM that ` +
        `content/site.json's hours.open / hours.close carry (02 D-02.6).`,
    );
  }

  const naive = Date.UTC(ANCHOR.year, ANCHOR.month, ANCHOR.day, hours, minutes);
  return new Date(naive - zoneOffsetMs(timeZone, new Date(naive)));
}

/* -------------------------------------------------------------------------- *
 * Days
 * -------------------------------------------------------------------------- */

/**
 * The two ends of `site.hours.days`, as the day ids
 * `src/lib/menu-day.ts`'s `weekdayDate` turns into dates to name.
 *
 * The range is read off the array rather than assumed to be Monday–Friday: an
 * owner who opens Tuesday to Saturday edits `hours.days` and the panel follows.
 * A single-day week collapses to the same id twice, which
 * `common.format.dayRange` renders as "Monday – Monday" — honest, and a shape
 * the design never draws.
 */
export function hoursDayRange(days: readonly DayId[]): {
  readonly from: DayId;
  readonly to: DayId;
} {
  const from = days.at(0);
  const to = days.at(-1);

  if (from === undefined || to === undefined) {
    throw new Error(
      "hoursDayRange was given an empty week; content/site.json declares hours.days with at " +
        "least one entry (02 D-02.11).",
    );
  }

  return { from, to };
}
