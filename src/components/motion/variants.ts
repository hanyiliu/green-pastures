import type { TargetAndTransition, TransformTemplate, Transition, Variants } from "motion/react";

import { dur, ease, rise, stagger } from "@/design/tokens";

/**
 * The variant catalogue (05 `D-05.3`, §5.2).
 *
 * One named entry per design entrance, with the keyframes lifted verbatim from
 * the prototype (`docs/design/desktop/Green Pastures - Homepage.dc.html`,
 * `getFX` L600–613 and the `gp*` keyframes L19–27). **The table in 05 §5.2 is
 * the contract**: a variant that is not in it does not exist, and every value,
 * `times` array and transform origin below is that table read left to right.
 * `tests/unit/motion/variants.test.ts` asserts the catalogue row by row, so a
 * value drifts here only if the test drifts with it.
 *
 * The table has twelve rows; eleven of them carry values. The twelfth, `none`,
 * is 05's "no entrance" row — nav items use it so that they still take part in
 * the locale cascade (§5.6) — and its cells are all "—", so its entry is the
 * identity.
 *
 * Shape (05 §5.1): `variants[name] = { hidden, visible, transition, reduced }`,
 * dynamic by `custom` (index / side / tail). `transition` is a sibling of the
 * two targets rather than living inside `visible`, because `reduced` needs its
 * own; {@link revealMotionVariants} folds the pair into the `Variants` object
 * Motion actually consumes.
 *
 * ### Where the numbers come from
 *
 * INV-05.6: every duration, delay, easing, stagger and distance arrives by
 * importing `src/design/tokens.ts` — 03's TS mirror of `src/styles/tokens.css`
 * (03 §7, memo ADJ-8). Nothing below types a duration or a bezier. What this
 * file *does* own, and what makes it one of the two ESLint exempts from the
 * motion-value ban (08 §2, `gp/exempt-token-catalogue-motion`), is the
 * **geometry** of the entrances: the keyframe stops, their `times` and their
 * origins, which 03 explicitly does not restate ("the keyframe recipes
 * themselves … are owned by `05-animation-system.md`; 03 supplies only their
 * timing tokens").
 */

/**
 * The one filter in the whole system (INV-05.1's single exception): the
 * philosophy quote inks in from `blur(14px)`. 05 §5.2 owns the value; 03 mints
 * no token for it because nothing else blurs.
 */
const INK_BLUR_PX = 14;

/* -------------------------------------------------------------------------- *
 * Types
 * -------------------------------------------------------------------------- */

/** Which side a polaroid flies in from, and which side a bubble's tail is on. */
export type RevealSide = "left" | "right";

/**
 * The `custom` payload Motion threads into a dynamic variant. `RevealItem`
 * passes `index`, `side` and `tail` (05 §5.1); `Reveal` adds `riseDistance`,
 * which is the breakpoint-resolved travel for the `rise` entrance (§5.3: 26 px
 * on desktop, 18 px below `md`).
 */
export type RevealCustom = {
  readonly index?: number;
  readonly side?: RevealSide;
  readonly tail?: RevealSide;
  readonly riseDistance?: number;
};

/** A target that may depend on `custom`. */
type DynamicTarget = TargetAndTransition | ((custom: RevealCustom) => TargetAndTransition);

/** A transition that may depend on `custom` (only `swap`'s cascade delay does). */
type DynamicTransition = Transition | ((custom: RevealCustom) => Transition);

/** One direction of one entrance: where it starts, where it ends, how it gets there. */
export type VariantForm = {
  readonly hidden: DynamicTarget;
  readonly visible: DynamicTarget;
  readonly transition: DynamicTransition;
};

/** One row of 05 §5.2. */
export type VariantEntry = VariantForm & {
  /**
   * The `prefers-reduced-motion: reduce` fallback for this row (05 §5.9). Every
   * animated entrance reduces to **opacity only**: the keyframe transforms, the
   * blur and the scale are all dropped, and only the duration survives.
   */
  readonly reduced: VariantForm;
  /**
   * `transform-origin`, where 05 §5.2 names one. Applied as a static style
   * rather than an animated value — it never changes during the entrance.
   */
  readonly origin?: string | ((custom: RevealCustom) => string);
  /**
   * Only `swing` sets one: Motion composes `translate → scale → rotate`,
   * whereas `gpswing` is `rotate() translateY()`, so the 12 px lift is rotated
   * by 9° in the prototype and would not be here (05 §5.2).
   */
  readonly transformTemplate?: TransformTemplate;
};

/* -------------------------------------------------------------------------- *
 * Helpers used by the catalogue
 * -------------------------------------------------------------------------- */

/** The prototype's `210 + min(i × 14, 300) ms` cascade step, in seconds (05 §5.6). */
export function cascadeDelay(index: number): number {
  return Math.min(index * stagger.word, stagger.wordCap);
}

/**
 * Which side a polaroid flies in from: `side` when the caller states it,
 * otherwise index parity — "even index = left (−150 px, −10°), odd = right"
 * (05 §5.2, §5.3).
 */
function polaroidSide({ side, index = 0 }: RevealCustom): RevealSide {
  return side ?? (index % 2 === 0 ? "left" : "right");
}

/** `gpswing`'s transform order, restored (05 §5.2). */
const swingTransformTemplate: TransformTemplate = ({ rotate, y }, generated) =>
  rotate === undefined && y === undefined ? generated : `rotate(${rotate}) translateY(${y})`;

/** Every reduced form is this shape; only the transition differs. */
function opacityOnly(transition: DynamicTransition): VariantForm {
  return { hidden: { opacity: 0 }, visible: { opacity: 1 }, transition };
}

/* -------------------------------------------------------------------------- *
 * The catalogue — 05 §5.2, row by row
 * -------------------------------------------------------------------------- */

export const revealVariants = {
  /**
   * Section headers and blocks; the hero text column and the hero photo (the
   * hero is plain `rise`, not a special variant). `y` rides SOFT and `opacity`
   * rides std over the same 750 ms — the prototype's .7 s/.8 s pair, unified by
   * `--dur-rise`. Mobile travels 18 px instead of 26 (§5.3), which arrives as
   * `custom.riseDistance`.
   */
  rise: {
    hidden: ({ riseDistance = rise.base }) => ({ opacity: 0, y: riseDistance }),
    visible: { opacity: 1, y: 0 },
    transition: {
      y: { duration: dur.rise, ease: ease.soft },
      opacity: { duration: dur.rise, ease: ease.std },
    },
    reduced: opacityOnly({ duration: dur.rise, ease: ease.std }),
  },

  /** The default staggered child: sections without a bespoke variant, subpage lists. */
  riseChild: {
    hidden: { opacity: 0, y: rise.child },
    visible: { opacity: 1, y: 0 },
    transition: {
      y: { duration: dur.rise, ease: ease.soft },
      opacity: { duration: dur.rise, ease: ease.std },
    },
    reduced: opacityOnly({ duration: dur.rise, ease: ease.std }),
  },

  /**
   * The philosophy quote block and its badges "ink in". The `filter` track is
   * INV-05.1's single exception, and it is the one track Motion's own
   * `reducedMotion` gate does not cover — which is why `reduced` drops it here
   * rather than relying on the provider (05 §5.9 E2).
   */
  ink: {
    hidden: { opacity: 0, scale: 0.97, filter: `blur(${INK_BLUR_PX}px)` },
    visible: { opacity: 1, scale: 1, filter: "blur(0px)" },
    transition: {
      scale: { duration: dur.ink, ease: ease.soft },
      opacity: { duration: dur.ink, ease: ease.std },
      filter: { duration: dur.ink, ease: ease.std },
    },
    reduced: opacityOnly({ duration: dur.ink, ease: ease.std }),
  },

  /** Visit — the three blocks, one slow fade. Already motion-free, so `reduced` matches. */
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    transition: { duration: dur.visitFade, ease: ease.std },
    reduced: opacityOnly({ duration: dur.visitFade, ease: ease.std }),
  },

  /**
   * The programs stepping stones (`gpsprout`): `scale` and `scaleY` compose
   * multiplicatively, matching the prototype's `scale(1.05) scaleY(1.07)` stop,
   * and SPRING plays on each keyframe segment exactly as the CSS does.
   */
  sprout: {
    hidden: { opacity: 0, scale: 0.6, scaleY: 0.25 },
    visible: {
      opacity: [0, 1, 1, 1],
      scale: [0.6, 1.05, 0.985, 1],
      scaleY: [0.25, 1.07, 1, 1],
    },
    transition: { duration: dur.sprout, ease: ease.spring, times: [0, 0.6, 0.8, 1] },
    origin: "50% 100%",
    reduced: opacityOnly({ duration: dur.sprout, ease: ease.std }),
  },

  /** The menu plate rolling in (`gproll`, stagger child 0). */
  roll: {
    hidden: { opacity: 0, x: -90, rotate: -150 },
    visible: {
      opacity: [0, 1, 1],
      x: [-90, 10, 0],
      rotate: [-150, 8, 0],
    },
    transition: { duration: dur.roll, ease: ease.soft, times: [0, 0.6, 1] },
    origin: "50% 50%",
    reduced: opacityOnly({ duration: dur.roll, ease: ease.std }),
  },

  /** The menu day-chip row and sample line (`gpdrop`, children ≥ 1). */
  drop: {
    hidden: { opacity: 0, y: -34 },
    visible: {
      opacity: [0, 1, 1, 1],
      y: [-34, 7, -4, 0],
    },
    transition: { duration: dur.drop, ease: ease.std, times: [0, 0.55, 0.75, 1] },
    reduced: opacityOnly({ duration: dur.drop, ease: ease.std }),
  },

  /**
   * Gallery polaroids fly in from alternating sides. The entrance rotation is
   * separate from the resting ±2–6° tilt, which lives on the inner frame
   * (`D-05.12`), so the origin is the plain centre.
   */
  polaroid: {
    hidden: (custom) => {
      const left = polaroidSide(custom) === "left";
      return { opacity: 0, x: left ? -150 : 150, rotate: left ? -10 : 10, scale: 0.9 };
    },
    visible: { opacity: 1, x: 0, rotate: 0, scale: 1 },
    transition: {
      x: { duration: dur.polaroid, ease: ease.spring },
      rotate: { duration: dur.polaroid, ease: ease.spring },
      scale: { duration: dur.polaroid, ease: ease.spring },
      opacity: { duration: dur.polaroidFade, ease: ease.std },
    },
    origin: "50% 50%",
    reduced: opacityOnly({ duration: dur.polaroidFade, ease: ease.std }),
  },

  /** Reviews speech bubbles inflate from the tail — the only "pop" in the system. */
  bubble: {
    hidden: { opacity: 0, scale: 0.3 },
    visible: { opacity: 1, scale: 1 },
    transition: {
      scale: { duration: dur.bubble, ease: ease.spring },
      opacity: { duration: dur.bubbleFade, ease: ease.std },
    },
    origin: ({ tail }) => (tail === "right" ? "88% 100%" : "12% 100%"),
    reduced: opacityOnly({ duration: dur.bubbleFade, ease: ease.std }),
  },

  /** Teacher frames swing and settle (`gpswing`), hung from the top edge. */
  swing: {
    hidden: { opacity: 0, rotate: -9, y: -12 },
    visible: {
      opacity: [0, 1, 1, 1, 1],
      rotate: [-9, 5, -2.5, 1, 0],
      y: [-12, 0, 0, 0, 0],
    },
    transition: { duration: dur.swing, ease: ease.std, times: [0, 0.35, 0.6, 0.8, 1] },
    origin: "50% 0%",
    transformTemplate: swingTransformTemplate,
    reduced: opacityOnly({ duration: dur.swing, ease: ease.std }),
  },

  /**
   * The locale cascade (§5.6) and `WordSwap`'s enter. The delay is the mount
   * order, not a stagger container: `min(i × 14 ms, 300 ms)`. Under reduced
   * motion the cascade keeps its delays and drops the `y` track — an
   * opacity-only cascade, never a no-cascade instant swap (`D-05.9`).
   */
  swap: {
    hidden: { opacity: 0, y: rise.swap },
    visible: { opacity: 1, y: 0 },
    transition: ({ index = 0 }) => ({
      duration: dur.wordSwap,
      ease: ease.std,
      delay: cascadeDelay(index),
    }),
    reduced: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      transition: ({ index = 0 }) => ({
        duration: dur.wordSwap,
        ease: ease.std,
        delay: cascadeDelay(index),
      }),
    },
  },

  /**
   * Nav items. No entrance of its own — the row is all "—" — but a `Reveal`
   * still wraps them so they join the locale cascade (05 §5.1, §5.6).
   */
  none: {
    hidden: {},
    visible: {},
    transition: {},
    reduced: { hidden: {}, visible: {}, transition: {} },
  },
} satisfies Record<string, VariantEntry>;

/** Every name in 05 §5.2, including the "no entrance" row. */
export type VariantName = keyof typeof revealVariants;

/** The twelve rows of 05 §5.2, in the table's order. */
export const VARIANT_NAMES = Object.keys(revealVariants) as readonly VariantName[];

/**
 * The eleven rows that carry values. `none` is excluded because its cells are
 * all "—"; nothing about it can drift.
 */
export const ANIMATED_VARIANT_NAMES: readonly VariantName[] = VARIANT_NAMES.filter(
  (name) => name !== "none",
);

/* -------------------------------------------------------------------------- *
 * Building what Motion consumes
 * -------------------------------------------------------------------------- */

/**
 * {@link revealVariants} is declared with `satisfies` so that its keys stay
 * literal and the values keep their exact types — which also means a row that
 * names no `origin` has no `origin` property to read. This widened view is how
 * the accessors below ask a row a question every row can answer.
 */
const catalogue: Readonly<Record<VariantName, VariantEntry>> = revealVariants;

function resolveTarget(target: DynamicTarget, custom: RevealCustom): TargetAndTransition {
  return typeof target === "function" ? target(custom) : target;
}

function resolveTransition(transition: DynamicTransition, custom: RevealCustom): Transition {
  return typeof transition === "function" ? transition(custom) : transition;
}

/**
 * Strip the `opacity` track from a target or a per-property transition.
 *
 * This is the `opaque` prop (05 §5.1): the hero photo is the LCP candidate, so
 * it rises without ever sitting at opacity 0 (INV-05.7, OQ-05.8).
 */
function withoutOpacity<T extends object>(value: T): T {
  const copy = { ...value } as unknown as Record<string, unknown>;
  delete copy.opacity;
  return copy as T;
}

export type RevealVariantOptions = {
  /** Use the row's `reduced` form (05 §5.9). */
  readonly reduced?: boolean;
  /** Drop the opacity track — the hero photo only (05 §5.1 `opaque`). */
  readonly opaque?: boolean;
};

/**
 * Fold one catalogue row into the `Variants` object `m.*` takes, keeping both
 * states dynamic so Motion can thread `custom` through per element.
 */
export function revealMotionVariants(
  name: VariantName,
  { reduced = false, opaque = false }: RevealVariantOptions = {},
): Variants {
  const entry = catalogue[name];
  const form: VariantForm = reduced ? entry.reduced : entry;

  return {
    hidden: (custom: RevealCustom = {}) => {
      const target = resolveTarget(form.hidden, custom);
      return opaque ? withoutOpacity(target) : target;
    },
    visible: (custom: RevealCustom = {}) => {
      const target = resolveTarget(form.visible, custom);
      const transition = resolveTransition(form.transition, custom);
      return {
        ...(opaque ? withoutOpacity(target) : target),
        transition: opaque ? withoutOpacity(transition) : transition,
      };
    },
  };
}

/**
 * The container variants of a stagger group (05 §5.1): the container itself is
 * never transformed (INV-05.4), it only sequences its `RevealItem` children
 * 110 ms apart.
 */
export function staggerContainerVariants(delayChildren: number): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: stagger.child, delayChildren } },
  };
}

/** The `transform-origin` 05 §5.2 gives this row, or `undefined` where it gives none. */
export function transformOriginFor(
  name: VariantName,
  custom: RevealCustom = {},
): string | undefined {
  const { origin } = catalogue[name];
  if (origin === undefined) return undefined;
  return typeof origin === "function" ? origin(custom) : origin;
}

/** `swing`'s transform-order fix, or `undefined` for every other row. */
export function transformTemplateFor(name: VariantName): TransformTemplate | undefined {
  return catalogue[name].transformTemplate;
}
