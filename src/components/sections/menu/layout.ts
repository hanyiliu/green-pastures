/**
 * The Menu section's geometry (04 `D-04.6`, INV-04.5).
 *
 * Every number the two reference files draw for this section lives here rather
 * than in the components: the plate and its three dots, the day-chip row, the
 * sample line's cap, and the bottom row that carries the dietary chips and the
 * link.
 *
 * **Everything is written on Tailwind's `--spacing` scale, never as a raw px**
 * — `size-47.5` is 190px, `gap-3.5` is 14px, `max-w-145` is 580px — which is the
 * spelling `hero/layout.ts` established and the one that keeps INV-03.2 true.
 * Where 03 *has* minted a token the token is used instead, even where it is
 * unused elsewhere in `src/`: the chip paddings are `--chip-day`,
 * `--chip-day-selected` and `--chip-benefit`, and the type sizes are
 * `--text-chip-day`, `--text-chip-benefit` and `--text-sample-line`.
 *
 * Line numbers are `docs/design/desktop/Green Pastures - Homepage.dc.html` (D)
 * and `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html` (M).
 */

/* -------------------------------------------------------------------------- *
 * The stagger column (D L193, M L123)
 * -------------------------------------------------------------------------- */

/**
 * The `data-stagger` column both references draw: plate, day chips, sample
 * line, centred, 20px apart on mobile and 26px on the wide view.
 *
 * A stagger container is never itself transformed (INV-05.4), so this class is
 * placement only — the entrances belong to the three `RevealItem`s inside it.
 */
export const MENU_STAGGER = "flex flex-col items-center gap-5 md:gap-6.5" as const;

/* -------------------------------------------------------------------------- *
 * The plate (D L194–198, M L124–128)
 * -------------------------------------------------------------------------- */

/**
 * The white disc: 190px → 230px (03 §4 "component sizes"), the inset ring and
 * drop shadow of `--shadow-plate`, and its three dot columns 10px → 14px apart.
 *
 * The shadow carries the ring, so there is no border and no second element:
 * 03 §5 mints `--shadow-plate` as `0 18px 40px …, inset 0 0 0 10px #fdf3da`,
 * one token for both halves. 03 §5 declares ONE shadow set (`D-03.7`), so the
 * mobile reference's tighter `0 16px 34px … inset … 8px` (M L124) is a
 * difference 03 decided not to carry; reproducing it here would be a raw shadow
 * in a component (INV-03.1).
 */
export const PLATE =
  "flex items-center justify-center gap-2.5 rounded-full bg-white shadow-plate size-47.5 md:size-57.5 md:gap-3.5" as const;

/** One dot and its caption: a centred column 6px → 7px apart (D L195, M L125). */
export const PLATE_DOT_COLUMN = "flex flex-col items-center gap-1.5 md:gap-1.75" as const;

/**
 * The three dots, keyed by meal id.
 *
 * **Size is positional, colour is by id, and both are right.** The middle dot
 * is the large one in both references (46px → 56px against 36px → 46px), and
 * 03 §2.4 mints a colour token per meal — `--color-dot-breakfast` and friends —
 * so the fill genuinely is a property of *which meal* it is. The sizes are keyed
 * the same way here only because `site.menu.meals` and the colour tokens
 * already agree on the three ids; {@link PLATE_DOT} is a lookup by id with the
 * lunch row carrying the larger diameter, so a `meals` array in a different
 * order still draws lunch large, which is what the design means.
 */
export const PLATE_DOT: Readonly<Record<string, string>> = {
  breakfast: "size-9 rounded-full bg-dot-breakfast md:size-11.5",
  lunch: "size-11.5 rounded-full bg-dot-lunch md:size-14",
  snack: "size-9 rounded-full bg-dot-snack md:size-11.5",
};

/**
 * The caption colours, one per meal (03 §2.4; D L195–197).
 *
 * Each is important because `Eyebrow`'s own recipe already sets a colour —
 * `--section-accent` — and an appended class would lose to it silently
 * (`withOverrides`). Only the colour is overridden; the size, tracking, weight,
 * family and `uppercase` all stay the recipe's.
 */
export const PLATE_DOT_LABEL: Readonly<Record<string, string>> = {
  breakfast: "text-dot-label-breakfast!",
  lunch: "text-dot-label-lunch!",
  snack: "text-dot-label-snack!",
};

/* -------------------------------------------------------------------------- *
 * The day chips (D L199–204, M L129–134)
 * -------------------------------------------------------------------------- */

/** The chip row: centred, 7px apart on mobile and 10px on the wide view. */
export const DAY_CHIP_ROW =
  "flex flex-wrap items-center justify-center gap-1.75 md:gap-2.5" as const;

/**
 * What every day chip carries, selected or not.
 *
 * **The hit area is a pseudo-element, and the drawing is untouched** (03 §6,
 * 04 §5.5, INV-04.7). A day chip is 9px + 13px + 9px ≈ 35px tall on mobile and
 * 03 §6 says so in as many words — "day chips (`9px 13px` mobile) are under
 * 44px tall by design — 04 extends the hit area with padding/pseudo-element,
 * not by changing the visual". So `::before` is centred on the button at
 * `--tap-min` tall and at least `--tap-min` wide, and the pill the reader sees
 * keeps the design's padding exactly.
 *
 * **The transition is `background-color` alone**, over `--dur-word-swap` on
 * `--ease-soft`: 05 §5.6 names that property and no other, because the padding
 * changes with the selection and padding is layout (INV-05.1). The ink colour
 * therefore snaps rather than fading, which is the same instant that the
 * padding takes.
 *
 * **It is not a `Chip`.** 04 §3.2 lists `Chip`'s six tones and none of them is
 * this pill — different family (Fredoka against Nunito), weight, size token,
 * colour token, padding token and shadow token, which is every property in the
 * recipe. `Chip`'s own file says as much from the other side: "the components
 * that make a chip pressable — the menu day chips, the gallery filters — extend
 * the hit area on their own control". 04 §4's `MenuDayChips` row names no
 * primitive either. Six important overrides would be a `Chip` in name only.
 */
export const DAY_CHIP =
  "relative inline-flex cursor-pointer items-center justify-center rounded-pill font-display text-chip-day font-semibold transition-[background-color] duration-(--dur-word-swap) ease-soft before:absolute before:top-1/2 before:left-1/2 before:h-(--tap-min) before:w-full before:min-w-(--tap-min) before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']" as const;

/**
 * The two states, as two complete recipes rather than a base plus an override.
 *
 * Each of these four properties is written exactly once on the element.
 * Concatenating `bg-white` and `bg-daychip-selected` and trusting the second to
 * win is the failure `src/components/ui/class-names.tsx` exists to describe:
 * Tailwind v4 sorts `@layer utilities` by property, so which of two colliding
 * classes applies is decided by the stylesheet, not by the attribute.
 */
export const DAY_CHIP_STATE = {
  /** D L202, M L132 — amber fill, white ink, the wider padding, the lifted shadow. */
  selected: "bg-daychip-selected p-(--chip-day-selected) text-white shadow-chip-amber",
  /** D L200, M L130 — white pill, muted ink, the tighter padding, the flat shadow. */
  unselected: "bg-white p-(--chip-day) text-daychip-text shadow-chip-gold",
} as const;

/* -------------------------------------------------------------------------- *
 * The sample line (D L205, M L135)
 * -------------------------------------------------------------------------- */

/**
 * "**Wednesday** — whole-grain pancakes · …": Nunito 600 on `--section-sub`,
 * centred and capped at the design's 580px.
 *
 * `--text-sample-line` is 03 §3.2's token for this line and nothing else
 * (13px → 15px), including its 1.6 line height.
 */
export const SAMPLE_LINE =
  "mx-auto max-w-145 text-center font-body text-sample-line font-semibold text-(color:--section-sub)" as const;

/** The `<day>` tag 02 `D-02.5` allows in this string: the weekday, in ink. */
export const SAMPLE_LINE_DAY = "font-bold text-ink" as const;

/* -------------------------------------------------------------------------- *
 * The bottom row (D L207–212, M L136–141)
 * -------------------------------------------------------------------------- */

/**
 * The dietary chips and the "See the full menu →" link.
 *
 * One DOM, two drawings (INV-04.4). The wide view puts chips and link on a
 * single 16px-gap row 30px under the sample line (D L207); the narrow one
 * stacks the wrapped chip row above the link, still inside the 20px rhythm of
 * the column above it (M L136, L141). Nothing here reads a viewport.
 */
export const MENU_FOOTER =
  "mt-5 flex flex-col items-center gap-5 md:mt-7.5 md:flex-row md:flex-wrap md:justify-center md:gap-4" as const;

/** The chips themselves: wrapped and centred, 8px apart, 16px on the wide view. */
export const DIETARY_ROW = "flex flex-wrap items-center justify-center gap-2 md:gap-4" as const;

/**
 * What a dietary chip changes about `Chip tone="white"`.
 *
 * `Chip`'s recipe hard-codes one size and one padding for all six of its roles,
 * so the two tokens 03 §3.2 / §4 mint for *this* role — `--text-chip-benefit`
 * (11px → 12px, against the recipe's 11px → 13px) and `--chip-benefit`
 * (7×12 → 8×14, against the recipe's 6×13 → 7×15) — would otherwise go unused
 * and the chips would render a step off the drawing. Both are important, which
 * is the `className` contract's answer for exactly this (`withOverrides`), and
 * important is *enough* on its own: `!important` outranks the recipe's plain
 * `md:` twin at every width, and `--chip-benefit` re-declares itself at `md`,
 * so the padding still steps up on the wide view without a second class here.
 *
 * The tone stays `white`, whose colour is `--section-sub` — `#897a4e` in this
 * section, which is the value the reference draws (D L209).
 */
export const DIETARY_CHIP = "p-(--chip-benefit)! text-chip-benefit!" as const;

/**
 * The `< md` / `≥ md` halves of the label toggle (`D-04.5`: both strings
 * render, `md:` picks one).
 *
 * Both are important for the reason above and the one the phase learned the
 * hard way: `Chip`'s recipe sets `inline-flex`, so a plain `hidden` would lose
 * to it — and a *plain* `md:inline-flex` beside an important `hidden!` would
 * lose in turn, because an important base class outranks its own media query.
 * An `x!` needs an `md:x!` twin.
 */
export const DIETARY_LABEL = {
  short: "md:hidden!",
  long: "hidden! md:inline-flex!",
} as const;
