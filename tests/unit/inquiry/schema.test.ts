import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routing } from "@/i18n/routing";
import { INQUIRY_FIELD_CODES, type InquiryFieldErrors } from "@/lib/inquiry/codes";
import {
  CHILD_AGE_IDS,
  EMAIL_MAX_LENGTH,
  HONEYPOT_FIELD,
  INQUIRY_FORM_FIELDS,
  INQUIRY_SOURCES,
  MESSAGE_MAX_LENGTH,
  MIN_SUBMIT_MS,
  NAME_MAX_LENGTH,
  TURNSTILE_TOKEN_FIELD,
  isBotSignal,
  parseInquiry,
  type Inquiry,
} from "@/lib/inquiry/schema";

import { NOW, STARTED_AT, rawSubmission, type RawSubmission } from "./fixtures";

/**
 * The shared schema (07 `D-07.3`, §8 *Schema*).
 *
 * `new Date()` is read inside the `desiredStart` refinement, so the clock is
 * fixed for the whole file — only `Date` is faked, leaving timers real so the
 * async cases elsewhere in the suite behave.
 */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/** The parsed submission, or a failure that names the codes it produced. */
function parsed(payload: unknown): Inquiry {
  const result = parseInquiry(payload);
  if (!result.ok) throw new Error(`expected a valid submission: ${JSON.stringify(result.fields)}`);
  return result.inquiry;
}

/** The per-field codes, or a failure saying the submission was accepted. */
function rejected(payload: unknown): InquiryFieldErrors {
  const result = parseInquiry(payload);
  if (result.ok) throw new Error("expected the submission to be rejected");
  return result.fields;
}

/** The code a single field failed with, or `undefined` when it passed. */
function codeFor(overrides: Partial<RawSubmission>, field: string): string | undefined {
  const result = parseInquiry(rawSubmission(overrides));
  return result.ok ? undefined : result.fields[field];
}

/** `rawSubmission` with some keys taken out, as a JSON body may send it. */
function without(...keys: string[]): Record<string, string> {
  const payload: Record<string, string> = { ...rawSubmission() };
  for (const key of keys) delete payload[key];
  return payload;
}

describe("a well-formed submission", () => {
  it("parses and normalises in one pass", () => {
    const inquiry = parsed(rawSubmission({ parentName: "  Wei   Chen " }));

    expect(inquiry.parentName).toBe("Wei Chen");
    expect(inquiry.email).toBe("wei.chen@example.com");
    expect(inquiry.childAge).toBe("toddler");
    expect(inquiry.desiredStart).toBe("asap");
    expect(inquiry.startedAt).toBe(STARTED_AT);
  });

  it("strips a key the contract does not name instead of failing on it", () => {
    const inquiry = parsed({ ...rawSubmission(), "cf-turnstile-idempotency": "x" });
    expect(inquiry).not.toHaveProperty("cf-turnstile-idempotency");
  });

  it("treats a blank optional field as unanswered", () => {
    const inquiry = parsed(rawSubmission({ desiredStart: "", message: "   " }));
    expect(inquiry.desiredStart).toBeUndefined();
    expect(inquiry.message).toBeUndefined();
  });

  it("lists the five controls the design draws", () => {
    expect(INQUIRY_FORM_FIELDS).toStrictEqual([
      "parentName",
      "email",
      "childAge",
      "desiredStart",
      "message",
    ]);
  });
});

describe("parentName", () => {
  it("is required", () => {
    expect(codeFor({ parentName: "   " }, "parentName")).toBe("required");
  });

  it("has a two-character floor", () => {
    expect(codeFor({ parentName: "W" }, "parentName")).toBe("too_short");
    expect(codeFor({ parentName: "We" }, "parentName")).toBeUndefined();
  });

  it("accepts a two-character CJK name (07 §8: CJK names)", () => {
    expect(parsed(rawSubmission({ parentName: "陈伟" })).parentName).toBe("陈伟");
  });

  it("has an eighty-character ceiling", () => {
    expect(codeFor({ parentName: "x".repeat(NAME_MAX_LENGTH) }, "parentName")).toBeUndefined();
    expect(codeFor({ parentName: "x".repeat(NAME_MAX_LENGTH + 1) }, "parentName")).toBe("too_long");
  });

  it("reports required, not too_short, for an empty value", () => {
    expect(codeFor({ parentName: "" }, "parentName")).toBe("required");
  });
});

describe("email", () => {
  it("is required", () => {
    expect(codeFor({ email: "" }, "email")).toBe("required");
  });

  it("rejects a malformed address with invalid_email", () => {
    expect(codeFor({ email: "wei.chen" }, "email")).toBe("invalid_email");
    expect(codeFor({ email: "wei@" }, "email")).toBe("invalid_email");
  });

  it("has a 254-character ceiling, checked before the format", () => {
    const long = `${"x".repeat(EMAIL_MAX_LENGTH)}@example.com`;
    expect(codeFor({ email: long }, "email")).toBe("too_long");
  });
});

describe("childAge", () => {
  it("offers 02's canonical five ids", () => {
    expect(CHILD_AGE_IDS).toStrictEqual(["infant", "toddler", "preschool", "expecting", "other"]);
  });

  it.each([...CHILD_AGE_IDS])("accepts %s", (id) => {
    expect(codeFor({ childAge: id }, "childAge")).toBeUndefined();
  });

  it("is required, and an unknown value is invalid_option", () => {
    expect(codeFor({ childAge: "" }, "childAge")).toBe("required");
    expect(codeFor({ childAge: "teenager" }, "childAge")).toBe("invalid_option");
  });
});

describe("desiredStart", () => {
  it("accepts the two keywords", () => {
    expect(codeFor({ desiredStart: "asap" }, "desiredStart")).toBeUndefined();
    expect(codeFor({ desiredStart: "flexible" }, "desiredStart")).toBeUndefined();
  });

  it("accepts both edges of the window", () => {
    expect(codeFor({ desiredStart: "2026-07" }, "desiredStart")).toBeUndefined();
    expect(codeFor({ desiredStart: "2028-08" }, "desiredStart")).toBeUndefined();
  });

  it("reports out_of_range one step past either edge", () => {
    expect(codeFor({ desiredStart: "2026-06" }, "desiredStart")).toBe("out_of_range");
    expect(codeFor({ desiredStart: "2028-09" }, "desiredStart")).toBe("out_of_range");
  });

  it("separates a value that is not a month from one that is out of range", () => {
    expect(codeFor({ desiredStart: "next spring" }, "desiredStart")).toBe("invalid_option");
    expect(codeFor({ desiredStart: "2026-13" }, "desiredStart")).toBe("invalid_option");
  });
});

describe("message", () => {
  it("is optional and capped at a thousand characters", () => {
    expect(codeFor({ message: "x".repeat(MESSAGE_MAX_LENGTH) }, "message")).toBeUndefined();
    expect(codeFor({ message: "x".repeat(MESSAGE_MAX_LENGTH + 1) }, "message")).toBe("too_long");
  });

  it("keeps newlines and drops other control characters", () => {
    expect(parsed(rawSubmission({ message: "one\r\ntwothree" })).message).toBe("one\ntwothree");
  });
});

describe("the technical fields", () => {
  it("takes its locale enum from routing.locales", () => {
    for (const locale of routing.locales) {
      expect(codeFor({ locale }, "locale")).toBeUndefined();
    }
    expect(codeFor({ locale: "zh" }, "locale")).toBe("invalid_option");
    expect(codeFor({ locale: "fr" }, "locale")).toBe("invalid_option");
  });

  it.each([...INQUIRY_SOURCES])("accepts source %s", (source) => {
    expect(codeFor({ source }, "source")).toBeUndefined();
  });

  it("rejects an unlisted source", () => {
    expect(codeFor({ source: "footer" }, "source")).toBe("invalid_option");
  });

  it("requires a UUID submission id", () => {
    expect(codeFor({ submissionId: "1" }, "submissionId")).toBe("invalid");
  });

  it("coerces startedAt from the string a URL-encoded body sends", () => {
    expect(parsed(rawSubmission({ startedAt: "1700000000000" })).startedAt).toBe(1_700_000_000_000);
  });

  it("rejects a startedAt that is not a number", () => {
    expect(codeFor({ startedAt: "soon" }, "startedAt")).toBe("invalid");
  });

  it("requires a Turnstile token", () => {
    expect(codeFor({ [TURNSTILE_TOKEN_FIELD]: "" }, TURNSTILE_TOKEN_FIELD)).toBe("required");
    expect(codeFor({ [TURNSTILE_TOKEN_FIELD]: "x".repeat(2049) }, TURNSTILE_TOKEN_FIELD)).toBe(
      "too_long",
    );
  });

  it("only ever reports codes the contract knows", () => {
    for (const code of Object.values(rejected({}))) {
      expect(INQUIRY_FIELD_CODES as readonly string[]).toContain(code);
    }
  });

  it("calls an omitted field required, not invalid", () => {
    expect(rejected({})).toMatchObject({
      parentName: "required",
      email: "required",
      childAge: "required",
      [TURNSTILE_TOKEN_FIELD]: "required",
      locale: "invalid_option",
      source: "invalid_option",
      submissionId: "invalid",
      startedAt: "invalid",
    });
  });

  it("treats an omitted optional field as unanswered rather than invalid", () => {
    const inquiry = parsed(without("desiredStart", "message"));
    expect(inquiry.desiredStart).toBeUndefined();
    expect(inquiry.message).toBeUndefined();
  });
});

describe("the honeypot is not a validation failure (07 §2 steps 2 and 3)", () => {
  it("parses a filled honeypot, so the decoy path can answer instead of a 400", () => {
    const inquiry = parsed(rawSubmission({ [HONEYPOT_FIELD]: "https://spam.example" }));
    expect(inquiry[HONEYPOT_FIELD]).toBe("https://spam.example");
  });

  it("defaults to empty when the field is absent from a JSON body", () => {
    expect(parsed(without(HONEYPOT_FIELD))[HONEYPOT_FIELD]).toBe("");
  });
});

describe("isBotSignal (07 §2 step 3)", () => {
  const base = { startedAt: STARTED_AT, [HONEYPOT_FIELD]: "" };

  it("is false for a form a human filled in", () => {
    expect(isBotSignal(base, NOW.getTime())).toBe(false);
  });

  it("is true when the honeypot carries anything at all", () => {
    expect(isBotSignal({ ...base, [HONEYPOT_FIELD]: " " }, NOW.getTime())).toBe(true);
  });

  it("is true below the timing floor and false at it", () => {
    const now = NOW.getTime();
    expect(isBotSignal({ ...base, startedAt: now - (MIN_SUBMIT_MS - 1) }, now)).toBe(true);
    expect(isBotSignal({ ...base, startedAt: now - MIN_SUBMIT_MS }, now)).toBe(false);
  });

  it("is true for a form that claims to have mounted in the future", () => {
    const now = NOW.getTime();
    expect(isBotSignal({ ...base, startedAt: now + 60_000 }, now)).toBe(true);
  });
});
