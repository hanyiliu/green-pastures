"use client";

import {
  AnimatePresence,
  useReducedMotionConfig,
  type HTMLMotionProps,
  type Variants,
} from "motion/react";
import * as m from "motion/react-m";
import { useMemo, type ComponentType, type ReactNode } from "react";

import { dur, ease } from "@/design/tokens";

import { revealMotionVariants } from "@/components/motion/variants";

/**
 * The keyed text swap (05 `D-05.9`, §5.6).
 *
 * One caller at launch: the menu's sample-meals line, keyed by the selected day
 * (04 §3.3). When the key changes, the old line fades out, the new one fades in
 * and rises 6 px — `AnimatePresence mode="wait"`, so the two never overlap and
 * the line never doubles in height mid-swap (INV-05.7).
 *
 * **`WordSwap` is not the locale cascade.** The EN ↔ 中文 toggle is a URL
 * navigation that re-mounts the whole `[locale]` subtree, so it cannot be a
 * keyed swap of one string; it is `Reveal variant="swap"` on every text block,
 * delayed by mount order (05 §5.6, memo ADJ-4). The two share this file's
 * entrance because they are the same 200 ms motion, and sharing it is what
 * keeps them from drifting apart.
 *
 * The design specifies **no** animation for the day swap. 05 §5.6 records the
 * micro-transition as a conscious addition, removable without touching anything
 * else (OQ-05.3) — which is exactly what this component is: delete the wrapper
 * and the line still changes.
 *
 * ── Two things worth knowing ─────────────────────────────────────────────
 *
 * **It is one of the two files allowed to import from `motion/react`**
 * (`eslint.config.mjs`, `gp/exempt-motion-provider`; the other is
 * `MotionProvider`). `AnimatePresence` is not a motion component — it has no
 * `m.*` twin and `LazyMotion strict` has nothing to say about it — so it can
 * only come from the full entry point. The animated child is still `m.div` from
 * `motion/react-m`, and the exit feature it needs is in `domAnimation`.
 *
 * **`initial={false}`.** The first render is the server's: the default day's
 * line, already correct and already visible (04 §3.4's server-computed
 * `defaultDay`). Animating it in on mount would fade in text that had been on
 * screen since the first paint. Only a *change* of key animates.
 */

/**
 * The elements the swapped line may be. Closed, for the same reason `Reveal`'s
 * list is: the menu line is a `role="tabpanel"` block, an inline swap inside a
 * sentence is a `span`, and nothing becomes a `div` by accident.
 */
export type WordSwapAs = "span" | "div" | "p";

/**
 * The same narrowing `Reveal` uses: every `m.*` element is the one component
 * with a different element type, and the props this file passes are the
 * element-agnostic subset. Written as an annotation rather than `Reveal`'s
 * `satisfies … as unknown as …`, which turns out to be unnecessary here — the
 * annotation alone still fails the build if a name in {@link WordSwapAs} has no
 * entry, and it needs no assertion to get there.
 */
type MotionElement = ComponentType<HTMLMotionProps<"div">>;

const WORD_SWAP_ELEMENTS: Readonly<Record<WordSwapAs, MotionElement>> = {
  span: m.span,
  div: m.div,
  p: m.p,
};

export type WordSwapProps = {
  /**
   * The value the text is a function of — the selected day id for the menu
   * line. A change here is the swap; an identical value re-renders in place.
   */
  readonly swapKey: string;
  /** The new text, server-rendered by the caller (04 `D-04.2`). */
  readonly children: ReactNode;
  readonly as?: WordSwapAs;
  readonly className?: string;
};

export function WordSwap({ swapKey, children, as = "span", className }: WordSwapProps) {
  const reduced = useReducedMotionConfig() === true;

  /**
   * Enter is the catalogue's `swap` row (05 §5.2) — opacity 0→1, y 6→0, 200 ms
   * `--ease-std`, and the `min(i × 14 ms, 300 ms)` cascade delay that a
   * `custom.index` would select. This component passes no index, so it resolves
   * to no delay; the row is shared with the locale cascade rather than copied,
   * which is what stops the two from drifting (INV-05.6).
   *
   * Exit is 05 §5.6's own sentence — "exit `opacity 0` (200 ms std)" — and is
   * the one target the catalogue does not already name, so it is assembled here
   * from the same two tokens the row uses.
   */
  const variants = useMemo<Variants>(
    () => ({
      ...revealMotionVariants("swap", { reduced }),
      exit: { opacity: 0, transition: { duration: dur.wordSwap, ease: ease.std } },
    }),
    [reduced],
  );

  const Element = WORD_SWAP_ELEMENTS[as];

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Element
        key={swapKey}
        data-word-swap={swapKey}
        className={className}
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {children}
      </Element>
    </AnimatePresence>
  );
}
