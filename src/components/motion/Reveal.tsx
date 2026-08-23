"use client";

import { useReducedMotionConfig, type HTMLMotionProps } from "motion/react";
import * as m from "motion/react-m";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";

import { breakpoints, REVEAL_THRESHOLD, rise } from "@/design/tokens";

import {
  cascadeIndexFor,
  hasRevealed,
  isLocaleSwapping,
  markRevealed,
} from "@/components/motion/registry";
import {
  revealMotionVariants,
  staggerContainerVariants,
  transformOriginFor,
  transformTemplateFor,
  type RevealCustom,
  type RevealSide,
  type VariantName,
} from "@/components/motion/variants";

/**
 * The one entrance primitive (05 `D-05.2`, §5.1).
 *
 * `Reveal` is a thin client wrapper around server-rendered children: sections
 * stay server components, and the only things crossing the boundary are strings
 * and numbers — a variant name, an index, an id (05 §5.1, 04 `D-04.2`). No
 * section ever calls Motion directly and no section ships a one-off CSS
 * entrance.
 *
 * Four behaviours are worth knowing before reading the code.
 *
 * **One observer for the page (INV-05.9).** Motion pools IntersectionObservers
 * by their serialised options, so every production `Reveal` passing the same
 * frozen `{ once: true, amount: 0.16, margin: "0px" }` shares a single one. The
 * `once` / `amount` / `margin` props exist for tests; varying them in
 * production splits the pool and is the thing the perf test catches.
 *
 * **Once per session (`D-05.6`).** The first time a `Reveal` enters the
 * viewport it writes its `id` into the module-scope registry. A client
 * navigation — a subpage and back, a locale switch — re-mounts the tree but not
 * the module, so the second mount finds the id and renders the final state with
 * `initial={false}`: no hidden state, no observer, no replay.
 *
 * **Reduced motion (§5.9).** `MotionConfig reducedMotion` already turns
 * transform animations into instant jumps, but it leaves `filter` animating
 * (the `ink` blur) and leaves the *hidden* transform on the element. So the
 * component swaps in the catalogue's `reduced` form instead, which is
 * opacity-only by construction. The swap is deferred by one render during
 * hydration ({@link useIsHydrated}) because the server cannot know the user's
 * media query, and a first client render that disagreed with the server would
 * be a hydration mismatch; `MotionProvider`'s reduced-motion stylesheet covers
 * that one frame.
 *
 * **The locale cascade (§5.6).** The language switcher marks the registry
 * immediately before it navigates. Every already-revealed `Reveal` that mounts
 * inside the window plays `swap` — opacity 0→1, y 6→0, 200 ms, delayed by its
 * mount order — instead of rendering its final state. Reveals that had never
 * played still wait for the scroll, with their own variant.
 */

/* -------------------------------------------------------------------------- *
 * Elements
 * -------------------------------------------------------------------------- */

/**
 * The elements a `Reveal` may render as (05 §5.1). The list is closed so that
 * semantics survive the wrapper: a list of polaroids is `ul` / `li`, a figure
 * is a `figure`, and nothing becomes a `div` by accident.
 */
export type RevealAs = "div" | "section" | "ul" | "li" | "figure" | "p" | "span" | "h2" | "h3";

/**
 * Every `m.*` element is the same component with a different element type, and
 * the props this file passes are the element-agnostic subset (`variants`,
 * `initial`, `animate`, `whileInView`, `custom`, `style`, `className`,
 * `children`). One narrowing keeps the call sites readable; the `satisfies`
 * clause is what still fails the build if a name in {@link RevealAs} has no
 * entry here.
 */
type MotionElement = ComponentType<HTMLMotionProps<"div">>;

const REVEAL_ELEMENTS = {
  div: m.div,
  section: m.section,
  ul: m.ul,
  li: m.li,
  figure: m.figure,
  p: m.p,
  span: m.span,
  h2: m.h2,
  h3: m.h3,
} satisfies Record<RevealAs, unknown> as unknown as Readonly<Record<RevealAs, MotionElement>>;

/* -------------------------------------------------------------------------- *
 * Hooks
 * -------------------------------------------------------------------------- */

const neverChanges = () => () => undefined;
const alwaysTrue = () => true;
const alwaysFalse = () => false;

/**
 * `false` on the server and for the single render that hydrates it, `true`
 * afterwards. The standard `useSyncExternalStore` shape: React takes the server
 * snapshot while hydrating, so the markup matches, then re-renders once.
 */
function useIsHydrated(): boolean {
  return useSyncExternalStore(neverChanges, alwaysTrue, alwaysFalse);
}

/**
 * The `rise` entrance travels 26 px on desktop and 18 px below `md` (05 §5.3;
 * 03 §7's `--reveal-rise` / `--reveal-rise-sm`). That is a media query, so it
 * is read here rather than branched on a viewport measurement.
 *
 * One `MediaQueryList` and one `change` listener serve every `Reveal` on the
 * page; the hook only fans the notification out. The server snapshot is the
 * desktop distance, so hydration matches whatever the server rendered and a
 * narrow viewport corrects itself on the next render — before any entrance has
 * had a chance to play.
 */
const DESKTOP_MEDIA_QUERY = `(min-width: ${String(breakpoints.md)}px)`;

const breakpointSubscribers = new Set<() => void>();
let breakpointQuery: MediaQueryList | null | undefined;

function desktopMediaQuery(): MediaQueryList | null {
  if (breakpointQuery === undefined) {
    breakpointQuery =
      typeof window === "undefined" || typeof window.matchMedia !== "function"
        ? null
        : window.matchMedia(DESKTOP_MEDIA_QUERY);
    breakpointQuery?.addEventListener("change", () => {
      for (const notify of breakpointSubscribers) notify();
    });
  }
  return breakpointQuery;
}

function subscribeToBreakpoint(onStoreChange: () => void): () => void {
  desktopMediaQuery();
  breakpointSubscribers.add(onStoreChange);
  return () => {
    breakpointSubscribers.delete(onStoreChange);
  };
}

function readRiseDistance(): number {
  const query = desktopMediaQuery();
  return query === null || query.matches ? rise.base : rise.sm;
}

function readServerRiseDistance(): number {
  return rise.base;
}

function useRiseDistance(): number {
  return useSyncExternalStore(subscribeToBreakpoint, readRiseDistance, readServerRiseDistance);
}

/**
 * Whether this render should use the catalogue's `reduced` form. Combines the
 * user's media query with `MotionConfig`'s override, so
 * `MotionProvider reducedMotion="always"` flips it for a test the same way the
 * OS setting does for a person (05 §5.9).
 */
function useReducedForm(): boolean {
  const prefersReduced = useReducedMotionConfig();
  const isHydrated = useIsHydrated();
  return prefersReduced === true && isHydrated;
}

/* -------------------------------------------------------------------------- *
 * Context
 * -------------------------------------------------------------------------- */

type RevealContextValue = {
  /** Has this `Reveal` played yet? Drives {@link useRevealed}. */
  readonly revealed: boolean;
  /** Was it already played when it mounted? Drives `RevealItem`'s `initial`. */
  readonly revealedAtMount: boolean;
};

const RevealContext = createContext<RevealContextValue>({
  revealed: true,
  revealedAtMount: true,
});

/**
 * Has the enclosing `Reveal` played? This is how reveal-dependent behaviour —
 * `CountUp` at launch — hears about the entrance, instead of a callback prop
 * crossing the server/client boundary (05 §5.1).
 *
 * Outside a `Reveal` it answers `true`: nothing is waiting on an entrance that
 * does not exist.
 */
export function useRevealed(): boolean {
  return useContext(RevealContext).revealed;
}

/* -------------------------------------------------------------------------- *
 * Reveal
 * -------------------------------------------------------------------------- */

export type RevealProps = {
  /**
   * The registry key, `"<section>.<slot>"` (e.g. `programs.header`). Required:
   * production `Reveal`s are always `once`, and `once` without an id would
   * replay on every client navigation (05 §5.1, `D-05.6`).
   */
  readonly id: string;
  readonly children: ReactNode;
  /** A catalogue entry (05 §5.2). `"none"` is no entrance at all. */
  readonly variant?: VariantName;
  /**
   * The children are `RevealItem`s and this element only sequences them,
   * 110 ms apart in DOM order. A stagger container is never itself transformed
   * (INV-05.4), so its own `variant` is ignored.
   */
  readonly stagger?: boolean;
  /** Seconds. `delayChildren` on a stagger container, `delay` otherwise. */
  readonly delay?: number;
  /** Test-only override. Production is always `true` (INV-05.9). */
  readonly once?: boolean;
  /** Test-only override. Production is always `REVEAL_THRESHOLD` (INV-05.9). */
  readonly amount?: number | "some" | "all";
  /** Test-only override. Production is always `"0px"` (INV-05.9). */
  readonly margin?: string;
  readonly as?: RevealAs;
  /**
   * Drop the opacity track and rise on transform alone. The hero photo only:
   * it is the LCP candidate and must never sit at opacity 0 (05 §5.1, §5.3's
   * labelled deviation, OQ-05.8).
   */
  readonly opaque?: boolean;
  readonly className?: string;
};

export function Reveal({
  id,
  children,
  variant = "rise",
  stagger = false,
  delay,
  once = true,
  amount = REVEAL_THRESHOLD,
  margin = "0px",
  as = "div",
  opaque = false,
  className,
}: RevealProps) {
  const reduced = useReducedForm();
  const riseDistance = useRiseDistance();

  /**
   * Everything decided once, at mount, from module state: whether this id has
   * already played, and — if it has, and a locale switch is in flight — where
   * it sits in the cascade. `cascadeIndexFor` memoises per id, so a StrictMode
   * double render cannot shuffle the delays.
   */
  const [mounted] = useState(() => {
    const revealedAtMount = hasRevealed(id) || variant === "none";
    const cascadeIndex = revealedAtMount && isLocaleSwapping() ? cascadeIndexFor(id) : null;
    return { revealedAtMount, cascadeIndex };
  });

  const [revealed, setRevealed] = useState(mounted.revealedAtMount);

  useEffect(() => {
    if (mounted.revealedAtMount) markRevealed(id);
  }, [id, mounted.revealedAtMount]);

  const onViewportEnter = useCallback(() => {
    markRevealed(id);
    setRevealed(true);
  }, [id]);

  const viewport = useMemo(() => ({ once, amount, margin }), [once, amount, margin]);

  const context = useMemo<RevealContextValue>(
    () => ({ revealed, revealedAtMount: mounted.revealedAtMount }),
    [revealed, mounted.revealedAtMount],
  );

  const cascading = mounted.cascadeIndex !== null;
  const activeVariant: VariantName = cascading ? "swap" : variant;

  const custom = useMemo<RevealCustom>(
    () => ({ index: mounted.cascadeIndex ?? undefined, riseDistance }),
    [mounted.cascadeIndex, riseDistance],
  );

  const variants = useMemo(
    () =>
      stagger
        ? staggerContainerVariants(delay ?? 0)
        : revealMotionVariants(activeVariant, { reduced, opaque }),
    [stagger, delay, activeVariant, reduced, opaque],
  );

  const style = useMemo<CSSProperties | undefined>(() => {
    if (stagger || reduced) return undefined;
    const transformOrigin = transformOriginFor(activeVariant, custom);
    return transformOrigin === undefined ? undefined : { transformOrigin };
  }, [stagger, reduced, activeVariant, custom]);

  const Element = REVEAL_ELEMENTS[as];

  /**
   * Three ways to render, and only the third observes anything.
   *
   * - **Cascading**: an enter-only `swap`, played immediately with the mount
   *   order as its delay. No viewport, because the element is already where the
   *   reader left it (05 §5.6).
   * - **Already revealed**: `initial={false}` renders the final state with no
   *   animation and no observer — the reveal-once guarantee across a client
   *   navigation (`D-05.6`).
   * - **Fresh**: the hidden state, and `whileInView` on the frozen viewport
   *   options every other fresh `Reveal` also passes (INV-05.9).
   */
  const entrance = cascading
    ? { initial: "hidden", animate: "visible" }
    : mounted.revealedAtMount
      ? { initial: false as const, animate: "visible" }
      : { initial: "hidden", whileInView: "visible", viewport, onViewportEnter };

  return (
    <RevealContext.Provider value={context}>
      <Element
        data-reveal=""
        data-reveal-id={id}
        className={className}
        style={style}
        variants={variants}
        custom={custom}
        transformTemplate={stagger ? undefined : transformTemplateFor(activeVariant)}
        {...entrance}
      >
        {children}
      </Element>
    </RevealContext.Provider>
  );
}

/* -------------------------------------------------------------------------- *
 * RevealItem
 * -------------------------------------------------------------------------- */

export type RevealItemProps = {
  /** Required: an item always names its entrance (05 §5.1). */
  readonly variant: VariantName;
  readonly children: ReactNode;
  /** DOM position within the stagger group; drives polaroid alternation. */
  readonly index?: number;
  /** Which side a polaroid flies in from, when parity is not the rule. */
  readonly side?: RevealSide;
  /** Which side a review bubble's tail is on; picks its transform origin. */
  readonly tail?: RevealSide;
  readonly as?: RevealAs;
  readonly className?: string;
};

/**
 * One staggered child of a `Reveal` container.
 *
 * It carries no viewport of its own — Motion's variant propagation drives it
 * from the parent, which is what keeps the page down to one observer
 * (INV-05.9) — and no id, because the cascade and the registry work on the
 * block, not on its parts (05 §5.6).
 *
 * **Why `initial` is left undefined on a fresh item.** Motion decides whether an
 * element belongs to its parent's variant tree by looking for a *variant label*
 * — a string — in any of `initial`, `animate`, `whileInView`, `while*`, `exit`
 * (`isControllingVariants`). An element that names one is taken to drive its own
 * variants, so `VisualElement.mount` skips `parent.addVariantChild(this)`; the
 * container's `variantChildren` stays empty and `animateVariant`'s
 * `getChildAnimations` degrades to a no-op. A `RevealItem` that spelled its
 * hidden state as `initial="hidden"` would therefore never be sequenced by the
 * container and — having no `animate` of its own — would sit at `opacity: 0`
 * forever. Leaving `initial` undefined lets the item *inherit* `"hidden"` from
 * the container through Motion's context, which renders the identical hidden
 * markup on the server (INV-05.7) while keeping the item in the variant tree.
 *
 * `false` is not a variant label, so the already-revealed branch keeps its
 * explicit `initial={false}` — final state, no animation (`D-05.6`).
 */
export function RevealItem({
  variant,
  children,
  index = 0,
  side,
  tail,
  as = "div",
  className,
}: RevealItemProps) {
  const reduced = useReducedForm();
  const riseDistance = useRiseDistance();
  const { revealedAtMount } = useContext(RevealContext);

  const custom = useMemo<RevealCustom>(
    () => ({ index, side, tail, riseDistance }),
    [index, side, tail, riseDistance],
  );

  const variants = useMemo(() => revealMotionVariants(variant, { reduced }), [variant, reduced]);

  const style = useMemo<CSSProperties | undefined>(() => {
    if (reduced) return undefined;
    const transformOrigin = transformOriginFor(variant, custom);
    return transformOrigin === undefined ? undefined : { transformOrigin };
  }, [reduced, variant, custom]);

  const Element = REVEAL_ELEMENTS[as];

  return (
    <Element
      data-reveal=""
      className={className}
      style={style}
      variants={variants}
      custom={custom}
      transformTemplate={transformTemplateFor(variant)}
      initial={revealedAtMount ? false : undefined}
    >
      {children}
    </Element>
  );
}
