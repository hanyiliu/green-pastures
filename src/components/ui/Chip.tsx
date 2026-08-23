import type { ReactNode } from "react";

import { withOverrides } from "./class-names";
import { Emoji } from "./Emoji";

/**
 * The pill-shaped label (04 §3.2): hero badge, trust row, dietary and benefit
 * chips, programme highlight chips, teacher tags, the HEAD TEACHER badge, and
 * the gallery filter chips' *appearance* (the interactive filter lives in
 * `GalleryExplorer`).
 *
 * A `Chip` is **not interactive**, so it carries no `--tap-min` floor; the
 * components that make a chip pressable — the menu day chips, the gallery
 * filters — extend the hit area on their own control, visual unchanged
 * (03 §6, 04 §5.5).
 *
 * The optional `icon` is an emoji id from `site.json` and renders through
 * {@link Emoji} with no label: it repeats the chip's own words, so it is
 * decorative (03 `D-03.8`).
 *
 * **Two tone notes.** (a) 04 §3.2 lists five tones but the design draws six
 * chip recipes, and it pins only one of them: the HEAD TEACHER badge is
 * `tone="sage"`, which the reference draws as a solid sage fill with white text
 * (desktop L292). The pale sage chip the hero badge and trust row use (L73,
 * L115) is a different recipe, so it is `sage-soft` here rather than being
 * silently merged into `sage` and losing 4.5:1 on white text. (b) `cool`,
 * `white` and `lavender` are drawn from the section role variables rather than
 * from a per-section colour name (`D-04.3`): in the sections that use them the
 * variables resolve to exactly the reference's values — gallery filters to
 * `--section-link` (L492), the menu's benefit chips to `--section-sub` (L209),
 * teacher tags to `--section-bg` / `--section-accent` (L542).
 *
 * **Tone is colour; `size` is the box.** The two axes are orthogonal and the
 * design proves it: `tone="sage"` serves both the HEAD TEACHER badge (`5×13`,
 * D L292) and the philosophy credential badge (`9×16`, D L152). Deriving one
 * from the other would collapse a pair the reference keeps apart.
 */

/**
 * The chip's padding, one `--chip-*` token per role (03 §4, "The `--btn-*` and
 * `--chip-*` padding tokens"). Each token holds the whole `padding` shorthand
 * and flips at `--breakpoint-md` on its own, so one unprefixed class covers
 * both views and no `md:` twin is needed — see {@link ChipSize}.
 *
 * **The two `--chip-*` tokens missing from this map are not oversights.**
 * `--chip-day` and `--chip-day-selected` belong to `MenuDayChips`, which 03 §4
 * and 04 §3 both name as their consumer; the day chips are a pressable
 * `role="tab"`, not a `Chip`. And there is no `--chip-trust`, because the
 * design's trust row is plain text on the section ground with no fill and no
 * padding (D L123, L125) — only its *type* is chip-sized, which is why
 * `--text-chip-trust` lives on `TrustRow`'s spans and not here.
 */
const SIZE = {
  /** Hero badge — `--chip-hero-badge`, `6×13` mobile (M L54) / `7×15` desktop (D L115). */
  "hero-badge": "p-(--chip-hero-badge)",
  /** Menu dietary chips — `--chip-benefit`, `7×12` (M L138) / `8×14` (D L209). */
  benefit: "p-(--chip-benefit)",
  /** Programme highlight chips and teacher tags — `--chip-pill`, `4×10` (M L308) / `5×11` (D L409). */
  pill: "p-(--chip-pill)",
  /** The HEAD TEACHER badge — `--chip-head-teacher`, `4×11` (M L199) / `5×13` (D L292). */
  "head-teacher": "p-(--chip-head-teacher)",
  /** The Yelp pill beside the review count — `--chip-yelp`, `4×9` (M L167) / `5×11` (D L240). */
  yelp: "p-(--chip-yelp)",
} as const;

/**
 * The label's type size per role (03 §3.2, "Sub-tokens of `--text-subhead`,
 * `--text-button` and `--text-chip`"). `--text-chip` holds the *hero badge's*
 * size and the rest of the family extends it, exactly as `--text-button` holds
 * the nav pill's — so this map is the one part of the recipe a role cannot
 * share, and every role drew the hero badge's `11px`/`13px` for as long as the
 * recipe set `text-chip` once for all of them.
 *
 * Two entries are worth the sentence they cost:
 *
 * - **`head-teacher` takes `--text-chip-pill`, not a name of its own.** The
 *   reference draws the badge at `10px` (M L199) and `11px` (D L292), which is
 *   `--text-chip-pill` to the pixel (`10px` / `11px`); 03 §3.2 mints no
 *   `--text-chip-head-teacher`, and inventing a second spelling of a size the
 *   token source already carries is what `D-03.1` forbids.
 * - **`yelp` takes the `--text-chip` base, and the desktop value is one step
 *   small.** The reference draws `11px` (M L167) and **`14px`** (D L240), so
 *   mobile is exact and desktop renders `13px`. 03 §3.2 mints no
 *   `--text-chip-yelp` to bind, so the gap stays visible here rather than being
 *   papered over with a raw px (INV-03.2) — closing it is a change to 03 first.
 */
const SIZE_TEXT = {
  "hero-badge": "text-chip",
  benefit: "text-chip-benefit",
  pill: "text-chip-pill",
  "head-teacher": "text-chip-pill",
  yelp: "text-chip",
} as const;

const TONE = {
  /** Solid sage, white label — HEAD TEACHER badge (L292), credential badge (L152). */
  sage: "bg-sage text-white shadow-badge",
  /** Pale sage — hero badge (L115), trust row (L73), preschool tags (L425). */
  "sage-soft": "bg-chip-bg text-chip-text",
  /** Pale gold — the Yelp trust pill (L74) and the toddler tags (L417). */
  gold: "bg-yelp-pill-bg text-yelp-pill-text",
  /** White on a cool shadow — gallery filter chips (L492). */
  cool: "bg-white text-(color:--section-link) shadow-chip-cool",
  /** White on a gold shadow — the menu's benefit chips (L209). */
  white: "bg-white text-(color:--section-sub) shadow-chip-gold-md",
  /** The section-tinted chip; the only section that draws it is Teachers (L542). */
  lavender: "bg-(color:--section-bg) text-(color:--section-accent)",
} as const;

export type ChipTone = keyof typeof TONE;

/**
 * The chip's box, `--chip-*` padding and `--text-chip*` type together.
 *
 * **One unprefixed class per role, never a `md:` twin.** Each `--chip-*` token
 * is re-declared inside `tokens.css`'s `@media (width >= 48rem)` block, so the
 * `var()` already carries both views and a `md:` restatement would compile to a
 * second rule setting the identical value. Measured in chromium against the
 * compiled stylesheet at 390px and 1280px: `p-(--chip-head-teacher)` alone
 * renders `4px 11px` and `5px 13px` — the same two boxes as the same class
 * paired with a `md:` twin.
 */
export type ChipSize = keyof typeof SIZE;

export type ChipProps = {
  readonly children: ReactNode;
  readonly tone?: ChipTone;
  /** The padding and type role; defaults to the hero badge the recipe is built around. */
  readonly size?: ChipSize;
  /** An emoji from a `site.json` `icon` field; rendered decoratively. */
  readonly icon?: string;
  /** Extra classes; an override of a property the recipe sets must be important (`bg-white!`). */
  readonly className?: string;
};

export function Chip({
  children,
  tone = "sage-soft",
  size = "hero-badge",
  icon,
  className,
}: ChipProps) {
  return (
    <span
      className={withOverrides(
        "Chip",
        `inline-flex items-center gap-2 rounded-pill font-body font-bold ${SIZE[size]} ${SIZE_TEXT[size]} ${TONE[tone]}`,
        className,
      )}
    >
      {icon === undefined ? null : <Emoji symbol={icon} size="inline" />}
      {children}
    </span>
  );
}
