import { z } from "zod";

import { type CollectionOf, Emoji, Id, idEnum, Image, Text } from "./primitives";

/**
 * The `teachers` collection (02 `D-02.11`, *Design → Collections → teachers*).
 *
 * Display names are per-locale text, so a Chinese page may show "陈老师" alone.
 * The HEAD TEACHER badge and the photo-slot rule are `site.json` data (`head`,
 * `photo`), never a name comparison. The three shipped names and their
 * credentials are the design's samples and are listed in `site.json.provisional`
 * — the only provisional values that live outside `site.json`, because they are
 * text rather than facts (02 `D-02.20`).
 */

/* -------------------------------------------------------------------------- *
 * Per-locale text
 * -------------------------------------------------------------------------- */

export const TeacherText = z.strictObject({
  /** "Ms. Ping" / "Ms. Chen 陈老师". */
  name: Text,
  /** "AMS certified · 15 years with little ones". */
  credentials: Text.optional(),
  /** The card line; `summaryShort` is 02 `D-02.13`'s mobile variant. */
  summary: Text,
  summaryShort: Text.optional(),
  /** The Team page paragraph. */
  bio: Text,
  bioShort: Text.optional(),
  /** Up to three chips; empty for the teachers whose cards show none. */
  tags: z.array(Text).max(3),
  /**
   * Optional here and cross-checked in the join: 02's photo-slot rule gives
   * only the head teacher a photograph, and a teacher who has one must have an
   * `alt` (INV-02.3) — see `requirePhotoAlt` in `src/content/collections.ts`.
   */
  photoAlt: Text.optional(),
});
export type TeacherText = z.infer<typeof TeacherText>;

export function teachersCollectionSchema(ids: readonly string[]) {
  return z.record(idEnum(ids), TeacherText);
}
export type TeachersCollection = CollectionOf<TeacherText>;

/* -------------------------------------------------------------------------- *
 * Shared data — content/site.json → teachers[]
 * -------------------------------------------------------------------------- */

export const TeacherShared = z.strictObject({
  id: Id,
  /** The HEAD TEACHER badge. At most one teacher may carry it — see `site.ts`. */
  head: z.boolean().default(false),
  /** 🧸 / 🎨 — the placeholder pictogram a teacher without a photograph shows. */
  icon: Emoji.optional(),
  photo: Image.optional(),
});
export type TeacherShared = z.infer<typeof TeacherShared>;
