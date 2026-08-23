import type { ReactNode } from "react";

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
 */

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

export type ChipProps = {
  readonly children: ReactNode;
  readonly tone?: ChipTone;
  /** An emoji from a `site.json` `icon` field; rendered decoratively. */
  readonly icon?: string;
  readonly className?: string;
};

export function Chip({ children, tone = "sage-soft", icon, className }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-pill px-3.25 py-1.5 font-body text-chip font-bold md:px-3.75 md:py-1.75 ${TONE[tone]} ${className ?? ""}`}
    >
      {icon === undefined ? null : <Emoji symbol={icon} size="inline" />}
      {children}
    </span>
  );
}
