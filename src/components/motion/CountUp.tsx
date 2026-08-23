"use client";

import { animate, useReducedMotionConfig } from "motion/react";
import { useLocale } from "next-intl";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { dur, ease } from "@/design/tokens";

import { useRevealed } from "@/components/motion/Reveal";

/**
 * The Yelp count-up — 5.0 and 47 (05 `D-05.8`, §5.5; 04 §3.3).
 *
 * ── The rule that shapes this file ───────────────────────────────────────
 *
 * **The server HTML carries the final number.** A crawler, a reader with no
 * JavaScript, and every frame before hydration all see "5.0" and "47", not "0"
 * and not an empty box (INV-05.10). That is not left to an effect to arrange;
 * it falls out of {@link useIsHydrated}, which is `false` on the server *and*
 * for the one render that hydrates it. While it is `false` this component has
 * exactly one behaviour — print the final value — so there is no server render
 * in which the number is missing and no hydration render in which it differs.
 *
 * The alternative (start at 0, correct it in an effect) is the version that
 * looks fine in a browser and ships a "0" to Googlebot, so the gate is the
 * point of the design rather than a detail of it.
 *
 * ── The sequence ─────────────────────────────────────────────────────────
 *
 * 1. Server, and the render that hydrates it: the final value.
 * 2. Hydrated, inside a `Reveal` that has not played: 0, and wait. The reader
 *    has not scrolled here yet, so nobody watches it drop.
 * 3. `useRevealed()` flips when the Reveal enters the viewport, and
 *    `animate(0, value, …)` runs it up over `--dur-countup` (1000 ms) on
 *    `--ease-out-cubic`, formatted every frame.
 * 4. `onComplete` — the final value, snapped, and from then on React renders
 *    exactly the string the server did.
 *
 * `useRevealed()` is the whole trigger (05 §5.1): the count hears about the
 * entrance through the `Reveal` context rather than through a callback prop,
 * because callbacks do not cross the server/client boundary, and it adds no
 * observer of its own — the page has exactly two (INV-05.9).
 *
 * ── Three things that follow ─────────────────────────────────────────────
 *
 * **Already revealed means never animate.** A `Reveal` that played earlier in
 * the session reports `revealed` from its first render, so a return from a
 * subpage or a locale switch re-mounts this component onto the final value and
 * stops there — 05 §5.5's "runs once per session", inherited from `D-05.6`
 * rather than re-implemented here.
 *
 * **Reduced motion never sees a 0.** Not a faster count, not a count at all
 * (05 §5.9). `useReducedMotionConfig` rather than `useReducedMotion` so that
 * `MotionProvider reducedMotion="always"` flips it for a test the same way the
 * OS setting does for a person.
 *
 * **The width is reserved from the final string** — `tabular-nums` plus a
 * `min-width` in `ch` measured on the formatted *result*, so 0 → 47 cannot
 * widen the line as digits arrive. Animations contribute 0 to CLS (INV-05.7),
 * and this is the one component that could have.
 */

const neverChanges = () => () => undefined;
const alwaysTrue = () => true;
const alwaysFalse = () => false;

/**
 * `false` on the server and for the single render that hydrates it, `true`
 * afterwards — the same `useSyncExternalStore` shape `Reveal` uses for the same
 * reason. It is restated rather than imported because `Reveal` keeps it
 * private; if a third caller ever needs it, that is the moment to lift it into
 * a shared hook rather than now.
 */
function useIsHydrated(): boolean {
  return useSyncExternalStore(neverChanges, alwaysTrue, alwaysFalse);
}

export type CountUpProps = {
  /** `site.yelp.rating` (5) or `site.yelp.reviewCount` (47) — never a literal. */
  readonly value: number;
  /**
   * Fraction digits: 1 for the rating, 0 for the count. It comes from the
   * shared config alongside the value it belongs to, which is why it is a prop
   * and not something inferred from `value` (05 §5.5).
   */
  readonly decimals?: number;
  readonly className?: string;
};

export function CountUp({ value, decimals = 0, className }: CountUpProps) {
  /**
   * 05 §5.5's formatter, verbatim. 02 `D-02.6` names a `rating` *format*
   * (`minimumFractionDigits: 1`) for the ICU side of the same number; this
   * builds the equivalent from `decimals` so the count — 0 digits — and the
   * rating — 1 — go through one code path. The locale comes from the provider
   * next-intl already puts above this component (memo ADJ-7).
   */
  const locale = useLocale();
  const formatted = useMemo(() => {
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return (n: number) => formatter.format(n);
  }, [locale, decimals]);

  const hydrated = useIsHydrated();
  const reduced = useReducedMotionConfig() === true;
  const revealed = useRevealed();
  /** Was the entrance already over when this mounted? Decided once. */
  const [revealedAtMount] = useState(revealed);

  /** How far the run has got. Only Motion's own callbacks move these two. */
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  /**
   * Derived, not stored: the four conditions that would make a count wrong are
   * all readable during render, so none of them needs an effect to notice a
   * change. The effect below therefore starts an animation and does nothing
   * else — no `setState` in its body, which is also what keeps it off React's
   * cascading-render path.
   */
  const counting = hydrated && !revealedAtMount && !reduced && !done;

  useEffect(() => {
    if (!counting || !revealed) return;

    const controls = animate(0, value, {
      duration: dur.countup,
      ease: ease.outCubic,
      onUpdate: setProgress,
      onComplete: () => {
        setDone(true);
      },
    });

    return () => {
      controls.stop();
    };
  }, [counting, revealed, value]);

  return (
    <span
      data-countup=""
      className={`inline-block tabular-nums ${className ?? ""}`}
      /*
       * `ch` is the advance of "0", and `tabular-nums` makes every digit that
       * width — so the reserved box is the final string's, measured in the one
       * unit that survives a font swap (INV-05.7). `inline-block` is what makes
       * `min-width` apply at all: an inline box ignores it.
       */
      style={{ minWidth: `${String(formatted(value).length)}ch` }}
    >
      {counting ? formatted(revealed ? progress : 0) : formatted(value)}
    </span>
  );
}
