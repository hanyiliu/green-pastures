import type { TargetAndTransition, Transition } from "motion/react";
import { describe, expect, it } from "vitest";

import {
  ANIMATED_VARIANT_NAMES,
  cascadeDelay,
  revealMotionVariants,
  revealVariants,
  staggerContainerVariants,
  transformOriginFor,
  transformTemplateFor,
  VARIANT_NAMES,
  type RevealCustom,
  type VariantName,
} from "@/components/motion/variants";

/**
 * Catalogue fidelity (05 §5.14; PR-4.3a's acceptance row: "`variants.ts` equals
 * 05 §5.2 — values, `times`, origins").
 *
 * Every number below is transcribed from the table in
 * `docs/technical/05-animation-system.md` §5.2 by hand, **not** imported from
 * `src/design/tokens.ts`. That is deliberate: importing the tokens would only
 * prove the catalogue is self-consistent, whereas the thing worth protecting is
 * that the catalogue still says what the design document says. A value changes
 * here only if someone argues it against §5.2 first.
 *
 * The numbers are named rather than written inline because INV-05.6's lint ban
 * exempts `variants.ts` and `tokens.ts`, not this file — which is the right way
 * round.
 */

/** §5.2's three easings: `--ease-soft`, `--ease-spring`, and "std" = CSS `ease`. */
const SOFT = [0.2, 0.8, 0.25, 1];
const SPRING = [0.34, 1.56, 0.5, 1];
const STD = [0.25, 0.1, 0.25, 1];

/** §5.2's durations as seconds — the table's milliseconds ÷ 1000. */
const SECONDS = {
  rise: 0.75,
  ink: 0.95,
  visitFade: 1.1,
  sprout: 0.9,
  roll: 0.85,
  drop: 0.7,
  polaroid: 0.8,
  polaroidFade: 0.5,
  bubble: 0.65,
  bubbleFade: 0.45,
  swing: 1,
  wordSwap: 0.2,
};

/** §5.1's `staggerChildren: 0.11` (110 ms) and §5.6's 14 ms step, 300 ms cap. */
const STAGGER_CHILD = 0.11;
const CASCADE_STEP = 0.014;
const CASCADE_CAP = 0.3;
const NO_DELAY = 0;
const A_CONTAINER_DELAY = 0.25;

type Resolved = {
  readonly hidden: TargetAndTransition;
  readonly visible: TargetAndTransition;
  readonly transition: Transition | undefined;
};

type TargetFn = (custom: RevealCustom) => TargetAndTransition;

/** Resolve one row the way `Reveal` does, then split the transition back out. */
function resolve(
  name: VariantName,
  custom: RevealCustom = {},
  options: { reduced?: boolean; opaque?: boolean } = {},
): Resolved {
  const variants = revealMotionVariants(name, options);
  const hidden = (variants.hidden as TargetFn)(custom);
  const visible = (variants.visible as TargetFn)(custom);
  const { transition, ...target } = visible;
  return { hidden, visible: target, transition };
}

/** The `delay` of a resolved transition, which only `swap` sets. */
function delayOf(transition: Transition | undefined): number {
  return (transition as { delay?: number } | undefined)?.delay ?? Number.NaN;
}

describe("the catalogue is exactly 05 §5.2", () => {
  it("has the table's twelve rows, eleven of which carry values", () => {
    expect(VARIANT_NAMES).toEqual([
      "rise",
      "riseChild",
      "ink",
      "fade",
      "sprout",
      "roll",
      "drop",
      "polaroid",
      "bubble",
      "swing",
      "swap",
      "none",
    ]);
    expect(ANIMATED_VARIANT_NAMES).toHaveLength(11);
    expect(ANIMATED_VARIANT_NAMES).not.toContain("none");
  });

  it("rise — opacity 0, y 26 → opacity 1, y 0; y SOFT and opacity std over 750 ms", () => {
    expect(resolve("rise")).toEqual({
      hidden: { opacity: 0, y: 26 },
      visible: { opacity: 1, y: 0 },
      transition: {
        y: { duration: SECONDS.rise, ease: SOFT },
        opacity: { duration: SECONDS.rise, ease: STD },
      },
    });
    expect(transformOriginFor("rise")).toBeUndefined();
  });

  it("rise — travels 18 px below md (§5.3)", () => {
    expect(resolve("rise", { riseDistance: 18 }).hidden).toEqual({ opacity: 0, y: 18 });
  });

  it("riseChild — opacity 0, y 22, transitioned as rise", () => {
    expect(resolve("riseChild")).toEqual({
      hidden: { opacity: 0, y: 22 },
      visible: { opacity: 1, y: 0 },
      transition: {
        y: { duration: SECONDS.rise, ease: SOFT },
        opacity: { duration: SECONDS.rise, ease: STD },
      },
    });
  });

  it("ink — scale .97 and blur(14px) over 950 ms, scale SOFT, opacity and filter std", () => {
    expect(resolve("ink")).toEqual({
      hidden: { opacity: 0, scale: 0.97, filter: "blur(14px)" },
      visible: { opacity: 1, scale: 1, filter: "blur(0px)" },
      transition: {
        scale: { duration: SECONDS.ink, ease: SOFT },
        opacity: { duration: SECONDS.ink, ease: STD },
        filter: { duration: SECONDS.ink, ease: STD },
      },
    });
  });

  it("fade — opacity only, 1100 ms std", () => {
    expect(resolve("fade")).toEqual({
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      transition: { duration: SECONDS.visitFade, ease: STD },
    });
  });

  it("sprout — gpsprout's four stops, times [0, .6, .8, 1], 900 ms SPRING, origin 50% 100%", () => {
    expect(resolve("sprout")).toEqual({
      hidden: { opacity: 0, scale: 0.6, scaleY: 0.25 },
      visible: {
        opacity: [0, 1, 1, 1],
        scale: [0.6, 1.05, 0.985, 1],
        scaleY: [0.25, 1.07, 1, 1],
      },
      transition: { duration: SECONDS.sprout, ease: SPRING, times: [0, 0.6, 0.8, 1] },
    });
    expect(transformOriginFor("sprout")).toBe("50% 100%");
  });

  it("roll — gproll's three stops, times [0, .6, 1], 850 ms SOFT, origin centre", () => {
    expect(resolve("roll")).toEqual({
      hidden: { opacity: 0, x: -90, rotate: -150 },
      visible: { opacity: [0, 1, 1], x: [-90, 10, 0], rotate: [-150, 8, 0] },
      transition: { duration: SECONDS.roll, ease: SOFT, times: [0, 0.6, 1] },
    });
    expect(transformOriginFor("roll")).toBe("50% 50%");
  });

  it("drop — gpdrop's four stops, times [0, .55, .75, 1], 700 ms std, no origin", () => {
    expect(resolve("drop")).toEqual({
      hidden: { opacity: 0, y: -34 },
      visible: { opacity: [0, 1, 1, 1], y: [-34, 7, -4, 0] },
      transition: { duration: SECONDS.drop, ease: STD, times: [0, 0.55, 0.75, 1] },
    });
    expect(transformOriginFor("drop")).toBeUndefined();
  });

  it("polaroid — even index flies in from the left, odd from the right", () => {
    const transition = {
      x: { duration: SECONDS.polaroid, ease: SPRING },
      rotate: { duration: SECONDS.polaroid, ease: SPRING },
      scale: { duration: SECONDS.polaroid, ease: SPRING },
      opacity: { duration: SECONDS.polaroidFade, ease: STD },
    };

    expect(resolve("polaroid", { index: 0 })).toEqual({
      hidden: { opacity: 0, x: -150, rotate: -10, scale: 0.9 },
      visible: { opacity: 1, x: 0, rotate: 0, scale: 1 },
      transition,
    });
    expect(resolve("polaroid", { index: 1 }).hidden).toEqual({
      opacity: 0,
      x: 150,
      rotate: 10,
      scale: 0.9,
    });
    expect(transformOriginFor("polaroid")).toBe("50% 50%");
  });

  it("polaroid — an explicit side overrides index parity", () => {
    expect(resolve("polaroid", { index: 0, side: "right" }).hidden).toEqual({
      opacity: 0,
      x: 150,
      rotate: 10,
      scale: 0.9,
    });
  });

  it("bubble — scale .3 → 1 at 650 ms SPRING with a 450 ms std fade", () => {
    expect(resolve("bubble")).toEqual({
      hidden: { opacity: 0, scale: 0.3 },
      visible: { opacity: 1, scale: 1 },
      transition: {
        scale: { duration: SECONDS.bubble, ease: SPRING },
        opacity: { duration: SECONDS.bubbleFade, ease: STD },
      },
    });
  });

  it("bubble — the origin is the tail: 12% 100% left, 88% 100% right", () => {
    expect(transformOriginFor("bubble", { tail: "left" })).toBe("12% 100%");
    expect(transformOriginFor("bubble", { tail: "right" })).toBe("88% 100%");
  });

  it("swing — gpswing's five stops, times [0, .35, .6, .8, 1], 1000 ms std, origin 50% 0%", () => {
    expect(resolve("swing")).toEqual({
      hidden: { opacity: 0, rotate: -9, y: -12 },
      visible: {
        opacity: [0, 1, 1, 1, 1],
        rotate: [-9, 5, -2.5, 1, 0],
        y: [-12, 0, 0, 0, 0],
      },
      transition: { duration: SECONDS.swing, ease: STD, times: [0, 0.35, 0.6, 0.8, 1] },
    });
    expect(transformOriginFor("swing")).toBe("50% 0%");
  });

  it("swing — and only swing — restores the rotate-then-translate order", () => {
    const template = transformTemplateFor("swing");
    expect(template).toBeDefined();
    expect(template?.({ rotate: "-9deg", y: "-12px" }, "translateY(-12px) rotate(-9deg)")).toBe(
      "rotate(-9deg) translateY(-12px)",
    );

    for (const name of VARIANT_NAMES.filter((entry) => entry !== "swing")) {
      expect(transformTemplateFor(name)).toBeUndefined();
    }
  });

  it("swing — leaves an untransformed element alone rather than writing an identity", () => {
    expect(transformTemplateFor("swing")?.({}, "none")).toBe("none");
  });

  it("swap — opacity 0, y 6 over 200 ms std, delayed by min(index × 14 ms, 300 ms)", () => {
    const { hidden, visible, transition } = resolve("swap", { index: 3 });
    expect(hidden).toEqual({ opacity: 0, y: 6 });
    expect(visible).toEqual({ opacity: 1, y: 0 });
    expect(transition).toMatchObject({ duration: SECONDS.wordSwap, ease: STD });
    expect(delayOf(transition)).toBeCloseTo(3 * CASCADE_STEP, 10);
  });

  it("swap — the cascade delay caps at 300 ms", () => {
    expect(cascadeDelay(0)).toBe(NO_DELAY);
    expect(cascadeDelay(1)).toBeCloseTo(CASCADE_STEP, 10);
    expect(cascadeDelay(21)).toBeCloseTo(21 * CASCADE_STEP, 10);
    expect(cascadeDelay(22)).toBe(CASCADE_CAP);
    expect(cascadeDelay(500)).toBe(CASCADE_CAP);
  });

  it("none — every cell of the row is a dash", () => {
    expect(resolve("none")).toEqual({ hidden: {}, visible: {}, transition: {} });
    expect(transformOriginFor("none")).toBeUndefined();
  });

  it("gives every multi-stop row a times array as long as its keyframes", () => {
    for (const name of ["sprout", "roll", "drop", "swing"] as const) {
      const { visible, transition } = resolve(name);
      const { times } = transition as { times: number[] };
      for (const value of Object.values(visible)) {
        expect(Array.isArray(value)).toBe(true);
        expect(value as unknown[]).toHaveLength(times.length);
      }
      expect(times[0]).toBe(0);
      expect(times.at(-1)).toBe(1);
      expect([...times]).toEqual([...times].sort((a, b) => a - b));
    }
  });
});

describe("the reduced-motion fallback (05 §5.9)", () => {
  it("gives every animated row an opacity-only form", () => {
    for (const name of ANIMATED_VARIANT_NAMES) {
      const { hidden, visible } = resolve(name, { index: 1, tail: "right" }, { reduced: true });
      expect(Object.keys(hidden)).toEqual(["opacity"]);
      expect(Object.keys(visible)).toEqual(["opacity"]);
      expect(hidden).toEqual({ opacity: 0 });
      expect(visible).toEqual({ opacity: 1 });
    }
  });

  it("keeps each row's own duration and drops the transform easings", () => {
    const expected: Record<VariantName, number | undefined> = {
      rise: SECONDS.rise,
      riseChild: SECONDS.rise,
      ink: SECONDS.ink,
      fade: SECONDS.visitFade,
      sprout: SECONDS.sprout,
      roll: SECONDS.roll,
      drop: SECONDS.drop,
      polaroid: SECONDS.polaroidFade,
      bubble: SECONDS.bubbleFade,
      swing: SECONDS.swing,
      swap: SECONDS.wordSwap,
      none: undefined,
    };

    for (const name of ANIMATED_VARIANT_NAMES) {
      const { transition } = resolve(name, {}, { reduced: true });
      expect(transition).toMatchObject({ duration: expected[name], ease: STD });
    }
  });

  it("keeps the locale cascade's delays rather than swapping instantly", () => {
    const { transition } = resolve("swap", { index: 5 }, { reduced: true });
    expect(delayOf(transition)).toBeCloseTo(5 * CASCADE_STEP, 10);
  });

  it("leaves fade untouched — it was already motion-free", () => {
    expect(resolve("fade", {}, { reduced: true })).toEqual(resolve("fade"));
  });
});

describe("the opaque escape hatch (05 §5.1)", () => {
  it("drops the opacity track so the LCP candidate is never at opacity 0", () => {
    const { hidden, visible, transition } = resolve("rise", {}, { opaque: true });
    expect(hidden).toEqual({ y: 26 });
    expect(visible).toEqual({ y: 0 });
    expect(transition).toEqual({ y: { duration: SECONDS.rise, ease: SOFT } });
  });
});

describe("the stagger container (05 §5.1, §5.3)", () => {
  it("sequences children 110 ms apart and never transforms itself", () => {
    expect(staggerContainerVariants(NO_DELAY)).toEqual({
      hidden: {},
      visible: { transition: { staggerChildren: STAGGER_CHILD, delayChildren: NO_DELAY } },
    });
  });

  it("passes the caller's delay through as delayChildren", () => {
    expect(staggerContainerVariants(A_CONTAINER_DELAY).visible).toEqual({
      transition: { staggerChildren: STAGGER_CHILD, delayChildren: A_CONTAINER_DELAY },
    });
  });
});

describe("the catalogue's shape (05 §5.1)", () => {
  it("gives every row hidden, visible, transition and reduced", () => {
    for (const name of VARIANT_NAMES) {
      const entry = revealVariants[name];
      expect(entry).toHaveProperty("hidden");
      expect(entry).toHaveProperty("visible");
      expect(entry).toHaveProperty("transition");
      expect(entry).toHaveProperty("reduced");
    }
  });
});
