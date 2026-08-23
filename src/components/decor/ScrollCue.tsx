"use client";

import * as m from "motion/react-m";
import type { ReactNode, Ref } from "react";

import "@/components/motion/ambient.css";

/**
 * The hero's "scroll to come inside ⌄" cue (04 §3.4, `D-04.15`; 05 §5.4).
 *
 * The prototype draws it as a `div` with a `data-scrollto` attribute and a
 * `cursor: pointer` (desktop L135, mobile L74). In production it is a **real
 * link** — 04 §3.4 says so, and it is the only reason a keyboard visitor can
 * use it at all: an anchor to `#philosophy` moves focus as well as the
 * viewport, works unscripted, and inherits the site's focus ring for free.
 *
 * ── The two layers (INV-05.5) ────────────────────────────────────────────
 *
 * Outer `m.div` — stable `id`, `data-deco`, forwarded `ref`. Inner `<a>` — the
 * `gpbounce` loop. Unlike `Sun` and `Leaf` the inner layer here is the
 * interactive element, so the 6 px bounce carries the focus ring with it; that
 * is the design's own behaviour and stops the moment the loop does.
 *
 * Unlike its two siblings this component takes no `loop` prop: 05 §5.4 gives
 * `loop?: boolean` to `Leaf` and `Sun` only, and there is exactly one cue on
 * the page, always bouncing.
 *
 * The words are `home.hero.scrollCue` and arrive as server-rendered children,
 * never as a literal (INV-02.1): the cue is a client component for its outer
 * `m.*` layer alone, and reads no messages of its own (04 `D-04.2`).
 */

export type ScrollCueProps = {
  /** `deco-hero-cue` (04 `D-04.15`); repeated as `data-deco`. */
  readonly id: string;
  /** The in-page anchor the cue points at — `#philosophy` on the home page. */
  readonly href: string;
  /** `home.hero.scrollCue`, resolved by the section. */
  readonly children: ReactNode;
  /**
   * Placement — including the centring — from the hero's `layout.ts`
   * (`D-04.6`). The component sets no position of its own, so there is no
   * recipe class here for a caller class to collide with.
   */
  readonly className?: string;
  /** Forwarded to the outer layer — the future scrub target (INV-05.5). */
  readonly ref?: Ref<HTMLDivElement>;
};

export function ScrollCue({ id, href, children, className, ref }: ScrollCueProps) {
  return (
    <m.div id={id} data-deco={id} ref={ref} className={className}>
      <a
        href={href}
        data-loop="cue"
        className="loop inline-block font-body text-scroll-cue font-bold tracking-label text-muted-2"
      >
        {children}
      </a>
    </m.div>
  );
}
