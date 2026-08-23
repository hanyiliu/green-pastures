import type { ReactNode } from "react";

import { withOverrides } from "./class-names";

/**
 * The photo placeholder (03 §9, 04 §3.2, `D-04.12`).
 *
 * Every photograph on this site is client-supplied and none has arrived (HD-12
 * settled that no stock imagery is bought). Until one does, the slot reserves
 * the photo's box and fills it with a solid tint of the section it sits in:
 * `color-mix(in oklab, var(--section-bg) 92%, var(--color-ink))`, exactly as
 * 03 §9 specifies. Dropping a real photo in later is adding an `image` object
 * to `site.json` — the box does not move.
 *
 * That `color-mix` is written as a Tailwind arbitrary value, which is the only
 * place the gates leave for it and is deliberate rather than a shortcut: 08's
 * Stylelint config disallows `color-mix` in every stylesheet but
 * `src/styles/tokens.css`, and ESLint disallows it inside `style={}`
 * (INV-03.1's two halves). The expression names two tokens and no literal
 * colour, so INV-03.1's actual rule — no raw colour — holds.
 *
 * Accessibility (04 §3.2): with an `alt` the slot is `role="img"` and carries
 * it; without one it is `aria-hidden`. Nothing visible is rendered inside it —
 * `slotId` is data on a `data-*` attribute, never copy (INV-02.1).
 */

/**
 * 03 §5's concrete radius steps, as token names — `hero` among them. It was the
 * one photo radius with no step of its own, and 03 §5 has since minted
 * `--radius-hero` (22px `< md`, 26px `≥ md`) under the name 04 §5.3 asked for,
 * so the hero photo binds a step here instead of overriding the recipe.
 */
const RADIUS = {
  pill: "rounded-pill",
  hero: "rounded-hero",
  "card-lg": "rounded-card-lg",
  card: "rounded-card",
  "card-md": "rounded-card-md",
  "card-sm": "rounded-card-sm",
  tile: "rounded-tile",
  "logo-card": "rounded-logo-card",
  input: "rounded-input",
  badge: "rounded-badge",
  polaroid: "rounded-polaroid",
  full: "rounded-full",
} as const;

/** A 03 §5 radius step, by token name. Shared with `Picture` when it lands. */
export type RadiusToken = keyof typeof RADIUS;

export function radiusClass(radius: RadiusToken): string {
  return RADIUS[radius];
}

/** 03 §9's fill: the section background, darkened toward ink. */
const FILL = "bg-[color:color-mix(in_oklab,var(--section-bg)_92%,var(--color-ink))]";

export type PhotoSlotProps = {
  /** Which slot this is (`hero`, `philosophy`, `map`, a gallery photo id). Data, not copy. */
  readonly slotId: string;
  /** The photograph's accessible name, from the per-locale collection or message. */
  readonly alt?: string;
  /**
   * A 03 §5 radius step. `card` — 20px — is the default: 03 §5 is the normative
   * section and gives `--radius-card: 20px`, while §1's illustrative sample
   * prints 18px (tracked as bead `gp-dln.38`).
   */
  readonly radius?: RadiusToken;
  /** `circle` overrides `radius`: programme stones and teacher photos are round. */
  readonly shape?: "rect" | "circle";
  /** Extra classes; an override of a property the recipe sets must be important (`w-auto!`). */
  readonly className?: string;
  /** A floating badge or frame the caller draws over the slot. */
  readonly children?: ReactNode;
};

export function PhotoSlot({
  slotId,
  alt,
  radius = "card",
  shape = "rect",
  className,
  children,
}: PhotoSlotProps) {
  const labelled = alt !== undefined;
  const shapeClasses = shape === "circle" ? "aspect-square rounded-full" : radiusClass(radius);

  return (
    <div
      data-photo-slot={slotId}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? alt : undefined}
      aria-hidden={labelled ? undefined : true}
      className={withOverrides("PhotoSlot", `block w-full ${FILL} ${shapeClasses}`, className)}
    >
      {children}
    </div>
  );
}
