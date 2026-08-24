"use client";

import { Chip } from "@/components/ui/Chip";

import { FILTER_BUTTON, FILTER_DISPLAY, FILTER_ROW } from "./layout";

/**
 * The filter chips (04 §3.6 `GalleryFilters`; D L488–494, M L392–397).
 *
 * "All" plus one chip per `site.gallery.categories[]`, exactly one pressed at a
 * time. The labels arrive as props — `gallery.filters.all` and
 * `collections.gallery.categories.<id>`, both read on the server — so no
 * message and no collection crosses the boundary for this row (04 §6).
 *
 * ── Why these *are* `Chip`s and the menu's day chips are not ─────────────
 *
 * `MenuDayChips` is the precedent for a pressable chip, and it deliberately
 * refuses `Chip`: "different family (Fredoka against Nunito), weight, size
 * token, colour token, padding token and shadow token, which is every property
 * in the recipe. Six important overrides would be a `Chip` in name only."
 *
 * Counting the same six properties here gives the opposite answer. The
 * references draw the unpressed chip as Nunito 700 (`Chip`'s recipe), at 11px
 * `< md` / 13px `≥ md` (`--text-chip`, the recipe's default size, exact on both
 * views), on a white fill with `--color-link-gallery` ink and
 * `--shadow-chip-cool` — which is `tone="cool"`, whose entry in `Chip` names
 * this component's chips as its consumer and cites the very line the reference
 * draws them on (D L492). The pressed chip is the same pill in
 * `--color-sage` with white ink, which is `tone="sage"`. Five of the six match
 * the recipe outright; only the padding does not, and only because 03 §4 mints
 * no `--chip-filter` — the drawing's `7×14` / `8×18` is a step off
 * `--chip-hero-badge`'s `6×13` / `7×15`. One gap, held open rather than papered
 * over with a raw px (INV-03.2), is not "a `Chip` in name only".
 *
 * The two shed exactly one recipe property each, both important because both
 * replace something `Chip` sets:
 *
 * - the pressed chip drops `--shadow-badge` (`shadow-none!`) — `tone="sage"`
 *   carries the HEAD TEACHER badge's lift and neither reference draws one under
 *   a filter chip (D L490, M L394);
 * - `text-(color:--section-link)!` is *not* needed: `tone="cool"` already reads
 *   the role variable, and on this page `SubpageBar` resolves it to
 *   `--color-link-gallery`, the reference's `#56707e`.
 *
 * ── The control is the button, the drawing is the chip ───────────────────
 *
 * `Chip` renders a `<span>` and carries no `--tap-min` floor on purpose — its
 * own file says the components that make a chip pressable "extend the hit area
 * on their own control, visual unchanged". So the `<button>` owns the pressed
 * state, the focus ring and the 44px pseudo-element (`FILTER_BUTTON`), and the
 * `Chip` inside owns every pixel that paints. Nothing about the drawn pill
 * moves (INV-04.7).
 *
 * ── `role="group"` and `aria-pressed`, not a tablist ─────────────────────
 *
 * 04 §3.6 spells it: "filters `role="group"` of toggle buttons `aria-pressed`".
 * That is the right pattern and it is *not* the day chips': a tab selects one
 * of several panels and takes roving focus with it, while these buttons filter
 * one grid that is always present. Every chip stays in the tab order and the
 * arrow keys are the browser's, which is what a group of toggles should do.
 */

/** One chip: the id the grid filters on, and the label the server produced. */
export type GalleryFilter = {
  /** A `site.gallery.categories[].id`, or {@link ALL_FILTER} for the "All" chip. */
  readonly id: string;
  /** `gallery.filters.all` or `collections.gallery.categories.<id>`. */
  readonly label: string;
  /** `site.gallery.categories[].onMobile`; the narrow view drops `celebrations`. */
  readonly onMobile: boolean;
};

/**
 * The "All" chip's id. It is not a category — `site.gallery.categories[]` has
 * four entries and the reference draws five chips — so the grid compares
 * against this sentinel rather than against a category that does not exist.
 * `src/content/schemas/gallery.ts` says the same thing from the other side:
 * "The 'All' chip is the message `gallery.filters.all`, not a category."
 */
export const ALL_FILTER = "all";

export type GalleryFiltersProps = {
  readonly filters: readonly GalleryFilter[];
  readonly selected: string;
  readonly onSelect: (id: string) => void;
  /** Names the group for a screen reader — `gallery.heading`, from the server. */
  readonly groupLabel: string;
};

export function GalleryFilters({ filters, selected, onSelect, groupLabel }: GalleryFiltersProps) {
  return (
    <div role="group" aria-label={groupLabel} className={FILTER_ROW}>
      {filters.map((filter) => {
        const pressed = filter.id === selected;

        return (
          <button
            key={filter.id}
            type="button"
            data-filter={filter.id}
            aria-pressed={pressed}
            onClick={() => {
              onSelect(filter.id);
            }}
            className={`${filter.onMobile ? FILTER_DISPLAY.both : FILTER_DISPLAY.desktopOnly} ${FILTER_BUTTON}`}
          >
            <Chip tone={pressed ? "sage" : "cool"} className={pressed ? "shadow-none!" : undefined}>
              {filter.label}
            </Chip>
          </button>
        );
      })}
    </div>
  );
}
