/**
 * The heading a Back lands on, and the request that outlives the page making it
 * (05 §5.7, 04 §3.1).
 *
 * 05 §5.7 measured that the router moves focus nowhere on any of the three
 * navigations, and makes the move mandatory rather than optional: forward, the
 * detail page's `h1`; on Back — typed *or* from the browser's own button — the
 * origin section's heading on the home page. The forward half is a mount effect
 * on the page that arrives, so it needs nothing from here. **The Back half has
 * no such component**: the element to focus belongs to the page arriving, and
 * the knowledge of *which* element belongs to the page leaving, which is
 * unmounted before the other exists.
 *
 * So the two are joined by a *request* rather than by a timer. A detail page
 * carries the id of its origin heading in the markup ({@link
 * ORIGIN_HEADING_ATTRIBUTE}); a Back turns that into a request ({@link
 * requestHeadingFocus}); and `BackFocus`, which sits in the `[locale]` layout
 * and therefore survives the navigation, spends the request once the home page
 * has rendered. The request is module scope for the reason the reveal registry
 * is (05 `D-05.6`): a client navigation re-mounts the tree but never
 * re-evaluates the module, and a full page load is a fresh instance.
 *
 * ── Why this is not a longer wait ───────────────────────────────────────
 *
 * The first implementation polled `document.getElementById` every 32 ms from
 * inside the page being unmounted and gave up after a two-second wall clock,
 * because from there nothing else was available to wait on. Re-mounting the
 * home page is eight sections with their decorations and reveals, and on a
 * machine running the full Playwright matrix that render finished after the
 * deadline often enough to fail about half of PR-6.10's local full runs —
 * always on the Back move, never on the forward one. A longer deadline is the
 * same defect with a smaller failure rate.
 *
 * The fix is to stop timing the render and take the event that *is* the render:
 * React commits the DOM before it runs any effect, so `BackFocus`'s effect
 * firing for the new pathname is itself the proof that the heading exists.
 * Measured against a main thread deliberately blocked for 2.6 s at the moment
 * of Back, the polling version leaves focus on `<body>` and this one lands.
 */

/** 06 `D-06.6`: the internal pathname of the home page. */
export const HOME_PATHNAME = "/";

/**
 * The id of a home section's heading — `philosophy-title`, `teachers-title`.
 * Every `<Section>` points `aria-labelledby` at exactly this, built from
 * `site.routes[].homeAnchor`, so the origin heading is addressable without any
 * component naming it (04 INV-04.8).
 */
export function homeHeadingId(homeAnchor: string): string {
  return `${homeAnchor}-title`;
}

/**
 * Give an element a programmatic focus target, and only if it has none.
 *
 * 04 §3.1 asks for `h1 tabIndex={-1}`, but the `h1` is rendered by
 * `SectionTitle` inside `SectionHeader` — PR-4.2 files that take no `tabIndex`
 * prop — and the home section headings focused on the way back have the same
 * shape. So the attribute is set on the element about to be focused instead:
 * the observable result is identical, and it costs no edit to two files another
 * row owns. Give `SectionTitle` a `tabIndex` prop later and this function loses
 * its first line; nothing else changes.
 */
export function makeFocusable(target: HTMLElement): void {
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
}

/**
 * Focus a heading that is in the document now, and report whether one was.
 *
 * `preventScroll` (05 §5.7): the scroll position is the router's — the origin
 * section's snap point reached through the hash, or the offset the browser
 * restores on a `popstate` — and a focus that scrolled would fight it under the
 * slide.
 */
export function focusHeading(headingId: string): boolean {
  const target = document.getElementById(headingId);
  if (target === null) return false;

  makeFocusable(target);
  target.focus({ preventScroll: true });
  return true;
}

/**
 * The attribute a detail page's panel carries: the id of the heading a Back out
 * of that page has to land on.
 *
 * **It is an attribute rather than a module value, and the difference is
 * measured.** The first version published the id from a `BackLink` mount
 * effect, which reads as the obvious place — the component holds the
 * `homeAnchor` prop. React schedules passive effects in a later task, so a
 * reader who presses Back before that task runs finds nothing published, and
 * that window is wide enough to matter: instrumenting a `popstate` listener
 * registered before any bundle, a Back taken the instant the URL changed found
 * the arriving page's `h1` still without the `tabindex` {@link makeFocusable}
 * stamps on it — that effect had not run — in five of six runs across three
 * locales, and in all three under an ×8 CPU throttle. The same probe found this
 * attribute present in every one of them, because it is in the server-rendered
 * markup and there is no window in which it is not.
 *
 * `SubpageBar` writes it beside `data-subpage`, from the same
 * `site.routes[].homeAnchor` (02 `D-02.12`) `BackLink`'s href is built from, and
 * omits it entirely on a standalone route that expands no home section
 * (`/privacy`) — which is the whole of that route's special case here.
 */
export const ORIGIN_HEADING_ATTRIBUTE = "data-origin-heading";

/**
 * The origin heading of the detail page on screen *now*, read out of the
 * document.
 *
 * "Now" is what makes this safe from a `popstate` handler: the event runs before
 * React has re-rendered anything, so the page being left is still the page in
 * the DOM. On the home page — or anywhere else with no detail panel — there is
 * nothing to find and the answer is `null`.
 */
export function originHeadingInDocument(): string | null {
  return (
    document
      .querySelector(`[${ORIGIN_HEADING_ATTRIBUTE}]`)
      ?.getAttribute(ORIGIN_HEADING_ATTRIBUTE) ?? null
  );
}

/** The heading `BackFocus` owes the reader once the home page has rendered. */
let requestedHeadingId: string | null = null;

/**
 * Ask for a heading to take focus once the home page has rendered. The two
 * callers are the two events that mean "this reader is going back":
 * `BackLink`'s own click, which knows its page's anchor from its props, and the
 * `popstate` `BackFocus` listens for, which reads it back out of the document.
 * Both are *events*, so both are certain; neither is a guess about how long the
 * destination will take.
 */
export function requestHeadingFocus(headingId: string): void {
  requestedHeadingId = headingId;
}

/**
 * Read the pending request and clear it, whether or not the caller can honour
 * it.
 *
 * Clearing on read is what stops a request outliving the navigation that made
 * it: a Back that lands somewhere other than the home page drops it, rather
 * than firing at whatever moment the reader next reaches home.
 */
export function takeBackFocusRequest(): string | null {
  const requested = requestedHeadingId;
  requestedHeadingId = null;
  return requested;
}
