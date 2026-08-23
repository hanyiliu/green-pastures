import type { ReactNode } from "react";

import { RevealItem } from "@/components/motion/Reveal";
import type { RevealSide } from "@/components/motion/variants";

import { BUBBLE_CARD } from "./layout";

/**
 * One speech bubble — the white card with a single squared corner (04 §3.4;
 * D L245–252, M L173–179).
 *
 * It is the `<li>` of the bubble list *and* the animated element: 05 §5.2's
 * `bubble` entrance inflates the card from its tail, so the transform has to
 * sit on the box the tail belongs to. `RevealItem as="li"` is what keeps the
 * list semantics while it does (05 §5.1, 04 §3.3).
 *
 * ── The tail decides two things, and both come from the same prop ─────────
 *
 * The **corner** is 03 §5's `--radius-bubble-l` / `--radius-bubble-r`
 * (`20px 20px 20px 5px` and its mirror, 22/6 above `md`) — one token per tail,
 * so the per-view flip needs no class of its own.
 *
 * The **transform origin** is the catalogue's: `bubble` reads `custom.tail` and
 * answers `12% 100%` or `88% 100%`, which is the prototype's
 * `origin: (i % 2 ? '88% 100%' : '12% 100%')` (desktop L611). Passing `tail`
 * to `RevealItem` is the whole of that wiring; nothing here sets a
 * `transform-origin`.
 *
 * ── `desktopOnly` is a surface flag, never a view branch ──────────────────
 *
 * `site.testimonials[].onMobile` is 02 `D-02.13`'s flag, and Karen T. carries
 * `false`: the mobile reference draws two bubbles where the desktop draws three
 * (M L172 vs D L244). It renders on both views and `lg:` decides — no component
 * reads a viewport, so there is no hydration mismatch and no shift (INV-04.4).
 * The pair lives inside this recipe rather than arriving as a caller class
 * because `display` is a property the recipe already sets, and a bare `hidden`
 * from a caller would collide with it.
 *
 * ── No `id` prop ──────────────────────────────────────────────────────────
 *
 * 04 §3.4 sketches `Bubble` with one, in the shape the decorations use for
 * their `data-deco` hook. `RevealItem`'s prop list is closed and forwards no
 * `data-*`, so an id here would have nowhere to land without changing a Phase 4
 * primitive. `SpeechBubble` puts `data-testimonial` on the `<figure>` inside
 * instead, which is the element a test or an e2e selector wants anyway.
 */

/** 03 §5's two bubble radii, by the side the tail is on. */
const TAIL_RADIUS = {
  left: "rounded-bubble-l",
  right: "rounded-bubble-r",
} as const satisfies Record<RevealSide, string>;

export type BubbleProps = {
  /** Which corner is squared; also picks the `bubble` entrance's origin. */
  readonly tail: RevealSide;
  /** DOM position in the stagger group. */
  readonly index?: number;
  /** `site.testimonials[].onMobile === false` — drawn only in the 3-column grid. */
  readonly desktopOnly?: boolean;
  /** Extra classes on the card — the centre column's push. */
  readonly className?: string;
  readonly children: ReactNode;
};

export function Bubble({ tail, index = 0, desktopOnly = false, className, children }: BubbleProps) {
  const display = desktopOnly ? "hidden lg:flex" : "flex";

  return (
    <RevealItem
      as="li"
      variant="bubble"
      tail={tail}
      index={index}
      className={`${display} ${BUBBLE_CARD} ${TAIL_RADIUS[tail]}${className === undefined ? "" : ` ${className}`}`}
    >
      {children}
    </RevealItem>
  );
}
