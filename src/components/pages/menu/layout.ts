import type { CSSProperties } from "react";

/**
 * The Menu page's geometry (04 `D-04.6`, INV-04.5).
 *
 * Every number the two reference files draw for this page lives here rather
 * than in `WeeklyMenuTable` / `DayCards`: the content column, the table card
 * and its grid, the meal row labels and cells, the per-day cards, and the note.
 *
 * **Values on Tailwind's `--spacing` scale wherever a scale step exists** —
 * `gap-1.75` is 7px, `p-4` is 16px — and a 03 token wherever 03 mints one.
 *
 * ── The one place this file writes pixels, and why ──────────────────────
 *
 * 03 §3.2's type scale has **no row** for anything on this page's two
 * structures: not the table's column headers, not its meal labels, not its
 * cells, not the day cards' headings, not the note. Neither has 03 §5 for the
 * cells' 11px radius or the table's 120px label column. Binding them to tokens
 * minted for other roles — `--text-chip-day` for a column header,
 * `--radius-input` for a cell — would make a later change to one silently move
 * the other, which is the argument `BackLink` makes about `--text-scroll-cue`
 * and the reason the subpage bar writes its own 12/13px pair.
 *
 * So the three `*_VARS` blocks below do what the shell already does on this
 * surface: the design's own values, once, as component config, declared on the
 * element that consumes them. Nothing here is a raw px in markup (INV-03.2) and
 * nothing is a raw colour (INV-03.1) — every colour below is a 03 token or a
 * `color-mix` of one. See this row's report for the request back to 03.
 *
 * Line numbers are `docs/design/desktop/Green Pastures - Homepage.dc.html` (D)
 * and `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html` (M).
 */

/** `style` that also carries CSS custom properties (React writes them through). */
type StyleWithCustomProperties = CSSProperties & Partial<Record<`--${string}`, string>>;

/* -------------------------------------------------------------------------- *
 * Component config (see the note above)
 * -------------------------------------------------------------------------- */

/**
 * The table's own sizes, declared on the `<table>` and inherited by its cells.
 *
 * Every one of them carries a **single** value rather than a `< md` / `≥ md`
 * pair, because the table exists on one view only (`D-04.11`) and is never
 * drawn at another size.
 *
 * They ride the element rather than the page's content column because
 * `SubpageBar` — the shell's file, not this row's — exposes a
 * `contentClassName` but no `contentStyle`, and a wrapper `<div>` added only to
 * hold them would become a flex child of that column and swallow one of its
 * gaps. Attaching each block's config to the block is the smaller change and
 * keeps the declaration next to its only consumer.
 */
export const MENU_TABLE_VARS: StyleWithCustomProperties = {
  /** The meal-label column; the five day columns share the rest (D L444). */
  "--menu-label-col": "120px",
  /** The cells' and row labels' corner (D L451, L452). */
  "--menu-cell-radius": "11px",
  /** Column headers — Fredoka 600 (D L445). */
  "--menu-th-day": "15px",
  /** Meal row labels — Nunito 700 (D L451). */
  "--menu-th-meal": "13px",
  /** Cells — Nunito 600 (D L452). */
  "--menu-cell": "13px",
  "--menu-cell-lh": "1.4",
};

/** One day card's sizes, declared on its `<section>`. Narrow view only. */
export const DAY_CARD_VARS: StyleWithCustomProperties = {
  /** The day's heading — Fredoka 600 (M L332). */
  "--menu-daycard-title": "17px",
  /** The meal pill — Nunito 700 (M L334). */
  "--menu-daycard-meal": "10px",
  /** The dish — Nunito 600 (M L334). */
  "--menu-daycard-dish": "13px",
};

/**
 * The note's pair — the one value on this page drawn on both views, so the two
 * sizes are two properties rather than one (a `md:` toggle cannot read an
 * inline style; `D-04.5`, and `SubpageBar` writes its kicker's pair the same
 * way).
 */
export const MENU_NOTE_VARS: StyleWithCustomProperties = {
  "--menu-note": "11px", // M L378
  "--menu-note-md": "13px", // D L476
};

/* -------------------------------------------------------------------------- *
 * The content column (D L437, M L328)
 * -------------------------------------------------------------------------- */

/**
 * What this page changes about `SubpageBar`'s content column.
 *
 * The width is the shell's already — the reference draws this page at the full
 * 1080px (D L437), which is `--container-content`, so `max-w-content` stands
 * and only the block rhythm moves: 16px / 24px against the shell's Philosophy
 * values of 18px / 28px. Important in both views for the reason
 * `programs/layout.ts` gives — an important base class does not outrank its own
 * `md:` twin.
 */
export const MENU_COLUMN = "gap-4! md:gap-6!" as const;

/**
 * What the page changes about `SubpageHeader`.
 *
 * Two overrides, both of which the shell leaves to the page.
 *
 * **`mb-0!`** — `SectionHeader`'s 28px/44px of clearance is additive on a
 * gapped column; see `programs/layout.ts`, which carries the full note.
 *
 * **The intro is `≥ md` only.** 04 §4's Menu-page row marks `menu.intro`
 * desktop-only and the mobile reference draws the header with two lines rather
 * than three (M L329–331). `SectionHeader` expresses exactly that with its
 * `introDesktopOnly` prop — but `SubpageHeader`, which is the shell's file and
 * not this row's, does not forward it, and `menu` has no `introShort` for the
 * other shape to catch. So the toggle is applied from outside, on the header's
 * last paragraph: with one intro that is the intro, and if a locale ever gains
 * `menu.introShort` the *short* one is the earlier `<p>` and keeps its own
 * `md:hidden`, so the selector stays correct in both worlds. Forwarding
 * `introDesktopOnly` from `SubpageHeader` is the better fix and belongs to the
 * shell; see this row's report.
 */
export const MENU_HEADER =
  "mb-0! md:mb-0! [&>p:last-of-type]:hidden md:[&>p:last-of-type]:block" as const;

/* -------------------------------------------------------------------------- *
 * The weekly table — `>= md` only (D-04.11; D L443–472)
 * -------------------------------------------------------------------------- */

/**
 * The white card the table sits in, and the half of `D-04.11` that hides it.
 *
 * `hidden md:block` is `display: none` below `md`, which takes the whole table
 * out of the accessibility tree rather than merely off-screen — `D-04.11`'s own
 * requirement, and what keeps the page's fifteen dishes from being announced
 * twice.
 *
 * The radius is `--radius-card` (20px), which is the reference's value exactly
 * (D L443) and is safe to bind here where `rounded-card-md` was the right
 * answer for the room cards: this box is drawn on one view only, so the token's
 * single value has nothing to disagree with.
 *
 * **The padding is 3px, and that is not a typo.** The reference pads the card
 * 10px and sets a 7px grid gap (D L443, L444). A `border-separate` table lays
 * its `border-spacing` between the cells *and* between the cells and the
 * table's edge, so the 7px is already there; 3px of card padding puts the first
 * cell exactly 10px from the corner and no number is invented.
 */
export const MENU_TABLE_CARD =
  "hidden rounded-card bg-white p-0.75 shadow-card-warm-lg md:block" as const;

/**
 * The table itself.
 *
 * `border-separate` with a 7px `border-spacing` is the reference's `gap:7px`
 * (D L444) expressed without giving up table semantics — a `display: grid` on a
 * `<table>` would drop the row and column relationships `<th scope>` exists to
 * declare. `table-fixed` plus a 120px first column makes the remaining five
 * share the width equally, which is `repeat(5, 1fr)`.
 */
export const MENU_TABLE = "w-full table-fixed border-separate border-spacing-1.75" as const;

/** The meal-label column's width — the `120px` of {@link MENU_TABLE_VARS}. */
export const MENU_TABLE_LABEL_COL = "w-(--menu-label-col)" as const;

/** A day's column header — centred Fredoka 600 in ink, 10px of air (D L445). */
export const MENU_TH_DAY =
  "py-2.5 text-center font-display text-(length:--menu-th-day) font-semibold text-ink" as const;

/**
 * A meal's row header — a centred pill in the meal's own colours (D L451, L457,
 * L463).
 *
 * The fill comes from {@link MEAL_LABEL}; only the box is here.
 */
export const MENU_TH_MEAL =
  "rounded-(--menu-cell-radius) text-center font-body text-(length:--menu-th-meal) font-bold" as const;

/** One dish cell — 12px of padding on the meal's pale ground (D L452). */
export const MENU_CELL =
  "rounded-(--menu-cell-radius) p-3 align-top font-body text-(length:--menu-cell) leading-(--menu-cell-lh) font-semibold text-body" as const;

/* -------------------------------------------------------------------------- *
 * The day cards — `< md` only (D-04.11; M L332–377)
 * -------------------------------------------------------------------------- */

/** The stack of five cards, and the half of `D-04.11` that hides it at `md`. */
export const DAY_CARD_LIST = "flex flex-col gap-4 md:hidden" as const;

/** One day's card — white, 16px of padding, its two blocks 10px apart (M L332). */
export const DAY_CARD =
  "flex flex-col gap-2.5 rounded-card-md bg-white p-4 shadow-card-warm" as const;

/** The day's name — Fredoka 600 in ink (M L332). */
export const DAY_CARD_TITLE =
  "font-display text-(length:--menu-daycard-title) font-semibold text-ink" as const;

/** The three meal rows, 7px apart (M L333). */
export const DAY_CARD_MEALS = "flex flex-col gap-1.75" as const;

/** One meal row: the pill and the dish on a shared baseline, 9px apart (M L334). */
export const DAY_CARD_ROW = "flex items-baseline gap-2.25" as const;

/**
 * The meal pill — Nunito 700 in the meal's colours, 3px × 9px (M L334).
 *
 * `shrink-0` is the reference's `flex:none`, so a long dish cannot squeeze the
 * label. The fill comes from {@link MEAL_LABEL}.
 */
export const DAY_CARD_MEAL =
  "shrink-0 rounded-pill px-2.25 py-0.75 font-body text-(length:--menu-daycard-meal) font-bold" as const;

/** The dish — Nunito 600 body copy (M L334). */
export const DAY_CARD_DISH =
  "font-body text-(length:--menu-daycard-dish) font-semibold text-body" as const;

/* -------------------------------------------------------------------------- *
 * Meal colours (D L451–465, M L334)
 * -------------------------------------------------------------------------- */

/**
 * The two grounds a meal is drawn on: the strong pill behind its label, and the
 * pale tint behind its dishes (D L451–465; M L334).
 *
 * ── One formula, not seven literals ─────────────────────────────────────
 *
 * 03 §2.4 mints a colour *per meal* — `--color-dot-label-breakfast` and its two
 * siblings, which the reference uses for the plate's captions and, at full
 * strength, for this page's row labels and meal pills. What it does not mint is
 * either ground: the reference's `#fff0d9` / `#eef2e8` / `#f7e7df` pills and
 * `#fdf8ec` / `#f4f7ef` / `#fdf6f2` cells are six unnamed values.
 *
 * They are, though, one thing: the meal's own colour laid thinly over white.
 * Mixing 15 % of it reproduces all three pills to within about four parts in
 * 255, and 5 % reproduces all three cells to within about eight. So both maps
 * below are the same expression with one parameter changed, keyed to the token
 * the meal already has — no literal colour is written (INV-03.1) and a change
 * to a meal's token moves its whole column together.
 *
 * `color-mix` inside a Tailwind arbitrary value is the shape `PhotoSlot` uses
 * and documents as "the only place the gates leave for it": Stylelint's ban
 * covers stylesheets and ESLint's covers `style={}`, and this is neither.
 *
 * ── Why the rows are written out rather than built from the id ──────────
 *
 * Tailwind v4 finds classes by scanning source *text*, so a class assembled at
 * runtime from a template literal is never emitted and the cell would render
 * unstyled. The three rows therefore have to be literal strings. That is the
 * same constraint — and the same shape — `sections/menu/layout.ts` works under
 * for `PLATE_DOT`, whose justification carries here unchanged: 03 mints a
 * colour per meal, so the fill genuinely is a property of *which meal* it is
 * rather than of where the cell sits. {@link mealClass} is what makes a meal
 * with no row a loud failure instead of a white box.
 */
export const MEAL_LABEL: Readonly<Record<string, string>> = {
  breakfast:
    "bg-[color:color-mix(in_oklab,var(--color-dot-label-breakfast)_15%,var(--color-white))] text-(color:--color-dot-label-breakfast)",
  lunch:
    "bg-[color:color-mix(in_oklab,var(--color-dot-label-lunch)_15%,var(--color-white))] text-(color:--color-dot-label-lunch)",
  snack:
    "bg-[color:color-mix(in_oklab,var(--color-dot-label-snack)_15%,var(--color-white))] text-(color:--color-dot-label-snack)",
};

/** The meal's pale ground — one dish cell in the table (D L452, L458, L464). */
export const MEAL_CELL: Readonly<Record<string, string>> = {
  breakfast:
    "bg-[color:color-mix(in_oklab,var(--color-dot-label-breakfast)_5%,var(--color-white))]",
  lunch: "bg-[color:color-mix(in_oklab,var(--color-dot-label-lunch)_5%,var(--color-white))]",
  snack: "bg-[color:color-mix(in_oklab,var(--color-dot-label-snack)_5%,var(--color-white))]",
};

/**
 * One meal's ground, by id, with the failure made loud.
 *
 * A meal `content/site.json` declares and this file has no row for would
 * otherwise render an unstyled white cell that reads as a rendering glitch
 * rather than as a missing token — the same trade `src/content/collections.ts`
 * makes when a joined id has no text.
 */
export function mealClass(map: Readonly<Record<string, string>>, meal: string): string {
  const classes = map[meal];

  if (classes === undefined) {
    throw new Error(
      `The Menu page has no colours for the meal "${meal}". 03 §2.4 mints ` +
        `--color-dot-label-<meal> per meal; add the row to ` +
        `src/components/pages/menu/layout.ts beside the token.`,
    );
  }

  return classes;
}

/* -------------------------------------------------------------------------- *
 * The bottom of the page (D L473–476, M L372–378)
 * -------------------------------------------------------------------------- */

/**
 * The dietary chips row.
 *
 * The chips themselves are the home section's `DietaryChips`, reused unchanged
 * (04 §3.6: "`DietaryChips` (reuse) + note"). That component takes an already
 * filtered list, which is what lets this page pass all three where the home
 * section passes the two with `onHome` — no `surface` prop and no branch inside
 * it. This class only centres the row the way the reference does (D L473,
 * M L372); the row's own gap is `DietaryChips`'.
 */
export const MENU_CHIPS_ROW = "flex justify-center" as const;

/**
 * "Sample menu — the live menu is posted each Monday."
 *
 * `--color-muted-2` is 03 §2.1's lighter muted ink and the closest shipped
 * value to the drawn `#a89a72`; the note is neutral copy rather than the page's
 * subhead voice, so a `--section-sub` here would be the wrong register even
 * though it is a closer name. The size is {@link MENU_NOTE_VARS}' pair.
 */
export const MENU_NOTE =
  "text-center font-body text-(length:--menu-note) font-semibold text-muted-2 md:text-(length:--menu-note-md)" as const;
