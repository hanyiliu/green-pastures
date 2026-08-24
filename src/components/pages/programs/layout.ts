import type { ChipTone } from "@/components/ui/Chip";

/**
 * The Programs page's geometry (04 `D-04.6`, INV-04.5).
 *
 * Every number the two reference files draw for this page lives here rather
 * than in `RoomCards` / `RoomCard`: the content column, the card box, the photo
 * ring and its two diameters, the name row, and the chip row.
 *
 * **Everything is written on Tailwind's `--spacing` scale, never as a raw px**
 * — `size-18` is 72px, `p-4.5` is 18px, `gap-1.75` is 7px — which is the
 * spelling every `sections/<id>/layout.ts` established and the one that keeps INV-03.2
 * true. Where 03 mints a token the token is bound instead, and where it mints
 * none the nearest shipped token is bound with the gap named in the comment
 * (the pattern `menu/layout.ts` and `SteppingStone` both follow).
 *
 * **One breakpoint, `md:`.** 03 §8 gives `lg:` to the desktop *multi-column*
 * layouts, and this page has none: the card is one row of two blocks on both
 * views and everything that changes between them — the photo diameter, the type
 * sizes, the paddings, the number of highlight chips — is in 03 §8's `md:` list.
 * 04 §6's Subpages row says the same thing ("desktop type" at the middle band,
 * "as designed" at `lg`), and 04 §3.6's `RoomCards` row spells both switches as
 * `≥ md` / `< md`.
 *
 * Line numbers are `docs/design/desktop/Green Pastures - Homepage.dc.html` (D)
 * and `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html` (M).
 */

/* -------------------------------------------------------------------------- *
 * The content column (D L397, M L299)
 * -------------------------------------------------------------------------- */

/**
 * What this page changes about `SubpageBar`'s content column.
 *
 * The shell's own values are Philosophy's — 940px wide, 18px/28px between
 * blocks — and `SubpageBar` says in as many words that the narrower column is
 * "that page's config, not the shell's". Programs draws 880px (D L397) and
 * 16px/24px (M L299, D L397), so all three are overridden here.
 *
 * `max-w-220` is 880px on Tailwind's `--spacing` scale, so no arbitrary value
 * is needed. All three are important because the shell's recipe already sets
 * them, and the `md:` twins are important too: an important base class does not
 * outrank its own `md:` twin, so an `x!` needs an `md:x!` beside it
 * (`src/components/ui/class-names.tsx`, and `menu/layout.ts`'s `DIETARY_LABEL`
 * note, which learned it the hard way).
 */
export const PROGRAMS_COLUMN = "max-w-220! gap-4! md:gap-6!" as const;

/**
 * What the page changes about `SubpageHeader`.
 *
 * `SectionHeader` carries `mb-7 md:mb-11` — 28px/44px of clearance under the
 * stack — because a home `Section` puts no gap between its children and the
 * header has to make its own. `SubpageBar`'s content column *is* a gapped flex
 * column, so on a detail page that margin lands **on top of** the gap: 16 + 28
 * on the narrow view and 24 + 44 on the wide one, against the 16 and 24 the
 * reference draws. Zeroing it here is the `className` contract doing its job,
 * and it is not a Programs quirk — every detail page composing the shell has
 * the same arithmetic. See this row's report; the shell is the better place for
 * it.
 */
export const PROGRAMS_HEADER = "mb-0! md:mb-0!" as const;

/* -------------------------------------------------------------------------- *
 * The card list (D L398–427, M L303–319)
 * -------------------------------------------------------------------------- */

/**
 * The `<ul>`: a plain column on the same 16px/24px rhythm as the column it sits
 * in, so the three cards and the header read as one stack (D L397, M L299).
 *
 * A stagger container is never itself transformed (INV-05.4), so this class is
 * placement only — the entrance belongs to the `RevealItem`s inside it.
 */
export const ROOM_LIST = "flex flex-col gap-4 md:gap-6" as const;

/**
 * One room card.
 *
 * **Two drawings, one DOM** (`D-04.5`, INV-04.4). Below `md` the card is a
 * column — a photo-and-name row, then the description, then the chips (M L304).
 * At `md` the photo moves out to the left of *all three* (D L398), which a flex
 * row cannot express from the same DOM: the photo has to leave the row it
 * shares with the name. So the wide view is a two-column grid with the photo
 * spanning its three rows, and {@link ROOM_HEAD} dissolves into it with
 * `display: contents`. Nothing here reads a viewport.
 *
 * `rounded-card-md` is 03 §5's step whose own comment reads "panel, **subpage
 * cards**" — one 18px value on both views, against the reference's 16px (M
 * L304) and 20px (D L398). That collapse is 03's, the same way `D-03.7`
 * collapses the shadow set, and reproducing the pair here would be a raw radius
 * in a component (INV-03.2).
 *
 * `--shadow-card-warm` is `0 12px 30px`, which is the drawing's offset and blur
 * exactly (D L398); only its tint differs (`120 80 50 / 8%` against the
 * reference's `90 70 40 / 10%`), and 03 §5 mints no closer warm card shadow.
 */
export const ROOM_CARD =
  "flex flex-col gap-2.5 rounded-card-md bg-white p-4.5 shadow-card-warm md:grid md:grid-cols-[auto_1fr] md:items-center md:gap-x-6 md:gap-y-2 md:p-6" as const;

/**
 * The raised room's border (D L412: `2px solid #f0d9b8`).
 *
 * **Keyed off `site.programs[].featured`**, which is the same flag the home
 * section's raised stone reads — so which room is highlighted stays data
 * (INV-04.4, `D-04.18`).
 *
 * 03 mints no `#f0d9b8`. `--section-link-underline` is the Programs family's
 * own warm sand (`#e6bf95`, one shade deeper) and it reaches the component
 * through `D-04.3`'s role variables rather than by naming a section colour, so
 * a page that re-points the variable re-points the border with it. The delta is
 * this page's one visible colour gap; see the report.
 */
export const ROOM_CARD_FEATURED = "border-2 border-(color:--section-link-underline)" as const;

/**
 * The photo and the name/age block, which are a row of their own only on the
 * narrow view (M L304).
 *
 * `md:contents` is what lets the wide view treat the photo and the name block
 * as two independent grid items — see {@link ROOM_CARD}. It sets `display`, so
 * the two classes are a plain pair rather than an override; `withOverrides` is
 * not involved because this string is the whole recipe for its element.
 */
export const ROOM_HEAD = "flex items-center gap-3 md:contents" as const;

/**
 * The ring the photograph sits in: 5px of the section's own ground on the
 * narrow view, 6px on the wide one (M L304, D L399).
 *
 * `bg-(color:--section-bg)` rather than a colour name — the reference paints it
 * `#f7ecdd`, which is exactly what `D-04.3`'s role variable resolves to on this
 * page. `shrink-0` is the design's `flex:none`, so a long room name can never
 * squeeze the circle.
 */
export const ROOM_RING =
  "shrink-0 rounded-full bg-(color:--section-bg) p-1.25 md:col-start-1 md:row-span-3 md:row-start-1 md:self-center md:p-1.5" as const;

/**
 * The photograph itself — 72px → 116px (M L304, D L399).
 *
 * Both classes are important because `PhotoSlot`'s recipe already sets
 * `w-full`, and the `md:` twin is important for the reason
 * {@link PROGRAMS_COLUMN} gives. `STONE.base.photo` in the home section's
 * `layout.ts` is the same pair for the same reason.
 */
export const ROOM_PHOTO = "size-18! md:size-29!" as const;

/**
 * The name and the age label: stacked on the narrow view (M L304), one baseline
 * row 10px apart on the wide one (D L400).
 */
export const ROOM_NAMES =
  "flex flex-col md:col-start-2 md:row-start-1 md:flex-row md:items-center md:gap-2.5" as const;

/**
 * The room's name — Fredoka 600, `--text-program-title` (20px → 23px).
 *
 * That is 03 §3.2's "stepping-stone titles" token, and it is the right one:
 * this is the same room name the home section draws, one surface along. The
 * reference draws 20px (M L304) and 24px (D L400), so the narrow view is exact
 * and the wide one renders 1px small — the token's own row already carries a
 * per-programme spread (`23px` / `28px` for Toddler) that 03 chose not to model
 * per-surface.
 */
export const ROOM_NAME = "font-display text-program-title font-semibold text-ink" as const;

/**
 * The room's paragraph — Nunito 600 on `--section-sub` at `--text-blurb`.
 *
 * `--color-sub-programs` is `#7d7468`, the reference's colour exactly, and it
 * arrives through the role variable rather than by name (`D-04.3`).
 * `--text-blurb`'s own row in 03 §3.2 reads "`14px/1.5` programs" for the wide
 * view and ships 15px, so the 1px is 03's rounding, not this component's.
 */
export const ROOM_DESCRIPTION =
  "font-body text-blurb leading-(--text-blurb--line-height) font-semibold text-(color:--section-sub) md:col-start-2 md:row-start-2" as const;

/** The chip row: wrapped, 6px apart on the narrow view and 7px on the wide one. */
export const ROOM_CHIPS =
  "flex flex-wrap gap-1.5 md:col-start-2 md:row-start-3 md:gap-1.75" as const;

/**
 * The highlight chips the narrow view drops (04 §3.6: "ratio + 2 `≥ md`, ratio
 * + 1 `< md` (index ≥ 1 hidden)"; M L306 draws two chips against D L409's
 * three).
 *
 * It is a CSS toggle on the `<li>`, not a slice in code: every highlight the
 * collection carries is rendered on both views and `md:` decides which are
 * drawn, so no component reads a viewport (`D-04.5`, INV-04.4) and a locale
 * whose `highlights[]` is shorter simply has fewer `<li>`s. The `<li>` is not a
 * `Chip`, so a plain `hidden md:block` pair is enough — nothing on it collides.
 */
export const ROOM_CHIP_WIDE_ONLY = "hidden md:block" as const;

/**
 * The chip palette, by the room's position in `site.programs[]`.
 *
 * ── Position, not identity ───────────────────────────────────────────────
 *
 * The reference gives each of the three rooms its own chip colours (D L409,
 * L417, L425). Keying that off `program.id` would hard-code membership, which
 * INV-04.4 forbids and which a fourth room in `content/site.json` would
 * immediately break. Keying it off the index cannot dangle — the modulo below
 * cycles — and it is the rule `StonePath` already uses for the alternating path
 * ("parity, not `featured`").
 *
 * ── Why these three tones ────────────────────────────────────────────────
 *
 * Two of them were minted for these very chips: `Chip`'s own file documents
 * `gold` as "the toddler tags (L417)" and `sage-soft` as "preschool tags
 * (L425)". The first room's `#f3ece1` / `#9a7f5e` has no token and no tone, and
 * 03 §2.4 mints neither, so it takes `lavender` — the one recipe that names no
 * colour at all, drawing `--section-bg` on `--section-accent` (`#f7ecdd` /
 * `#c08552` here). It is the closest shipped recipe and the only one that stays
 * correct if the page's role variables move. The delta is in this row's report.
 */
const CHIP_TONES: readonly ChipTone[] = ["lavender", "gold", "sage-soft"];

/** The tone for the room at `index` in `site.programs[]`. Cycles; never undefined. */
export function chipToneFor(index: number): ChipTone {
  const tone = CHIP_TONES[index % CHIP_TONES.length];
  // Unreachable while `CHIP_TONES` is non-empty; a thrown path beats a chip
  // that silently renders `Chip`'s default tone on a fourth room.
  if (tone === undefined) throw new Error("CHIP_TONES is empty; it declares three tones.");
  return tone;
}

/* -------------------------------------------------------------------------- *
 * The footnote (D L428, M L319)
 * -------------------------------------------------------------------------- */

/**
 * "All programs include breakfast, lunch & snack …" — centred Nunito 600 on the
 * neutral muted ink.
 *
 * 03 §3.2 has no row for a subpage footnote, so this binds `--text-blurb`
 * (13px → 15px against the reference's 12px → 14px): the same secondary-copy
 * role, one step large on both views, consistently. `--color-muted` (`#8a8170`)
 * is 03 §2.1's generic muted ink and the closest shipped value to the drawn
 * `#9a8a72`; a *section* colour would be wrong here, because the footnote is
 * neutral copy rather than the page's subhead voice.
 */
export const PROGRAMS_FOOTNOTE =
  "text-center font-body text-blurb leading-(--text-blurb--line-height) font-semibold text-muted" as const;
