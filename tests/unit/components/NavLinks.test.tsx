import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FooterLinks } from "@/components/layout/FooterLinks";
import { NavLink, PrimaryNav, type NavLinkItem } from "@/components/layout/PrimaryNav";
import { SkipLink } from "@/components/layout/SkipLink";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { reference } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

/**
 * The three link lists and the rule they share (06 `D-06.7`, 04 §3.1).
 *
 * `D-06.7` is a rule about markup that only shows up as a bug in the wrong
 * place: on the home page a nav link must be a plain `#anchor` so the browser's
 * own smooth scroll runs, and from a subpage it must be a locale-prefixed
 * router link so Next routes first. Both forms are real hrefs — that is the
 * no-JavaScript half — and the tests below check the pair rather than either
 * one alone.
 */

const nav = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("@/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/navigation")>();
  return { ...actual, usePathname: () => nav.pathname };
});

const ITEMS: readonly NavLinkItem[] = [
  { id: "philosophy", href: "/#philosophy", label: "Philosophy" },
  { id: "team", href: "/#teachers", label: "Our Team" },
];

function renderIn(node: ReactNode, locale: Locale = routing.defaultLocale) {
  return render(
    <NextIntlClientProvider locale={locale} messages={reference}>
      <MotionProvider>{node}</MotionProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  nav.pathname = "/";
});

describe("NavLink picks the form from the page it is on (D-06.7)", () => {
  it("is a same-document anchor on the home page, with no locale prefix", () => {
    renderIn(<NavLink href="/#philosophy">Philosophy</NavLink>);

    expect(screen.getByRole("link")).toHaveAttribute("href", "#philosophy");
  });

  it("is a locale-prefixed link from a detail page, with no slash before the # (D-06.6)", () => {
    nav.pathname = "/menu";

    for (const locale of routing.locales) {
      const { unmount } = renderIn(<NavLink href="/#philosophy">Philosophy</NavLink>, locale);

      expect(screen.getByRole("link")).toHaveAttribute("href", `/${locale}#philosophy`);
      unmount();
    }
  });

  it("falls through to a plain locale-aware link for an href that is not a home anchor", () => {
    renderIn(<NavLink href="/menu">Menu</NavLink>);

    expect(screen.getByRole("link")).toHaveAttribute("href", `/${routing.defaultLocale}/menu`);
  });

  it("reports the click through onNavigate in both forms", () => {
    const onNavigate = vi.fn();

    const home = renderIn(
      <NavLink href="/#philosophy" onNavigate={onNavigate}>
        Philosophy
      </NavLink>,
    );
    fireEvent.click(screen.getByRole("link"));
    expect(onNavigate).toHaveBeenCalledOnce();
    home.unmount();

    nav.pathname = "/menu";
    renderIn(
      <NavLink href="/#philosophy" onNavigate={onNavigate}>
        Philosophy
      </NavLink>,
    );
    fireEvent.click(screen.getByRole("link"));
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });
});

describe("PrimaryNav joins the locale cascade (05 §5.6)", () => {
  it("wraps every item in a Reveal keyed by its nav id", () => {
    const { container } = renderIn(<PrimaryNav items={ITEMS} />);

    expect(
      [...container.querySelectorAll("[data-reveal-id]")].map((node) =>
        node.getAttribute("data-reveal-id"),
      ),
    ).toEqual(ITEMS.map((item) => `nav.${item.id}`));
  });

  it("gives each one a list item, so the row stays a list", () => {
    const { container } = renderIn(<PrimaryNav items={ITEMS} />);

    expect(container.querySelectorAll("ul > li")).toHaveLength(ITEMS.length);
  });

  it("renders the labels it was handed and reads no message of its own", () => {
    renderIn(<PrimaryNav items={ITEMS} />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(
      ITEMS.map((item) => item.label),
    );
  });
});

describe("FooterLinks", () => {
  it("renders one row per item, on the Visit link colour", () => {
    renderIn(<FooterLinks items={ITEMS} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(ITEMS.length);
    for (const link of links) expect(link.className).toContain("text-link-visit");
  });

  it("obeys the same hash-first rule as the nav", () => {
    nav.pathname = "/team";
    renderIn(<FooterLinks items={ITEMS} />);

    expect(screen.getAllByRole("link")[0]).toHaveAttribute(
      "href",
      `/${routing.defaultLocale}#philosophy`,
    );
  });
});

describe("SkipLink (04 §3.1, 06 §6.2)", () => {
  it("points at the #main landmark each page renders", () => {
    renderIn(<SkipLink />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "#main");
  });

  it("takes its label from common.a11y.skipToContent", () => {
    renderIn(<SkipLink />);

    expect(screen.getByRole("link")).toHaveTextContent(reference.common.a11y.skipToContent);
  });

  it("is hidden until it takes focus, and never display:none (which would drop it)", () => {
    renderIn(<SkipLink />);

    const link = screen.getByRole("link");
    expect(link.className).toContain("sr-only");
    expect(link.className).toContain("focus:not-sr-only");
    expect(link.className).not.toMatch(/(^|\s)hidden(\s|$)/u);
  });
});
