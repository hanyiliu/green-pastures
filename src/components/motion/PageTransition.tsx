import { ViewTransition } from "react";
import type { ReactNode } from "react";

import "./view-transitions.css";

/**
 * The subpage slide (05 §5.7, `D-05.10`; spike verdict `OQ-05.2`).
 *
 * Every `page.tsx` — the home page and the six detail pages — wraps its content
 * in this component. It is a Server Component on purpose: React's
 * `ViewTransition` is exported by the `react-server` build too, so the whole
 * mechanism costs the client bundle nothing. There is no `"use client"` here and
 * there should never be one.
 *
 * **Put it in `page.tsx`, never in a layout.** A layout persists across a
 * navigation, so its subtree neither enters nor exits and the props below would
 * never fire. Two sibling pages each wrapping themselves is what gives React an
 * exit on one side and an enter on the other.
 *
 * **The child should be a single element** — in practice the page's `<main>`.
 * React snapshots what it finds; a fragment of siblings gives the browser
 * several boxes to name and the slide stops meaning anything.
 *
 * ── What the props say ───────────────────────────────────────────────────
 *
 * `enter` and `exit` are maps from *transition type* to *view-transition-class*.
 * A navigation carries its types from the link or the router call that started
 * it — `Link transitionTypes={['subpage-enter']}` (already emitted by
 * `LearnMoreLink`) and `router.replace(…, { transitionTypes: ['subpage-exit'] })`
 * for "← Back". Only those two names map to `gp-page`, which
 * `view-transitions.css` animates; everything else — browser Back/Forward, the
 * nav links, a refresh, a Suspense reveal — falls to `default: "none"` and the
 * page does not participate in the transition at all. The bare `default="none"`
 * covers the remaining phases (`share`, `update`) for the same reason.
 *
 * That is the whole reason the mapping is spelled out three times rather than
 * left to `"auto"`: an unqualified `ViewTransition` animates on *every*
 * transition on the page, and the design asks for motion on exactly two.
 */

export type PageTransitionProps = {
  /** The page's content — a single element, normally the `<main>` landmark. */
  readonly children: ReactNode;
};

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <ViewTransition
      default="none"
      enter={{ "subpage-enter": "gp-page", default: "none" }}
      exit={{ "subpage-exit": "gp-page", default: "none" }}
    >
      {children}
    </ViewTransition>
  );
}
