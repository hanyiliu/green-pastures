/**
 * The Philosophy section's geometry (04 `D-04.6`, INV-04.5).
 *
 * Every number the two reference files draw for this section lives here rather
 * than in the components: the two leaf placements, the three block stacks, the
 * photo's two boxes and the credential badge's padding. `site.json` carries
 * none of it — geometry is component config, not content.
 *
 * **Everything is written on Tailwind's `--spacing` scale, never as a raw px.**
 * `mt-6.5` is 26px, `md:right-15` is 60px, `max-w-205` is 820px. 03 §4 quotes
 * all of these values (its "component sizes" row, its `--container-content`
 * row and its chip-padding notes) without minting a token for any of them, and
 * `src/styles/tokens.css` says so in as many words: "Values 03 quotes without
 * giving a token name at all (§4 geometry) are comments, not tokens". The
 * spacing scale is the spelling that keeps INV-03.2 (`no raw px`) true, and it
 * is the one `hero/layout.ts` already uses.
 *
 * Line numbers are `docs/design/desktop/Green Pastures - Homepage.dc.html` (D)
 * and `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html` (M).
 *
 * The section's own box is the shared one — `48px 24px` below `md`, `70px 44px`
 * above (D L139, M L78) — so unlike the hero there is no padding override here.
 */

/* -------------------------------------------------------------------------- *
 * The quote block (D L142–146, M L80–84)
 * -------------------------------------------------------------------------- */

/**
 * The centred column that holds the eyebrow and the pull-quote: gap 10px → 12px,
 * capped at the design's 820px (03 §4's `--container-content` row lists "quote
 * 820" among the per-block widths).
 *
 * `relative` is not in either reference. It is here for the same reason the
 * hero's text column carries it: the decoration layer is absolutely positioned
 * against the section box and therefore paints above every static box in it,
 * and on the narrow view the single leaf sits at the block's top-right corner
 * (M L79 — `right:20px; top:26px`, against a content box that starts at 24px).
 * One class keeps the words above the leaf without moving either.
 */
export const PHILOSOPHY_QUOTE_BLOCK =
  "relative mx-auto flex max-w-205 flex-col items-center gap-2.5 text-center md:gap-3" as const;

/**
 * The pull-quote's own stack, inside the `<blockquote>`: the same 10px → 12px
 * rhythm as the block around it, so the quote mark, the quote and the
 * attribution sit on one ladder (D L142's `gap:12px` covers all four children;
 * splitting the blockquote out of the flow does not change the drawing).
 */
export const PHILOSOPHY_PULL_QUOTE = "flex flex-col items-center gap-2.5 md:gap-3" as const;

/**
 * The decorative quote mark — 58px `< md`, 84px `≥ md` (`--text-quote-mark`),
 * Fredoka 600 in `--color-quote-mark-text`, with 8px / 10px of lift (D L144,
 * M L82).
 *
 * **Both `text-*` values are plain named utilities.** They were written in the
 * explicit `text-(length:…)` / `text-(color:…)` form because the colour used to
 * be `--color-quote-mark`: `--color-*` and `--text-*` share one `text-…` stem,
 * so a name in both namespaces emits a single rule and Tailwind resolves it to
 * the colour — `text-quote-mark` set `color` and nothing set `font-size`.
 * 03 INV-03.7 gave the stem to the type token and the colour the `-text` suffix
 * `--color-daychip-text` already carries, so both are reachable by name and the
 * two arbitrary modifiers are gone. The rendering is unchanged: a `--text-*`
 * token with no `--…--line-height` companion emits `font-size` alone, exactly
 * what `text-(length:…)` emitted.
 *
 * The sub-unit leading (0.5 / 0.55) is the references' own, and it is doing
 * real work: it collapses the glyph's box so the quote sits under the mark
 * rather than a line below it. 03 §4 quotes no line-height token for the mark,
 * and a unitless ratio is not one of the units INV-03.2 restricts.
 */
export const PHILOSOPHY_QUOTE_MARK =
  "mt-2 font-display text-quote-mark leading-[0.5] font-semibold text-quote-mark-text md:mt-2.5 md:leading-[0.55]" as const;

/**
 * The quote itself: Fredoka 500 at `--text-quote` (26px/1.35 → 44px/1.32) in
 * ink, balanced on every locale (D L145, M L83).
 *
 * This repeats `SectionTitle`'s `size="quote"` recipe rather than calling it,
 * because that component renders `h1 | h2 | h3` only and 04 §3 requires this
 * text to be the `<p>` of a `<blockquote>` — the section's `h2` is elsewhere
 * (§7). The duplication is reported rather than hidden.
 */
export const PHILOSOPHY_QUOTE =
  "text-balance font-display text-quote font-medium text-ink" as const;

/**
 * The attribution line: Nunito 600 on `--section-sub`, with 4px of lift on the
 * wide view only (D L146, M L84).
 *
 * `--text-blurb` (13px → 15px) is the nearest minted step to the drawing's
 * 12px → 15px: the wide view is exact and the narrow one is 1px over. 03 §3.2
 * mints nothing at 12/15, so this borrows the neighbouring token rather than
 * inventing a size — the same answer `FloatingMealsCard` reached for its sub
 * line — and a `--text-attribution` is requested of 03.
 */
export const PHILOSOPHY_ATTRIBUTION =
  "font-body text-blurb font-semibold text-(color:--section-sub) md:mt-1" as const;

/* -------------------------------------------------------------------------- *
 * The photo (D L148–149, M L86)
 * -------------------------------------------------------------------------- */

/**
 * The photo block: 26px below the quote on the narrow view, 40px above, where
 * it also becomes a centring row for a photo that is no longer full-width
 * (D L148, M L86).
 */
export const PHILOSOPHY_PHOTO_BLOCK = "mt-6.5 md:mt-10 md:flex md:justify-center" as const;

/**
 * The photo itself — full width and 190px tall at `--radius-card-md` (18px),
 * 560×260 at `--radius-card-lg` (22px) above `md` (D L149, M L86). 03 §5 names
 * both steps for this photo by name, so neither radius is a new token.
 *
 * The `md:` classes are plain rather than important: `withOverrides` keys a
 * claim by its variant, so `md:w-140` and the recipe's `w-full` are different
 * claims and the media query is what decides between them.
 */
export const PHILOSOPHY_PHOTO = "h-47.5 md:h-65 md:w-140 md:rounded-card-lg" as const;

/* -------------------------------------------------------------------------- *
 * The badge row (D L151–154, M L87–90)
 * -------------------------------------------------------------------------- */

/**
 * The row that closes the section: a centred column 24px below the photo on the
 * narrow view, a centred row 36px below it on the wide one, gap 10px → 16px
 * (D L151, M L87). The stack-to-row switch is 04 §6's one responsive rule for
 * this section, and it is CSS, not a branch (INV-04.4).
 */
export const PHILOSOPHY_BADGE_ROW =
  "mt-6 flex flex-col items-center gap-2.5 md:mt-9 md:flex-row md:justify-center md:gap-4" as const;

/**
 * The credential badge's padding — `8px 14px` at 11px, `9px 16px` at 13px
 * (D L152, M L88). The type is `Chip`'s own `--text-chip` (11px → 13px), which
 * is already exactly right; only the padding differs from the hero badge the
 * recipe is built around.
 *
 * 03 §4 states in as many words that this padding "has no row here and no
 * token … adding [it] is a separate change to this document", so it is spacing
 * on the scale, and every class is important because each replaces a property
 * `Chip`'s recipe sets (`withOverrides` throws on a bare collision).
 */
export const PHILOSOPHY_BADGE = "px-3.5! py-2! md:px-4! md:py-2.25!" as const;

/** The bilingual line beside the badge: Nunito 700 at `--text-chip` on `--section-sub` (D L153, M L89). */
export const PHILOSOPHY_BILINGUAL =
  "font-body text-chip font-bold text-(color:--section-sub)" as const;

/* -------------------------------------------------------------------------- *
 * The decoration layer (04 §3.4, INV-05.5)
 * -------------------------------------------------------------------------- */

/**
 * The corner both views draw is **two `Leaf` instances**, not one, and that is
 * the section's one genuinely awkward decision — so here is the whole of it.
 *
 * The narrow view draws a 24px leaf at `right:20px; top:26px` that floats
 * (`gpfloat 8s`, M L79). The wide view draws a 34px one at `right:60px;
 * top:50px` that is perfectly still (D L140). 04 §3.4 and 05 §5.4 both record
 * the split: the mobile philosophy leaf is one of the design's four looping
 * decorations and "the seven other section leaves are `loop={false}`".
 *
 * Size and position are ordinary `md:` overrides. **Looping was not.** `Leaf`
 * attaches its keyframes with the `.loop` class, driven by the `loop` prop, and
 * a prop cannot hold a media query. Switching it off at `md` from a utility was
 * tried and measured: Tailwind emits `.md\:[&>svg]\:animate-none>svg`
 * (specificity 0,1,1) into `@layer utilities`, while `ambient.css` was imported
 * by the component and therefore **unlayered**, where `.loop[data-loop="leaf"]`
 * (0,2,0) beat it twice over — on specificity, and on the cascade's rule that
 * unlayered normal declarations outrank every layered one. The desktop leaf
 * kept floating. Only `animate-none!` would have won, and an `!important`
 * animation shorthand fighting a stylesheet from another component is a trap
 * for whoever reads this next.
 *
 * **That half is now fixed at the source** (`gp-dln.304`): `ambient.css` wraps
 * itself in `@layer components`, so the utility above wins on layer order and
 * a breakpoint-conditional loop no longer needs a second element. The corner
 * nonetheless stays two instances, because looping was never the only thing
 * splitting it — the two leaves are 24px and 34px at different offsets, and
 * `Leaf` takes its size as a number prop, so one instance could only serve both
 * by moving the size into a `[&>svg]:size-*` pair and giving up the prop. Two
 * declarations that differ in three ways read better as two, they need no JS
 * branch (INV-04.4), and the count a reader *sees* stays 04 §3.4's ×1 / ×2.
 */

/** The narrow view's leaf: 24px, floating, hidden from `md` (M L79). */
export const PHILOSOPHY_LEAF_1 = "absolute top-6.5 right-5 opacity-70 md:hidden" as const;

/**
 * The wide view's leaf in the same corner: 34px, still, `right:60px; top:50px`
 * (D L140). The size rides on `Leaf`'s own `size` prop rather than a `[&>svg]`
 * class, because this instance is only ever drawn at one size.
 */
export const PHILOSOPHY_LEAF_2 = "absolute top-12.5 right-15 hidden opacity-70 md:block" as const;

/**
 * The third leaf: 24px at `left:80px; bottom:60px; opacity:.7`, resting at
 * `rotate(-30deg)`, wide view only (D L141). The resting rotation sits on the
 * outer layer with the rest of the placement — where it would compose with a
 * loop instead of being overwritten by one (INV-05.5).
 */
export const PHILOSOPHY_LEAF_3 =
  "absolute bottom-15 left-20 hidden -rotate-30 opacity-70 md:block" as const;
