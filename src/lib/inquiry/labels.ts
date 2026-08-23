import type { Messages } from "@/i18n/messages";

import type { DesiredStartKeyword } from "./months";
import type { ChildAgeId } from "./schema";

/**
 * Option id → message key, with the compiler holding every end (02 rule 8).
 *
 * The ids are 02's canonical set and live in `./schema`, because the Zod enum is
 * what the wire is validated against. The *labels* live in
 * `content/<locale>/messages/visit.json`. The two are joined here, and the join
 * is checked in three directions by one mapped type plus one lookup:
 *
 * - The record's declared type maps over `keyof …options`, so **deleting**
 *   `visit.form.fields.childAge.options.expecting` from the reference locale
 *   leaves an excess property here and fails `tsc`.
 * - The same mapping makes **adding** an option to the JSON a missing property,
 *   so a `<select>` entry the server would reject cannot ship.
 * - `CHILD_AGE_OPTION_KEY[id]` in {@link childAgeOptionKey} indexes that record
 *   with a `ChildAgeId`, so **adding an id to the enum** with no matching option
 *   fails to compile there.
 *
 * Each value is its own key. That is not redundancy: it is what makes the first
 * two checks structural rather than a comment, and it is the only place the two
 * spellings meet.
 *
 * The month options have no message keys at all — their ids are `YYYY-MM` and
 * their labels come from the `dateMonth` format (02 rule 8) — which is why only
 * the two keywords appear below.
 */

type ChildAgeOptions = Messages["visit"]["form"]["fields"]["childAge"]["options"];
type DesiredStartOptions = Messages["visit"]["form"]["fields"]["desiredStart"]["options"];

export const CHILD_AGE_OPTION_KEY: { readonly [Key in keyof ChildAgeOptions]: Key } = {
  infant: "infant",
  toddler: "toddler",
  preschool: "preschool",
  expecting: "expecting",
  other: "other",
};

export const DESIRED_START_OPTION_KEY: { readonly [Key in keyof DesiredStartOptions]: Key } = {
  asap: "asap",
  flexible: "flexible",
};

/**
 * The keys as a `visit`-namespaced translator wants them — a template literal
 * type, so the returned value is still one of the keys next-intl knows and the
 * call site keeps its type checking instead of widening to `string`.
 */
export type ChildAgeOptionKey =
  `form.fields.childAge.options.${Extract<keyof ChildAgeOptions, string>}`;
export type DesiredStartOptionKey =
  `form.fields.desiredStart.options.${Extract<keyof DesiredStartOptions, string>}`;

/** `form.fields.childAge.options.toddler`, for a `visit` translator. */
export function childAgeOptionKey(id: ChildAgeId): ChildAgeOptionKey {
  return `form.fields.childAge.options.${CHILD_AGE_OPTION_KEY[id]}`;
}

/** `form.fields.desiredStart.options.asap`, likewise. */
export function desiredStartOptionKey(keyword: DesiredStartKeyword): DesiredStartOptionKey {
  return `form.fields.desiredStart.options.${DESIRED_START_OPTION_KEY[keyword]}`;
}
