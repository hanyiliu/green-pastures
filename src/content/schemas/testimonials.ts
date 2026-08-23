import { z } from "zod";

import { type CollectionOf, Id, idEnum, RichText, Text } from "./primitives";

/**
 * The `testimonials` collection (02 `D-02.11`, *Design → Collections*).
 *
 * The quote is the one rich field at launch — the design italicises a word
 * inside it ("the teachers truly <em>see</em> her") — and the quotation marks
 * around it come from `common.punctuation.*`, which is locale-aware, not from
 * the stored string.
 */

/* -------------------------------------------------------------------------- *
 * Per-locale text
 * -------------------------------------------------------------------------- */

export const TestimonialText = z.strictObject({
  quote: RichText,
  /** "Mei L." — a parent's name, per locale so a Chinese page may render it differently. */
  author: Text,
  /** "parent of a 3-year-old". */
  relation: Text,
});
export type TestimonialText = z.infer<typeof TestimonialText>;

export function testimonialsCollectionSchema(ids: readonly string[]) {
  return z.record(idEnum(ids), TestimonialText);
}
export type TestimonialsCollection = CollectionOf<TestimonialText>;

/* -------------------------------------------------------------------------- *
 * Shared data — content/site.json → testimonials[]
 * -------------------------------------------------------------------------- */

export const TestimonialShared = z.strictObject({
  id: Id,
  /** Rendered with the `rating` number format (`5` → "5.0"), never as text. */
  rating: z.number().min(0).max(5),
  /** The review's page on the source site, when there is one. */
  sourceUrl: z.url().optional(),
  /** Surface membership (02 `D-02.13`) — Karen T. is desktop-only, Alan W. page-only. */
  onHome: z.boolean().default(true),
  onMobile: z.boolean().default(true),
});
export type TestimonialShared = z.infer<typeof TestimonialShared>;
