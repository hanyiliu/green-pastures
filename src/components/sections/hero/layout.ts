/**
 * The hero's geometry (04 `D-04.6`, INV-04.5).
 *
 * Every number the two reference files draw for this section lives here rather
 * than in the components: decoration offsets and opacities, the three column
 * widths, and the section's own padding. `site.json` carries none of it —
 * geometry is component config, not content — and no component below reads a
 * position of its own.
 *
 * **Everything is written on Tailwind's `--spacing` scale, never as a raw px.**
 * `top-27.5` is 110px, `md:left-15` is 60px, `max-w-190` is 760px. 03 §4 quotes
 * all of these values (its "hero section padding" row, its `--container-content`
 * row and its "component sizes" row) without minting a token for any of them —
 * `src/styles/tokens.css` says so in as many words: "Values 03 quotes without
 * giving a token name at all (§4 geometry) are comments, not tokens". So the
 * spacing scale is the spelling that keeps INV-03.2 (`no raw px`) true, and it
 * is the same one `SectionHeader` already uses for its `mb-7` / `md:mb-11`.
 *
 * Line numbers are `docs/design/desktop/Green Pastures - Homepage.dc.html` (D)
 * and `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html` (M).
 */

/**
 * The section's own padding — `36px 22px 40px` below `md`, `60px 44px 56px`
 * above (03 §4's "hero section padding" row; D L109, M L50). It is the one
 * section whose box differs from `--section-py` / `--section-px`, which is why
 * `Section` documents "the hero's own padding" as a caller override. Every
 * class is important: each replaces a property the `Section` recipe sets, and
 * `withOverrides` throws on a bare collision.
 */
export const HERO_PADDING = "px-5.5! pt-9! pb-10! md:px-11! md:pt-15! md:pb-14!" as const;

/**
 * The text column: centred, capped at 760px, and `relative` so it paints above
 * the decoration layer (the references give it `position:relative` for exactly
 * that — D L114, M L53). Gap 16px → 22px.
 */
export const HERO_TEXT_COLUMN =
  "relative mx-auto flex max-w-190 flex-col items-center gap-4 text-center md:gap-5.5" as const;

/** The subhead's own cap — 540px, narrower than the column (D L117). */
export const HERO_SUBHEAD = "max-w-135" as const;

/**
 * The CTA row: a full-width stack below `md` (M L57), a centred row above with
 * 16px between the pill and the text link and 4px of lift (D L118).
 */
export const HERO_CTA_ROW =
  "flex w-full flex-col items-center gap-3 md:mt-1 md:w-auto md:flex-row md:gap-4" as const;

/**
 * The trust row: 14px between its three parts below `md` (M L61), 22px and
 * 10px of lift above (D L122).
 */
export const HERO_TRUST_ROW = "flex items-center gap-3.5 md:mt-2.5 md:gap-5.5" as const;

/**
 * The photo block: full width to 1040px, 26px below the column on mobile and
 * 44px above (D L128, M L66). `relative` both stacks it over the decorations
 * and makes it the containing block the meals card hangs from.
 */
export const HERO_PHOTO_BLOCK = "relative mx-auto mt-6.5 w-full max-w-260 md:mt-11" as const;

/**
 * The photo itself — 230px tall at `--radius-hero` 22px, 380px at 26px
 * (D L129, M L67). The radius is important because `PhotoSlot`'s recipe
 * already sets one.
 */
export const HERO_PHOTO = "h-57.5 rounded-hero! md:h-95" as const;

/**
 * The meals card, hanging off the photo's bottom-left corner: `left:12px;
 * bottom:-16px` below `md`, `left:22px; bottom:-22px` above (D L130, M L68).
 */
export const HERO_MEALS_CARD = "absolute -bottom-4 left-3 md:-bottom-5.5 md:left-5.5" as const;

/**
 * The scroll cue, centred under the photo with 36px / 48px of clearance
 * (D L135, M L74). It is in flow, not in the decoration layer: the references
 * put it after the photo block and the reading order agrees.
 */
export const HERO_SCROLL_CUE = "mt-9 text-center md:mt-12" as const;

/* -------------------------------------------------------------------------- *
 * The decoration layer (04 §3.4, INV-05.5)
 * -------------------------------------------------------------------------- */

/**
 * The sun: 72px at `right:16px; top:16px`, 118px at `right:90px; top:34px`,
 * `opacity:.9` on both views (D L110, M L51). `Sun` draws its own two sizes.
 */
export const HERO_SUN = "absolute top-4 right-4 opacity-90 md:top-8.5 md:right-22.5" as const;

/**
 * The first leaf — the only one both views draw. 26px at `left:16px; top:110px;
 * opacity:.8` on mobile (M L52), 40px at `left:60px; top:64px; opacity:.85` on
 * desktop (D L111).
 *
 * **Why the size is a child selector.** `Leaf` puts its drawn size on the
 * `<svg>`'s `width`/`height` presentation attributes and its `className` on the
 * *outer* positioning layer, so a `md:size-10` there resizes the wrapper and
 * leaves the leaf at 26px — the component's own docstring claims otherwise and
 * is wrong on this point (filed). Reaching the inner layer is what actually
 * draws the reference's two sizes, and it is one class rather than a second
 * `Leaf` instance toggled by `hidden md:block`.
 */
export const HERO_LEAF_1 =
  "absolute top-27.5 left-4 opacity-80 md:top-16 md:left-15 md:opacity-85 md:[&>svg]:size-10" as const;

/**
 * The second leaf: 28px at `right:200px; top:150px; opacity:.7`, desktop only
 * (D L112). The mobile reference draws one leaf, so this and the third are a
 * CSS toggle rather than a view branch in code (INV-04.4).
 */
export const HERO_LEAF_2 = "absolute top-37.5 right-50 hidden opacity-70 md:block" as const;

/** The third leaf: 22px at `left:170px; bottom:130px; opacity:.7` (D L113). */
export const HERO_LEAF_3 = "absolute bottom-32.5 left-42.5 hidden opacity-70 md:block" as const;

/**
 * The meals card's icon dot — a fixed 30px / 38px box (03 §9 lists it by name),
 * with the glyph centred inside so a platform's emoji width can never reflow
 * the card around it.
 */
export const HERO_MEALS_DOT =
  "flex size-7.5 shrink-0 items-center justify-center rounded-full bg-chip-bg md:size-9.5" as const;
