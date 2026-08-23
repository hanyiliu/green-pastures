import type { Messages } from "@/i18n/messages";
import { inquiryErrorMessageKey, type InquiryFormFieldName } from "@/lib/inquiry/codes";

/**
 * The component-side half of 07's error-code record (04 `D-04.14`).
 *
 * **It re-exports; it does not redefine.** `D-04.14` places "the typed record
 * mapping 07's wire codes to 02's key segments" at this path, and PR-5.8 had
 * already built that record — the fourteen codes, the camelCase segments, the
 * per-field overrides and the fallback order — in `src/lib/inquiry/codes.ts`,
 * because the *handler* has to read the same list. Copying it here would give
 * the code list two homes and one of them would go stale, so this module
 * re-exports the shared one whole (`export *` below) and adds the one thing a
 * component needs and a handler does not: the key **relative to the namespace
 * the client actually holds**.
 *
 * That is the whole difference. `inquiryErrorMessageKey` answers with a path
 * from the root of the message tree — `visit.form.errors.network` — which is
 * what a server translator built with `getTranslations()` wants. `FormAlert`
 * and `FormField` read through `useTranslations("visit.form")` (04 §3.5,
 * §5.2 — `visit` is a client namespace, `D-02.16`), so they need
 * `errors.network`. {@link inquiryErrorKey} is that one subtraction.
 *
 * **A missing key is still a compile error**, and in two places now. The record
 * itself is typed against `Messages` in `src/lib/inquiry/codes.ts`, so deleting
 * `visit.form.errors.turnstileFailed` from `content/en/messages/visit.json`
 * fails `tsc` there; {@link InquiryErrorKey} is derived from the same tree, so
 * the literal {@link UNKNOWN_ERROR_KEY} below stops compiling here the moment
 * `visit.form.errors.unknown` goes missing. Neither can ship a banner that
 * renders `⟦visit.form.errors.unknown⟧` to a parent.
 */

export * from "@/lib/inquiry/codes";

type VisitForm = Messages["visit"]["form"];

/** A key of `visit.form.errors` — the generic, form-level error copy. */
type ErrorSegment = Extract<keyof VisitForm["errors"], string>;

/** A key of `visit.form.fields.<field>.errors` — that field's own override. */
type FieldErrorSegment<TField extends InquiryFormFieldName> = VisitForm["fields"][TField] extends {
  readonly errors: infer TErrors;
}
  ? Extract<keyof TErrors, string>
  : never;

/**
 * Every key an inquiry error can resolve to, spelled the way a
 * `useTranslations("visit.form")` translator wants it.
 *
 * The union is computed from the message tree, never written out: the generic
 * `errors.<segment>` half plus, per field, only the segments that field
 * actually overrides. A key next-intl would reject is therefore not
 * constructible, and the `t(key)` call sites keep their type checking instead
 * of widening to `string`.
 */
export type InquiryErrorKey =
  | `errors.${ErrorSegment}`
  | {
      [TField in InquiryFormFieldName]: `fields.${TField}.errors.${FieldErrorSegment<TField>}`;
    }[InquiryFormFieldName];

/**
 * 02's last error-table row — "*(any other)* → `unknown`" — as a key.
 *
 * Typed as {@link InquiryErrorKey} rather than inferred, which is what makes it
 * a live check: delete `visit.form.errors.unknown` and this line is the error.
 */
export const UNKNOWN_ERROR_KEY: InquiryErrorKey = "errors.unknown";

/** The prefix {@link inquiryErrorMessageKey} adds and this module removes. */
const VISIT_FORM_PREFIX = "visit.form.";

/**
 * The message key a wire code renders through, relative to `visit.form`.
 *
 * The resolution order is not decided here — it is 02's, implemented once in
 * the shared record: a field-scoped code tries `fields.<field>.errors.<segment>`
 * and falls back to `errors.<segment>`; a form-scoped code renders from
 * `errors.<segment>`; anything unrecognised renders `errors.unknown`. This
 * function only re-anchors the answer, so the two spellings can never drift.
 */
export function inquiryErrorKey(code: string, field?: string): InquiryErrorKey {
  const absolute = inquiryErrorMessageKey(code, field);
  return absolute.startsWith(VISIT_FORM_PREFIX)
    ? (absolute.slice(VISIT_FORM_PREFIX.length) as InquiryErrorKey)
    : UNKNOWN_ERROR_KEY;
}
