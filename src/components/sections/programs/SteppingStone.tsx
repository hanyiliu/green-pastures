"use client";

import * as m from "motion/react-m";
import type { ReactNode, Ref } from "react";

import type { StoneSize } from "./layout";

/**
 * The white ring a programme photo sits in (04 §3.4, `D-04.15`, INV-04.5;
 * D L166–168, L172–173, M L101, L107).
 *
 * ── The two layers (INV-05.5) ────────────────────────────────────────────
 *
 * Outer: an `m.div` with the stable `id`, `data-deco` and a forwarded `ref`,
 * carrying the caller's placement. Inner: the ring itself. Two elements so the
 * `sprout` entrance the `RevealItem` above plays and any later scrub compose
 * rather than overwrite one another — the reason every decoration in 04 §3.4 is
 * a component, and the reason it is a client component from day one
 * (`D-04.15`: an RSC cannot render the outer `m.*` layer).
 *
 * **It is not `aria-hidden`.** `Sun` and `Leaf` are, because nothing inside
 * them is content; this one wraps the programme's photograph, which carries its
 * own `alt` from `collections.programs.<id>.photoAlt`. Hiding the ring would
 * hide the picture with it.
 *
 * **It does not animate itself.** 05 §5.4's loop table has no row for a stone,
 * and the `sprout` entrance belongs to the `RevealItem` that wraps this
 * (05 §5.1's own example, §5.3's Programs row) — one observer for the whole
 * stagger group rather than one per stone (INV-05.9). So, unlike `Sun` and
 * `Leaf`, there is no `loop` prop to take: there is nothing here to loop.
 *
 * ── What it owns, and what it does not ───────────────────────────────────
 *
 * The ring's padding, fill and shadow are its recipe, because 04 §3.4 describes
 * this component as exactly that ("white ring, `--shadow-stone(-lg)`;
 * `featured` from `site.programs[].featured`"). The *photo's* diameter is not:
 * that is the caller's, from `programs/layout.ts` (`D-04.6`), and it reaches
 * the `PhotoSlot` passed as `children`.
 *
 * The two shadows are `--shadow-stone` / `--shadow-stone-lg`. 03 §6 mints them
 * from the desktop drawing (D L168, L173) and declares no `md:` twin, so both
 * views take the desktop shadow; the mobile reference's slightly tighter
 * `0 12px 26px` / `0 16px 32px` (M L101, L107) is a difference 03 decided not
 * to carry, and reproducing it here would be a raw shadow in a component
 * (INV-03.1).
 */

/**
 * The ring, per size. Padding is 6px → 7px plain and 7px → 9px featured
 * (D L166, L172; M L101, L107) on Tailwind's `--spacing` scale, which is how
 * 03 §4's untokenised component geometry is spelled everywhere in `src/`.
 */
const RING = {
  base: "rounded-full bg-white p-1.5 shadow-stone md:p-1.75",
  featured: "rounded-full bg-white p-1.75 shadow-stone-lg md:p-2.25",
} as const satisfies Record<StoneSize, string>;

export type SteppingStoneProps = {
  /** `deco-programs-stone-<programme id>` (04 `D-04.15`); repeated as `data-deco`. */
  readonly id: string;
  /** `featured` is `site.programs[].featured` — the design's raised Toddler stone. */
  readonly size?: StoneSize;
  /** The programme's photograph — a `PhotoSlot` until the photography lands (`D-04.12`). */
  readonly children: ReactNode;
  /** Placement, from the section's `layout.ts` (`D-04.6`). */
  readonly className?: string;
  /** Forwarded to the outer layer — the future scrub target (INV-05.5). */
  readonly ref?: Ref<HTMLDivElement>;
};

export function SteppingStone({ id, size = "base", children, className, ref }: SteppingStoneProps) {
  return (
    <m.div id={id} data-deco={id} ref={ref} className={className}>
      <div className={RING[size]}>{children}</div>
    </m.div>
  );
}
