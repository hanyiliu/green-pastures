"use client";

import * as m from "motion/react-m";
import type { Ref } from "react";

import "@/components/motion/ambient.css";

/**
 * The floating leaf (04 §3.4, `D-04.15`; 05 §5.4, INV-05.5).
 *
 * Eleven instances across the two references and only four of them move: the
 * three hero leaves (7 s / 8 s / 9 s) and the mobile Philosophy leaf. The other
 * seven are the same component with `loop={false}`, which drops the `.loop`
 * class so no keyframes attach (04 §3.4 owns the per-section counts).
 *
 * ── The two layers (INV-05.5) ────────────────────────────────────────────
 *
 * Outer `m.div` — stable `id`, `data-deco`, forwarded `ref`, and the caller's
 * placement classes. Inner `<svg>` — the CSS float. The references hang a
 * resting `rotate(-30deg)` / `rotate(20deg)` on several of the static leaves;
 * that belongs on the outer layer with the rest of the placement, where it
 * composes with the loop instead of being overwritten by it.
 *
 * ── `variant` ────────────────────────────────────────────────────────────
 *
 * `"a"` drifts up and clockwise (`gpfloat`), `"b"` down and anticlockwise
 * (`gpfloat2`). Only the desktop hero's 28 px leaf is a `"b"`, and the design
 * gives it no speed of its own — it is the 8 s base by construction, so
 * `speed` and `variant="b"` are not meant to be combined.
 */

/**
 * The `--color-leaf-*` family (03 §2.4). The tint is named after the instance
 * it was drawn for rather than after its hue, which is 03 `D-03.1`'s rule and
 * the reason a section can be recoloured in one file.
 */
const TINT = {
  /** #a9c39a — the 40 px hero leaf, and the single mobile hero leaf. */
  "hero-1": "fill-leaf-hero-1",
  /** #e8c79a — the 28 px hero leaf (`variant="b"`). */
  "hero-2": "fill-leaf-hero-2",
  /** #cdb38a — the 22 px hero leaf. */
  "hero-3": "fill-leaf-hero-3",
  /** #9fbb8f — both Philosophy leaves. */
  philosophy: "fill-leaf-philosophy",
  /** #c3b7d6 — both Teachers leaves. */
  teachers: "fill-leaf-teachers",
  /** #7e9a6e — the Visit leaf. */
  visit: "fill-leaf-visit",
} as const;

export type LeafTint = keyof typeof TINT;

/** 7 s / 8 s / 9 s — `--dur-leaf-fast` / `--dur-leaf` / `--dur-leaf-slow`. */
export type LeafSpeed = "fast" | "base" | "slow";

export type LeafVariant = "a" | "b";

export type LeafProps = {
  /** `deco-<section>-leaf-<n>` (04 `D-04.15`); repeated as `data-deco`. */
  readonly id: string;
  /**
   * Drawn size in px — 40 / 28 / 22 for the desktop hero, 26 for the mobile
   * one, and so on down the references. A `size-*` / `md:size-*` pair in
   * `className` overrides it where a leaf is drawn at two sizes, because CSS
   * beats the SVG presentation attributes.
   */
  readonly size: number;
  readonly speed?: LeafSpeed;
  readonly variant?: LeafVariant;
  readonly tint: LeafTint;
  /** `false` for the seven leaves the design draws still. */
  readonly loop?: boolean;
  /** Placement, resting rotation and opacity, from `layout.ts` (`D-04.6`). */
  readonly className?: string;
  /** Forwarded to the outer layer — the future scrub target (INV-05.5). */
  readonly ref?: Ref<HTMLDivElement>;
};

/** The reference leaf, identical in both prototypes (desktop L111, mobile L52). */
const LEAF_PATH = "M14 2 C22 6 24 18 14 26 C4 18 6 6 14 2 Z";

export function Leaf({
  id,
  size,
  speed = "base",
  variant = "a",
  tint,
  loop = true,
  className,
  ref,
}: LeafProps) {
  return (
    <m.div id={id} data-deco={id} ref={ref} aria-hidden className={className}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        data-loop={variant === "b" ? "leaf-b" : "leaf"}
        data-speed={speed}
        className={loop ? "loop" : undefined}
      >
        <path d={LEAF_PATH} className={TINT[tint]} />
      </svg>
    </m.div>
  );
}
