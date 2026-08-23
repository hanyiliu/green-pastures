/**
 * The session reveal registry (05 `D-05.6`, §5.1, §5.6).
 *
 * Module scope is the whole point: a client navigation (a subpage and back, a
 * locale switch) re-mounts the `[locale]` subtree but never re-evaluates this
 * module, so a `Reveal` that has already played finds its id here and renders
 * its final state instead of animating again. A full page load is a fresh
 * module instance, which is exactly the "once per session" the design asks for.
 *
 * Three pieces of state live here, all of them plain module values rather than
 * React state, because they must outlive every component tree in the session:
 *
 * 1. {@link revealedIds} — the set of `Reveal` ids that have entered the
 *    viewport at least once (05 §5.3: "the container registers its `id` on the
 *    first `visible`").
 * 2. The locale-swap mark — a timestamp written by `LangSwitcher` immediately
 *    before it navigates (04 `D-04.16`, 05 §5.6), read by every `Reveal` that
 *    mounts inside the following {@link LOCALE_SWAP_WINDOW_MS}.
 * 3. The cascade order — the mount-order counter that turns into the
 *    `min(i × 14 ms, 300 ms)` delay of the `swap` variant.
 *
 * Nothing here imports React, so the module is safe to pull into a server
 * component's import graph; only the client components actually call it.
 */

/**
 * How long after {@link markLocaleSwap} a mounting `Reveal` still counts as
 * part of the locale cascade (05 §5.6: "Every `Reveal` that mounts within
 * 1000 ms of the mark plays `swap`").
 *
 * This is not a design token: 03 §7 mints no custom property for it, and it is
 * a staleness guard rather than a duration anything animates over — if the
 * navigation is slow enough to miss the window, the new tree simply renders its
 * final state, which is the pre-cascade behaviour.
 */
export const LOCALE_SWAP_WINDOW_MS = 1000;

/**
 * The ids of every `Reveal` that has played in this session. Exported as the
 * live `Set` because 05 §5.1 names it (`registry.revealedIds`); prefer
 * {@link hasRevealed} / {@link markRevealed} at call sites so the read and the
 * write stay symmetrical.
 */
export const revealedIds = new Set<string>();

/** When `LangSwitcher` last marked a locale swap, or `null` if it never has. */
let localeSwapAt: number | null = null;

/** Mount order within the current cascade, keyed by reveal id. */
const cascadeOrder = new Map<string, number>();

/** Has this reveal id already played in this session? */
export function hasRevealed(id: string): boolean {
  return revealedIds.has(id);
}

/** Record that a reveal has played. Called once, on the first `visible`. */
export function markRevealed(id: string): void {
  revealedIds.add(id);
}

/**
 * Called by `LangSwitcher` before `router.replace(…)` (04 `D-04.16`, 06
 * `D-06.9`). The mark opens the cascade window and resets the mount-order
 * counter so the next tree's first `Reveal` is index 0.
 */
export function markLocaleSwap(): void {
  localeSwapAt = Date.now();
  cascadeOrder.clear();
}

/**
 * Is a locale cascade in progress? True only inside
 * {@link LOCALE_SWAP_WINDOW_MS} of the mark.
 */
export function isLocaleSwapping(): boolean {
  return localeSwapAt !== null && Date.now() - localeSwapAt < LOCALE_SWAP_WINDOW_MS;
}

/**
 * The cascade position of one reveal id — 0 for the first `Reveal` to ask,
 * 1 for the next, and so on, which is mount order and therefore DOM order (nav
 * items first, then the hero, then the rest — 05 §5.6).
 *
 * The answer is memoised per id for the life of the cascade so that React's
 * StrictMode double-render, or any re-render inside the window, cannot shuffle
 * an element's delay.
 */
export function cascadeIndexFor(id: string): number {
  const existing = cascadeOrder.get(id);
  if (existing !== undefined) return existing;

  const index = cascadeOrder.size;
  cascadeOrder.set(id, index);
  return index;
}

/**
 * Wipe every piece of session state.
 *
 * A full page load gives this for free, so production never calls it; it exists
 * because a unit test needs one session per test case (08 §4).
 */
export function resetRevealRegistry(): void {
  revealedIds.clear();
  cascadeOrder.clear();
  localeSwapAt = null;
}
