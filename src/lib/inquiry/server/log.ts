import type { InquiryCode } from "../codes";

/**
 * One structured line per request (07 §2 *Logging*, INV-07.5).
 *
 * The field list is the doc's, and so is the *absence* list: **never** the
 * name, the e-mail address, the message, the IP or the Turnstile token. That is
 * not a style preference — Vercel's runtime logs have a retention this project
 * does not control (09 decides on a drain), and a parent's e-mail address in
 * them is a data-handling promise broken in §4.
 *
 * {@link InquiryLogFields} is a closed type rather than a `Record<string,
 * unknown>` for the same reason: adding a field is a deliberate edit here, next
 * to the list of what may never appear, instead of an extra key at a call site
 * three modules away.
 *
 * `childAge` and `desiredStart` are in the doc's list and are not PII: an age
 * band and a month, with no person attached, are what tell the daycare whether
 * the infant room is the one filling up.
 */

export type InquiryOutcome =
  "accepted" | "spam" | "invalid" | "rejected" | "unavailable" | "failed";

export type InquiryLogFields = {
  readonly event: string;
  readonly requestId: string;
  readonly outcome: InquiryOutcome;
  readonly code?: InquiryCode;
  readonly status: number;
  readonly locale?: string;
  readonly source?: string;
  readonly childAge?: string;
  readonly desiredStart?: string;
  readonly durationMs: number;
  readonly transport?: string;
  readonly resendId?: string;
  readonly turnstileErrorCodes?: readonly string[];
};

/** Drop the keys that were never set, so the line stays readable. */
function compact(fields: InquiryLogFields): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

/**
 * Write the line. `console.info` for everything that worked as designed —
 * including a rejection, which is the endpoint doing its job — and
 * `console.error` for the two states an operator should see: the bot check
 * unavailable, and a provider failure.
 */
export function logInquiry(fields: InquiryLogFields): void {
  const line = JSON.stringify(compact(fields));
  if (fields.outcome === "unavailable" || fields.outcome === "failed") {
    console.error(line);
    return;
  }
  console.info(line);
}
