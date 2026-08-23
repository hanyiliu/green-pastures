import { z } from "zod";

import { type CollectionOf, Id, idEnum, RichText, Text } from "./primitives";

/**
 * The `faq` collection — **reserved, not built** (02 `D-02.17` / HD-5).
 *
 * `content/<locale>/collections/faq.json` and `site.json.faq[]` stay in the
 * tree so 06 can ship the route the day content exists. While `site.json.faq[]`
 * is empty the namespace is exempt from parity, the sitemap, the nav and the
 * Playwright matrix — and {@link faqCollectionSchema} over an empty id list
 * accepts `{}` and rejects every key, which is the same rule expressed as a
 * schema: nobody can add an FAQ answer without first declaring its id.
 */

export const FaqText = z.strictObject({
  question: Text,
  /** Rich text is allowed here (02 *Design → Collections*). */
  answer: RichText,
});
export type FaqText = z.infer<typeof FaqText>;

export function faqCollectionSchema(ids: readonly string[]) {
  return z.record(idEnum(ids), FaqText);
}
export type FaqCollection = CollectionOf<FaqText>;

export const FaqShared = z.strictObject({
  id: Id,
  /** Optional grouping for a future FAQ page with sections. */
  topic: Id.optional(),
});
export type FaqShared = z.infer<typeof FaqShared>;
