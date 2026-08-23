"use client";

import { domAnimation, LazyMotion, MotionConfig, type ReducedMotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * The one Motion provider (05 `D-05.5`), mounted at the body root of
 * `app/[locale]/layout.tsx` (04 §3.3).
 *
 * Two responsibilities and nothing else:
 *
 * 1. **`LazyMotion features={domAnimation} strict`.** `domAnimation` carries
 *    the animation, exit and gesture features — including the `whileInView`
 *    observer `Reveal` runs on — and leaves out drag and layout projection,
 *    which nothing on this site uses. `strict` makes `motion.*` throw, so every
 *    component must reach for `m.*` from `motion/react-m` and the full DOM
 *    bundle can never creep back in (INV-05.11). ESLint enforces the same rule
 *    statically: this file and `WordSwap` are the only two allowed to import
 *    from `motion/react` at all (08 §2).
 * 2. **`MotionConfig reducedMotion`.** `"user"` in production — Motion then
 *    skips every transform and layout animation while keeping opacity, which is
 *    most of 05 §5.9. `Reveal` closes the rest of the gap by swapping the
 *    catalogue's `reduced` form in, because Motion's own gate does not cover
 *    `filter` (the `ink` blur) and leaves the *initial* transform in place.
 *
 * It also emits the `noscript` stylesheet INV-05.10 requires. Without
 * JavaScript no `Reveal` ever animates, so every `[data-reveal]` element would
 * sit at its hidden state — `opacity: 0` and a transform — forever. The rule
 * below is the whole no-JS story: the server already rendered the real content,
 * and this makes it visible.
 */

/**
 * INV-05.10. Scoped to `[data-reveal]`, which `Reveal` and `RevealItem` are the
 * only things to set, so it can never reach a non-motion element.
 *
 * It is written into the `noscript` element rather than nested as a `<style>`
 * child: a browser with scripting **enabled** parses `noscript` content as raw
 * text, so React only ever emits children there during SSR — which is the one
 * render that matters here, but is also the render that has to carry the whole
 * markup. `dangerouslySetInnerHTML` produces the same server HTML and does not
 * depend on how a client render treats the element.
 */
const NOSCRIPT_REVEAL_CSS =
  "<style>[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}</style>";

/**
 * The CSS half of 05 §5.9, and the reason a reduced-motion user never sees a
 * transform even in the frame before hydration: whatever hidden state the
 * server rendered, the entrance is opacity-only from the first paint.
 *
 * `Reveal` reaches the same conclusion in JS (it renders the row's `reduced`
 * form), so this is belt and braces rather than the mechanism — but it is the
 * only half that works before the bundle has run.
 */
const REDUCED_MOTION_REVEAL_CSS =
  "@media (prefers-reduced-motion: reduce){[data-reveal]{transform:none!important;filter:none!important}}";

export type MotionProviderProps = {
  readonly children: ReactNode;
  /**
   * Production leaves this alone. `"always"` is 05 §5.9's testing hook — the
   * value Storybook and the unit tests pass to assert the reduced-motion
   * fallback without emulating a media query.
   */
  readonly reducedMotion?: ReducedMotionConfig;
};

export function MotionProvider({ children, reducedMotion = "user" }: MotionProviderProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={reducedMotion}>
        <style dangerouslySetInnerHTML={{ __html: REDUCED_MOTION_REVEAL_CSS }} />
        <noscript dangerouslySetInnerHTML={{ __html: NOSCRIPT_REVEAL_CSS }} />
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
