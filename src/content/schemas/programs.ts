import { z } from "zod";

import { type CollectionOf, Id, idEnum, Image, PositiveInt, Text } from "./primitives";

/**
 * The `programs` collection (02 `D-02.11`, *Design → Collections*).
 *
 * Text per locale in `content/<locale>/collections/programs.json`; ids, age
 * ranges, ratios, the photo and the `featured` flag once in
 * `content/site.json` under `programs[]`.
 */

/* -------------------------------------------------------------------------- *
 * Per-locale text
 * -------------------------------------------------------------------------- */

export const ProgramText = z.strictObject({
  /** "Infant" — the programme's display name, translated. */
  name: Text,
  /**
   * "6 – 18 months". Text, not derived from `ageMonths`: the English uses an
   * en dash and a word, Chinese uses neither, and 02 `D-02.3` keeps a rendered
   * label out of the data.
   */
  ageLabel: Text,
  /** The card line on the home page; `summaryShort` is 02 `D-02.13`'s mobile variant. */
  summary: Text,
  summaryShort: Text.optional(),
  /** The longer paragraph the Programs page renders. */
  description: Text,
  /** Two or three chips; mobile slices to two (02 `D-02.13`). */
  highlights: z.array(Text).min(1).max(3),
  /** Required, because every programme in `site.json` carries a photo (INV-02.3). */
  photoAlt: Text,
});
export type ProgramText = z.infer<typeof ProgramText>;

/**
 * One collection file, keyed by the ids `site.json` declares. Exhaustive in
 * both directions — see {@link idEnum}.
 */
export function programsCollectionSchema(ids: readonly string[]) {
  return z.record(idEnum(ids), ProgramText);
}
export type ProgramsCollection = CollectionOf<ProgramText>;

/* -------------------------------------------------------------------------- *
 * Shared data — content/site.json → programs[]
 * -------------------------------------------------------------------------- */

/** `[6, 18]` — inclusive age band in months, low first. */
const AgeMonths = z
  .tuple([z.number().int().nonnegative(), PositiveInt])
  .refine(([from, to]) => from < to, { error: "ageMonths is [from, to] with from < to." });

/** `[1, 3]` — one adult to three children; renders through `programs.ratioLabel`. */
const Ratio = z.tuple([PositiveInt, PositiveInt]);

export const ProgramShared = z.strictObject({
  id: Id,
  ageMonths: AgeMonths,
  ratio: Ratio,
  /** The Toddler card is raised in the design; default keeps `site.json` terse. */
  featured: z.boolean().default(false),
  photo: Image,
});
export type ProgramShared = z.infer<typeof ProgramShared>;
