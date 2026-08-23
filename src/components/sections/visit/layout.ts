/**
 * The Visit section's geometry (04 `D-04.6`, INV-04.5).
 *
 * Every number the two reference files draw for this section lives here rather
 * than in the components: the section's missing bottom padding, the two
 * decorations, the header stack, the two-column grid, the white form card, the
 * map photo and the dark info panel. `site.json` carries none of it — geometry
 * is component config, not content.
 *
 * **Everything is written on Tailwind's `--spacing` scale, never as a raw px.**
 * `max-w-250` is 1000px, `p-7.5` is 30px, `h-37.5` is 150px. 03 §4 quotes these
 * values without minting a token for any of them, and `src/styles/tokens.css`
 * says so in as many words: "Values 03 quotes without giving a token name at
 * all (§4 geometry) are comments, not tokens". So the spacing scale is the
 * spelling that keeps INV-03.2 (`no raw px`) true.
 *
 * **Why the columns switch at `lg` and everything else at `md`.** 04 §6's
 * breakpoint table gives this section three columns: `< md` is "stacked, inputs
 * 46px, photo 120", `md`–`lg` is "stacked, inputs 44px", and `≥ lg` is the
 * "1.2fr/1fr grid gap 30". That is 03 `D-03.6` — a tablet renders desktop type,
 * padding and radii inside the mobile *structure* — so the one class that turns
 * a stack into two columns is `lg:` and every size, radius and gap below flips
 * at `md` with the tokens.
 *
 * Line numbers are `docs/design/desktop/Green Pastures - Homepage.dc.html` (D)
 * and `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html` (M).
 */

/* -------------------------------------------------------------------------- *
 * The section shell
 * -------------------------------------------------------------------------- */

/**
 * The one thing this section's box does not share with the other seven: it has
 * **no bottom padding** (`padding: 70px 44px 0` — D L307; `48px 24px 0` —
 * M L220). The footer is drawn inside the same forest block and brings its own
 * `pb-8`, so a `--section-py` at the bottom here would open a gap between the
 * panel and the footer rule that neither reference draws.
 *
 * The horizontal and top padding are `Section`'s own `--section-px` /
 * `--section-py`, which already hold 24/44 and 48/70 — so this replaces one
 * property and is written important for exactly that property (04 §3.2).
 */
export const VISIT_PADDING = "pb-0!" as const;

/* -------------------------------------------------------------------------- *
 * The decoration layer (04 §3.4, INV-05.5)
 * -------------------------------------------------------------------------- */

/**
 * The sun both views draw, at `opacity:.5`: `right:16px; top:20px` on mobile
 * (M L221) and `right:60px; top:50px` on desktop (D L308). Its two drawn sizes
 * — 70px and 120px — are `Sun`'s own `size="visit"`, so nothing here names a
 * dimension.
 *
 * It is `loop={false}`: neither reference gives this sun an `animation`
 * (D L308, M L221), and 04 §3.4 counts the animated suns off the drawings
 * rather than off 05 §5.4's prose.
 */
export const VISIT_SUN = "absolute top-5 right-4 opacity-50 md:top-12.5 md:right-15" as const;

/**
 * The single leaf, desktop only: 34px at `left:50px; top:90px`, tilted 20°, at
 * `opacity:.5` (D L309). The mobile reference draws no leaf in this section, so
 * this is a CSS toggle rather than a view branch in code (INV-04.4), and it is
 * `loop={false}` for the same reason the sun is.
 */
export const VISIT_LEAF =
  "absolute top-22.5 left-12.5 hidden rotate-20 opacity-50 md:block" as const;

/* -------------------------------------------------------------------------- *
 * The header stack (D L310–L313, M L222–L225)
 * -------------------------------------------------------------------------- */

/**
 * Title and subtitle, centred, with 10px between them and 26px below on mobile
 * (M L222) and 12px / 40px on desktop (D L310).
 *
 * `relative` is the reference's own (D L310): it paints the stack above the
 * decoration layer, which is the same reason the hero's text column carries it.
 *
 * **It is not a `SectionHeader`.** That recipe's title is `text-ink` and it
 * forwards no `className` to it, so a white heading cannot be reached through
 * it; its first slot is an `Eyebrow`, which this section has none of; and its
 * intro is capped at 560px against the reference's 520px. `ReviewsHeader` is
 * the precedent — 04 §3.5 lists a section's own header component whenever the
 * shared stack does not fit, and this is the second such section.
 */
export const VISIT_HEADER =
  "relative mb-6.5 flex flex-col items-center gap-2.5 text-center md:mb-10 md:gap-3" as const;

/**
 * The `h2`: white, and honouring its `\n` only `≥ md`.
 *
 * `text-white` is important because `SectionTitle`'s recipe paints `text-ink` —
 * one property, one marker (04 §3.2). Forest is the only section background
 * dark enough to need it, which is why this is the section's recipe rather than
 * a role variable.
 *
 * The break is the hero's story exactly: the desktop reference breaks after
 * "little one's" (D L311) and the mobile one runs the line on (M L223), so
 * `whitespace-pre-line` sits behind `md:` and below it the newline collapses to
 * a space (02 §Line breaks).
 *
 * **The size is `--text-section-title`, a step off the drawing.** The token is
 * 28px `< md` — the reference's mobile size exactly (M L223) — and 40px `≥ md`
 * against the reference's 42px (D L311). 03 §3.2 records that 42 inside the
 * token's own row without minting a name for it, and `ReviewsHeader` reached
 * the same conclusion for Reviews' 36px: the section takes the token and 03
 * owes the two of them a sub-token.
 */
export const VISIT_TITLE = "text-white! md:whitespace-pre-line" as const;

/**
 * The subtitle: Nunito 600 on `--section-sub`, capped at the reference's 520px
 * (D L312).
 *
 * **The one size this section is told to carry itself.** `--text-subhead-section`
 * is 13px `< md` / 17px `≥ md`; the desktop value is the drawing's (D L312) and
 * the mobile one is a pixel under it, because this section draws 14 (M L224).
 * `src/styles/tokens.css` says whose job that is in as many words on the
 * token's own row — "Visit draws 14px here … a per-section deviation 04's
 * recipe carries" — so the recipe carries it, and `text-sm` is Tailwind's own
 * 14px step rather than a raw px (INV-03.2) or a token one step off the
 * drawing. That is the hero secondary CTA's answer to the same question.
 *
 * The leading stays the token's on both views: `leading-*` writes
 * `--tw-leading`, which is exactly the variable `md:text-subhead-section` reads
 * for its own line-height, so `:root:lang(zh)`'s 1.75 still lands (03 §3.3).
 *
 * The title above is the *other* answer, and deliberately: 03 records Visit's
 * 42px inside `--text-section-title`'s row without asking 04 for anything, the
 * way it records Reviews' 36px that `ReviewsHeader` also left to the token.
 */
export const VISIT_SUBTITLE =
  "max-w-130 font-body text-sm leading-(--text-subhead-section--line-height) font-semibold text-(color:--section-sub) md:text-subhead-section" as const;

/* -------------------------------------------------------------------------- *
 * The two columns (D L314, M L226–L241)
 * -------------------------------------------------------------------------- */

/**
 * The form and the info column — **one grid on both views, not two structures**
 * (INV-04.4).
 *
 * Below `lg` it is a single column and the 16px the mobile reference puts
 * between the card and the info block (M L241's `margin-top:16px`) is the row
 * gap. At `lg` it becomes the reference's `1.2fr 1fr` with a 30px gap, capped
 * at 1000px (D L314) — narrower than `Section`'s own `--container-content`
 * (1080px), so the cap lives here rather than on the section shell, where it
 * would also squeeze the header.
 *
 * `1.2fr` is a fraction, not a length, so there is no token for it and no
 * INV-03.2 question: it is the reference's own column ratio.
 */
export const VISIT_GRID =
  "mx-auto grid max-w-250 gap-4 lg:grid-cols-[1.2fr_1fr] lg:gap-7.5" as const;

/**
 * The white card the form sits in — **the section's, not the form's** (07
 * `D-07.4`: the success panel replaces the form *inside the same card*, so
 * `InquiryForm` renders only the shell that swaps them and this is what draws
 * the card around both).
 *
 * Radius 18 → 20 and padding 20 → 30 (D L315, M L227). `--radius-card` is 03
 * §5's "form card" and `--radius-card-md` its "mobile form card", so both steps
 * are tokens and neither is a number here.
 */
export const VISIT_FORM_CARD = "rounded-card-md bg-white p-5 md:rounded-card md:p-7.5" as const;

/**
 * The info column: the map photo above the panel, 14px apart on mobile (M L241)
 * and 16px on desktop (D L326). It stretches to the form card's height at `lg`
 * — the reference's `align-items:stretch` (D L314) is the grid's default, and
 * the panel's `flex-1` below is what actually fills the difference.
 */
export const VISIT_INFO_COLUMN = "flex h-full flex-col gap-3.5 md:gap-4" as const;

/* -------------------------------------------------------------------------- *
 * The map photo (D L327, M L242)
 * -------------------------------------------------------------------------- */

/** The anchor around the photo: a block, so the slot keeps its own box. */
export const VISIT_MAP_LINK = "block" as const;

/**
 * The slot itself: 120px tall with a 14px radius on mobile (M L242), 150px and
 * 16px on desktop (D L327).
 *
 * The radius arrives as `PhotoSlot`'s `radius="tile"` — 03 §5's `--radius-tile`
 * is named for "icon tiles, mobile map photo" — and the desktop step is
 * `--radius-card-sm`, whose own comment names the "desktop map photo". The
 * `md:` class claims a different variant bucket from the recipe's unprefixed
 * one, so it needs no important marker and still wins from 768px up.
 */
export const VISIT_MAP = "h-30 md:h-37.5 md:rounded-card-sm" as const;

/* -------------------------------------------------------------------------- *
 * The info panel (D L328–L332, M L243)
 * -------------------------------------------------------------------------- */

/**
 * The dark panel: `--color-forest-panel`, radius 18, padding 20 → 24, 14px →
 * 16px between its three groups, filling whatever height the grid row leaves
 * (D L328, M L243).
 *
 * The mobile reference draws a 16px radius and the desktop one 18px; 03 §5
 * mints a single `--radius-card-md` and names "panel" on its row, so the panel
 * takes the token on both views and the 2px is 03's to resolve.
 */
export const VISIT_PANEL =
  "flex flex-1 flex-col gap-3.5 rounded-card-md bg-forest-panel p-5 md:gap-4 md:p-6" as const;

/**
 * A panel value: Nunito 600 white, `--text-panel-value` (14 → 16px), 3px below
 * its label on mobile and 5px on desktop (D L329, M L243).
 */
export const VISIT_PANEL_VALUE =
  "mt-0.75 font-body text-panel-value font-semibold text-white md:mt-1.25" as const;

/**
 * The time half of the hours line.
 *
 * **One line `< md`, two lines `≥ md`** (04 §6): the desktop reference breaks
 * between the days and the times (D L330's `<br>`) and the mobile one joins
 * them with a middot (M L243), so the times become a block at `md` and the
 * separator disappears with them.
 *
 * `lowercase` is what turns `Intl`'s "7:30 AM" into the design's "7:30 am"
 * (02 §Numbers, dates, times: "via CSS lowercase of the day period"). It is a
 * no-op on the Chinese locales' day periods, so there is no locale branch here
 * (INV-03.6).
 */
export const VISIT_HOURS_TIME = "lowercase md:block" as const;

/** The middot the mobile reference joins the two halves with (M L243). */
export const VISIT_HOURS_SEPARATOR = "md:hidden" as const;

/**
 * The "Open in Maps" link under the address.
 *
 * The design draws no such link — 07 §6 requires it, because the map is a photo
 * and never an embed, and 02 registers `home.visit.info.mapsLink` as
 * "production copy, not in the design". So this is the section's own recipe:
 * `--section-link` for the colour, `--text-blurb` for the size (the same token
 * every other section's closing link takes), and the 44px hit area INV-04.7
 * asks of every target.
 *
 * The rule under the words is `underline` rather than `LearnMoreLink`'s
 * `border-b-2`: 03 §2.3 prints "—" for Visit's link-underline role, so
 * `--section-link-underline` is deliberately unset here (see
 * `components/layout/Section.tsx`) and a border reading it would fall back to
 * `currentColor` — an underline the design explicitly does not have in that
 * weight.
 */
export const VISIT_MAPS_LINK =
  "mt-1.5 inline-flex min-h-(--tap-min) items-center font-body text-blurb font-bold text-(color:--section-link) underline" as const;
