import type { Messages } from "@/i18n/messages";

/**
 * The inquiry error codes and the message keys they resolve to (07 `D-07.3`,
 * 07 §9; 02 *Design → Forms and email*).
 *
 * Two rules meet in this file and nowhere else.
 *
 * 1. **The wire carries codes, never copy** (INV-07.1). The handler answers
 *    `{ ok: false, code: "turnstile_failed" }` or, for a validation failure,
 *    `{ ok: false, fields: { email: "invalid_email" } }`. No English exists in
 *    the API.
 * 2. **A code with no translation is a *compile* error.** 02 splits the two
 *    spellings — wire codes are 07's snake_case, message-key segments are their
 *    camelCase forms (memo ADJ-18) — and says "the typed record … is the only
 *    place the two meet, and a missing key is a TypeScript error". That is what
 *    {@link INQUIRY_ERROR_SEGMENT} and {@link FIELD_ERROR_SEGMENTS} are: their
 *    *values* are typed against `Messages`, which is `typeof` the `en` message
 *    tree, so deleting `visit.form.errors.turnstileFailed` from
 *    `content/en/messages/visit.json` fails `tsc` here rather than shipping a
 *    banner that renders `⟦visit.form.errors.turnstileFailed⟧` to a parent.
 *    The mapped types are exhaustive in the other direction too: a code with no
 *    row does not compile, and neither does a form field with no row.
 *
 * 04 `D-04.14` places the *component-side* record in
 * `src/components/forms/inquiry-codes.ts`; this module is the shared half both
 * it and the handler read, so the code list has one home. Nothing here is
 * server-only — the client imports it to resolve a code it received.
 */

/* -------------------------------------------------------------------------- *
 * The fourteen codes (07 §9)
 * -------------------------------------------------------------------------- */

/**
 * Field-scoped codes: they arrive inside `fields`, keyed by the field that
 * failed, and render as inline error text under that control (07 §1's table —
 * the validation 400 "carries per-field codes and no form-level code").
 */
export const INQUIRY_FIELD_CODES = [
  "required",
  "too_short",
  "too_long",
  "invalid",
  "invalid_email",
  "invalid_option",
  "out_of_range",
] as const;

/**
 * Form-scoped codes: they arrive as `code` and render as one banner above the
 * submit button. `network` is the one code the server never sends — the client
 * raises it when `fetch` throws or aborts (02's table marks it *form (client
 * only)*), and it is listed here because it resolves through the same record.
 */
export const INQUIRY_FORM_CODES = [
  "turnstile_failed",
  "turnstile_unavailable",
  "rate_limited",
  "forbidden",
  "payload_too_large",
  "email_failed",
  "network",
] as const;

export type InquiryFieldCode = (typeof INQUIRY_FIELD_CODES)[number];
export type InquiryFormCode = (typeof INQUIRY_FORM_CODES)[number];
export type InquiryCode = InquiryFieldCode | InquiryFormCode;

/** All fourteen, in 07 §9's order — field-scoped first, then form-scoped. */
export const INQUIRY_CODES: readonly InquiryCode[] = [
  ...INQUIRY_FIELD_CODES,
  ...INQUIRY_FORM_CODES,
];

/* -------------------------------------------------------------------------- *
 * The message tree, as types
 * -------------------------------------------------------------------------- */

type VisitForm = Messages["visit"]["form"];

/** A key of `visit.form.errors` — the generic, form-level error copy. */
type ErrorSegment = keyof VisitForm["errors"];

/** A key of `visit.form.fields` — the five controls the design draws. */
export type InquiryFormFieldName = keyof VisitForm["fields"];

/** A key of `visit.form.fields.<field>.errors` — that field's own override. */
type FieldErrorSegment<TField extends InquiryFormFieldName> = VisitForm["fields"][TField] extends {
  readonly errors: infer TErrors;
}
  ? Extract<keyof TErrors, string>
  : never;

/* -------------------------------------------------------------------------- *
 * Code → key segment (02 *Design → Forms and email*, the authoritative table)
 * -------------------------------------------------------------------------- */

/**
 * Every code's camelCase key segment. The value type is `ErrorSegment`, so each
 * one must exist under `visit.form.errors` in the reference locale; the mapped
 * key type is `InquiryCode`, so every code must appear exactly once.
 *
 * `invalid_email` is the row that looks odd and is not: 02 resolves it to
 * `visit.form.fields.email.errors.invalid`, so its segment is `invalid` and
 * {@link CODE_FIELD_SCOPE} pins it to the `email` field.
 */
export const INQUIRY_ERROR_SEGMENT: { readonly [TCode in InquiryCode]: ErrorSegment } = {
  required: "required",
  too_short: "tooShort",
  too_long: "tooLong",
  invalid: "invalid",
  invalid_email: "invalid",
  invalid_option: "invalidOption",
  out_of_range: "outOfRange",
  turnstile_failed: "turnstileFailed",
  turnstile_unavailable: "turnstileUnavailable",
  rate_limited: "rateLimited",
  forbidden: "forbidden",
  payload_too_large: "payloadTooLarge",
  email_failed: "emailFailed",
  network: "network",
};

/** 02's last table row: "*(any other)* → `unknown`", the catch-all banner. */
export const UNKNOWN_ERROR_SEGMENT: ErrorSegment = "unknown";

/**
 * The codes that always belong to one named field, whatever the caller passes.
 * Only `invalid_email` qualifies: 02 says there is no form-level key for it.
 */
const CODE_FIELD_SCOPE: Partial<Record<InquiryCode, InquiryFormFieldName>> = {
  invalid_email: "email",
};

/**
 * Which error segments each field overrides with its own copy.
 *
 * Both halves are checked. The mapped key type makes the record exhaustive over
 * the five fields `visit.form.fields` declares — add a sixth control to the JSON
 * and this stops compiling — and each entry's element type is that field's own
 * `errors` keys, so naming a segment the field does not actually carry is a
 * type error too. A code whose segment is absent here falls back to the generic
 * `visit.form.errors.<segment>`, which is 02's documented order.
 */
export const FIELD_ERROR_SEGMENTS = {
  parentName: ["required", "tooShort", "tooLong"],
  email: ["required", "invalid", "tooLong"],
  childAge: ["required", "invalidOption"],
  desiredStart: ["invalidOption", "outOfRange"],
  message: ["tooLong"],
} as const satisfies {
  readonly [TField in InquiryFormFieldName]: ReadonlyArray<FieldErrorSegment<TField>>;
};

const FORM_FIELD_NAMES = Object.keys(FIELD_ERROR_SEGMENTS) as readonly InquiryFormFieldName[];

/** Is `value` one of the five controls that has its own copy in `visit.form`? */
export function isInquiryFormFieldName(value: string): value is InquiryFormFieldName {
  return (FORM_FIELD_NAMES as readonly string[]).includes(value);
}

/** Is `value` one of the fourteen codes 07 §9 defines? */
export function isInquiryCode(value: string): value is InquiryCode {
  return (INQUIRY_CODES as readonly string[]).includes(value);
}

/**
 * Is `value` one of the seven **field-scoped** codes — the ones that may appear
 * inside a 400's `fields`?
 *
 * `parseInquiry` asks this of every Zod issue message: a message that is one of
 * the seven *is* the code the parent sees, and anything else — a schema-level
 * failure with no code of its own — is reported as the generic `invalid`. That
 * narrowing decision is the reason this is exported as a predicate rather than
 * the caller reading {@link INQUIRY_FIELD_CODES} and re-deciding. A second copy
 * of the list fails quietly: a code added here but missing from the copy is
 * downgraded to `invalid`, and the parent reads "please check this value" in
 * place of the specific reason. One list, one predicate, no copy to forget.
 */
export function isInquiryFieldCode(value: string): value is InquiryFieldCode {
  return (INQUIRY_FIELD_CODES as readonly string[]).includes(value);
}

/**
 * The message key a code renders through, as a dotted path from the root of the
 * message tree.
 *
 * The order is 02's: a field-scoped code tries `visit.form.fields.<field>
 * .errors.<segment>` first and falls back to `visit.form.errors.<segment>`; a
 * form-scoped code renders from `visit.form.errors.<segment>`; anything
 * unrecognised renders `visit.form.errors.unknown`. `field` is ignored for a
 * code that is pinned to one field, and for a field that publishes no override
 * of that segment.
 */
export function inquiryErrorMessageKey(code: string, field?: string): string {
  if (!isInquiryCode(code)) return `visit.form.errors.${UNKNOWN_ERROR_SEGMENT}`;

  const segment = INQUIRY_ERROR_SEGMENT[code];
  const pinned = CODE_FIELD_SCOPE[code];
  const scope =
    pinned ?? (field !== undefined && isInquiryFormFieldName(field) ? field : undefined);

  if (scope !== undefined) {
    const overrides: readonly string[] = FIELD_ERROR_SEGMENTS[scope];
    if (overrides.includes(segment)) return `visit.form.fields.${scope}.errors.${segment}`;
  }

  return `visit.form.errors.${segment}`;
}

/* -------------------------------------------------------------------------- *
 * The response body (07 §2 step 9)
 * -------------------------------------------------------------------------- */

/** Per-field codes, keyed by the schema field name that failed. */
export type InquiryFieldErrors = Readonly<Record<string, InquiryFieldCode>>;

/**
 * What `POST /api/inquiry` answers with.
 *
 * The success body carries **no provider id** on purpose: 07 §2 step 9 requires
 * it to be byte-identical to the decoy the honeypot path returns, so a bot
 * learns nothing from a successful-looking response. The Resend id goes to the
 * structured log instead.
 */
export type InquiryResponseBody =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code?: InquiryFormCode;
      readonly fields?: InquiryFieldErrors;
    };
