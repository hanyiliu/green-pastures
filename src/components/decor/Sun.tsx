"use client";

import * as m from "motion/react-m";
import type { Ref } from "react";

import "@/components/motion/ambient.css";

/**
 * The sun (04 §3.4, `D-04.15`; 05 §5.4, INV-05.5).
 *
 * Three instances in the design and only one of them turns: the hero sun
 * rotates ±22° over `--dur-sun`, while the Programs and Visit suns are the same
 * component with `loop={false}` (desktop reference L160 and L308 carry no
 * `animation`, and the mobile Visit sun at L222 likewise).
 *
 * ── The two layers (INV-05.5) ────────────────────────────────────────────
 *
 * Outer: an `m.div` with the stable `id`, `data-deco` and a forwarded `ref`.
 * It is deliberately empty of behaviour — it exists so that a later
 * `useScroll` / `useTransform` parallax can attach to it without touching this
 * file (05 §5.12).
 *
 * Inner: the `<svg>`, which carries the CSS loop. Two elements mean the two
 * transforms compose rather than overwrite one another, which is the whole
 * reason the decorations are components at all and the reason they are client
 * components from day one (04 `D-04.15`) — an RSC cannot render the outer
 * `m.*` layer.
 *
 * ── What this component does not own ─────────────────────────────────────
 *
 * Placement and opacity. Every instance in the references sits at its own
 * offset and its own alpha (.9 hero, .55 programs, .5 visit), and 04 `D-04.6`
 * puts that geometry in the section's `layout.ts`, never here. It arrives as
 * `className` on the outer layer, where it composes with the loop below it.
 */

/**
 * The drawn sizes, per view. `hero` and `visit` are the two the references draw
 * at two sizes; `programs` is desktop-only (the mobile Programs section has no
 * sun). Sizes are Tailwind spacing multipliers rather than tokens because 03 §4
 * keeps decoration geometry as prose, not custom properties.
 */
const SIZE = {
  /** 72 px, 118 px at `md` — desktop L110, mobile L51. */
  hero: "size-18 md:size-29.5",
  /** 100 px, desktop only — desktop L160. */
  programs: "size-25",
  /** 70 px, 120 px at `md` — desktop L308, mobile L222. */
  visit: "size-17.5 md:size-30",
  /**
   * 72 px on both views. 04 §3.4 names this size and no reference instance
   * draws it; it is the smallest sun the design contains, held flat.
   */
  sm: "size-18",
} as const;

export type SunSize = keyof typeof SIZE;

export type SunProps = {
  /** `deco-<section>-sun` (04 `D-04.15`); repeated as `data-deco`. */
  readonly id: string;
  readonly size?: SunSize;
  /** `false` for the Programs and Visit suns, which the design draws still. */
  readonly loop?: boolean;
  /** Placement and opacity, from the section's `layout.ts` (`D-04.6`). */
  readonly className?: string;
  /** Forwarded to the outer layer — the future scrub target (INV-05.5). */
  readonly ref?: Ref<HTMLDivElement>;
};

export function Sun({ id, size = "hero", loop = true, className, ref }: SunProps) {
  return (
    <m.div id={id} data-deco={id} ref={ref} aria-hidden className={className}>
      <svg
        viewBox="0 0 120 120"
        fill="none"
        data-loop="sun"
        /*
         * `origin-center` is 05 §5.4's `transform-origin: 60px 60px`, which it
         * glosses as "centre of the 120 viewBox". Written as the centre rather
         * than as 60 px it stays right at every drawn size; the prototype's
         * literal 60 px is only correct for the 118/120 px instances and puts
         * the 72 px mobile sun's pivot outside its own disc.
         */
        className={`${SIZE[size]} origin-center ${loop ? "loop" : ""}`}
      >
        <circle cx="60" cy="60" r="26" className="fill-sun" />
        <g className="stroke-sun" strokeWidth="5" strokeLinecap="round">
          <line x1="60" y1="12" x2="60" y2="26" />
          <line x1="60" y1="94" x2="60" y2="108" />
          <line x1="12" y1="60" x2="26" y2="60" />
          <line x1="94" y1="60" x2="108" y2="60" />
          <line x1="26" y1="26" x2="36" y2="36" />
          <line x1="84" y1="84" x2="94" y2="94" />
          <line x1="94" y1="26" x2="84" y2="36" />
          <line x1="36" y1="84" x2="26" y2="94" />
        </g>
      </svg>
    </m.div>
  );
}
