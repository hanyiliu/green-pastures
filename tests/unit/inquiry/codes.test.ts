import { describe, expect, it } from "vitest";

import { reference } from "@/i18n/messages";
import {
  FIELD_ERROR_SEGMENTS,
  INQUIRY_CODES,
  INQUIRY_ERROR_SEGMENT,
  INQUIRY_FIELD_CODES,
  INQUIRY_FORM_CODES,
  UNKNOWN_ERROR_SEGMENT,
  inquiryErrorMessageKey,
  isInquiryCode,
  isInquiryFormFieldName,
} from "@/lib/inquiry/codes";

/**
 * The code ↔ message-key contract (07 §9; 02 *Design → Forms and email*).
 *
 * `INQUIRY_ERROR_SEGMENT` and `FIELD_ERROR_SEGMENTS` are typed against
 * `Messages`, so a segment naming a key the reference locale does not carry
 * fails `tsc` before it can fail a test. These cases cover what the types
 * cannot: that the resolution *order* is 02's, that the fallback is taken when
 * a field publishes no override, and that the fourteen codes are the fourteen
 * codes 07 §9 lists.
 */

/** Walk a dotted key into the reference message tree. */
function resolve(key: string): unknown {
  let current: unknown = reference;
  for (const segment of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

describe("the code list (07 §9)", () => {
  it("is the fourteen codes the doc names, and no others", () => {
    expect(INQUIRY_CODES).toStrictEqual([
      "required",
      "too_short",
      "too_long",
      "invalid",
      "invalid_email",
      "invalid_option",
      "out_of_range",
      "turnstile_failed",
      "turnstile_unavailable",
      "rate_limited",
      "forbidden",
      "payload_too_large",
      "email_failed",
      "network",
    ]);
    expect(INQUIRY_CODES).toHaveLength(14);
  });

  it("splits seven field-scoped codes from seven form-scoped ones", () => {
    expect(INQUIRY_FIELD_CODES).toHaveLength(7);
    expect(INQUIRY_FORM_CODES).toHaveLength(7);
    for (const code of INQUIRY_FIELD_CODES) {
      expect(INQUIRY_FORM_CODES as readonly string[]).not.toContain(code);
    }
  });

  it("recognises its own codes and nothing else", () => {
    expect(isInquiryCode("rate_limited")).toBe(true);
    expect(isInquiryCode("rateLimited")).toBe(false);
    expect(isInquiryCode("teapot")).toBe(false);
  });
});

describe("every code resolves to a message that exists", () => {
  it.each([...INQUIRY_CODES])("%s renders real copy", (code) => {
    const key = inquiryErrorMessageKey(code);
    expect(typeof resolve(key)).toBe("string");
  });

  it.each([...INQUIRY_CODES])("%s renders real copy on every field too", (code) => {
    for (const field of Object.keys(FIELD_ERROR_SEGMENTS)) {
      expect(typeof resolve(inquiryErrorMessageKey(code, field))).toBe("string");
    }
  });

  it("has copy for the unknown fallback", () => {
    expect(typeof resolve(`visit.form.errors.${UNKNOWN_ERROR_SEGMENT}`)).toBe("string");
  });

  it("declares only segments the field's own errors object carries", () => {
    const fields = reference.visit.form.fields as Record<string, { errors?: object }>;
    for (const [field, segments] of Object.entries(FIELD_ERROR_SEGMENTS)) {
      const declared = Object.keys(fields[field]?.errors ?? {});
      for (const segment of segments) expect(declared).toContain(segment);
    }
  });
});

describe("resolution order (02 *Design → Forms and email*)", () => {
  it("prefers the field's own copy when it publishes an override", () => {
    expect(inquiryErrorMessageKey("required", "parentName")).toBe(
      "visit.form.fields.parentName.errors.required",
    );
  });

  it("falls back to the generic banner when the field publishes none", () => {
    expect(inquiryErrorMessageKey("too_short", "message")).toBe("visit.form.errors.tooShort");
  });

  it("pins invalid_email to the email field, whatever the caller passes", () => {
    const expected = "visit.form.fields.email.errors.invalid";
    expect(inquiryErrorMessageKey("invalid_email")).toBe(expected);
    expect(inquiryErrorMessageKey("invalid_email", "parentName")).toBe(expected);
  });

  it("keeps the generic invalid separate from the email one", () => {
    expect(inquiryErrorMessageKey("invalid")).toBe("visit.form.errors.invalid");
  });

  it("renders form-scoped codes as banners, ignoring any field", () => {
    expect(inquiryErrorMessageKey("rate_limited", "email")).toBe("visit.form.errors.rateLimited");
  });

  it("renders an unlisted code as unknown (02's last table row)", () => {
    expect(inquiryErrorMessageKey("teapot")).toBe("visit.form.errors.unknown");
    expect(inquiryErrorMessageKey("emailInvalid")).toBe("visit.form.errors.unknown");
  });

  it("ignores a field name the form does not have", () => {
    expect(inquiryErrorMessageKey("required", "cf-turnstile-response")).toBe(
      "visit.form.errors.required",
    );
    expect(isInquiryFormFieldName("cf-turnstile-response")).toBe(false);
    expect(isInquiryFormFieldName("childAge")).toBe(true);
  });

  it("maps each code to 02's camelCase key segment", () => {
    expect(INQUIRY_ERROR_SEGMENT.too_short).toBe("tooShort");
    expect(INQUIRY_ERROR_SEGMENT.payload_too_large).toBe("payloadTooLarge");
    expect(INQUIRY_ERROR_SEGMENT.turnstile_unavailable).toBe("turnstileUnavailable");
  });
});
