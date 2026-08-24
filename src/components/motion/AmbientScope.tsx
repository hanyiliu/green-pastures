"use client";

import { useEffect, useRef } from "react";

/**
 * The off-screen half of `D-05.7` (04 §3.3; 05 §5.4; INV-05.9).
 *
 * `ambient.css` §3 has always carried `[data-ambient="paused"] .loop
 * { animation-play-state: paused }`. This is the thing that sets the attribute
 * — the single observer 05 §5.4 asks for, "one per looping section", which 04
 * §3.3 places in `components/motion/` and describes as rendering nothing
 * visible. Until it existed the rule was inert and no loop had ever stopped.
 *
 * ── Which element ────────────────────────────────────────────────────────
 *
 * The attribute belongs on the **section**, because the rule is a descendant
 * combinator and the design pauses a section's decorations together — never
 * the page's. `Section` (04 `D-04.3`) is the only thing that writes
 * `data-section`, so the nearest `[data-section]` ancestor is the scope, and
 * a `AmbientScope` dropped into a section's `decor` needs no id, no prop and
 * no agreement with its parent about a name that could drift.
 *
 * Reaching for it needs a node of our own, which is what the hidden `span` is:
 * `display: none`, no box, no content, nothing for a screen reader. The
 * observer never watches the span — a zero-size marker crosses the viewport
 * edge at a different moment than the section does — it watches what `closest`
 * returns.
 *
 * ── Why not `useInView` ──────────────────────────────────────────────────
 *
 * 04 §3.3 and 05 §5.4 both spell this "one `useInView`", and the count it is
 * really making is INV-05.9's: **one** `IntersectionObserver` beyond the
 * frozen `Reveal` pool. Motion's hook takes a ref to an element React
 * rendered, and the element that has to carry the attribute is a `<section>`
 * rendered by a *server* component several layers up; priming a ref for it
 * from a layout effect would work only for as long as `useInView` keeps
 * reading `ref.current` from a passive effect. A plain observer is the same
 * one observer, with the contract in this file instead of in Motion's
 * internals — the reading `Turnstile` already takes for its own viewport
 * trigger. `src/components/motion/**` is the tree 08 §2 excuses from the
 * observer/scroll-listener ban for exactly this.
 *
 * ── Failing open ─────────────────────────────────────────────────────────
 *
 * Two directions are not symmetric, which `ambient.css` states in its own
 * words: "an unpaused loop is a wasted frame, a paused-but-never-resumed one
 * is a bug". So the attribute is absent until the observer says otherwise
 * (a section is running before its first callback, not paused), a scope this
 * component cannot find is left alone rather than paused, and the cleanup
 * removes the attribute — a scope that outlives the component, which is what
 * 04 §3.3's "`PhilosophySection` on mobile" is, must not be left frozen.
 */

/** The hook `ambient.css` §3 answers to. */
const AMBIENT_ATTRIBUTE = "data-ambient";
const PAUSED = "paused";

/** The section shell, and the only thing that writes it (04 `D-04.3`). */
const SCOPE_SELECTOR = "[data-section]";

export function AmbientScope() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scope = marker.current?.closest<HTMLElement>(SCOPE_SELECTOR) ?? null;
    if (scope === null) return undefined;
    if (typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver((entries) => {
      /*
       * The last record, not `some(…)`: one callback can carry several
       * records for the same target, and only the newest is the current
       * state. `some` would read an in-view record from earlier in the batch
       * as "still on screen" and leave a departed section running.
       */
      const latest = entries.at(-1);
      if (latest === undefined) return;

      if (latest.isIntersecting) scope.removeAttribute(AMBIENT_ATTRIBUTE);
      else scope.setAttribute(AMBIENT_ATTRIBUTE, PAUSED);
    });

    observer.observe(scope);

    return () => {
      observer.disconnect();
      scope.removeAttribute(AMBIENT_ATTRIBUTE);
    };
  }, []);

  return <span hidden ref={marker} />;
}
