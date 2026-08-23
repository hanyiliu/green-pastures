import { TIME_ZONE } from "@/i18n/formats";

/**
 * The "Desired start" month window (07 §1, `D-07.2`).
 *
 * The control is a native `<select>` of the next 12 months plus `asap` and
 * `flexible`; the server tolerates a wider window — current month −1 to +24 —
 * "so a statically rendered page a few weeks old still validates". Both numbers
 * live here, and so does the only arithmetic: a `YYYY-MM` id is compared as an
 * **absolute month index** (`year * 12 + month`), which makes a December-to-
 * January step ordinary subtraction instead of a special case.
 *
 * "Now" is read in `site.timeZone` (02 `D-02.6`), not in the server's zone, for
 * the same reason the menu's default day is: a request at 16:00 UTC on the 1st
 * is still the previous month in California, and the option list a browser
 * renders must be the list the handler accepts.
 *
 * There are no message keys for months. Their labels come from
 * `Intl.DateTimeFormat` through next-intl's `dateMonth` format (02 rule 8), so
 * adding a locale never touches this list.
 */

/** How far back a `YYYY-MM` may sit before the current month, server-side. */
export const START_WINDOW_BACK_MONTHS = 1;

/** How far ahead a `YYYY-MM` may sit, server-side. */
export const START_WINDOW_FORWARD_MONTHS = 24;

/** How many months the form actually offers (07 §1: "12 months offered"). */
export const START_OPTION_COUNT = 12;

/** The two non-month choices, which are ids rather than dates. */
export const DESIRED_START_KEYWORDS = ["asap", "flexible"] as const;
export type DesiredStartKeyword = (typeof DESIRED_START_KEYWORDS)[number];

/** `2026-10` — four digits, a hyphen, a two-digit month in `01`–`12`. */
export const MONTH_ID_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;

/** Is `value` shaped like a month option id? */
export function isMonthId(value: string): boolean {
  return MONTH_ID_PATTERN.test(value);
}

/** Is `value` `asap` or `flexible`? */
export function isDesiredStartKeyword(value: string): value is DesiredStartKeyword {
  return (DESIRED_START_KEYWORDS as readonly string[]).includes(value);
}

/** A calendar month as one number, so ordering and differences are arithmetic. */
function absoluteMonth(year: number, month: number): number {
  return year * 12 + (month - 1);
}

/** Turn an absolute month index back into a `YYYY-MM` id. */
function monthIdOf(absolute: number): string {
  const year = Math.floor(absolute / 12);
  const month = absolute - year * 12 + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** Parse a `YYYY-MM` id, or `undefined` when it is not one. */
function parseMonthId(value: string): number | undefined {
  if (!isMonthId(value)) return undefined;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return absoluteMonth(year, month);
}

/**
 * The current month in `timeZone`, as an absolute month index.
 *
 * `en-CA` is not a locale choice — it is the shortest way to ask `Intl` for
 * ISO-ordered numeric parts, and the output is parsed, never shown. INV-02.9 is
 * about branching on the *site's* locale; this is a formatter argument.
 */
export function currentAbsoluteMonth(now: Date, timeZone: string = TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const find = (type: "year" | "month") => Number(parts.find((part) => part.type === type)?.value);
  return absoluteMonth(find("year"), find("month"));
}

/**
 * The month ids the form offers, starting with the current month (07 §1).
 * Computed at render, which is why the server's accepted window is wider.
 */
export function monthOptionIds(
  now: Date,
  options: { readonly count?: number; readonly timeZone?: string } = {},
): readonly string[] {
  const count = options.count ?? START_OPTION_COUNT;
  const first = currentAbsoluteMonth(now, options.timeZone);
  return Array.from({ length: count }, (_, index) => monthIdOf(first + index));
}

/**
 * Is `value` a `YYYY-MM` inside the window the handler accepts — the current
 * month less {@link START_WINDOW_BACK_MONTHS} through plus
 * {@link START_WINDOW_FORWARD_MONTHS}, inclusive at both ends?
 *
 * A value that is not a month id at all is *not* out of range; it is not an
 * option, and the schema reports `invalid_option` for it. Keeping the two apart
 * is what lets the form tell a parent "that month has passed" instead of "that
 * is not a month".
 */
export function isMonthIdInWindow(value: string, now: Date, timeZone: string = TIME_ZONE): boolean {
  const month = parseMonthId(value);
  if (month === undefined) return false;
  const current = currentAbsoluteMonth(now, timeZone);
  return (
    month >= current - START_WINDOW_BACK_MONTHS && month <= current + START_WINDOW_FORWARD_MONTHS
  );
}
