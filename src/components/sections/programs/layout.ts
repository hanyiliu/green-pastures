/**
 * The Programs section's geometry (04 `D-04.6`, INV-04.5).
 *
 * Every number the two reference files draw for this section lives here rather
 * than in the components: the path's two shapes, the three stone diameters and
 * their ring paddings, the featured column's raise, and the sun's offset.
 * `site.json` carries none of it — geometry is component config, not content.
 *
 * **Everything is written on Tailwind's `--spacing` scale, never as a raw px**,
 * the spelling `hero/layout.ts` established and the one that keeps INV-03.2
 * true: `size-26` is 104px, `lg:w-59` is 236px, `lg:mb-8.5` is 34px. 03 §4
 * quotes all of these under "component sizes", "grid gaps" and
 * "offsets / rotations" without minting a token for any of them.
 *
 * ── Two breakpoints, and which value belongs to which ────────────────────
 *
 * This is the first section whose per-view switch is **not** a single `md:`,
 * and 03 §8 is what splits it:
 *
 * - **`md:` (768px) — "flips every per-view token in §3–§4 (type scale, section
 *   padding, … component sizes)".** So the stone diameters (104/122/104 →
 *   150/188/150), the ring paddings and the type sizes are `md:`.
 * - **`lg:` (1024px) — "where 04 enables the desktop multi-column layouts
 *   (3-stone row, …)".** So the path's direction, its alignment, the column
 *   widths, the column gaps and the featured raise are `lg:`.
 *
 * Between the two — 03 §8's "tablets get desktop type and padding in
 * single-column structure" — the alternating path renders at desktop stone
 * sizes, which is exactly what that sentence asks for and is why the row's
 * acceptance quotes 150/188/150 at `≥ lg` and 104/122/104 at `< md` and says
 * nothing about the band between.
 *
 * Line numbers are `docs/design/desktop/Green Pastures - Homepage.dc.html` (D)
 * and `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html` (M).
 */

/**
 * The path itself (the `<ul>`): a centred column 22px apart below `lg` (M L99),
 * a bottom-aligned row of three 44px apart and capped at 980px above (D L165).
 *
 * `items-end` is what makes the featured stone's raise a bottom margin rather
 * than a negative offset — the design bottom-aligns the row and lifts the
 * middle column with `margin-bottom` (D L170), and this reproduces that
 * literally.
 */
export const STONE_PATH =
  "mx-auto flex w-full flex-col items-center gap-5.5 lg:max-w-245 lg:flex-row lg:items-end lg:justify-center lg:gap-11" as const;

/**
 * One stone's row/column, minus its size (see {@link STONE}).
 *
 * Below `lg` it is the mobile path's circle-beside-text row, 16px apart and
 * full width (M L100). At `lg` it becomes a centred column, and `lg:flex-col`
 * is what undoes {@link STONE_ITEM_MIRRORED}'s `flex-row-reverse` for the one
 * item that carries it — Tailwind emits `lg:` after the unprefixed utilities,
 * so the later rule wins without either class being important.
 */
export const STONE_ITEM =
  "flex w-full items-center gap-4 lg:flex-col lg:items-center lg:text-center" as const;

/**
 * The mirrored half of the alternating path (M L107): the circle on the right,
 * the words right-aligned against it.
 *
 * **Parity, not `featured`.** `docs/design/mobile/README.md` §3 calls this "an
 * alternating left/right path" and 04 §3.5 glosses the same row as "alternating
 * left/right path (featured right-aligned text)". With the design's three
 * programmes those two readings pick the same stone — Toddler is both the
 * middle one and the featured one — but only parity keeps the path alternating
 * if `site.json` ever carries four programmes or none marked `featured`. So the
 * mirror is `index % 2 === 1` and the size is `featured`; the drawing is
 * unchanged and neither rule is doing the other's job.
 */
export const STONE_ITEM_MIRRORED = "flex-row-reverse text-end" as const;

/**
 * The mirrored row's text block, which the design gives `flex:1` so the words
 * reach the left edge before they right-align (M L107). Neutralised at `lg`,
 * where the block is a column item and stretching it would pull the summary
 * away from the age line.
 */
export const STONE_TEXT_MIRRORED = "flex-1 lg:flex-none" as const;

/**
 * The stone's placement: the design's `flex:none` (M L101), so a long name
 * cannot squeeze the circle. Everything else about the ring — its padding, its
 * white fill and its shadow — is `SteppingStone`'s own recipe.
 */
export const STONE_RING = "shrink-0" as const;

/**
 * The age line's 2px of clearance under the name, which the desktop reference
 * draws (D L167) and the mobile one does not (M L102). `md:` rather than `lg:`
 * because it is a type-stack rhythm value, the same family as
 * `SectionHeader`'s `md:gap-3`.
 */
export const STONE_AGE = "md:mt-0.5" as const;

/**
 * What differs between a plain stone and the raised one, size by size.
 *
 * - **photo** — 104px → 150px and 122px → 188px (03 §4 "component sizes";
 *   D L168, L173, M L101, L107). Both classes are important because
 *   `PhotoSlot`'s recipe already sets `w-full`, and an important base with a
 *   plain `md:` twin would beat its own override.
 * - **item** — the desktop column widths 200px / 236px and their inner gaps
 *   13px / 15px, plus the featured column's 34px raise (D L165, L166, L170).
 * - **summary** — 4px under the age line on the path (M L102) and the column's
 *   own 13px / 15px gap above the blurb on the row (D L166, L170). One margin
 *   serves both because the summary is one node in one DOM: the design reaches
 *   the same two distances with a margin on mobile and a flex gap on desktop.
 */
export const STONE = {
  base: {
    photo: "size-26! md:size-37.5!",
    item: "lg:w-50 lg:gap-3.25",
    summary: "mt-1 lg:mt-3.25",
  },
  featured: {
    photo: "size-30.5! md:size-47!",
    item: "lg:mb-8.5 lg:w-59 lg:gap-3.75",
    summary: "mt-1 lg:mt-3.75",
  },
} as const;

/** The two stone sizes 04 §3.4 gives `SteppingStone`, keyed as they are drawn. */
export type StoneSize = keyof typeof STONE;

/* -------------------------------------------------------------------------- *
 * The decoration layer (04 §3.4, INV-05.5)
 * -------------------------------------------------------------------------- */

/**
 * The sun: 100px at `right:50px; top:40px; opacity:.55`, desktop only (D L160).
 * The mobile reference draws no sun in this section (M L95), so the second view
 * is a CSS toggle rather than a branch in code (INV-04.4), and it is `md:`
 * because `Sun`'s `programs` size is one of 03 §8's component sizes.
 *
 * `loop={false}` at the call site: 04 §3.4 and 05 §5.4 both note that only the
 * hero's sun turns, and D L160 carries no `animation`.
 */
export const PROGRAMS_SUN = "absolute top-10 right-12.5 hidden opacity-55 md:block" as const;

/**
 * The "See all programs →" row, centred 28px under the path and 38px on the
 * wide view (D L183, M L114).
 */
export const PROGRAMS_LINK = "mt-7 text-center md:mt-9.5" as const;
