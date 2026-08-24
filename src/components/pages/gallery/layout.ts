/**
 * The gallery page's geometry (04 §3.6 `GalleryExplorer`, `D-04.6`, INV-04.5;
 * D L480–508, M L383–406).
 *
 * Every number the two references draw for the photo *wall on the subpage*
 * lives here rather than in the components — the two column counts, the two row
 * heights, the two gaps, and the span table that makes the mosaic. The home
 * wall's `src/components/sections/gallery/layout.ts` is the pattern this
 * follows, and `D-04.6` is the rule both obey: `site.json` carries data, the
 * slot geometry lives beside the components that draw it.
 *
 * ── Why the spans are positional and not `site.gallery.photos[].wide` ─────
 *
 * The obvious reading is that `wide: true` — which only `g07` carries — is the
 * span, and it is wrong in both directions once the two drawings are put side
 * by side. `g07` is the **seventh** photo, and the wide reference gives its
 * seventh slot `grid-column: span 2` (D L506) while the narrow reference gives
 * *its* fifth slot — which `onMobile` filtering also resolves to `g07` — a
 * `grid-row: span 2` (M L402). The same photograph is wide on one view and tall
 * on the other, so the span cannot be a property of the photograph.
 *
 * It is a property of the **position**, and the two references agree on that:
 * slots 1 and 5 are tall on both views, and the wide view adds one
 * double-width slot at 7. {@link assignSpans} is that table, and it is the only
 * shape that survives the filter chips — filter to Meals and the two photos
 * left have to land in slots 1 and 2, whatever their ids are.
 *
 * `site.gallery.photos[].wide` is therefore not read by this page. It is not
 * dead: it records which photograph is the 1600×900 landscape one, which is why
 * `g07` sits at the index the wide slot is drawn at in the unfiltered view. The
 * flag has no other consumer in `src/` today, and it is 02's to keep or retire.
 *
 * ── The row heights are on the spacing scale, not arbitrary values ───────
 *
 * `grid-auto-rows` is what makes `row-span-2` mean "twice as tall" rather than
 * "twice whatever this photograph happens to be", so both heights are fixed:
 * 130px `< md` (M L398) and 170px `≥ md` (D L498). Tailwind v4 resolves
 * `auto-rows-*` against `--spacing`, so those are `auto-rows-32.5` and
 * `auto-rows-42.5` (× 4px) — the same spelling every other geometry number in
 * this repo uses, and never `auto-rows-[170px]`, which is a raw px in a class
 * (INV-03.2) and is what ESLint's `arbitraryValue` ban refuses.
 */

/**
 * The content column. The shell caps at `--container-content` (1080px) and
 * gaps 18px/28px; this page draws 1020px and 16px/24px (D L484, M L387), which
 * is the per-page config `SubpageBar`'s docstring describes — `max-w-255` is
 * 255 × 4px.
 *
 * Each class is important because each replaces a property the shell's recipe
 * sets, and the `md:` half is written out rather than left to the base: an
 * important unprefixed class does **not** outrank its own `md:` twin, so
 * `gap-4!` alone would lose to the recipe's `md:gap-7` above the breakpoint.
 */
export const GALLERY_COLUMN = "max-w-255! gap-4! md:gap-6!" as const;

/**
 * The header stack sheds its bottom margin. `SectionHeader` reserves 28px/44px
 * under itself for a home section; here the column's own gap is the whole
 * separation the design draws (D L485, M L388), so both halves are zeroed.
 */
export const GALLERY_HEADER = "mb-0! md:mb-0!" as const;

/** The filter row — centred, wrapping, 6px/8px apart (M L393, D L489). */
export const FILTER_ROW = "flex flex-wrap items-center justify-center gap-1.5 md:gap-2" as const;

/**
 * One filter chip's control.
 *
 * The chip itself is a {@link Chip} — see `GalleryFilters` for why this one is
 * a `Chip` where the menu's day chips are not — and this is the button around
 * it: the 44px hit area, the pointer and the focus ring, and nothing that
 * paints. `Chip` carries no `--tap-min` floor by design ("the components that
 * make a chip pressable … extend the hit area on their own control, visual
 * unchanged"), and the pseudo-element is how `MenuDayChips` already spells that
 * extension, so it is spelled the same way here: centred on the button,
 * `--tap-min` tall and at least `--tap-min` wide, with the drawn pill untouched
 * (03 §6, 04 §5.5, INV-04.7).
 *
 * `display` is deliberately **not** in this string. A category the narrow view
 * drops needs `hidden md:inline-flex`, and appending that to a recipe that
 * already says `inline-flex` puts two `display` claims on one element — the
 * failure `src/components/ui/class-names.tsx` exists to describe, since
 * Tailwind sorts `@layer utilities` by property and the attribute order decides
 * nothing. {@link FILTER_DISPLAY} holds the two complete alternatives instead,
 * which is how `Bubble` already spells the same surface flag.
 */
export const FILTER_BUTTON =
  "relative cursor-pointer items-center justify-center rounded-pill " +
  "before:absolute before:top-1/2 before:left-1/2 before:h-(--tap-min) before:w-full " +
  "before:min-w-(--tap-min) before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']";

/**
 * The two `display` recipes a filter chip can have — `site.gallery.categories[]`
 * flags `celebrations` `onMobile: false` and the narrow reference draws four
 * chips where the wide one draws five (M L392 vs D L488). The chip renders on
 * both views and `md:` decides; no component reads a viewport (02 `D-02.13`,
 * `D-04.5`, INV-04.4).
 */
export const FILTER_DISPLAY = {
  both: "inline-flex",
  desktopOnly: "hidden md:inline-flex",
} as const;

/**
 * The grid: two columns of 130px rows 10px apart `< md` (M L398), three columns
 * of 170px rows 14px apart `≥ md` (D L498).
 */
export const GRID =
  "grid grid-cols-2 auto-rows-32.5 gap-2.5 md:grid-cols-3 md:auto-rows-42.5 md:gap-3.5" as const;

/* -------------------------------------------------------------------------- *
 * The slot table
 * -------------------------------------------------------------------------- */

/**
 * Which slots are drawn larger than one cell, per view.
 *
 * Both references make their **first and fifth drawn slots** two rows tall
 * (D L499, L503; M L398, L402), and the wide one adds a two-column slot at its
 * seventh (D L506), which the narrow grid has no third column to hold.
 *
 * "Drawn" is the word that matters: the two views draw different *sets* of
 * photographs, because `onMobile` hides two of the eight. The narrow view's
 * fifth drawn slot is `g07` and the wide view's fifth is `g05`, so a single
 * index over the full list cannot produce both — which is why the assignment
 * below walks a second cursor over the `onMobile` subset, exactly as
 * `sections/gallery/layout.ts`'s `assignSlots` does for the home wall.
 */
const TALL_SLOTS: readonly number[] = [0, 4];
const WIDE_SLOT = 6;

/** A rendered cell: the photograph, and its classes on both views. */
export type GallerySpan<TPhoto> = {
  readonly photo: TPhoto;
  /** `hidden md:block` for a photograph the narrow view drops, else `block`. */
  readonly display: string;
  /** The row/column spans, both views, already prefixed. */
  readonly span: string;
};

/**
 * Every class below is a whole literal, never composed: Tailwind v4 scans
 * source text for complete class names, so a `md:` prefix concatenated at
 * runtime generates no CSS at all. Same reason, same spelling as the home
 * wall's slot tables.
 */
const CLASSES = {
  shown: "block",
  hiddenBelowMd: "hidden md:block",
  /** A photograph the current filter excludes — hidden on both views. */
  filteredOut: "hidden",
  tall: "row-span-2",
  tallDesktop: "md:row-span-2",
  /** The reset a mobile-tall slot needs when the wide view draws it one row. */
  shortDesktop: "md:row-span-1",
  wideDesktop: "md:col-span-2",
} as const;

/**
 * Assign the drawn slots to the photographs the current filter leaves, in
 * `site.json` order — "editors reorder by editing `site.json` order; slots fill
 * in order" (`D-04.6`).
 *
 * Unlike the home wall this never runs out of slots and never throws: the
 * mosaic is a *pattern*, not a fixed field of seven positions, so a ninth
 * photograph lands in a plain cell and the grid grows a row. That is also what
 * has to happen when a chip is pressed and three photographs are left — the
 * slot table walks whatever is showing, so the first of them is the tall one
 * whatever its id.
 *
 * ── Filtering hides; it never unmounts ───────────────────────────────────
 *
 * `isVisible` returns a class, not a decision about whether to render — every
 * photograph stays in the tree on every filter, and this is the reason.
 *
 * A `RevealItem` has no entrance of its own: it inherits `hidden` from the
 * enclosing `Reveal stagger` and is driven to `visible` when the container's
 * `whileInView` fires (05 §5.1). The container is `once`, so that fires exactly
 * one time. Unmounting a thumbnail on a filter and mounting it again on the
 * next one therefore produces an element that inherits `hidden` from a
 * container which will never animate again — an invisible photograph in a grid
 * cell it still occupies. Measured in chromium: after Meals → All, six of the
 * eight thumbnails sat at `opacity: 0` and stayed there.
 *
 * Keeping every item mounted also keeps its stagger index stable, so the
 * entrance never re-sequences under the reader.
 *
 * The photograph travels back out with its classes, so the caller pairs the two
 * once — here — instead of indexing a parallel array under
 * `noUncheckedIndexedAccess`.
 */
export function assignSpans<TPhoto extends { readonly onMobile: boolean }>(
  photos: readonly TPhoto[],
  isVisible: (photo: TPhoto) => boolean = () => true,
): readonly GallerySpan<TPhoto>[] {
  // Two cursors over the *shown* photographs — one per view, because the two
  // views show different subsets and each has its own slot table.
  let desktopCursor = 0;
  let mobileCursor = 0;

  return photos.map((photo) => {
    if (!isVisible(photo)) return { photo, display: CLASSES.filteredOut, span: "" };

    const parts: string[] = [];

    if (photo.onMobile) {
      if (TALL_SLOTS.includes(mobileCursor)) parts.push(CLASSES.tall);
      mobileCursor += 1;
    }

    const index = desktopCursor;
    desktopCursor += 1;

    // The wide view's own table, and the reset that keeps a slot the narrow
    // view stretched from staying stretched once the third column appears.
    if (TALL_SLOTS.includes(index)) parts.push(CLASSES.tallDesktop);
    else if (parts.includes(CLASSES.tall)) parts.push(CLASSES.shortDesktop);

    if (index === WIDE_SLOT) parts.push(CLASSES.wideDesktop);

    return {
      photo,
      display: photo.onMobile ? CLASSES.shown : CLASSES.hiddenBelowMd,
      span: parts.join(" "),
    };
  });
}

/**
 * A photo in the grid: the slot fills its cell in both axes, so the row height
 * above — not the photograph's own ratio — decides the box.
 *
 * `--radius-card-sm` is 13px `< md` and 16px `≥ md`; the references draw 14px
 * and 16px (M L399, D L499), so the wide view is exact and the narrow one is a
 * pixel tight. 03 §5 mints no closer step — `--radius-tile` is a flat 14px and
 * would be two pixels out on the view that is currently exact — so this binds
 * the token rather than inventing a px (INV-03.2).
 *
 * `rounded-card-sm!` is important because `PhotoSlot`'s recipe already sets a
 * radius (`--radius-card`, its default step) and the `className` contract
 * refuses a bare class that collides with one the recipe writes. `h-full`
 * collides with nothing — the recipe claims `display` and `width`, never
 * `height` — so it needs no marker.
 */
export const GRID_PHOTO = "h-full rounded-card-sm!" as const;

/**
 * The thumbnail button. It is the whole cell, so the hit area needs no
 * pseudo-element — the smallest cell the grid can draw is half a narrow
 * viewport by 130px.
 */
export const GRID_BUTTON = "block h-full w-full cursor-pointer rounded-card-sm" as const;

/**
 * "Tap any photo to enlarge …", centred under the wall (D L507, M L405).
 *
 * **Two gaps, both 03's.** The type is Nunito 600 at 11px `< md` and 13px
 * `≥ md`; `--text-eyebrow` is the only token that is those two values exactly,
 * and this line is not an eyebrow — it takes the size and none of the rest
 * (no `uppercase`, no `--tracking-eyebrow`, no `--section-accent`). Minting a
 * second spelling of a size the token source already carries is what `D-03.1`
 * forbids, which is the same argument `Chip` makes for pointing its
 * HEAD TEACHER badge at `--text-chip-pill`.
 *
 * The colour the references draw is `#8ba0aa`, and 03 §2.3 has no token for it:
 * the gallery's own sub role is `--color-sub-gallery` (`#6f7a80`), a shade
 * darker. The role variable stands and the drawing's exact value is 03's to
 * mint (INV-03.1 forbids naming the hex here).
 */
export const GALLERY_HINT =
  "text-center font-body text-eyebrow font-semibold text-(color:--section-sub)" as const;

/* -------------------------------------------------------------------------- *
 * The lightbox (04 §3.6, `D-04.7`)
 * -------------------------------------------------------------------------- */

/**
 * The modal itself. Neither reference draws it — both print "lightbox on the
 * live site" instead (D L507, M L405) — so `D-04.7`'s "native `<dialog>`" and
 * 03's tokens are the whole specification, and this is the one surface on
 * either of this row's pages with no drawing behind it.
 *
 * A native modal `<dialog>` is centred by the UA and painted over the
 * `::backdrop`, so the geometry here is only the photo's box: the page's own
 * content cap, and a viewport cap so a portrait photograph cannot push the
 * controls off-screen. `dvh` rather than `vh` because a mobile browser's
 * retracting toolbar is exactly the case the cap exists for.
 */
export const LIGHTBOX =
  "m-auto max-h-[85dvh] w-full max-w-255 overflow-y-auto bg-transparent p-4 backdrop:bg-ink/70" as const;

/** The photo above its controls, the design's own 12px apart. */
export const LIGHTBOX_FRAME = "flex flex-col gap-3" as const;

/**
 * The photo's box. It takes its ratio from `site.gallery.photos[].width` /
 * `height` through an inline `aspect-ratio` — a runtime value, so it cannot be
 * a Tailwind class (v4 scans source text for whole class names) and is not a
 * design constant that could be a token.
 */
export const LIGHTBOX_PHOTO_BOX = "w-full" as const;

export const LIGHTBOX_PHOTO = "h-full rounded-card-md!" as const;

/** The control row: close on one side, the arrows on the other. */
export const LIGHTBOX_CONTROLS = "flex items-center justify-between gap-3" as const;

/**
 * One control. The white pill of the back link, at the back link's own shadow
 * token, with the 44px floor on the button itself rather than a pseudo-element:
 * nothing here is drawn smaller than the hit area, so there is no drawing to
 * protect.
 */
export const LIGHTBOX_BUTTON =
  "inline-flex min-h-(--tap-min) min-w-(--tap-min) cursor-pointer items-center justify-center " +
  "rounded-pill bg-white font-body text-chip font-bold text-(color:--section-link) shadow-back";
