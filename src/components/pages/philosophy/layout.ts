/**
 * The Philosophy page's geometry (04 `D-04.6`, §3.6).
 *
 * Every number the two references draw for this page lives here rather than in
 * the composites, exactly as `components/sections/*\/layout.ts` does for the
 * home sections. `content/site.json` carries none of it — geometry is component
 * config, not content — and no component below reads a position of its own.
 *
 * **Everything is on Tailwind's `--spacing` scale, never a raw px.** `p-4.5` is
 * 18px, `gap-2.75` is 11px, `max-w-235` is 940px. 03 §4 quotes these values
 * without minting a token for any of them, and `src/styles/tokens.css` says so
 * in as many words: "Values 03 quotes without giving a token name at all (§4
 * geometry) are comments, not tokens". The spacing scale is the spelling that
 * keeps INV-03.2 (no raw px) true.
 *
 * Line numbers are `docs/design/desktop/Green Pastures - Homepage.dc.html` (D)
 * and `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html` (M).
 *
 * ── Three colours the design draws and 03 does not name ──────────────────
 *
 * The three principle tiles are tinted `#eef2e8`, `#fff0d9` and `#f7e7df`
 * (D L360, L364, L368), and the timeline's time pill is `#e9f0e3` (D L377).
 * Of the four, only the first has a token — `--color-chip-bg` is `#eef2e8`
 * exactly — and `site.json.principles[]` is `{id, icon}` with no tint field, so
 * there is nowhere for a per-principle colour to come from that is not a
 * literal (INV-03.1). All four boxes therefore take `--color-chip-bg`. Closing
 * the gap is a change to 03 §2 first (a `--color-tile-*` family), then to 02's
 * `Principle` schema; this row's report files it.
 */

/* -------------------------------------------------------------------------- *
 * The page column
 * -------------------------------------------------------------------------- */

/**
 * The content column's cap: 940px, narrower than the shell's shared 1080px
 * (D L353). `SubpageBar` sets `max-w-content`, so the override is important —
 * per `withOverrides`' contract, one property at a time.
 *
 * The column's padding and its 18/28px gaps are the shell's own and match this
 * page's reference exactly (M L261, D L353), so nothing else is overridden.
 */
export const PHILOSOPHY_COLUMN = "max-w-235!" as const;

/**
 * The subpage header's own bottom margin, released to the column's gap.
 *
 * `SectionHeader` closes with `mb-7 md:mb-11` because a home section's header
 * sits in a box with no gap of its own. The subpage column *is* a flex column
 * with an 18/28px gap (`SubpageBar`'s `CONTENT`), so the margin would stack on
 * top of it and open 46px / 72px where the references draw 18px and 28px.
 *
 * **Both halves are important, and the pair is deliberate.** `mb-0!` alone
 * leaves `md:mb-11` to be settled by importance, and the two readings of that
 * cascade disagree across this codebase's own notes; making the `md:` twin
 * important too removes the question — at `≥ md` both rules are important and
 * the `md:` one is later in the stylesheet, so it wins under every reading.
 */
export const PHILOSOPHY_HEADER = "mb-0! md:mb-0!" as const;

/* -------------------------------------------------------------------------- *
 * The principles (D L359–L372, M L267–L281)
 * -------------------------------------------------------------------------- */

/**
 * The three cards: one per line below `md` at the column's own 18px rhythm
 * (M L267, L272, L277 are three siblings of the 18px column), a 3-column grid
 * at 20px above it (D L359).
 */
export const PRINCIPLES_GRID = "grid grid-cols-1 gap-4.5 md:grid-cols-3 md:gap-5" as const;

/**
 * One principle card: white, `--radius-card-md`, 18px of padding and a 9px
 * column below `md`; 24px and 11px above it (D L360, M L268).
 *
 * `--shadow-card-sage` is 03 §6's token for this exact shadow and its row names
 * this card. The mobile reference draws a slightly tighter one (`0 8px 20px`)
 * that 03 does not name, so both views take the token.
 *
 * The radius is the same story: `--radius-card-md` is 18px, which is the
 * desktop drawing; mobile draws 16px and 03 §5 mints no step for it.
 */
export const PRINCIPLE_CARD =
  "flex flex-col gap-2.25 rounded-card-md bg-white p-4.5 shadow-card-sage md:gap-2.75 md:p-6" as const;

/**
 * The emoji tile behind a principle's icon: 40px below `md`, 48px above
 * (M L268, D L360), on `--radius-tile` (14px).
 *
 * **Why the box is overridden at all.** `Emoji size="tile"` is 48px on *both*
 * views, because 03 §9 fixes "48px tiles" as one number. The references draw
 * 40px `< md`, and 04 §3.6's row for this component says the same thing —
 * "tile 48 → 40px". Two of the three sources agree with the drawing, so the
 * drawing wins here and 03 §9's single value is reported rather than followed.
 *
 * Both halves of each pair are important for the reason
 * {@link PHILOSOPHY_HEADER} gives: the `md:` twin has to outrank an important
 * base class without depending on how that cascade is read.
 */
export const PRINCIPLE_TILE =
  "size-10! rounded-tile bg-chip-bg text-lg! md:size-12! md:text-2xl!" as const;

/** The card's title: Fredoka 600 on ink, 17 → 20px (D L361, M L269). */
export const PRINCIPLE_TITLE = "font-display text-name font-semibold text-ink" as const;

/**
 * The card's body: Nunito 600 on `--color-body`, 13 → 14px at 1.6 (D L362,
 * M L270).
 *
 * `--text-blurb` is 13/15px at 1.6 — mobile exact, desktop one step large, the
 * same 1px 03 §3.2 already records on this token's own row for the assistants'
 * cards. The colour is `#6b7060`, which is `--color-body` to the digit; it is
 * not a section-scoped role, so `D-04.3`'s role variables have nothing to say
 * about it (`--section-sub` on this page is `--color-sub-philosophy`, `#7e8a72`
 * — the home section's attribution grey, not this one).
 */
export const PRINCIPLE_BODY = "font-body text-blurb font-semibold text-body" as const;

/* -------------------------------------------------------------------------- *
 * The daily rhythm (D L374–L380, M L282–L288)
 * -------------------------------------------------------------------------- */

/**
 * The card the timeline sits in: white, `--radius-card-md`, 20px of padding
 * below `md` and 28px above (D L374, M L282). Same shadow token as a principle
 * card, and 03 §6's row covers both.
 */
export const DAY_CARD = "rounded-card-md bg-white p-5 shadow-card-sage md:p-7" as const;

/**
 * The card's heading: Fredoka 600 on ink with 13px of clearance below it, 18px
 * above `md` (D L375, M L283).
 *
 * `--text-program-title` is 20/23px against the drawing's 19/24 — the closest
 * token 03 §3.2 has, and 03 mints nothing for a subpage card heading. The
 * margin is here rather than on the list because the reference puts it there.
 */
export const DAY_TITLE =
  "mb-3.25 font-display text-program-title font-semibold text-ink md:mb-4.5" as const;

/** The rows: 11px apart below `md`, 14px above (D L376, M L284). */
export const DAY_LIST = "flex flex-col gap-2.75 md:gap-3.5" as const;

/**
 * One row: the time pill and the sentence, baseline-aligned, 11px apart below
 * `md` and 16px above (D L377, M L285).
 */
export const DAY_ROW = "flex items-baseline gap-2.75 md:gap-4" as const;

/**
 * The time pill: Fredoka 600 on `--section-link`, `4px 10px` below `md` and
 * `5px 13px` above (D L377, M L285). `flex-none` is what keeps a long time from
 * squeezing the pill, which is the reference's own `flex:none`.
 *
 * `--text-chip-day` (13/14px, the design's one Fredoka 600 chip size) against
 * the drawing's 12/14: exact on desktop, one step large on mobile. The fill is
 * `--color-chip-bg` — see this file's header for why.
 */
export const DAY_TIME =
  "flex-none rounded-pill bg-chip-bg px-2.5 py-1 font-display text-chip-day font-semibold text-(color:--section-link) md:px-3.25 md:py-1.25" as const;

/**
 * The sentence beside the pill: Nunito 600 at 13 → 15px on 1.5 (D L377,
 * M L285). `--text-sample-line` is those two sizes exactly; its line height is
 * 03 §3.3's 1.6 rather than the drawing's 1.5, a deviation 03 took deliberately
 * and records on the token's own row.
 *
 * The colour is the drawing's `#5c6152`, for which 03 names nothing; of the two
 * body greys it has, `--color-body` (`#6b7060`) is the near one and
 * `--color-sub-philosophy` (`#7e8a72`) is not. Reported with the tile tints.
 */
export const DAY_TEXT = "font-body text-sample-line font-semibold text-body" as const;

/** The bolded step name inside the sentence: ink, on the reference's own `<b>`. */
export const DAY_TERM = "text-ink" as const;

/* -------------------------------------------------------------------------- *
 * The credential badges (D L381–L385; drawn on the wide view only)
 * -------------------------------------------------------------------------- */

/**
 * The badge row: centred, wrapping, 12px apart — and **absent below `md`**
 * (D L381; the mobile reference closes the page with the timeline card,
 * M L288).
 *
 * 04 §3.6's row hides `ams` and `bilingualDaily` `< md` and leaves `certified`
 * standing, which would draw one badge on a view the reference draws none on.
 * The drawing wins (this row's acceptance is "matches `docs/design/`") and the
 * whole row is a CSS toggle rather than a branch in code (INV-04.4).
 */
export const PHILOSOPHY_BADGES =
  "hidden flex-wrap items-center justify-center gap-3 md:flex" as const;
