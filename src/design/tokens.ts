/**
 * The TypeScript mirror of the motion tokens (03 `D-03.3`, §7, INV-03.4; memo
 * ADJ-8 fixes this path).
 *
 * `src/styles/tokens.css` is the declaration of record. This module restates
 * **nothing**: every value below is the same token in the units Motion takes —
 * seconds instead of `ms`/`s`, bezier arrays instead of `cubic-bezier()`
 * strings, px numbers instead of `px` strings, px numbers instead of `rem` for
 * the two breakpoints. It is the only place Motion code reads a number
 * (05 §5.1, INV-05.6), so a component never sees a literal and the two sides
 * can only disagree in one file.
 *
 * INV-03.4: motion values exist in exactly two places, `src/styles/tokens.css`
 * and here, and a test asserts the pair agrees — with one exception,
 * {@link REVEAL_THRESHOLD}, which has no CSS twin because nothing in CSS can
 * read an IntersectionObserver threshold.
 *
 * The mapping, token by token:
 *
 * | CSS (`src/styles/tokens.css`) | here |
 * |---|---|
 * | `--ease-soft\|spring\|std\|out-cubic` | {@link ease}`.soft\|spring\|std\|outCubic` |
 * | `--dur-*` | {@link dur}`.*`, ÷ 1000 where the CSS is `ms` |
 * | `--stagger-child\|word\|word-cap` | {@link stagger}`.child\|word\|wordCap` |
 * | `--reveal-rise\|-sm\|-child`, `--swap-rise` | {@link rise}`.base\|sm\|child\|swap` |
 * | *(none — JS only)* | {@link REVEAL_THRESHOLD} |
 * | `--breakpoint-md\|-lg` | {@link breakpoints}`.md\|lg`, rem × 16 |
 *
 * Adding a motion token is two edits: the custom property in `tokens.css` and
 * the field here. 03 owns both names; nothing here is 05's to choose.
 */

/**
 * The four easings. `std` is the CSS `ease` keyword spelled out, `outCubic` is
 * the count-up's `1 − (1 − p)³` (03 §7).
 *
 * Motion's `BezierDefinition` is a `readonly` 4-tuple, so `as const` is exactly
 * the type it wants.
 */
export const ease = {
  soft: [0.2, 0.8, 0.25, 1],
  spring: [0.34, 1.56, 0.5, 1],
  std: [0.25, 0.1, 0.25, 1],
  outCubic: [0.33, 1, 0.68, 1],
} as const;

/** Every `--dur-*`, in **seconds** — Motion's unit, not the CSS one (03 §7). */
export const dur = {
  rise: 0.75,
  ink: 0.95,
  polaroid: 0.8,
  polaroidFade: 0.5,
  visitFade: 1.1,
  subpage: 0.5,
  wordSwap: 0.2,
  sprout: 0.9,
  roll: 0.85,
  drop: 0.7,
  swing: 1,
  bubble: 0.65,
  bubbleFade: 0.45,
  leaf: 8,
  leafFast: 7,
  leafSlow: 9,
  sun: 9,
  cue: 2,
  countup: 1,
} as const;

/** Every `--stagger-*`, in seconds: the per-child step and the locale cascade's. */
export const stagger = {
  child: 0.11,
  word: 0.014,
  wordCap: 0.3,
} as const;

/**
 * Reveal travel distances in px: `--reveal-rise` (26), `--reveal-rise-sm` (18,
 * below `md`), `--reveal-rise-child` (22) and `--swap-rise` (6).
 */
export const rise = {
  base: 26,
  sm: 18,
  child: 22,
  swap: 6,
} as const;

/**
 * `--reveal-threshold` — the "~16% threshold" of the design, and the one motion
 * value with no CSS twin (03 §7, `D-03.3`). Every production `Reveal` passes
 * exactly this as `viewport.amount`, which is what makes them share a single
 * pooled IntersectionObserver (INV-05.9).
 */
export const REVEAL_THRESHOLD = 0.16;

/**
 * `--breakpoint-md: 48rem` and `--breakpoint-lg: 64rem` as px, for the media
 * queries JS has to ask about — 05 §5.3's mobile reveal distance is the only
 * one at launch. `--breakpoint-xl` has no JS consumer and is not mirrored.
 */
export const breakpoints = {
  md: 768,
  lg: 1024,
} as const;
