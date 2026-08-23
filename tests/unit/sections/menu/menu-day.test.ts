import { describe, expect, it } from "vitest";

import { getSite } from "@/content/site";
import type { DayId } from "@/content/schemas/menu";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { routing } from "@/i18n/routing";
import { defaultMenuDay, weekdayDate } from "@/lib/menu-day";

/**
 * `src/lib/menu-day.ts` (04 `D-04.10`, 02 `D-02.6`).
 *
 * The whole reason this module exists is that PR-5.3's hardest acceptance
 * criterion — "no SSR/CSR day mismatch" — is a *server* computation. What makes
 * that testable is that both functions are pure given their argument, so
 * "Saturday selects Monday" and "a reader in Tokyo sees Fremont's day" are
 * assertions rather than a wall-clock wait.
 *
 * Every expectation is read from `content/site.json` and `src/i18n/formats.ts`
 * rather than typed out, so the suite catches a module that stopped agreeing
 * with the content tree rather than one that agrees with itself.
 */

const site = getSite();
const days = site.menu.days;

/** Noon UTC on a known date, which is mid-morning or earlier in Fremont. */
function noonUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

describe("weekdayDate", () => {
  it("returns a date that Intl names as the day asked for, in site.timeZone", () => {
    const name = new Intl.DateTimeFormat("en-US", {
      timeZone: site.timeZone,
      ...formats.dateTime.weekdayShort,
    });

    expect(days.map((day) => name.format(weekdayDate(day)))).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
    ]);
  });

  it("covers the two days the sample week does not draw", () => {
    const name = new Intl.DateTimeFormat("en-US", {
      timeZone: site.timeZone,
      ...formats.dateTime.weekdayLong,
    });

    expect(name.format(weekdayDate("sat"))).toBe("Saturday");
    expect(name.format(weekdayDate("sun"))).toBe("Sunday");
  });

  it("is stable — the same id gives the same instant every call", () => {
    expect(weekdayDate("wed").getTime()).toBe(weekdayDate("wed").getTime());
  });

  it("names the id it was given when the id is not a weekday", () => {
    expect(() => weekdayDate("someday" as DayId)).toThrow(/someday/u);
  });

  it("survives the reader's own zone, because only the weekday is ever read", () => {
    // The anchor is noon UTC precisely so that no zone the site is read from
    // shifts it onto the day before or after. Sydney (UTC+10/+11) is the far
    // side of that window from Fremont.
    const sydney = new Intl.DateTimeFormat("en-US", {
      timeZone: "Australia/Sydney",
      ...formats.dateTime.weekdayShort,
    });

    expect(days.map((day) => sydney.format(weekdayDate(day)))).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
    ]);
  });
});

describe("defaultMenuDay", () => {
  it("selects today when the sample week draws it", () => {
    // 2026-08-19 is a Wednesday.
    expect(defaultMenuDay(days, site.timeZone, noonUtc(2026, 8, 19))).toBe("wed");
    expect(defaultMenuDay(days, site.timeZone, noonUtc(2026, 8, 17))).toBe("mon");
    expect(defaultMenuDay(days, site.timeZone, noonUtc(2026, 8, 21))).toBe("fri");
  });

  it("sends the weekend to Monday (04 D-04.10)", () => {
    expect(defaultMenuDay(days, site.timeZone, noonUtc(2026, 8, 22))).toBe("mon");
    expect(defaultMenuDay(days, site.timeZone, noonUtc(2026, 8, 23))).toBe("mon");
  });

  it("reads the calendar in site.timeZone, not in the process's zone", () => {
    /*
     * 2026-08-24T03:00Z is Monday in London and 20:00 **Sunday** in Fremont, so
     * a module that asked the host for the day would answer `mon` on the
     * server, `mon` for a London reader — and disagree with the Californian
     * kitchen the menu belongs to. The zone is 02 D-02.6's fixed one for
     * exactly this.
     */
    const sundayEveningInFremont = new Date(Date.UTC(2026, 7, 24, 3));

    expect(sundayEveningInFremont.getUTCDay()).toBe(1);
    expect(defaultMenuDay(days, site.timeZone, sundayEveningInFremont)).toBe("mon");

    // …and the same instant is Sunday in Fremont, which the fallback catches.
    // Wednesday proves the branch is a real zone read rather than a constant:
    const wednesdayEveningInFremont = new Date(Date.UTC(2026, 7, 20, 3));
    expect(wednesdayEveningInFremont.getUTCDay()).toBe(4);
    expect(defaultMenuDay(days, site.timeZone, wednesdayEveningInFremont)).toBe("wed");
  });

  it("falls back to the week's own first day, not to a hard-coded `mon`", () => {
    expect(defaultMenuDay(["tue", "wed"], site.timeZone, noonUtc(2026, 8, 22))).toBe("tue");
  });

  it("refuses an empty week rather than returning nothing", () => {
    expect(() => defaultMenuDay([], site.timeZone)).toThrow(/menu\.days/u);
  });

  it("defaults `now` to the clock, and answers with a day the week declares", () => {
    expect(days).toContain(defaultMenuDay(days, site.timeZone));
  });

  it("uses the zone src/i18n/formats.ts pins, which is site.json's", () => {
    expect(site.timeZone).toBe(TIME_ZONE);
    // The module is content-driven, so a new locale changes nothing here.
    expect(routing.locales.length).toBeGreaterThan(0);
  });
});
