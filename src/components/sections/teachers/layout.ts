/**
 * The Teachers section's geometry (04 `D-04.6`, INV-04.5).
 *
 * Every number the two reference files draw for this section lives here rather
 * than in the components: the two leaf placements, the triptych, the three
 * column widths, the ring around the head teacher's photograph and the icon
 * dots. `site.json` carries none of it — geometry is component config, not
 * content — and no component below reads a position of its own.
 *
 * **Everything is written on Tailwind's `--spacing` scale, never as a raw px.**
 * `lg:w-75` is 300px, `lg:mt-11` is 44px, `w-37.5` is 150px. 03 §4 quotes these
 * values without minting a token for any of them, and `src/styles/tokens.css`
 * says so in as many words: "Values 03 quotes without giving a token name at
 * all (§4 geometry) are comments, not tokens". So the spacing scale is the
 * spelling that keeps INV-03.2 (`no raw px`) true.
 *
 * **Why the layout switches at `lg` and the type at `md`.** 04 §6's breakpoint
 * table gives this section three columns: `< md` is "`head` first, assistants
 * 2-col, names 22/17", `md`–`lg` is "`head` first, desktop type", and `≥ lg` is
 * "triptych, assistants offset 44px". That is 03 `D-03.6` — a tablet renders
 * desktop type inside the mobile *structure* — so every class here that moves a
 * box is `lg:`, and the type tokens flip on their own at `md` with no help from
 * this file. The one exception is the copy toggles (`introShort`,
 * `summaryShort`), which follow the type: a longer line belongs with the larger
 * size, and `SectionHeader` already spells its own toggle `md:`.
 *
 * Line numbers are `docs/design/desktop/Green Pastures - Homepage.dc.html` (D)
 * and `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html` (M).
 */

/* -------------------------------------------------------------------------- *
 * The triptych
 * -------------------------------------------------------------------------- */

/**
 * The frames row — **one flex container on both views, not two structures**
 * (INV-04.4).
 *
 * The mobile reference draws the head teacher above a nested row holding the
 * two assistants (M L195, M L203). A wrapping flex line reaches the same
 * drawing without the extra element: the head frame is `w-full` so it fills row
 * one on its own, the two assistants are `flex-1` so they share row two, and
 * the two gaps the reference gives — 24px down, 16px across (M L195, M L203) —
 * are `gap-y-6` and `gap-x-4`.
 *
 * At `lg` the row stops wrapping and becomes the desktop triptych: no wrap, one
 * 40px gap, tops aligned, capped at the reference's 1000px (D L284). That cap
 * is narrower than `Section`'s own `--container-content` (1080px), so it lives
 * here rather than on the section shell — the header above it is a `max-w-140`
 * intro and wants the wider box.
 */
export const TEACHERS_ROW =
  "mx-auto flex max-w-250 flex-wrap items-start justify-center gap-x-4 gap-y-6 lg:flex-nowrap lg:gap-10" as const;

/**
 * The head teacher's frame: the full width of its own line below `lg` and the
 * reference's 300px column above (D L288). `order-first` is the whole of the
 * mobile reorder (04 §4's row: "mobile reorder is visual only") — the DOM stays
 * in `site.teachers[]` order, which is the desktop reading order, and the cards
 * hold no interactive content, so nothing about focus or tab order moves with
 * it. `lg:order-none` hands the line back to the DOM at the triptych.
 */
export const TEACHERS_HEAD_FRAME = "order-first w-full lg:order-none lg:w-75" as const;

/**
 * An assistant's frame: half of row two below `lg` (`flex-1` over the row's
 * 16px column gap, M L203), the reference's 230px column above, dropped 44px so
 * the head teacher stands proud of the pair (D L285, D L299).
 */
export const TEACHERS_ASSISTANT_FRAME = "flex-1 lg:mt-11 lg:w-57.5 lg:flex-none" as const;

/**
 * The section's closing link, centred with 26px of clearance on mobile and 38px
 * on desktop (D L303, M L216).
 */
export const TEACHERS_LINK_ROW = "mt-6.5 text-center lg:mt-9.5" as const;

/* -------------------------------------------------------------------------- *
 * The head teacher's card (D L288–L297, M L196–L201)
 * -------------------------------------------------------------------------- */

/** The card's own column: centred, 12px between its parts, 14px at the triptych. */
export const TEACHERS_HEAD_CARD = "flex flex-col items-center gap-3 lg:gap-3.5" as const;

/**
 * The photograph and the badge that hangs off it. `relative` is what the badge
 * is positioned against, and it is on this wrapper rather than on the ring so
 * the badge overlaps the ring's edge exactly as the reference draws it.
 */
export const TEACHERS_HEAD_PHOTO_WRAP = "relative" as const;

/**
 * The white ring around the photograph: 8px of padding on mobile, 9px on
 * desktop (D L291, M L197). `--shadow-ring-lavender` is 03 §6's token for this
 * exact shadow; the mobile reference draws a slightly tighter one that 03 does
 * not name, so both views take the token.
 */
export const TEACHERS_HEAD_RING =
  "rounded-full bg-white p-2 shadow-ring-lavender lg:p-2.25" as const;

/**
 * The photograph itself — 150px across on mobile, 196px at the triptych
 * (D L291, M L197). The width is important because `PhotoSlot`'s recipe is
 * `w-full`; the height comes from its `aspect-square`, which `shape="circle"`
 * already sets, so there is nothing to override there.
 */
export const TEACHERS_HEAD_PHOTO = "w-37.5! lg:w-49!" as const;

/**
 * The HEAD TEACHER badge, centred on the photograph's lower edge: 4px up on
 * mobile, 6px on desktop (D L292, M L199).
 *
 * **One important padding class, not two.** 03 §4 mints `--chip-head-teacher`
 * (4px 11px `< md`, 5px 13px `≥ md`) for this badge. The token is re-declared
 * inside `tokens.css`'s `@media (width >= 48rem)` block, so the single
 * `var()` already carries both views; and `!important` outranks a non-important
 * rule wherever that rule sits, a media query included, because importance is
 * settled before specificity and before source order and a media query
 * contributes to none of the three.
 *
 * This line carried a `md:` twin until `gp-dln.135`, on the reasoning that the
 * recipe's own `md:`-prefixed padding pair would otherwise "stand from 768px
 * up". It would not, and the twin compiled to a second rule setting the
 * identical value. Measured in chromium against the compiled stylesheet, this
 * class without the twin renders `4px 11px` at 390px and `5px 13px` at 1280px
 * — the same two boxes the pair rendered.
 *
 * The override itself goes when `HeadTeacherCard` passes `Chip`'s own
 * `size="head-teacher"`, which now binds this token in the recipe.
 */
export const TEACHERS_HEAD_BADGE =
  "absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap p-(--chip-head-teacher)! lg:bottom-1.5" as const;

/* -------------------------------------------------------------------------- *
 * An assistant's card (D L285–L287, M L204–L207)
 * -------------------------------------------------------------------------- */

/** The card's own column: centred, 9px between its parts, 13px at the triptych. */
export const TEACHERS_ASSISTANT_CARD = "flex flex-col items-center gap-2.25 lg:gap-3.25" as const;

/**
 * The white icon circle behind the assistant's emoji (D L285, M L204). `Emoji`
 * already owns the box — `size="dot"` is 03 §9's 48px / 56px — so this adds
 * only the fill, the shape and 03 §6's `--shadow-dot-lavender`, none of which
 * the recipe claims.
 */
export const TEACHERS_ASSISTANT_DOT = "shrink-0 rounded-full bg-white shadow-dot-lavender" as const;

/* -------------------------------------------------------------------------- *
 * Shared card type (both cards)
 * -------------------------------------------------------------------------- */

/** The name line: Fredoka 600 on ink, 22 → 26px for the head teacher (D L293, M L200). */
export const TEACHERS_NAME_LG = "font-display text-name-lg font-semibold text-ink" as const;

/** The same line for an assistant, 17 → 21px (D L286, M L205). */
export const TEACHERS_NAME = "font-display text-name font-semibold text-ink" as const;

/** The name and the role/credential line under it, 2px apart (D L286, D L293). */
export const TEACHERS_NAME_BLOCK = "text-center" as const;

/** The role or credential line's own 2px of clearance (D L286, D L293). */
export const TEACHERS_ROLE = "mt-0.5" as const;

/**
 * The card blurb: Nunito 600 on `--section-sub`, centred (D L287, M L206).
 *
 * `--text-blurb` is 13px `< md` and 15px `≥ md`, which is the head teacher's
 * two sizes exactly; the references draw the assistants one step down (12/14)
 * and 03 §3.2 records that on the token's own row without minting a second
 * name, the same way `--text-eyebrow-sm` records the assistants' 11px role
 * line. Both cards therefore take the token, and the 1px is a deviation of the
 * same kind 03 §3.3 already made deliberately on this token's line height
 * (1.6 for every card, against the references' 1.5 / 1.55 / 1.6).
 */
export const TEACHERS_BLURB =
  "font-body text-blurb font-semibold text-(color:--section-sub)" as const;

/* -------------------------------------------------------------------------- *
 * The decoration layer (04 §3.4, INV-05.5)
 * -------------------------------------------------------------------------- */

/**
 * The leaf both views draw — 22px, tilted 30°, at `opacity:.6`. Mobile puts it
 * in the top-right corner (`right:20px; top:26px`, M L189) and desktop in the
 * bottom-right (`right:90px; bottom:70px`, D L277), so the `lg:` half releases
 * `top` before claiming `bottom`.
 *
 * Both leaves here are `loop={false}`: 04 §3.4 counts the animated leaves off
 * the references and neither of this section's two moves (D L276–L277,
 * M L189 draw no `gpfloat`).
 */
export const TEACHERS_LEAF_1 =
  "absolute top-6.5 right-5 rotate-30 opacity-60 lg:top-auto lg:right-22.5 lg:bottom-17.5" as const;

/**
 * The second leaf: 30px, tilted −24°, at `left:70px; top:56px`, desktop only
 * (D L276). The mobile reference draws one leaf, so this is a CSS toggle rather
 * than a view branch in code (INV-04.4).
 */
export const TEACHERS_LEAF_2 =
  "absolute top-14 left-17.5 hidden -rotate-24 opacity-60 lg:block" as const;
