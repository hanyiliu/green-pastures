"use client";

import * as m from "motion/react-m";
import type { Ref } from "react";

import { Eyebrow } from "@/components/ui/Eyebrow";

import { PLATE, PLATE_DOT, PLATE_DOT_COLUMN, PLATE_DOT_LABEL } from "./layout";

/**
 * The menu plate — a white disc with three meal dots (04 §3.4's `Plate` row,
 * `D-04.15`, INV-04.5; D L194–198, M L124–128).
 *
 * ── The two layers (INV-05.5) ────────────────────────────────────────────
 *
 * Outer: an `m.div` with the stable `id`, `data-deco` and a forwarded `ref`,
 * carrying the caller's placement. Inner: the disc itself. Two elements so the
 * `roll` entrance the `RevealItem` above plays and any later scrub compose
 * rather than overwrite one another — the reason every decoration in 04 §3.4 is
 * a component, and the reason it is a client component from day one
 * (`D-04.15`: an RSC cannot render the outer `m.*` layer).
 *
 * **It does not animate itself.** 05 §5.4's loop table has no row for a plate,
 * and the `roll` entrance belongs to the `RevealItem` that wraps this — the
 * design's own reading, whose `data-stagger` handler gives child 0 `gproll` and
 * every later child `gpdrop` (D L609). One observer for the whole group, not
 * one per leaf (INV-05.9).
 *
 * ── It is not `aria-hidden`, and the dots are not labelled ───────────────
 *
 * 04 §4 words it as "plate dots are decorative with visible captions": the
 * three coloured circles carry no information a screen reader could use, and
 * the meal names beside them are real content from `menu.meals.<id>`. Hiding
 * the plate would take those names with it, and giving the dots their own
 * `aria-label` would read every meal twice. So the dots are empty elements —
 * invisible to assistive technology because they have no content, not because
 * an attribute says so — and the captions are ordinary text.
 *
 * ── Sizes are 03's, the captions' size is `Eyebrow`'s ────────────────────
 *
 * Diameters, gaps and fills come from `layout.ts`. The caption is
 * `Eyebrow size="sm"` because 04 §4's `Plate` row names that primitive, which
 * also keeps the design's uppercase inside the one recipe allowed to apply it
 * (04 §5.5). That fixes the caption at `--text-eyebrow-sm` (10px → 12px) where
 * the references draw 8px → 10px; 03 §3.2 mints no token at those sizes, and a
 * raw px here would break INV-03.2, so the two-pixel difference is 03's to
 * resolve rather than this component's to invent around.
 */

export type PlateDot = {
  /** A meal id from `site.menu.meals` — `breakfast`, `lunch`, `snack`. */
  readonly id: string;
  /** The meal's name, already read from `menu.meals.<id>` by the section. */
  readonly label: string;
};

export type PlateProps = {
  /** `deco-menu-plate` (04 `D-04.15`); repeated as `data-deco`. */
  readonly id: string;
  /** One dot per meal, in `site.menu.meals` order (serving order). */
  readonly dots: readonly PlateDot[];
  /** Placement, from the section's `layout.ts` (`D-04.6`). */
  readonly className?: string;
  /** Forwarded to the outer layer — the future scrub target (INV-05.5). */
  readonly ref?: Ref<HTMLDivElement>;
};

export function Plate({ id, dots, className, ref }: PlateProps) {
  return (
    <m.div id={id} data-deco={id} ref={ref} className={className}>
      <div className={PLATE}>
        {dots.map((dot) => (
          <div key={dot.id} className={PLATE_DOT_COLUMN}>
            <div data-plate-dot={dot.id} className={PLATE_DOT[dot.id]} />

            <Eyebrow size="sm" className={PLATE_DOT_LABEL[dot.id]}>
              {dot.label}
            </Eyebrow>
          </div>
        ))}
      </div>
    </m.div>
  );
}
