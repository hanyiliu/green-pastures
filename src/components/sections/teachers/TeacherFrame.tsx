"use client";

import * as m from "motion/react-m";
import type { ReactNode, Ref } from "react";

import { RevealItem } from "@/components/motion/Reveal";

/**
 * One teacher's frame (04 §3.4, `D-04.15`, INV-04.5; 05 §5.2, §5.3).
 *
 * The prototype hangs the whole Teachers group off its top edge and swings it
 * in — `gpswing 1s ease both`, `transform-origin: 50% 0%` (desktop L612) — and
 * `swing` is that keyframe row in the catalogue. This component is the third
 * thing 05 §5.3 names for the section, beside the header's `rise` and the
 * link's: the three frames are the stagger group.
 *
 * ── The two layers (INV-05.5) ────────────────────────────────────────────
 *
 * Outer `m.div` — stable `id`, `data-deco`, forwarded `ref`, and the caller's
 * placement classes from `layout.ts`: the column width, the 44px desktop
 * offset, and the head teacher's `order-first`. Inner `RevealItem` — the swing.
 * Splitting them is what keeps the *placement* off the transformed element, so
 * a later parallax or pin attaches to the outer layer without a refactor, and
 * it is the same shape `Leaf` and `ScrollCue` already use.
 *
 * **The outer layer is transparent to the stagger.** Motion only registers an
 * element in its parent's variant tree when the element is a variant node —
 * `variants`, or a variant label on `animate` / `initial` / `whileInView`
 * (`isVariantNode`) — and this `m.div` carries none of them. So the
 * `RevealItem` inside registers directly with the enclosing stagger container
 * and takes its own place in the 110ms sequence, in DOM order, exactly as if it
 * were a direct child. The wrapper is an addressable box and nothing else.
 *
 * It renders server-rendered children and reads no messages of its own
 * (04 `D-04.2`): it is a client component for the `m.*` layer alone.
 */

export type TeacherFrameProps = {
  /** `deco-teachers-frame-<n>` (04 `D-04.15`); repeated as `data-deco`. */
  readonly id: string;
  /** One `HeadTeacherCard` or `AssistantCard`, rendered on the server. */
  readonly children: ReactNode;
  /**
   * Placement — column width, offset, `order` — from the section's `layout.ts`
   * (`D-04.6`). The component sets no geometry of its own, so there is no
   * recipe class here for a caller class to collide with.
   */
  readonly className?: string;
  /** Forwarded to the outer layer — the future scrub target (INV-05.5). */
  readonly ref?: Ref<HTMLDivElement>;
};

export function TeacherFrame({ id, children, className, ref }: TeacherFrameProps) {
  return (
    <m.div id={id} data-deco={id} ref={ref} className={className}>
      <RevealItem variant="swing">{children}</RevealItem>
    </m.div>
  );
}
