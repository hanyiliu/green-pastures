import { describe, expect, it } from "vitest";

import { formats, TIME_ZONE } from "@/i18n/formats";
import { hoursDayRange, openingTimeDate } from "@/lib/hours";

/**
 * The hours derivation (PR-5.7's acceptance: *hours derived from `site.hours`,
 * never typed*; 02 `D-02.6`).
 *
 * `openingTimeDate` exists because a wall clock is not an instant and `Intl`
 * only names instants. The property that matters is a **round trip**: format
 * the date it returns in the zone it was given, and the clock the owner typed
 * comes back. That holds in a zone behind UTC, a zone ahead of it, and UTC
 * itself — three cases, one assertion each, which is the whole contract.
 */

/** Production's own formatter: `formats.dateTime.timeShort` in a given zone. */
function clockIn(timeZone: string, instant: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    ...formats.dateTime.timeShort,
    hourCycle: "h23",
  }).format(instant);
}

describe("openingTimeDate", () => {
  it.each([
    ["America/Los_Angeles", "07:30"],
    ["America/Los_Angeles", "18:00"],
    ["Asia/Tokyo", "07:30"],
    ["UTC", "23:59"],
    ["Australia/Adelaide", "00:00"],
  ])("reads back as the same wall clock in %s (%s)", (timeZone, time) => {
    expect(clockIn(timeZone, openingTimeDate(time, timeZone))).toBe(time);
  });

  it("puts the site's own opening time on the site's own zone", () => {
    expect(clockIn(TIME_ZONE, openingTimeDate("07:30", TIME_ZONE))).toBe("07:30");
  });

  it("is stable — the same string always yields the same instant", () => {
    expect(openingTimeDate("07:30", TIME_ZONE).getTime()).toBe(
      openingTimeDate("07:30", TIME_ZONE).getTime(),
    );
  });

  it.each(["7:30", "07:5", "24:00", "07:60", "", "seven"])(
    "refuses %o, which content/site.json's schema would not have admitted",
    (time) => {
      expect(() => openingTimeDate(time, TIME_ZONE)).toThrow(/24-hour HH:MM/u);
    },
  );
});

describe("hoursDayRange", () => {
  it("takes the two ends of the week the config declares", () => {
    expect(hoursDayRange(["mon", "tue", "wed", "thu", "fri"])).toEqual({
      from: "mon",
      to: "fri",
    });
  });

  it("follows an owner who opens Tuesday to Saturday", () => {
    expect(hoursDayRange(["tue", "wed", "thu", "fri", "sat"])).toEqual({
      from: "tue",
      to: "sat",
    });
  });

  it("collapses a one-day week to the same id twice", () => {
    expect(hoursDayRange(["wed"])).toEqual({ from: "wed", to: "wed" });
  });

  it("refuses an empty week", () => {
    expect(() => hoursDayRange([])).toThrow(/at least one entry/u);
  });
});
