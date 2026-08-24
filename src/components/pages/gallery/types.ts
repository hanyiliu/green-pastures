/**
 * What crosses the server/client boundary for the gallery page (04 §3.6's
 * `GalleryExplorer` row, 04 §6, 02 `D-02.16`).
 *
 * The page joins `site.gallery.photos[]` with this locale's
 * `collections.gallery.photos.<id>` on the server — that is what
 * `src/content/collections.ts` is for, and it is server-only — and hands the
 * explorer the flat shape below. No collection and no message namespace beyond
 * `common.lightbox.*` reaches the browser for this row, which is what 04 §6's
 * client-namespace table records.
 *
 * The field list is 04 §3.6's, verbatim, minus `caption`: 02's schema makes it
 * optional and `content/en/collections/gallery.json` gives no photograph one,
 * so nothing here would render it and a prop nothing reads is a prop that rots.
 * Adding it is one field here and one line in the lightbox.
 */
export type GalleryItem = {
  /** A `site.gallery.photos[].id` — `g01` … `g08`. */
  readonly id: string;
  /** `site.gallery.photos[].src`; reserved for the day the photographs exist. */
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /** `collections.gallery.photos.<id>.alt`, in this locale (INV-02.3). */
  readonly alt: string;
  /** A `site.gallery.categories[].id`; what the filter chips compare against. */
  readonly category: string;
  /** 02 `D-02.13`'s surface flag; the narrow view draws six of the eight. */
  readonly onMobile: boolean;
};
