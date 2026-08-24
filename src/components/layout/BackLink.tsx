"use client";

import {
  useEffect,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { Link } from "@/i18n/navigation";

/**
 * The "← Back home" pill in the subpage bar (04 §3.1, 05 §5.7, 06 `D-06.8`).
 *
 * ── The navigation ──────────────────────────────────────────────────────
 *
 * 05 §5.7 and 06 `D-06.8` specify the behaviour as
 * `router.replace(`${home}#${sectionId}`, { transitionTypes: ['subpage-exit'] })`:
 * a *replace* rather than a push, so history stays `[home, home#section]`, and
 * a *typed* navigation, so `view-transitions.css` slides the page off to the
 * right. This is that navigation, expressed as next-intl's `Link` with
 * `replace` and `transitionTypes` rather than as a `useRouter()` call.
 *
 * **The router cannot express the href, and that is a next-intl fact rather
 * than a preference.** `useRouter().replace` takes `string | { pathname,
 * query }` — there is no `hash` field — and it prefixes whatever it is given
 * with `prefixPathname`, which strips a leading slash only for a bare `/` or
 * `/?…`. So `replace('/#philosophy')` produces `/en/#philosophy`: the slash
 * before the `#` that 06 `D-06.6` rules out, because `/en/` takes a
 * `trailingSlash: false` 308 before the reader lands. `Link` has no such
 * problem — it hands the pathname to `getPathname` and re-attaches the rest of
 * the URL object afterwards, so `{ pathname: '/', hash }` becomes
 * `/en#philosophy`, which is the one cross-page hash form `D-06.6` allows. That
 * closes `D-06.6`'s open `[assumed — spike: next-intl href normalisation]` in
 * the negative for the string form.
 *
 * Two things fall out of it, both wanted. The pill is a **real link**: it works
 * with JavaScript switched off, opens the home page in a new tab on a modified
 * click, and shows its URL in the status bar. And the handler below never calls
 * `preventDefault` — it only rides along.
 *
 * ── The focus moves ─────────────────────────────────────────────────────
 *
 * **This is the shell's only client component, so it owns both of them.**
 * 05 §5.7 measured the problem: after a typed forward navigation, after a typed
 * Back and after a browser Back, `document.activeElement` is `<body>` — the
 * router moves focus nowhere, so a keyboard visitor's next Tab restarts from
 * the top of the document on every navigation. 05 §5.7 therefore makes focus
 * handling mandatory and hands it to 04. `SubpageBar` and `SubpageHeader` are
 * Server Components and cannot become client components: they read a page
 * namespace, and 02 `D-02.16` keeps those out of `CLIENT_NAMESPACES`, so
 * flipping either one would ship a whole page's copy to the browser. That
 * leaves this component. On arrival it focuses the detail page's `h1`; on Back
 * it focuses the origin section's heading once the home page has rendered.
 * Focusing a heading is also the announcement: a screen reader reads the new
 * heading, which is what tells the reader the page changed.
 *
 * **Why `tabIndex` is applied at focus time.** 04 §3.1 asks for `h1
 * tabIndex={-1}`, but the `h1` is rendered by `SectionTitle` inside
 * `SectionHeader` — a PR-4.2 file this row does not touch, 04 §2 naming
 * `SubpageBar`, `BackLink` and `SubpageHeader` as the only `layout/` files this
 * phase touches — and neither takes a `tabIndex` prop. The home section
 * headings focused on the way back have the same shape. So the attribute is set
 * here, on the element about to be focused, and only when it has none of its
 * own: the observable result is identical, and it costs no edit to two files
 * another row owns. Give `SectionTitle` a `tabIndex` prop later and
 * {@link makeFocusable} loses its first line; nothing else here changes.
 */

/** 06 `D-06.6`: the internal pathname of the home page. */
const HOME_PATHNAME = "/";

/** 05 §5.7 / `D-05.10` — the type `PageTransition` maps to the `gp-page` class. */
const SUBPAGE_EXIT_TRANSITION = ["subpage-exit"];

/**
 * The id of a home section's heading — `philosophy-title`, `teachers-title`.
 * Every `<Section>` points `aria-labelledby` at exactly this, built from
 * `site.routes[].homeAnchor`, so the origin heading is addressable without any
 * component naming it (04 INV-04.8).
 */
function homeHeadingId(homeAnchor: string): string {
  return `${homeAnchor}-title`;
}

/**
 * How long to keep looking for the origin heading after Back. The home page is
 * prerendered and the router has it in hand, so the element is normally there
 * on the first or second check; the budget exists so a slow render ends in
 * "focus stayed where it was" rather than a timer that never stops. It is not a
 * design token — nothing animates over it, and the slide has `--dur-subpage`,
 * which this deliberately does not wait for.
 */
const FOCUS_DEADLINE_MS = 2000;
const FOCUS_POLL_MS = 32;

/**
 * Module scope, for the reason the reveal registry is (05 `D-05.6`): a client
 * navigation re-mounts the tree but never re-evaluates the module, and a full
 * page load is a fresh instance. Written the first time this session is known
 * to have navigated on the client, and read by
 * {@link arrivedByClientNavigation}.
 */
let hasNavigatedInSession = false;

/**
 * Did this component mount because of a client navigation, rather than because
 * the browser loaded this URL?
 *
 * The distinction decides whether focus moves at all. On a direct load of
 * `/en/philosophy` the SSR HTML *is* the page, no transition runs, and moving
 * focus to the `h1` would step over the skip link — the first focusable element
 * on every page, whose whole job is to be the first Tab stop. On a client
 * navigation nothing moves focus unless this does.
 *
 * Two signals, in order of certainty:
 *
 * 1. **Navigation Timing.** A client navigation adds no navigation entry, so
 *    `entry.name` still holds the URL the *document* was loaded with. If that
 *    is not the URL in the address bar, the difference is a client navigation.
 * 2. **The session flag.** Signal 1 goes quiet in exactly one case — load
 *    `/en/philosophy`, go Back, come forward again — because the document URL
 *    and the current URL agree once more. The flag is written the moment this
 *    session performs a Back, so the second visit is recognised.
 *
 * Both fail closed: with no Navigation Timing entry and no prior navigation the
 * answer is "hard load" and focus is left where the browser put it.
 */
function arrivedByClientNavigation(): boolean {
  if (hasNavigatedInSession) return true;

  const [entry] = performance.getEntriesByType("navigation");
  if (entry === undefined) return false;

  try {
    return new URL(entry.name).pathname !== window.location.pathname;
  } catch {
    return false;
  }
}

/** See the note on `tabIndex` above. */
function makeFocusable(target: HTMLElement): void {
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
}

/**
 * Focus the origin section's heading once the home page has replaced this one.
 *
 * **It waits for a *different* element, not merely for one to exist**, and that
 * distinction is the whole function. Four of the six routes have an id equal to
 * their home anchor, so `/philosophy`'s own `h1` and the home Philosophy
 * section's heading are both `#philosophy-title`. Looking the id up the moment
 * Back is clicked therefore finds the page being left, focuses it, and loses
 * the focus again the instant React unmounts it — measured: `activeElement`
 * back to `<body>` with the reader on the home page. Holding the outgoing node
 * and refusing it is what makes the wait mean "the home page has rendered".
 * Where the two ids differ (`reviews` → `testimonials-title`, `team` →
 * `teachers-title`) `outgoing` is simply `null` and the check costs nothing.
 *
 * `preventScroll` (05 §5.7): the scroll position is the router's — the origin
 * section's snap point, reached through the hash — and a focus that scrolled
 * would fight it under the slide.
 *
 * Deliberately not a `requestAnimationFrame` loop: rAF is paused while the
 * document is hidden, so a backgrounded tab would hold an unresolved callback
 * until someone looked at it again.
 */
export function focusHeadingWhenPresent(elementId: string): void {
  const deadline = Date.now() + FOCUS_DEADLINE_MS;
  const outgoing = document.getElementById(elementId);

  const attempt = () => {
    const target = document.getElementById(elementId);
    if (target !== null && target !== outgoing) {
      makeFocusable(target);
      target.focus({ preventScroll: true });
      return;
    }
    if (Date.now() < deadline) setTimeout(attempt, FOCUS_POLL_MS);
  };

  attempt();
}

/** `style` that also carries CSS custom properties (React writes them through). */
type StyleWithCustomProperties = CSSProperties & Partial<Record<`--${string}`, string>>;

/**
 * The pill's type size — Nunito 700 at 12px `< md` and 13px `≥ md` (mobile
 * L259, desktop L351).
 *
 * **03 §3.2 mints no token for it.** The whole subpage bar is missing from that
 * table: neither the pill's 12/13px nor the kicker's 16/17px is any row of it,
 * and 04 §10's only request to 03 for this bar was `--color-subnav-bg`, which
 * 03 has not minted either ("Until 03 mints them, 04 treats all three as
 * requested names, not shipped tokens"). One shipped token happens to carry
 * 12/13px in Nunito 700 — `--text-scroll-cue`, the hero's "scroll" cue — and
 * binding a back pill to the scroll cue's size would make a change to one
 * silently move the other. So the design's own pair is written here, once, as
 * component config, exactly as `SiteHeader` writes the nav's `blur(6px)` for
 * the same reason. Two custom properties rather than one value because the
 * views differ and a `md:` toggle cannot read an inline style (`D-04.5`: the
 * view is never a branch in code).
 */
const PILL_TYPE: StyleWithCustomProperties = {
  "--subnav-back": "12px",
  "--subnav-back-md": "13px",
};

/**
 * The hit area and the drawn pill are different boxes, the way
 * `LearnMoreLink`'s are. The design draws a 34px pill (9px of padding around a
 * 13px line) and INV-04.7 requires a 44px target on every view, measured as the
 * focusable element's bounding box. `--tap-min` on the anchor and the white
 * pill on an inner span satisfies both: the drawing is unchanged and the target
 * is 44px. `SubpageBar` sets its vertical padding against the 44px box, so the
 * bar keeps the height the design gives it.
 */
const HIT_AREA = "inline-flex min-h-(--tap-min) shrink-0 items-center";

const PILL =
  "inline-flex items-center rounded-pill bg-white px-3.5 py-2.25 font-body font-bold text-(length:--subnav-back) text-(color:--section-link) shadow-back md:px-4 md:text-(length:--subnav-back-md)";

export type BackLinkProps = {
  /** `site.routes[].homeAnchor` — the home section this page was opened from. */
  readonly homeAnchor: string;
  /**
   * The id of this page's `h1`, focused on arrival. `SubpageBar` passes
   * `subpageTitleId(routeId)`.
   */
  readonly titleId: string;
  /** The whole label, `←` included, from `common.back.label|labelShort`. */
  readonly children: ReactNode;
};

export function BackLink({ homeAnchor, titleId, children }: BackLinkProps) {
  useEffect(() => {
    if (!arrivedByClientNavigation()) return;

    // Reaching here *is* the proof, so record it: a later forward navigation to
    // a page whose URL happens to be the document's own is still a client
    // navigation, and signal 1 cannot see that on its own.
    hasNavigatedInSession = true;

    const heading = document.getElementById(titleId);
    if (heading === null) return;

    makeFocusable(heading);
    heading.focus({ preventScroll: true });
  }, [titleId]);

  function onClick(event: ReactMouseEvent<HTMLAnchorElement>) {
    // No `preventDefault` anywhere in here: the `Link` performs the navigation.
    // The modified clicks are skipped because they are not this navigation at
    // all — a middle click or a ⌘/ctrl-click opens the home page in a new tab
    // and leaves this document, and its focus, exactly where they are.
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    hasNavigatedInSession = true;

    // The navigation unmounts this component, so the wait for the origin
    // heading is deliberately not a React effect: `focusHeadingWhenPresent`
    // schedules itself, and the timer belongs to the module rather than to a
    // tree that is about to be replaced.
    focusHeadingWhenPresent(homeHeadingId(homeAnchor));
  }

  return (
    <Link
      href={{ pathname: HOME_PATHNAME, hash: homeAnchor }}
      replace
      transitionTypes={SUBPAGE_EXIT_TRANSITION}
      onClick={onClick}
      className={HIT_AREA}
    >
      <span className={PILL} style={PILL_TYPE}>
        {children}
      </span>
    </Link>
  );
}
