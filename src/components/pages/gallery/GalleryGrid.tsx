"use client";

import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { PhotoSlot } from "@/components/ui/PhotoSlot";

import { assignSpans, GRID, GRID_BUTTON, GRID_PHOTO } from "./layout";
import type { GalleryItem } from "./types";

/**
 * The mosaic (04 §3.6 `GalleryGrid`; D L497–506, M L397–404).
 *
 * A `<ul>` of thumbnails, each a button that opens the lightbox on its own
 * photograph. The span table is `layout.ts`'s and is positional, not per-photo
 * — see that file for why the two references force that reading.
 *
 * ── Every photograph is a `PhotoSlot`, not a `next/image` ────────────────
 *
 * 04 §3.6 asks for "`next/image` with `sizes`", and there is nothing to point
 * one at: HD-12 settled that no stock imagery is bought, `public/` carries the
 * logo and nothing else, and `site.gallery.photos[].src` names files that do
 * not exist. `PhotoSlot` is 03 §9 / `D-04.12`'s answer for exactly that state
 * — it reserves the photo's box and tints it from `--section-bg` — and it is
 * what the home wall's polaroids already render. Swapping in `next/image` is a
 * change to this one component on the day the photographs arrive; the boxes do
 * not move.
 *
 * ── Every photograph is always mounted ───────────────────────────────────
 *
 * The filter hides; it never unmounts. `layout.ts` carries the measurement
 * behind that — a `RevealItem` remounted after the stagger container has
 * already played inherits `hidden` and never leaves it — and the rule shows up
 * here as one thing: `items` is the **whole** list on every render, and
 * `isVisible` decides a class.
 *
 * ── One stagger group, no second observer ────────────────────────────────
 *
 * The `<ul>` is a `Reveal stagger` and each `<li>` a `riseChild` 110 ms behind
 * the last (04 §3.6's motion column, 05 §5.3). A stagger container is never
 * itself transformed (INV-05.4) and `RevealItem`s carry no viewport of their
 * own, so the page still has the one pooled observer (INV-05.9). The container
 * keeps one `id` for the life of the page: `Reveal` is once-per-session by id
 * (`D-05.6`), and re-keying it per filter would replay the entrance on every
 * chip press, which is not an entrance any more.
 */

export type GalleryGridProps = {
  /** Every photograph, always — see the note above. */
  readonly items: readonly GalleryItem[];
  /** Does the pressed chip include this photograph? */
  readonly isVisible: (item: GalleryItem) => boolean;
  /** Opens the lightbox on `id`. */
  readonly onOpen: (id: string) => void;
  /** Set on each thumbnail so the lightbox can return focus to it. */
  readonly thumbnailId: (id: string) => string;
};

export function GalleryGrid({ items, isVisible, onOpen, thumbnailId }: GalleryGridProps) {
  return (
    <Reveal id="gallery.grid" stagger as="ul" className={GRID}>
      {assignSpans(items, isVisible).map(({ photo, display, span }, index) => (
        <RevealItem
          key={photo.id}
          as="li"
          variant="riseChild"
          index={index}
          className={`${display} ${span}`}
        >
          <button
            type="button"
            id={thumbnailId(photo.id)}
            data-gallery-photo={photo.id}
            aria-label={photo.alt}
            /*
             * A hidden cell is `display: none`, so it is already out of the tab
             * order and out of the accessibility tree — no `inert` or
             * `tabIndex={-1}` is needed to keep a filtered-out photograph
             * unreachable.
             */
            onClick={() => {
              onOpen(photo.id);
            }}
            className={GRID_BUTTON}
          >
            {/*
              The slot has no `alt` of its own, so it is `aria-hidden` and the
              button carries the accessible name (04 §3.2). Two `role="img"`
              boxes with the same label — one inside the other's name — is the
              duplicate a screen reader would otherwise read out.
            */}
            <PhotoSlot slotId={photo.id} className={GRID_PHOTO} />
          </button>
        </RevealItem>
      ))}
    </Reveal>
  );
}
