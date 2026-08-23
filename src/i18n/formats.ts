import type { Formats } from "next-intl";

/**
 * Named formats (02 `D-02.6`, *Design → Message syntax and formatting*).
 *
 * Referenced by name from ICU (`{rating, number, rating}`) or from
 * `useFormatter()`. Weekday names, opening hours and time-of-day values are
 * *derived* from data with `Intl` rather than translated, which is why they are
 * formats and not message keys — a new locale gets them for free.
 *
 * `AppConfig['Formats']` is `typeof formats` (see `global.d.ts`), so a format
 * name that is not declared here is a type error at the call site.
 */
export const formats = {
  number: {
    /** The Yelp rating: `5` renders as "5.0" (02, `common.rating.ariaLabel`). */
    rating: { minimumFractionDigits: 1 },
  },
  dateTime: {
    /** Opening hours and the daily-rhythm times: "7:30 am – 6:00 pm". */
    timeShort: { hour: "numeric", minute: "2-digit" },
    /** The menu day chips: "Mon" / "周一". */
    weekdayShort: { weekday: "short" },
    /** The menu sample line: "Wednesday" / "星期三". */
    weekdayLong: { weekday: "long" },
    /** The inquiry form's "Desired start" options, whose ids are `YYYY-MM`. */
    dateMonth: { year: "numeric", month: "long" },
  },
} as const satisfies Formats;

/**
 * 02 `D-02.6`: fixed so "today" — the default selected menu day — is identical
 * on the server and in the browser.
 */
export const TIME_ZONE = "America/Los_Angeles";
