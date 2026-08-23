import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BookTourButton } from "@/components/layout/BookTourButton";
import { TrackedLink } from "@/components/layout/TrackedLink";
import { getSite } from "@/content/site";
import { reference } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

/**
 * The one analytics wrapper, and the pill that uses it (04 `D-04.1`, 07 §4).
 *
 * `TrackedLink` exists so that a server component can carry a click event
 * without becoming a client component, which means the thing worth testing is
 * that the event fires *and* that the link is still a link: the external form
 * has to open safely in a new tab, and the internal form has to be the same
 * hash-first anchor every other in-page link is.
 */

const nav = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("@/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/navigation")>();
  return { ...actual, usePathname: () => nav.pathname };
});

type AnalyticsWindow = typeof window & {
  va?: (kind: string, properties: { name: string; data?: Record<string, string> }) => void;
};

const va = vi.fn();

function renderIn(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale={routing.defaultLocale} messages={reference}>
      {node}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  nav.pathname = "/";
  va.mockClear();
  (window as AnalyticsWindow).va = va;
});

afterEach(() => {
  delete (window as AnalyticsWindow).va;
});

describe("TrackedLink", () => {
  it("fires the event with its params on click, in the shape @vercel/analytics takes", () => {
    renderIn(
      <TrackedLink href="/#visit" event="cta_book_tour" params={{ placement: "nav" }}>
        Book a tour
      </TrackedLink>,
    );

    fireEvent.click(screen.getByRole("link"));

    expect(va).toHaveBeenCalledWith("event", {
      name: "cta_book_tour",
      data: { placement: "nav" },
    });
  });

  it("is silent, not broken, when nothing is listening", () => {
    delete (window as AnalyticsWindow).va;
    renderIn(
      <TrackedLink href="/#visit" event="cta_book_tour">
        Book a tour
      </TrackedLink>,
    );

    expect(() => {
      fireEvent.click(screen.getByRole("link"));
    }).not.toThrow();
  });

  it("routes an internal href through the hash-first rule", () => {
    renderIn(
      <TrackedLink href="/#visit" event="cta_book_tour">
        Book a tour
      </TrackedLink>,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "#visit");

    nav.pathname = "/menu";
    const { unmount } = renderIn(
      <TrackedLink href="/#visit" event="cta_book_tour">
        Book a tour
      </TrackedLink>,
    );
    expect(screen.getAllByRole("link")[1]).toHaveAttribute(
      "href",
      `/${routing.defaultLocale}#visit`,
    );
    unmount();
  });

  it("opens an external target safely and still fires", () => {
    renderIn(
      <TrackedLink href="https://example.test/biz" event="yelp_click" external>
        Yelp
      </TrackedLink>,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("href", "https://example.test/biz");

    fireEvent.click(link);
    expect(va).toHaveBeenCalledWith("event", { name: "yelp_click", data: undefined });
  });
});

describe("BookTourButton (04 §3.1, 07 §6)", () => {
  it("takes the nav and sheet label from common.nav.bookTour", () => {
    for (const placement of ["nav", "sheet"] as const) {
      const { unmount } = renderIn(<BookTourButton placement={placement} />);
      expect(screen.getByRole("link")).toHaveTextContent(reference.common.nav.bookTour);
      unmount();
    }
  });

  it("takes the hero label from home.hero.ctaPrimary, arrow included", () => {
    renderIn(<BookTourButton placement="hero" />);

    expect(screen.getByRole("link")).toHaveTextContent(reference.home.hero.ctaPrimary);
  });

  it("points every placement at site.nav.cta.href", () => {
    renderIn(<BookTourButton placement="nav" />);

    expect(screen.getByRole("link")).toHaveAttribute("href", `#${getSite().nav.cta.href.slice(2)}`);
  });

  it("reports its placement as the event dimension 07 §4 names", () => {
    renderIn(<BookTourButton placement="sheet" />);

    fireEvent.click(screen.getByRole("link"));

    expect(va).toHaveBeenCalledWith("event", {
      name: "cta_book_tour",
      data: { placement: "sheet" },
    });
  });

  it("wears the pill recipe, and the sheet one fills its column", () => {
    const nav1 = renderIn(<BookTourButton placement="nav" />);
    const navClass = screen.getByRole("link").className;
    expect(navClass).toContain("rounded-pill");
    expect(navClass).not.toContain("w-full");
    nav1.unmount();

    renderIn(<BookTourButton placement="sheet" />);
    expect(screen.getByRole("link").className).toContain("w-full");
  });
});
