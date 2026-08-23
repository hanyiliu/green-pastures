import { describe, expect, it } from "vitest";

import {
  FIELD_ERROR_SEGMENTS,
  INQUIRY_CODES,
  inquiryErrorKey,
  inquiryErrorMessageKey,
  INQUIRY_FIELD_CODES,
  INQUIRY_FORM_CODES,
  UNKNOWN_ERROR_KEY,
} from "@/components/forms/inquiry-codes";
import { reference } from "@/i18n/messages";

/**
 * The component-side code record (04 `D-04.14`).
 *
 * The point of the file under test is that it **re-exports** the shared record
 * rather than restating it, so the first block below is the one that matters:
 * the fourteen codes a component sees have to be the fourteen codes the handler
 * answers with, and the only way that can stay true is if there is one list.
 *
 * The second block is the check the type system cannot make on its own. `tsc`
 * proves every *segment* exists in the reference tree; what it cannot prove is
 * that the *fallback order* — field override first, then the generic key — puts
 * the two halves together into a path that resolves. Every code is therefore
 * walked into `reference.visit.form` here, for every field and for none.
 */

/** Walk a dotted path into the reference tree, or `undefined`. */
function resolve(path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      reference,
    );
}

const FORM_FIELDS = Object.keys(FIELD_ERROR_SEGMENTS);

describe("the code list has one home (04 D-04.14)", () => {
  it("re-exports the fourteen codes 07 §9 defines", () => {
    expect(INQUIRY_CODES).toHaveLength(14);
    expect(INQUIRY_CODES).toEqual([...INQUIRY_FIELD_CODES, ...INQUIRY_FORM_CODES]);
  });

  it("re-exports the shared resolver rather than reimplementing it", () => {
    for (const code of INQUIRY_CODES) {
      for (const field of [undefined, ...FORM_FIELDS]) {
        expect(`visit.form.${inquiryErrorKey(code, field)}`).toBe(
          inquiryErrorMessageKey(code, field),
        );
      }
    }
  });
});

describe("every code resolves to copy a parent can read (02 Forms and email)", () => {
  it("resolves for every code, with and without a field", () => {
    for (const code of INQUIRY_CODES) {
      for (const field of [undefined, ...FORM_FIELDS]) {
        const key = inquiryErrorKey(code, field);
        expect(typeof resolve(`visit.form.${key}`), `${code} / ${String(field)} → ${key}`).toBe(
          "string",
        );
      }
    }
  });

  it("prefers a field's own copy over the generic one where it has some", () => {
    expect(inquiryErrorKey("required", "parentName")).toBe("fields.parentName.errors.required");
    expect(inquiryErrorKey("required")).toBe("errors.required");
  });

  it("falls back to the generic key for a field that publishes no override", () => {
    // `message` overrides `tooLong` only, so `required` falls through.
    expect(inquiryErrorKey("too_long", "message")).toBe("fields.message.errors.tooLong");
    expect(inquiryErrorKey("required", "message")).toBe("errors.required");
  });

  it("pins invalid_email to the email field whatever the caller passes", () => {
    expect(inquiryErrorKey("invalid_email")).toBe("fields.email.errors.invalid");
    expect(inquiryErrorKey("invalid_email", "parentName")).toBe("fields.email.errors.invalid");
  });

  it("answers the catch-all key for a code it does not know", () => {
    expect(inquiryErrorKey("teapot")).toBe(UNKNOWN_ERROR_KEY);
    expect(typeof resolve(`visit.form.${UNKNOWN_ERROR_KEY}`)).toBe("string");
  });
});
