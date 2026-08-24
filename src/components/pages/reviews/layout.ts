/**
 * The reviews page's geometry (04 §3.6 `ReviewsList` / `ReviewCard` /
 * `YelpButton`; D L511–546, M L411–439).
 *
 * Every number the two references draw for the subpage's review wall lives
 * here rather than in the components, on the pattern `D-04.6` sets and the two
 * gallery `layout.ts` files already follow.
 *
 * Three of the values below bind a token 03 minted for **this** surface by
 * name, which is unusual enough to be worth listing: `--shadow-card-warm` is
 * commented "review cards (L523)", `--radius-card-md` is "panel, subpage
 * cards", and `--color-sub-testimonials-count` is "47 reviews · Fremont
 * parents". Where a value has no such token the gap is named in place rather
 * than closed with a raw px (INV-03.2).
 */

/**
 * The content column. The shell caps at `--container-content` (1080px) and gaps
 * 18px/28px; this page draws 940px and 16px/26px (D L517, M L417) — the
 * per-page config `SubpageBar`'s own docstring describes, down to the
 * `max-w-235` spelling (235 × 4px).
 *
 * Each class is important because each replaces a property the shell's recipe
 * sets, and the `md:` half is written out rather than left to the base: an
 * important unprefixed class does not outrank its own `md:` twin.
 */
export const REVIEWS_COLUMN = "max-w-235! gap-4! md:gap-6.5!" as const;

/**
 * The header stack — the rating row, the `h1` and the count line, centred, 8px
 * apart `< md` and 12px `≥ md` (D L518, M L418).
 *
 * It is a box of its own rather than three items of the content column because
 * the design's three lines sit closer together than the column's own 16/26px
 * gap: the stack is one block, and the column separates it from the cards.
 */
export const REVIEWS_HEADER = "flex flex-col items-center gap-2 md:gap-3" as const;

/** Stars · 5.0 · Yelp, in one row 9px/12px apart (D L519, M L419). */
export const RATING_ROW = "inline-flex items-center gap-2.25 md:gap-3" as const;

/**
 * The count-up's own type: Fredoka 600 on `--color-ink` at `--text-countup`.
 *
 * The token is 22px `< md` / 30px `≥ md` and this page draws 22px / 28px
 * (M L419, D L519) — mobile exact, desktop one step large. It is the same token
 * and the same gap the home section's rating carries, so the two "5.0"s stay
 * one value rather than diverging by two pixels in one file.
 */
export const RATING_VALUE = "font-display text-countup font-semibold text-ink" as const;

/**
 * "47 reviews and counting" (D L520, M L420).
 *
 * `--color-sub-testimonials-count` is 03 §2.3's token for this exact line, and
 * it is a per-section colour named directly rather than through a
 * `--section-*` role variable for the reason `ReviewsHeader` already gives:
 * `Section` exposes five roles and this is a sixth, minted by 03 for this
 * consumer. `--text-subhead-section` is 13px/17px against the drawing's
 * 12px/15px — the same one-step gap the home count line carries, and the same
 * token, so the two lines cannot drift apart.
 */
export const COUNT_LINE =
  "font-body text-subhead-section font-semibold text-sub-testimonials-count" as const;

/**
 * The card grid: one column 16px apart `< md` (the narrow reference draws the
 * cards as siblings in the column, M L421–437), two columns 20px apart `≥ md`
 * (D L522).
 */
export const REVIEWS_GRID = "grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5" as const;

/**
 * One card, minus its `display` — see {@link CARD_DISPLAY}.
 *
 * White, `--radius-card-md` (18px, and 03 §5 names "subpage cards" as its
 * consumer; the narrow reference draws 16px, which no step is closer to),
 * 18px/24px of padding, on `--shadow-card-warm` — the token 03 §5 minted for
 * this card at this line (D L523, M L421).
 *
 * The box and the stack inside it are two recipes, as they are for the home
 * bubble: the `<li>` is the animated card and the `<figure>` inside carries the
 * gap, so the list semantics and the quote semantics each sit on the element
 * that means them.
 */
export const CARD = "flex-col rounded-card-md bg-white p-4.5 shadow-card-warm md:p-6" as const;

/** The `<figure>`: stars, quote and attribution, 10px/12px apart (D L523, M L421). */
export const CARD_BODY = "flex h-full flex-col gap-2.5 md:gap-3" as const;

/**
 * The two `display` recipes a card can have. `site.testimonials[]` flags
 * `karenT` `onMobile: false` and the narrow reference draws three cards where
 * the wide one draws four (M L421 vs D L522). The card renders on both views
 * and `md:` decides (02 `D-02.13`, `D-04.5`, INV-04.4).
 *
 * They are two complete alternatives rather than a base plus an override for
 * the reason `MenuDayChips`'s two states are: Tailwind sorts `@layer utilities`
 * by property, so concatenating `flex` and `hidden` lets the stylesheet decide
 * which wins, not the attribute.
 */
export const CARD_DISPLAY = {
  both: "flex",
  desktopOnly: "hidden md:flex",
} as const;

/**
 * The quote: Nunito 600 at 13px/1.6 `< md` and 15px `≥ md` on
 * `--color-sub-testimonials` — 03 §2.3's "quote — the bubble body on white",
 * which is exactly the references' `#5c5045` (D L525, M L423).
 *
 * The size token is `--text-testimonial` (14px/16px), the one 03 §3.2 mints for
 * a review quote; the subpage draws a step below the home bubble and 03 records
 * no sub-token for it. It is read through `--section-sub` rather than by name
 * because `SubpageBar` sets the role variables from the origin section, and on
 * this page that resolves to the testimonials tokens.
 */
export const CARD_QUOTE =
  "font-body text-testimonial font-semibold text-(color:--section-sub)" as const;

/**
 * The reviewer's name — Nunito 700 on `--color-ink` (D L526, M L424). 03 §3.2
 * records the name's size inside the `--text-testimonial` row without minting a
 * name for it, so this takes Tailwind's own steps: `xs` (12px) is the narrow
 * drawing exactly, and `sm` (14px) is one pixel over the wide drawing's 13.
 * Inventing a px is what INV-03.2 refuses; `SpeechBubble` reasons the same way
 * one step up.
 */
export const CARD_AUTHOR = "font-body text-xs font-bold text-ink md:text-sm" as const;

/**
 * The relation line — `--color-sub-testimonials-attribution`, 03 §2.3's token
 * for "reviewer relation line, on white". 11px/12px is again inside the
 * `--text-testimonial` row, so `text-xs` (12px) stands on both views.
 */
export const CARD_RELATION = "font-body text-xs font-semibold text-sub-testimonials-attribution";

/** The Yelp button's row, centred under the cards (D L545, M L438). */
export const YELP_ROW = "flex justify-center" as const;
