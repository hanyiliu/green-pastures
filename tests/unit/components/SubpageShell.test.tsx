import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { focusHeadingWhenPresent } from "@/components/layout/BackLink";
import { SubpageBar } from "@/components/layout/SubpageBar";
import { SubpageHeader, subpageTitleId } from "@/components/layout/SubpageHeader";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { getSite } from "@/content/site";
import { reference } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

import { installIntersectionObserverStub, installMatchMedia } from "../motion/harness";

/**
 * The subpage shell (PR-6.1; 04 §1, §3.1; 05 §5.7; 06 `D-06.3`, `D-06.6`).
 *
 * Six contracts are worth a test, and each is checked against `content/` or
 * against 03's tokens rather than against a value typed in here:
 *
 * - **the bar reads the page's own namespace and `site.routes[]`** — the kicker
 *   is `<page>.kicker`, the Back target is `homeAnchor`, and a namespace with
 *   no route (`visit`, `faq` — reserved, `D-02.17`) is a build failure rather
 *   than a dead link;
 * - **the Back href is 06 `D-06.6`'s one cross-page hash form** — locale
 *   prefix, no slash before the `#`;
 * - **the header renders what the namespace has** — `philosophy` has an
 *   eyebrow and both intros, `gallery` has neither, and neither case is a
 *   branch on the page id (INV-04.4);
 * - **the wait for the origin heading refuses the element it started with** —
 *   four routes share an id with their home section, so "an element with this
 *   id exists" is true before the navigation has happened at all;
 * - **the shell makes the header's three shared decisions** — the registry key
 *   that keeps `gallery`, `programs` and `menu` from spending their entrance on
 *   the home section of the same name, the bottom margin a gapped column does
 *   not want, and `introDesktopOnly`;
 * - **a message tree the two intro shapes cannot describe fails loudly** rather
 *   than rendering a header with no intro in it.
 */

const EN = routing.defaultLocale;

function renderShell(node: ReactNode, messages: typeof reference = reference) {
  return render(
    <NextIntlClientProvider locale={EN} messages={messages}>
      <MotionProvider>{node}</MotionProvider>
    </NextIntlClientProvider>,
  );
}

/** The `en` tree with one key taken out of one namespace. */
function referenceWithout(page: "philosophy", key: "intro"): typeof reference {
  const messages = structuredClone(reference);
  Reflect.deleteProperty(messages[page], key);
  return messages;
}

/** The registry key of the one `Reveal` a rendered header is wrapped in. */
function headerRevealId(container: HTMLElement): string | null {
  return container.querySelector("[data-reveal-id]")?.getAttribute("data-reveal-id") ?? null;
}

/** The `SectionHeader` stack — the box the `h1` sits in. */
function headerStack(): HTMLElement {
  const stack = screen.getByRole("heading", { level: 1 }).parentElement;
  if (stack === null) throw new Error("The h1 has no parent, so there is no header stack.");
  return stack;
}

beforeAll(() => {
  installIntersectionObserverStub();
  installMatchMedia(true);
});

afterEach(() => {
  resetRevealRegistry();
});

describe("SubpageBar", () => {
  it("takes the kicker from the page's own namespace", () => {
    renderShell(
      <SubpageBar routeId="philosophy">
        <SubpageHeader page="philosophy" />
      </SubpageBar>,
    );

    expect(screen.getByText(reference.philosophy.kicker)).toBeInTheDocument();
  });

  it("renders both back labels and lets md: choose between them (D-04.5)", () => {
    renderShell(<SubpageBar routeId="menu">{null}</SubpageBar>);

    const short = screen.getByText(reference.common.back.labelShort);
    const long = screen.getByText(reference.common.back.label);

    expect(short).toHaveClass("md:hidden");
    expect(long).toHaveClass("hidden", "md:inline");
  });

  it("points Back at the home anchor, prefixed and with no slash before the hash", () => {
    renderShell(<SubpageBar routeId="philosophy">{null}</SubpageBar>);

    expect(screen.getByRole("link")).toHaveAttribute("href", `/${EN}#philosophy`);
  });

  it("follows site.routes[] where the route id and the home anchor differ", () => {
    const reviews = getSite().routes.find((route) => route.id === "reviews");
    expect(reviews?.homeAnchor).toBe("testimonials");

    renderShell(<SubpageBar routeId="reviews">{null}</SubpageBar>);

    expect(screen.getByRole("link")).toHaveAttribute("href", `/${EN}#${reviews?.homeAnchor ?? ""}`);
  });

  it("carries the origin section's role variables, so nothing below names a colour", () => {
    const { container } = renderShell(<SubpageBar routeId="reviews">{null}</SubpageBar>);
    const panel = container.querySelector<HTMLElement>("[data-subpage]");

    expect(panel?.style.getPropertyValue("--section-bg")).toBe("var(--color-bg-testimonials)");
    expect(panel?.style.getPropertyValue("--section-link")).toBe("var(--color-link-testimonials)");
  });

  it("declares the page's own custom properties on the content column", () => {
    // Custom properties inherit, so the column is one declaration where the
    // Menu page used to carry seven — one per block, five of them day cards.
    const { container } = renderShell(
      <SubpageBar routeId="menu" contentStyle={{ "--menu-cell": "13px" }}>
        {null}
      </SubpageBar>,
    );

    const column = container.querySelector<HTMLElement>("main#main");
    expect(column?.style.getPropertyValue("--menu-cell")).toBe("13px");
  });

  it("renders the one #main landmark the skip link targets", () => {
    const { container } = renderShell(<SubpageBar routeId="team">{null}</SubpageBar>);

    expect(container.querySelectorAll("main#main")).toHaveLength(1);
  });

  it("gives the Back pill a 44px hit area without changing the drawn pill (INV-04.7)", () => {
    renderShell(<SubpageBar routeId="gallery">{null}</SubpageBar>);

    const anchor = screen.getByRole("link");
    expect(anchor).toHaveClass("min-h-(--tap-min)");
    // The white pill and its shadow are on the inner span, so the 44px box
    // never pulls the drawing away from the design's 34px.
    expect(anchor.firstElementChild).toHaveClass("rounded-pill", "bg-white", "shadow-back");
  });

  it("fails loudly for a namespace that has a kicker but no route (D-02.17)", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => renderShell(<SubpageBar routeId="visit">{null}</SubpageBar>)).toThrow(
      /content\/site\.json does not declare in routes\[\]/u,
    );

    errors.mockRestore();
  });
});

describe("SubpageHeader", () => {
  it("renders the page's one h1, at the id BackLink focuses", () => {
    renderShell(<SubpageHeader page="philosophy" />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveAttribute("id", subpageTitleId("philosophy"));
    expect(heading).toHaveTextContent(reference.philosophy.heading);
  });

  it("renders the eyebrow and both intros when the namespace has them", () => {
    renderShell(<SubpageHeader page="philosophy" />);

    expect(screen.getByText(reference.philosophy.eyebrow)).toBeInTheDocument();
    expect(screen.getByText(reference.philosophy.intro)).toBeInTheDocument();
    expect(screen.getByText(reference.philosophy.introShort)).toHaveClass("md:hidden");
  });

  it("renders neither where the namespace has neither, without branching on the page", () => {
    const { container } = renderShell(<SubpageHeader page="gallery" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(reference.gallery.heading);
    expect(container.querySelectorAll("p")).toHaveLength(0);
    expect(container.querySelectorAll("span")).toHaveLength(0);
  });

  it("renders a lone intro as one paragraph on both views", () => {
    const { container } = renderShell(<SubpageHeader page="menu" />);

    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toHaveTextContent(reference.menu.intro);
    expect(paragraphs[0]).not.toHaveClass("md:hidden");
  });

  it("forwards introDesktopOnly, so 04 §4's Menu row is a prop and not a selector", () => {
    const { container } = renderShell(<SubpageHeader page="menu" introDesktopOnly />);

    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toHaveTextContent(reference.menu.intro);
    expect(paragraphs[0]).toHaveClass("hidden", "md:block");
  });

  it("sheds SectionHeader's bottom margin itself, on both views and on every page", () => {
    // The margin is additive on `SubpageBar`'s gapped column, and the answer is
    // the same on all six pages — so the shell gives it rather than each page
    // repeating `mb-0! md:mb-0!`. Both halves: an important base class does not
    // outrank its own `md:` twin.
    for (const page of ["philosophy", "menu", "gallery"] as const) {
      const view = renderShell(<SubpageHeader page={page} />);
      expect(headerStack()).toHaveClass("mb-0!", "md:mb-0!");
      view.unmount();
    }
  });

  it("keys the header's Reveal by a namespace of its own, not by the page id", () => {
    // `gallery`, `programs` and `menu` are home *section* ids as well as page
    // ids, and the registry is once per session by id (05 `D-05.6`): an
    // unprefixed `gallery.header` is already spent by the time a reader who
    // scrolled the home page opens `/gallery`, and the entrance never plays.
    for (const page of ["gallery", "programs", "menu", "philosophy", "reviews", "team"] as const) {
      const view = renderShell(<SubpageHeader page={page} />);
      expect(headerRevealId(view.container)).toBe(`subpage.${page}.header`);
      view.unmount();
      resetRevealRegistry();
    }
  });

  it("refuses a namespace with an introShort and no intro (04 D-04.5)", () => {
    // Dormant in `content/` today and silent before this check: the pair branch
    // needs both keys, so the lone `introShort` fell through to the other shape
    // and the header rendered with no intro on either view.
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      renderShell(<SubpageHeader page="philosophy" />, referenceWithout("philosophy", "intro")),
    ).toThrow(/introShort and no intro/u);

    errors.mockRestore();
  });

  it("refuses introDesktopOnly beside an introShort, which SectionHeader's types also do", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => renderShell(<SubpageHeader page="philosophy" introDesktopOnly />)).toThrow(
      /introDesktopOnly, but its namespace carries an introShort/u,
    );

    errors.mockRestore();
  });
});

describe("focusHeadingWhenPresent", () => {
  it("refuses the element that is already there and takes the one that replaces it", () => {
    vi.useFakeTimers();

    const outgoing = document.createElement("h1");
    outgoing.id = "philosophy-title";
    document.body.append(outgoing);

    focusHeadingWhenPresent("philosophy-title");
    expect(document.activeElement).not.toBe(outgoing);

    // The navigation: the detail page's heading goes, the home section's
    // heading arrives under the same id.
    outgoing.remove();
    const arriving = document.createElement("h2");
    arriving.id = "philosophy-title";
    document.body.append(arriving);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(document.activeElement).toBe(arriving);
    expect(arriving).toHaveAttribute("tabindex", "-1");

    arriving.remove();
    vi.useRealTimers();
  });

  it("stops at its deadline instead of polling for ever", () => {
    vi.useFakeTimers();

    focusHeadingWhenPresent("teachers-title");

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(vi.getTimerCount()).toBe(0);
    expect(document.activeElement).toBe(document.body);

    vi.useRealTimers();
  });
});

describe("BackLink arrival focus", () => {
  /**
   * A fresh module per case: `hasNavigatedInSession` is module state by design
   * (05 `D-05.6`'s pattern — a client navigation re-mounts the tree but not the
   * module), so one session's answer must not leak into the next test's.
   */
  async function freshShell() {
    vi.resetModules();
    const bar = await import("@/components/layout/SubpageBar");
    const header = await import("@/components/layout/SubpageHeader");
    return { SubpageBar: bar.SubpageBar, SubpageHeader: header.SubpageHeader };
  }

  it("leaves focus alone on a direct load, so the skip link stays the first tab stop", async () => {
    const shell = await freshShell();

    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { name: window.location.href } as PerformanceEntry,
    ]);

    renderShell(
      <shell.SubpageBar routeId="philosophy">
        <shell.SubpageHeader page="philosophy" />
      </shell.SubpageBar>,
    );

    expect(document.activeElement).toBe(document.body);
  });

  it("focuses the page's h1 when the document was loaded at another URL", async () => {
    const shell = await freshShell();

    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { name: new URL("/somewhere-else", window.location.href).href } as PerformanceEntry,
    ]);

    renderShell(
      <shell.SubpageBar routeId="philosophy">
        <shell.SubpageHeader page="philosophy" />
      </shell.SubpageBar>,
    );

    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
    expect(document.activeElement).toHaveAttribute("id", subpageTitleId("philosophy"));
  });

  it("treats a document with no Navigation Timing entry as a hard load", async () => {
    const shell = await freshShell();

    vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);

    renderShell(
      <shell.SubpageBar routeId="philosophy">
        <shell.SubpageHeader page="philosophy" />
      </shell.SubpageBar>,
    );

    expect(document.activeElement).toBe(document.body);
  });
});

describe("BackLink click", () => {
  /**
   * jsdom cannot follow a link, and says so on `stderr`. The navigation is
   * next-intl's `Link` doing its job, which this suite does not re-test; what
   * it tests is what the handler schedules alongside.
   */
  function swallowNavigation() {
    const stop = (event: Event) => {
      event.preventDefault();
    };
    document.addEventListener("click", stop);
    return () => {
      document.removeEventListener("click", stop);
    };
  }

  it("focuses the origin section's heading once the home page has rendered", () => {
    const release = swallowNavigation();
    vi.useFakeTimers();

    renderShell(<SubpageBar routeId="reviews">{null}</SubpageBar>);

    // `reviews` → `testimonials`, so the heading id is one the detail page does
    // not also carry; this stands in for the home section arriving.
    const heading = document.createElement("h2");
    heading.id = "testimonials-title";

    fireEvent.click(screen.getByRole("link"));
    document.body.append(heading);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(document.activeElement).toBe(heading);

    heading.remove();
    vi.useRealTimers();
    release();
  });

  it("leaves a ⌘-click to the browser — it opens a tab and this document keeps its focus", () => {
    const release = swallowNavigation();
    vi.useFakeTimers();

    renderShell(<SubpageBar routeId="reviews">{null}</SubpageBar>);

    const heading = document.createElement("h2");
    heading.id = "testimonials-title";
    document.body.append(heading);

    fireEvent.click(screen.getByRole("link"), { metaKey: true });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(document.activeElement).not.toBe(heading);

    heading.remove();
    vi.useRealTimers();
    release();
  });
});
