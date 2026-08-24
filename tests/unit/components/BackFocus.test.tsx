import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BackFocus } from "@/components/layout/BackFocus";
import {
  ORIGIN_HEADING_ATTRIBUTE,
  requestHeadingFocus,
  takeBackFocusRequest,
} from "@/components/layout/heading-focus";

/**
 * `BackFocus` (PR-6.1 / gp-dln.269; 05 §5.7).
 *
 * The component that makes 05 §5.7's Back focus possible at all: it is mounted
 * in the `[locale]` layout, so it is alive on both sides of a navigation that
 * unmounts the page which knows where focus should land.
 *
 * **What is worth testing here is an ordering, not a value.** The defect this
 * replaced was a two-second wall clock: `BackLink` polled for the origin
 * heading from inside the page being unmounted, and on a loaded machine the
 * home page's render outran the deadline. The claim now is that no clock is
 * involved — a `useEffect` keyed on the pathname cannot run before the commit
 * that changed the pathname, so the heading is in the document by definition.
 * The cases below are that claim's edges: the request is spent when the
 * navigation lands on home, dropped when it lands anywhere else, never spent
 * twice, and written by a `popstate` as well as by the pill.
 *
 * `usePathname` is mocked because the pathname is the *input* to the ordering
 * and next-intl's routing has its own suite; a rerender at a new pathname is
 * exactly what the router does to this component.
 */

const route = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => route.pathname,
}));

/** A home section heading, under the id `aria-labelledby` already points at. */
function mountHeading(id: string): HTMLElement {
  const heading = document.createElement("h2");
  heading.id = id;
  document.body.append(heading);
  return heading;
}

/**
 * The reader on a detail page: `SubpageBar`'s panel, carrying the origin
 * heading in its markup exactly as the server renders it.
 */
function onDetailPage(headingId: string) {
  route.pathname = "/philosophy";
  const panel = document.createElement("div");
  panel.setAttribute("data-subpage", "philosophy");
  panel.setAttribute(ORIGIN_HEADING_ATTRIBUTE, headingId);
  document.body.append(panel);
  return { view: render(<BackFocus />), panel };
}

/**
 * The navigation, as this component sees it: the panel it was on goes with its
 * page, and React commits the new one, telling this component the pathname
 * changed.
 */
function land(page: ReturnType<typeof onDetailPage>, pathname: string) {
  page.panel.remove();
  route.pathname = pathname;
  page.view.rerender(<BackFocus />);
}

afterEach(() => {
  takeBackFocusRequest();
  document.body.replaceChildren();
  route.pathname = "/";
});

describe("BackFocus", () => {
  it("focuses the origin heading the moment the home page has rendered", () => {
    const heading = mountHeading("philosophy-title");
    const page = onDetailPage("philosophy-title");

    // The typed Back: `BackLink`'s click handler has already asked.
    requestHeadingFocus("philosophy-title");
    land(page, "/");

    expect(document.activeElement).toBe(heading);
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  it("answers a browser Back, which runs no click handler at all", () => {
    const heading = mountHeading("teachers-title");
    const page = onDetailPage("teachers-title");

    fireEvent.popState(window);
    land(page, "/");

    expect(document.activeElement).toBe(heading);
  });

  it("takes the heading from the page being left, not from one it was told", () => {
    // The `popstate` handler reads the DOM, so the answer is whatever page is
    // on screen when the reader presses Back — with no effect having had to run
    // first, which is the failure a container found and this machine did not.
    const heading = mountHeading("testimonials-title");
    const page = onDetailPage("testimonials-title");

    fireEvent.popState(window);

    expect(takeBackFocusRequest()).toBe("testimonials-title");
    requestHeadingFocus("testimonials-title");
    land(page, "/");

    expect(document.activeElement).toBe(heading);
  });

  it("asks for nothing when there is no detail page on screen", () => {
    // A Forward into a detail page, or a Back out of the home page itself:
    // same event, no panel, nothing to ask for.
    route.pathname = "/";
    render(<BackFocus />);

    fireEvent.popState(window);

    expect(takeBackFocusRequest()).toBeNull();
  });

  it("does not honour a request on a page that is not home", () => {
    // A `popstate` is written before anyone knows where it goes, and it is not
    // even necessarily a Back. The origin heading belongs to the home page, so
    // landing anywhere else moves nothing.
    const heading = mountHeading("philosophy-title");
    const page = onDetailPage("philosophy-title");

    fireEvent.popState(window);
    land(page, "/programs");

    expect(document.activeElement).not.toBe(heading);
  });

  it("reads the request only where it can honour it, so a stale effect cannot eat it", () => {
    // The failure a container found and this machine did not. React can still
    // owe a passive effect for the page the reader has already left; taking the
    // request first and checking the pathname afterwards let that effect
    // swallow it, and the home page's own effect then found nothing. Here the
    // detail page's late effect runs *after* the request was written, and the
    // home page's still gets it.
    const heading = mountHeading("philosophy-title");
    const page = onDetailPage("philosophy-title");

    fireEvent.popState(window);

    // The stale effect: same component, still on the detail pathname.
    page.view.rerender(<BackFocus />);

    land(page, "/");

    expect(document.activeElement).toBe(heading);
  });

  it("throws an unspent request away at the next popstate off a detail page", () => {
    // The other half of "spent exactly once": a Back that landed somewhere
    // other than home must not fire whenever the reader next reaches home.
    const page = onDetailPage("philosophy-title");

    fireEvent.popState(window);
    land(page, "/programs");
    fireEvent.popState(window);

    expect(takeBackFocusRequest()).toBeNull();
  });

  it("moves nothing on a page load, where no Back has asked for anything", () => {
    const heading = mountHeading("philosophy-title");

    route.pathname = "/";
    render(<BackFocus />);

    // The whole reason the request exists rather than a "focus the first
    // heading" rule: a cold load must leave the skip link as the first Tab
    // stop.
    expect(document.activeElement).not.toBe(heading);
    expect(document.activeElement).toBe(document.body);
  });

  it("stops listening when it is unmounted", () => {
    const page = onDetailPage("philosophy-title");
    page.view.unmount();

    fireEvent.popState(window);

    expect(takeBackFocusRequest()).toBeNull();
  });

  it("survives a heading that is not in the document", () => {
    // Not reachable through the router — the pathname changed, so the page
    // rendered — but the component must not throw if it ever is.
    const page = onDetailPage("nothing-title");
    requestHeadingFocus("nothing-title");

    expect(() => {
      land(page, "/");
    }).not.toThrow();
    expect(document.activeElement).toBe(document.body);
  });
});
