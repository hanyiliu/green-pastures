import type { ReactNode } from "react";

import { withOverrides } from "./class-names";

/**
 * The eyebrow recipe (04 §3.2) — **the only place `uppercase` is applied**
 * (04 §5.5, 03 §3.3). Section eyebrows, programme age labels, teacher role
 * lines and info-panel labels all come through here, so a string that must not
 * be upper-cased (`home.philosophy.badgeBilingual`, `contact.languages`, any
 * tag carrying 中文) simply is not an `Eyebrow`.
 *
 * Colour is the section role variable `--section-accent` (`D-04.3`); the
 * component never names a per-section colour. In the two sections 03 §2.3
 * leaves without an accent (hero, testimonials) the variable is unset and the
 * colour inherits — see `src/components/layout/Section.tsx`.
 *
 * `uppercase` is a no-op on CJK glyphs, and `:root:lang(zh)` already loosens
 * `--tracking-eyebrow` for Chinese (03 §3.3), so there is no locale branch here
 * (INV-03.6).
 *
 * Arrows and stars never go inside an eyebrow: tracked uppercase text mangles
 * `→ ↗ ← ★` (03 §3.1, 04 §5.4).
 */

/**
 * `eyebrow` is the section eyebrow (03 `--text-eyebrow`, 13/11px); `sm` is the
 * denser label — programme ages, teacher roles (`--text-eyebrow-sm`, 12/10px);
 * `panel` is the Visit info panel's label (`--text-panel-label`, 12/10px).
 * The wider `--tracking-eyebrow` (1.5px) belongs to the section eyebrow; the
 * two label sizes take `--tracking-label` (0.5px), which is what the design
 * sets on the role lines.
 *
 * **`sm` and `panel` currently render identically**, and that is a token fact,
 * not a duplicate variant: `src/styles/tokens.css` gives `--text-eyebrow-sm`
 * and `--text-panel-label` the same 10px `< md` / 12px `≥ md`, neither declares
 * a line height, and both sizes take `--tracking-label`. 04 §3.2 names all
 * three sizes and 03 §3.2 lists the two tokens on separate rows — the age
 * label and the info-panel label are free to diverge — so the variant stays and
 * the coincidence is 03's to resolve.
 */
const SIZE = {
  eyebrow: "text-eyebrow tracking-eyebrow",
  sm: "text-eyebrow-sm tracking-label",
  panel: "text-panel-label tracking-label",
} as const;

export type EyebrowSize = keyof typeof SIZE;

export type EyebrowProps = {
  readonly children: ReactNode;
  readonly size?: EyebrowSize;
  /** `span` by default so an eyebrow can sit inside a chip or a heading stack. */
  readonly as?: "span" | "div" | "p";
  /** Extra classes; an override of a property the recipe sets must be important (`tracking-label!`). */
  readonly className?: string;
};

export function Eyebrow({ children, size = "eyebrow", as: Tag = "span", className }: EyebrowProps) {
  return (
    <Tag
      className={withOverrides(
        "Eyebrow",
        `font-body font-bold text-(color:--section-accent) uppercase ${SIZE[size]}`,
        className,
      )}
    >
      {children}
    </Tag>
  );
}
