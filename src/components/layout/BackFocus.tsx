"use client";

import { useEffect } from "react";

import { usePathname } from "@/i18n/navigation";

import {
  focusHeading,
  HOME_PATHNAME,
  originHeadingInDocument,
  requestHeadingFocus,
  takeBackFocusRequest,
} from "./heading-focus";

/**
 * The half of 05 §5.7's focus contract that cannot live on either page
 * (`heading-focus.ts` carries the whole argument).
 *
 * It renders nothing. Its one job is to be **mounted on both sides of a Back**:
 * it sits in the `[locale]` layout, which persists across a client navigation,
 * so it is alive while the detail page is on screen *and* after the home page
 * has replaced it. `BackLink` cannot do this itself — it is unmounted by the
 * navigation it starts — and the home page cannot, because "the home page
 * mounted" is also true of a cold load, where moving focus would step over the
 * skip link.
 *
 * ── Why the `popstate` listener is here and not on `BackLink` ───────────
 *
 * It was on `BackLink` first, which is where it reads as belonging: that
 * component knows the origin heading, and a listener that only exists while a
 * detail page is on screen needs no guard for anything else. **It never fired
 * once.** Measured in a production build: the listener is registered, the
 * browser dispatches `popstate`, Next's own listener — registered earlier, at
 * hydration — restores the router state synchronously, React unmounts
 * `BackLink` inside that dispatch, and the effect cleanup calls
 * `removeEventListener` before the browser reaches the third listener in the
 * list. A listener removed mid-dispatch is not invoked, so the request was
 * never written and `document.activeElement` stayed `<body>` — the very
 * behaviour this was meant to fix.
 *
 * Here the ordering runs the other way, and by a rule rather than by luck.
 * React flushes passive effects children-first, and this component is a
 * descendant of Next's `AppRouter`; its effect therefore runs *before* the
 * effect that registers Next's `popstate` handler, so this listener is earlier
 * in the list and is invoked first — while the page being left is still the
 * page in the DOM. Nothing here is unmounted by a navigation, so nothing can
 * remove it mid-dispatch either.
 *
 * What the handler reads is the *markup*, not a value some other effect had to
 * write first — because on a Back taken the instant the URL changes, the
 * arriving page's passive effects have usually not run yet. `heading-focus.ts`
 * has that measurement.
 *
 * ── Why the focus move is keyed on the pathname ─────────────────────────
 *
 * `usePathname` changes exactly once per client navigation, in the same React
 * update that renders the new page, so the second effect fires once per
 * navigation and fires *after* the new page's DOM exists. That is the whole
 * mechanism, and it is why nothing here polls or waits: an effect cannot run
 * before the commit that scheduled it. A browser Back and a typed Back reach
 * the same line of code, which is what makes the two halves of this fix one
 * fix.
 *
 * The pathname is also the guard: a `popstate` is written before anyone knows
 * where it lands — it is not even necessarily a Back — and the entry behind a
 * detail page need not be the home page.
 *
 * **The guard comes before the read, and that order is what CI found.** Taking
 * first and deciding afterwards looks tidier and is wrong, for the same reason
 * as above: a passive effect can still be owed for a page the reader has
 * already left. Press Back fast enough — which a loaded container does
 * routinely and a fast laptop almost never did — and React flushes the *detail*
 * page's pending effect first, in the same dispatch. It took the request the
 * `popstate` handler had just written, saw a pathname that was no longer the
 * current one, and discarded it; the home page's own effect then found nothing
 * and focus stayed on `<body>`. `takeBackFocusRequest` still clears on read, so
 * a request is spent exactly once; what changed is that only an effect that can
 * honour it reads it.
 *
 * The other half of "spent exactly once" is in the `popstate` handler: a
 * `popstate` with no detail page on screen discards any unspent request rather
 * than leaving it for whenever home next renders.
 *
 * ── Where it is mounted ────────────────────────────────────────────────
 *
 * `src/app/[locale]/layout.tsx`, beside `SkipLink`, and nowhere else. It is a
 * client component in a tree 02 `D-02.16` keeps mostly on the server, and it
 * costs the bundle nothing beyond itself: it reads no message and imports no
 * content.
 */
export function BackFocus() {
  const pathname = usePathname();

  useEffect(() => {
    const onPopState = () => {
      // The page being left is still the page in the DOM — the event runs
      // before React has re-rendered anything — so its panel still carries the
      // heading a Back out of it lands on. On the home page there is no panel
      // and nothing to ask for, which is how a Forward, or a Back out of the
      // home page itself, costs nothing.
      const headingId = originHeadingInDocument();

      if (headingId === null) {
        // A Forward, or a Back out of the home page itself. Nothing to ask for
        // — and the moment to throw away anything an earlier Back left unspent.
        takeBackFocusRequest();
        return;
      }

      requestHeadingFocus(headingId);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (pathname !== HOME_PATHNAME) return;

    const headingId = takeBackFocusRequest();
    if (headingId === null) return;

    focusHeading(headingId);
  }, [pathname]);

  return null;
}
