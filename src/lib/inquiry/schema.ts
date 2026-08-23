import { z } from "zod";

import { routing } from "@/i18n/routing";

import {
  isInquiryFieldCode,
  type InquiryFieldCode,
  type InquiryFieldErrors,
  type InquiryFormFieldName,
} from "./codes";
import { isDesiredStartKeyword, isMonthId, isMonthIdInWindow, MONTH_ID_PATTERN } from "./months";
import { normaliseEmail, normaliseMessage, normaliseName } from "./normalise";

/**
 * The one inquiry schema, shared by client and server (07 `D-07.3`, INV-07.2).
 *
 * The client imports it for inline validation and has no second rule set; the
 * handler re-parses the body with it before anything else happens. Issue
 * messages are **machine codes** — `required`, `too_short`, `invalid_email` —
 * never copy, and the UI resolves them through `./codes` (INV-07.1).
 *
 * Two things about the shape, both deliberate departures from the illustrative
 * sketch in 07 §1, and both required by the normative text around it.
 *
 * 1. **The honeypot is not `z.literal("")`.** 07 §2 orders the steps: parse
 *    (step 2) *then* the decoy path (step 3). A schema that rejected a filled
 *    `website` would answer 400 with a field code and tell every bot exactly
 *    which field is the trap — the opposite of what the decoy is for. The field
 *    is therefore accepted with any value and {@link isBotSignal} decides,
 *    which is what step 3 describes. The sketch is labelled "illustrative"; the
 *    step order is not.
 * 2. **`z.object`, not `z.strictObject`.** `src/content/schemas/**` is strict
 *    because an unrecognised key in the owner's content file is a typo worth
 *    failing a build over. This is the opposite situation: a public wire format
 *    that a browser, a proxy or Turnstile itself may add a field to. Unknown
 *    keys are stripped, and nothing downstream can read one, so nothing is lost
 *    by not making them fatal.
 *
 * Every string field also carries `.default("")`, so an **omitted** field and a
 * **blank** one report the same code. Without it, a JSON body missing
 * `parentName` reports Zod's `invalid_type` — which resolves to the generic
 * `invalid`, "please check this value", on a control the parent never filled
 * in. `required` is what 07 §9 says a missing value is, so a missing key has to
 * arrive at the refinement as an empty string rather than as `undefined`.
 */

/* -------------------------------------------------------------------------- *
 * Option sets and limits (07 §1, `D-07.2`; the age ids are 02's canonical set)
 * -------------------------------------------------------------------------- */

export const CHILD_AGE_IDS = ["infant", "toddler", "preschool", "expecting", "other"] as const;
export type ChildAgeId = (typeof CHILD_AGE_IDS)[number];

export const INQUIRY_SOURCES = ["home", "enroll"] as const;
export type InquirySource = (typeof INQUIRY_SOURCES)[number];

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 254;
export const MESSAGE_MAX_LENGTH = 1000;
export const TURNSTILE_TOKEN_MAX_LENGTH = 2048;

/** The honeypot field name — hidden, must stay empty (07 §1, technical fields). */
export const HONEYPOT_FIELD = "website";

/** Cloudflare's own field name for the widget's token; not ours to rename. */
export const TURNSTILE_TOKEN_FIELD = "cf-turnstile-response";

/** The time-to-submit floor: a submit sooner than this is a bot (07 §3). */
export const MIN_SUBMIT_MS = 3000;

/** The maximum request body the handler will read, in bytes (07 §2 step 1). */
export const MAX_BODY_BYTES = 16 * 1024;

/* -------------------------------------------------------------------------- *
 * Field builders
 * -------------------------------------------------------------------------- */

/** Report one code and stop — a field carries a single error, never a list. */
function fail(ctx: z.RefinementCtx, code: InquiryFieldCode): void {
  ctx.addIssue({ code: "custom", message: code, path: [] });
}

/**
 * A normalised, length-bounded string. `required` wins over `too_short` when the
 * value is empty, because "please tell us your name" reads better than "at
 * least 2 characters" on a field nobody has touched.
 */
function boundedText(options: {
  readonly normalise: (value: string) => string;
  readonly min: number;
  readonly max: number;
  readonly required: boolean;
}) {
  return z
    .string()
    .default("")
    .transform(options.normalise)
    .superRefine((value, ctx) => {
      if (value.length === 0) {
        if (options.required) fail(ctx, "required");
        return;
      }
      if (value.length < options.min) return fail(ctx, "too_short");
      if (value.length > options.max) return fail(ctx, "too_long");
    });
}

const EMAIL_FORMAT = z.email();

const parentName = boundedText({
  normalise: normaliseName,
  min: NAME_MIN_LENGTH,
  max: NAME_MAX_LENGTH,
  required: true,
});

const email = z
  .string()
  .default("")
  .transform(normaliseEmail)
  .superRefine((value, ctx) => {
    if (value.length === 0) return fail(ctx, "required");
    if (value.length > EMAIL_MAX_LENGTH) return fail(ctx, "too_long");
    if (!EMAIL_FORMAT.safeParse(value).success) fail(ctx, "invalid_email");
  });

const childAge = z
  .string()
  .default("")
  .superRefine((value, ctx) => {
    if (value.length === 0) return fail(ctx, "required");
    if (!(CHILD_AGE_IDS as readonly string[]).includes(value)) fail(ctx, "invalid_option");
  })
  .pipe(z.enum(CHILD_AGE_IDS));

/**
 * Optional. `""` (the disabled placeholder option, and what an omitted field
 * becomes) means "not answered" and parses to `undefined`; `asap` and
 * `flexible` are ids; anything else must be a `YYYY-MM` inside the accepted
 * window, which is read at parse time so a page rendered weeks ago still
 * validates against today.
 */
const desiredStart = z
  .string()
  .default("")
  .superRefine((value, ctx) => {
    if (value.length === 0 || isDesiredStartKeyword(value)) return;
    if (!isMonthId(value)) return fail(ctx, "invalid_option");
    if (!isMonthIdInWindow(value, new Date())) fail(ctx, "out_of_range");
  })
  .transform((value) => (value.length === 0 ? undefined : value));

const message = boundedText({
  normalise: normaliseMessage,
  min: 0,
  max: MESSAGE_MAX_LENGTH,
  required: false,
}).transform((value) => (value.length === 0 ? undefined : value));

/**
 * The honeypot. Accepted whatever it holds — see the header note — but bounded,
 * so a bot cannot use it to push the body past the size cap for free.
 */
const honeypot = z.string().max(NAME_MAX_LENGTH, "too_long").default("");

const turnstileToken = z
  .string()
  .default("")
  .superRefine((value, ctx) => {
    if (value.length === 0) return fail(ctx, "required");
    if (value.length > TURNSTILE_TOKEN_MAX_LENGTH) fail(ctx, "too_long");
  });

/* -------------------------------------------------------------------------- *
 * The schema
 * -------------------------------------------------------------------------- */

/**
 * The locale enum is `routing.locales` itself, never a hand-written list
 * (07 §1). A locale INV-02.11 holds back is rejected for as long as it is out
 * of that array, and enabling it later changes no code here.
 */
export const inquirySchema = z.object({
  parentName,
  email,
  childAge,
  desiredStart,
  message,
  locale: z.enum(routing.locales, { error: () => "invalid_option" }),
  source: z.enum(INQUIRY_SOURCES, { error: () => "invalid_option" }),
  submissionId: z.uuid({ error: () => "invalid" }),
  startedAt: z.coerce.number({ error: () => "invalid" }).int({ error: "invalid" }),
  [HONEYPOT_FIELD]: honeypot,
  [TURNSTILE_TOKEN_FIELD]: turnstileToken,
});

/** One parsed, normalised submission. */
export type Inquiry = z.infer<typeof inquirySchema>;

/** The five controls the design draws, in the order it draws them. */
export const INQUIRY_FORM_FIELDS = [
  "parentName",
  "email",
  "childAge",
  "desiredStart",
  "message",
] as const satisfies ReadonlyArray<InquiryFormFieldName>;

/* -------------------------------------------------------------------------- *
 * Parsing
 * -------------------------------------------------------------------------- */

export type InquiryParseResult =
  | { readonly ok: true; readonly inquiry: Inquiry }
  | { readonly ok: false; readonly fields: InquiryFieldErrors };

/**
 * Parse a raw payload into per-field codes or a normalised inquiry.
 *
 * Zod reports one issue per field because every builder above stops at its
 * first failure; where it somehow reports two, the first wins, so the shape of
 * the 400 body is `Record<field, code>` exactly as 07 §1's table promises.
 * An issue whose message is not one of the seven field codes is reported as
 * `invalid`, the generic — a schema-level failure with no code of its own must
 * still render something a parent can read.
 */
export function parseInquiry(payload: unknown): InquiryParseResult {
  const result = inquirySchema.safeParse(payload);
  if (result.success) return { ok: true, inquiry: result.data };

  const fields: Record<string, InquiryFieldCode> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || field in fields) continue;
    fields[field] = asFieldCode(issue.message);
  }
  return { ok: false, fields };
}

/**
 * A Zod issue message as a field code, or the generic `invalid`.
 *
 * The recognised set is `./codes`'s and is asked for, never restated: this file
 * used to carry its own copy of the seven, and a copy that fell behind would
 * have downgraded every occurrence of a newly added code to `invalid` without
 * failing anything. {@link isInquiryFieldCode} also narrows, so the fallback is
 * the only place a code is asserted rather than proved.
 */
function asFieldCode(message: string): InquiryFieldCode {
  return isInquiryFieldCode(message) ? message : "invalid";
}

/* -------------------------------------------------------------------------- *
 * Bot signals (07 §2 step 3)
 * -------------------------------------------------------------------------- */

/**
 * Honeypot filled, or submitted sooner than {@link MIN_SUBMIT_MS} after the
 * form mounted. Either one sends the request down the decoy path: log
 * `inquiry.spam`, answer `200 { ok: true }`, send nothing.
 *
 * A `startedAt` in the future is a signal too. Clocks disagree, and a browser's
 * can be minutes off, but a form that claims it mounted *after* the request
 * arrived is not a browser making an honest mistake in the direction that
 * matters — and treating it as a bot costs a real parent nothing, because the
 * decoy is indistinguishable from success.
 */
export function isBotSignal(
  inquiry: Pick<Inquiry, "startedAt"> & { readonly [HONEYPOT_FIELD]: string },
  now: number,
): boolean {
  if (inquiry[HONEYPOT_FIELD].length > 0) return true;
  return now - inquiry.startedAt < MIN_SUBMIT_MS;
}

/** Re-exported so a caller needs one import to render the month options. */
export { MONTH_ID_PATTERN };
