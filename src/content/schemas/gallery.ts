import { z } from "zod";

import { AssetPath, Id, idEnum, PositiveInt, Text } from "./primitives";

/**
 * The `gallery` collection (02 `D-02.11`, *Design → Collections → gallery*).
 *
 * Per-locale text is the `alt` of every photo (INV-02.3 requires one in every
 * locale), an optional caption, and the category names the filter chips
 * render. The "All" chip is the message `gallery.filters.all`, not a category.
 */

/* -------------------------------------------------------------------------- *
 * Per-locale text
 * -------------------------------------------------------------------------- */

export const GalleryPhotoText = z.strictObject({
  alt: Text,
  caption: Text.optional(),
});
export type GalleryPhotoText = z.infer<typeof GalleryPhotoText>;

/**
 * One `gallery.json`. Both records are exhaustive against `site.json`, so a
 * photo added to `site.gallery.photos[]` without an `alt` fails the build
 * rather than shipping an unlabelled image (INV-02.3).
 */
export function galleryCollectionSchema(shared: GalleryShared) {
  return z.strictObject({
    categories: z.record(idEnum(shared.categories.map((category) => category.id)), Text),
    photos: z.record(idEnum(shared.photos.map((photo) => photo.id)), GalleryPhotoText),
  });
}

export type GalleryCollection = {
  readonly categories: Readonly<Record<string, string>>;
  readonly photos: Readonly<Record<string, GalleryPhotoText>>;
};

/* -------------------------------------------------------------------------- *
 * Shared data — content/site.json → gallery
 * -------------------------------------------------------------------------- */

export const GalleryCategoryShared = z.strictObject({
  id: Id,
  /** The design drops one chip on mobile; membership is data, not a breakpoint. */
  onMobile: z.boolean().default(true),
});
export type GalleryCategoryShared = z.infer<typeof GalleryCategoryShared>;

export const GalleryPhotoShared = z.strictObject({
  id: Id,
  src: AssetPath,
  width: PositiveInt,
  height: PositiveInt,
  /** Cross-checked against `gallery.categories[].id` by the site schema. */
  category: Id,
  /** A landscape polaroid that spans two columns. */
  wide: z.boolean().default(false),
  /** Degrees of tilt in the polaroid stack; a negative value tilts the other way. */
  rotation: z.number().optional(),
  /** Surface membership (02 `D-02.13`): 04 filters, then slices by breakpoint. */
  onHome: z.boolean().default(true),
  onMobile: z.boolean().default(true),
});
export type GalleryPhotoShared = z.infer<typeof GalleryPhotoShared>;

export const GalleryShared = z.strictObject({
  categories: z.array(GalleryCategoryShared).min(1),
  photos: z.array(GalleryPhotoShared).min(1),
});
export type GalleryShared = z.infer<typeof GalleryShared>;
