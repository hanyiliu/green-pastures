import { describe, expect, it } from "vitest";

import { reference } from "@/i18n/messages";
import {
  CHILD_AGE_OPTION_KEY,
  DESIRED_START_OPTION_KEY,
  childAgeOptionKey,
  desiredStartOptionKey,
} from "@/lib/inquiry/labels";
import { DESIRED_START_KEYWORDS } from "@/lib/inquiry/months";
import { CHILD_AGE_IDS } from "@/lib/inquiry/schema";

/**
 * The option-id ↔ message-key join (02 rule 8).
 *
 * The compiler already holds three of the four ways this can break; these cases
 * state the fourth — that the ids and the reference locale's option keys are the
 * same set — as an assertion an editor can read in a failure message.
 */

const childAgeOptions = reference.visit.form.fields.childAge.options;
const desiredStartOptions = reference.visit.form.fields.desiredStart.options;

describe("child's age", () => {
  it("has one option per id and one id per option", () => {
    expect(Object.keys(childAgeOptions).sort()).toStrictEqual([...CHILD_AGE_IDS].sort());
    expect(Object.keys(CHILD_AGE_OPTION_KEY).sort()).toStrictEqual([...CHILD_AGE_IDS].sort());
  });

  it.each([...CHILD_AGE_IDS])("resolves %s to copy that exists", (id) => {
    const key = childAgeOptionKey(id);
    expect(key).toBe(`form.fields.childAge.options.${id}`);
    expect(typeof childAgeOptions[id]).toBe("string");
  });
});

describe("desired start", () => {
  it("has one option per keyword and no month keys", () => {
    expect(Object.keys(desiredStartOptions).sort()).toStrictEqual(
      [...DESIRED_START_KEYWORDS].sort(),
    );
    expect(Object.keys(DESIRED_START_OPTION_KEY).sort()).toStrictEqual(
      [...DESIRED_START_KEYWORDS].sort(),
    );
  });

  it.each([...DESIRED_START_KEYWORDS])("resolves %s to copy that exists", (keyword) => {
    expect(desiredStartOptionKey(keyword)).toBe(`form.fields.desiredStart.options.${keyword}`);
    expect(typeof desiredStartOptions[keyword]).toBe("string");
  });
});
