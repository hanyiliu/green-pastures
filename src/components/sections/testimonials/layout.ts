/**
 * The testimonials section's geometry (04 `D-04.6`, INV-04.5).
 *
 * Every number the two reference files draw for this section lives here rather
 * than in the components below: the header stack's gaps, the grid, the bubble
 * box, the attribution row and the link row. `site.json` carries none of it —
 * geometry is component config, not content.
 *
 * **Everything is written on Tailwind's `--spacing` scale, never as a raw px**
 * (INV-03.2), the same convention `sections/hero/layout.ts` established:
 * `mb-6.5` is 26px, `gap-2.25` is 9px, `lg:mt-7.5` is 30px. 03 §4 quotes these
 * values without minting a token for any of them, and `src/styles/tokens.css`
 * says so in as many words — "Values 03 quotes without giving a token name at
 * all (§4 geometry) are comments, not tokens".
 *
 * **The composition switch is `lg:`, not `md:`.** 04 §6 puts the three-column
 * grid at `≥ lg` and leaves 768–1023 in the mobile structure with desktop type
 * (03 `D-03.6`, OQ-03.1), so the grid, the middle column's push and Karen T.'s
 * surface flag all key off `lg:` while every *type* and *padding* flip keys off
 * `md:`. The two references disagree about nothing here; they simply draw the
 * two ends of that range.
 *
 * Line numbers are `docs/design/desktop/Green Pastures - Homepage.dc.html` (D)
 * and `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html` (M).
 *
 * The section's own box is the shared one — `70px 44px` desktop, `48px 24px`
 * mobile (D L235, M L162) is exactly `--section-py` / `--section-px`, so unlike
 * the hero this section passes `Section` no padding override at all.
 */

/**
 * The header stack: centred column, 10px between its three lines with 26px
 * below it, 14px and 42px above `md` (D L236, M L163).
 */
export const TESTIMONIALS_HEADER =
  "mb-6.5 flex flex-col items-center gap-2.5 text-center md:mb-10.5 md:gap-3.5" as const;

/**
 * The rating row — stars, the count-up and the Yelp badge, 9px apart on mobile
 * and 12px on desktop (D L237, M L164). It is used twice: once for the row
 * itself and once for the `role="img"` group inside it, whose two children sit
 * at the same interval.
 */
export const TESTIMONIALS_RATING_ROW = "inline-flex items-center gap-2.25 md:gap-3" as const;

/**
 * The bubbles: a 16px stack below `lg` (M L172), a three-column grid with a
 * 24px gutter above (D L244). `items-start` is the reference's own — the cards
 * size to their content rather than stretching to the tallest.
 *
 * The 1080px cap the desktop reference writes on this grid is already the
 * `Section` content container's `--container-content`, so it is not repeated.
 */
export const TESTIMONIALS_GRID =
  "flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6" as const;

/** The centre column, dropped 30px so the three cards sit off a straight line (D L253). */
export const TESTIMONIALS_MIDDLE_PUSH = "lg:mt-7.5" as const;

/**
 * The bubble box: white, 20px of padding at `--shadow-card-warm-lg`, 26px above
 * `md` (D L245, M L173). The shadow is the desktop value on both views, which
 * is 03 `D-03.7`'s one-set rule rather than a rounding — the mobile reference's
 * `0 12px 26px` has no token and `--shadow-card-warm-lg` is minted for exactly
 * "homepage bubbles (L246)".
 *
 * The `display` and the tail radius are not here: `Bubble` owns both, because
 * one is the surface flag and the other is the tail.
 */
export const BUBBLE_CARD = "flex-col bg-white p-5 shadow-card-warm-lg md:p-6.5" as const;

/**
 * The `<figure>` inside the box: the stars, the quote and the attribution row,
 * 11px apart on mobile and 14px on desktop (D L245, M L173). `h-full` is what
 * lets the attribution's `mt-auto` mean anything if a future layout ever
 * stretches the cards.
 */
export const BUBBLE_BODY = "flex h-full flex-col gap-2.75 md:gap-3.5" as const;

/**
 * The attribution row: avatar, then name over relation, 10px apart on mobile
 * and 12px on desktop (D L248, M L176). `mt-auto` is the desktop reference's
 * own (D L248); it is inert while the grid is `items-start` and becomes the
 * design's intent the moment anything stretches a card.
 */
export const BUBBLE_ATTRIBUTION = "mt-auto flex items-center gap-2.5 md:gap-3" as const;

/**
 * The avatar: a 38px circle, 44px above `md` (D L249, M L176).
 *
 * **Both sizes are important, and that is not belt and braces.** The base class
 * has to be, because `PhotoSlot`'s recipe already sets `w-full` and
 * `withOverrides` refuses a bare collision. `!important` then outranks every
 * non-important rule *including the media query*, so a plain `md:size-11` never
 * applied and the desktop avatar drew at 38px. Marking the twin restores the
 * flip: two `!important` declarations of the same specificity are decided by
 * source order, and Tailwind emits the `md:` variant after the base utility.
 * `sections/hero/layout.ts` writes `px-5.5! md:px-11!` for the same reason.
 */
export const BUBBLE_AVATAR = "size-9.5! shrink-0 md:size-11!" as const;

/** The link row, centred 24px under the bubbles and 36px above `md` (D L271, M L184). */
export const TESTIMONIALS_LINK_ROW = "mt-6 text-center md:mt-9" as const;
