"use client";

import { useCallback, useMemo, useState } from "react";

import { Reveal } from "@/components/motion/Reveal";

import { ALL_FILTER, GalleryFilters, type GalleryFilter } from "./GalleryFilters";
import { GalleryGrid } from "./GalleryGrid";
import { Lightbox } from "./Lightbox";
import type { GalleryItem } from "./types";

/**
 * The gallery page's one client component (04 §3.6, §6; D L488–507,
 * M L392–405).
 *
 * It owns two pieces of state — which chip is pressed and which photograph the
 * lightbox is showing — and nothing else. `GalleryFilters`, `GalleryGrid` and
 * `Lightbox` are the three leaves 04 §3.6 lists as "internal to
 * `GalleryExplorer`", and they are separate files because each is a different
 * a11y contract, not because either is reused.
 *
 * ── What crosses the boundary ────────────────────────────────────────────
 *
 * Items, category labels and `allLabel` arrive as **props**, already joined and
 * translated on the server (`src/content/collections.ts` is server-only, 02
 * `D-02.16`). The only namespace this subtree reads for itself is
 * `common.lightbox.*`, which is what 04 §6's client-namespace table records —
 * `gallery` is on 02's client allowlist as headroom and no launch component
 * reads it in the browser.
 *
 * ── The filter is a comparison of two data values ────────────────────────
 *
 * `selected` holds a `site.gallery.categories[].id` or {@link ALL_FILTER}, and
 * the grid compares it against `item.category`. Nothing is typed against a
 * category name and nothing branches on one, so adding a fifth category is an
 * edit to `content/site.json` and its four collection files (INV-04.4).
 *
 * ── The lightbox walks the *filtered* list ───────────────────────────────
 *
 * The arrows step through what the reader can see, not through all eight — a
 * next arrow that jumps out of the filter would be the filter not meaning
 * anything. Stepping wraps at both ends, so the two controls are never dead and
 * neither needs a disabled state the design does not draw.
 *
 * **A chip pressed while the lightbox is open closes it.** The photograph on
 * screen may not be in the new filter at all, and leaving a modal open over a
 * grid it no longer belongs to is worse than the extra tap.
 *
 * ── The grid takes the predicate; the lightbox takes the list ────────────
 *
 * Both come from the same `isVisible`, and they take different shapes for one
 * reason: the grid must keep every thumbnail **mounted** across a filter change
 * or its entrance never plays again (measured; `layout.ts` carries the note),
 * while the lightbox genuinely only knows about what is showing.
 */

export type GalleryExplorerProps = {
  /** Every photograph, joined and translated on the server, in `site.json` order. */
  readonly items: readonly GalleryItem[];
  /** `site.gallery.categories[]` with `collections.gallery.categories.<id>` attached. */
  readonly categories: readonly GalleryFilter[];
  /** `gallery.filters.all` — the chip that is not a category. */
  readonly allLabel: string;
  /** Names the filter group for a screen reader — `gallery.heading`. */
  readonly groupLabel: string;
};

/**
 * The grid's own id for a thumbnail, so the lightbox can hand focus back to the
 * photograph the reader is actually looking at rather than to the one they
 * opened.
 */
function thumbnailId(photoId: string): string {
  return `gallery-photo-${photoId}`;
}

export function GalleryExplorer({ items, categories, allLabel, groupLabel }: GalleryExplorerProps) {
  const [selected, setSelected] = useState<string>(ALL_FILTER);
  const [openId, setOpenId] = useState<string | null>(null);

  /** "All" first, then `site.gallery.categories[]` in the order 02 declares. */
  const filters = useMemo<readonly GalleryFilter[]>(
    () => [{ id: ALL_FILTER, label: allLabel, onMobile: true }, ...categories],
    [allLabel, categories],
  );

  /**
   * Does the pressed chip include this photograph? The grid takes the
   * *predicate* and keeps every item mounted — see `GalleryGrid` — while the
   * lightbox takes the narrowed list, because the arrows walk what the reader
   * can see.
   */
  const isVisible = useCallback(
    (item: GalleryItem) => selected === ALL_FILTER || item.category === selected,
    [selected],
  );

  const visible = useMemo(() => items.filter(isVisible), [items, isVisible]);

  const openIndex = visible.findIndex((item) => item.id === openId);
  const open = openIndex === -1 ? null : (visible[openIndex] ?? null);

  const onSelect = useCallback((id: string) => {
    setSelected(id);
    setOpenId(null);
  }, []);

  const onStep = useCallback(
    (step: number) => {
      if (visible.length === 0) return;
      // `+ length` before the modulo: JavaScript's `%` keeps the sign, so
      // stepping back from the first photograph would answer −1 without it.
      const next = visible[(openIndex + step + visible.length) % visible.length];
      if (next !== undefined) setOpenId(next.id);
    },
    [openIndex, visible],
  );

  const onClose = useCallback(() => {
    // The platform restores focus to whatever opened the dialog; after the
    // arrows have moved on, that is the wrong thumbnail. Re-point it at the
    // photograph the reader was last looking at (04 §5.5).
    const returnTo = openId;
    setOpenId(null);
    if (returnTo === null) return;
    document.getElementById(thumbnailId(returnTo))?.focus();
  }, [openId]);

  return (
    <>
      <Reveal id="gallery.filters" variant="rise">
        <GalleryFilters
          filters={filters}
          selected={selected}
          onSelect={onSelect}
          groupLabel={groupLabel}
        />
      </Reveal>

      <GalleryGrid
        items={items}
        isVisible={isVisible}
        onOpen={setOpenId}
        thumbnailId={thumbnailId}
      />

      <Lightbox item={open} items={visible} onStep={onStep} onClose={onClose} />
    </>
  );
}
