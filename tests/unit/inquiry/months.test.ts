import { describe, expect, it } from "vitest";

import {
  DESIRED_START_KEYWORDS,
  START_OPTION_COUNT,
  START_WINDOW_BACK_MONTHS,
  START_WINDOW_FORWARD_MONTHS,
  currentAbsoluteMonth,
  isDesiredStartKeyword,
  isMonthId,
  isMonthIdInWindow,
  monthOptionIds,
} from "@/lib/inquiry/months";

/** 07 §8 *Schema*: "month window edges". */

/** 2026-08-23, 12:00 in America/Los_Angeles. */
const NOW = new Date("2026-08-23T19:00:00.000Z");

/** 2026-09-01, 00:30 UTC — still 31 August in Fremont. */
const UTC_MONTH_ROLLOVER = new Date("2026-09-01T00:30:00.000Z");

describe("month ids", () => {
  it("accepts YYYY-MM and nothing else", () => {
    expect(isMonthId("2026-10")).toBe(true);
    expect(isMonthId("2026-01")).toBe(true);
    expect(isMonthId("2026-12")).toBe(true);
    expect(isMonthId("2026-13")).toBe(false);
    expect(isMonthId("2026-00")).toBe(false);
    expect(isMonthId("2026-1")).toBe(false);
    expect(isMonthId("2026-10-01")).toBe(false);
    expect(isMonthId("asap")).toBe(false);
  });

  it("knows the two keywords", () => {
    expect(DESIRED_START_KEYWORDS).toStrictEqual(["asap", "flexible"]);
    expect(isDesiredStartKeyword("asap")).toBe(true);
    expect(isDesiredStartKeyword("flexible")).toBe(true);
    expect(isDesiredStartKeyword("2026-10")).toBe(false);
  });
});

describe("the option list the form renders", () => {
  it("offers twelve months, starting with the current one", () => {
    const ids = monthOptionIds(NOW);
    expect(ids).toHaveLength(START_OPTION_COUNT);
    expect(ids[0]).toBe("2026-08");
    expect(ids.at(-1)).toBe("2027-07");
  });

  it("steps over a year boundary without a special case", () => {
    expect(monthOptionIds(new Date("2026-11-15T20:00:00.000Z"), { count: 4 })).toStrictEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });

  it("reads the current month in the site's zone, not the server's", () => {
    // Already September in UTC; still August where the daycare is.
    expect(monthOptionIds(UTC_MONTH_ROLLOVER, { count: 1 })).toStrictEqual(["2026-08"]);
    expect(monthOptionIds(UTC_MONTH_ROLLOVER, { count: 1, timeZone: "UTC" })).toStrictEqual([
      "2026-09",
    ]);
  });

  it("agrees with currentAbsoluteMonth", () => {
    expect(currentAbsoluteMonth(NOW)).toBe(2026 * 12 + 7);
  });
});

describe("the window the handler accepts", () => {
  it("is one month back and twenty-four forward", () => {
    expect(START_WINDOW_BACK_MONTHS).toBe(1);
    expect(START_WINDOW_FORWARD_MONTHS).toBe(24);
  });

  it("accepts the current month", () => {
    expect(isMonthIdInWindow("2026-08", NOW)).toBe(true);
  });

  it("accepts both edges", () => {
    expect(isMonthIdInWindow("2026-07", NOW)).toBe(true);
    expect(isMonthIdInWindow("2028-08", NOW)).toBe(true);
  });

  it("rejects one step past either edge", () => {
    expect(isMonthIdInWindow("2026-06", NOW)).toBe(false);
    expect(isMonthIdInWindow("2028-09", NOW)).toBe(false);
  });

  it("still accepts every option a twelve-month-old page would offer", () => {
    for (const id of monthOptionIds(NOW)) expect(isMonthIdInWindow(id, NOW)).toBe(true);
  });

  it("is not a range check on something that is not a month", () => {
    expect(isMonthIdInWindow("asap", NOW)).toBe(false);
    expect(isMonthIdInWindow("2026-13", NOW)).toBe(false);
  });
});
