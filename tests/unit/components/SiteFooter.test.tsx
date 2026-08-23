import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { getSite } from "@/content/site";
import { reference } from "@/i18n/messages";
import { LOCALE_META, routing, type Locale } from "@/i18n/routing";

/**
 * The footer (04 §3.1, `D-04.17`; `gp-dln.9`, OQ-04.6).
 *
 * Two of the row's acceptance bullets live here and neither is visible from a
 * screenshot of one locale. **Both brand names** have to appear, chosen through
 * `LOCALE_META[locale].brandPairLocale` rather than by asking which locale this
 * is — so the test runs every locale and derives the expected pair the same way
 * the component does, which is what makes it catch a hard-coded pairing.
 * **The licence number** has to appear on both views; it is an argument of one
 * message rather than a per-view element, so the check is that the rendered
 * line contains it at all.
 */

const nav = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("@/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/navigation")>();
  return { ...actual, usePathname: () => nav.pathname };
});

function renderFooter(locale: Locale = routing.defaultLocale) {
  return render(
    <NextIntlClientProvider locale={locale} messages={reference}>
      <SiteFooter />
    </NextIntlClientProvider>,
  );
}

function copyrightText(container: HTMLElement): string {
  return container.querySelector("small")?.textContent ?? "";
}

beforeEach(() => {
  nav.pathname = "/";
});

describe("the bilingual copyright (D-04.17, D-02.19)", () => {
  it.each(routing.locales)("prints both brand names in %s, paired by config", (locale) => {
    const site = getSite();
    const { container } = renderFooter(locale);

    const line = copyrightText(container);
    expect(line).toContain(site.brand.name[locale]);
    expect(line).toContain(site.brand.name[LOCALE_META[locale].brandPairLocale]);
  });

  it("never reconstructs the pair from a locale comparison — the two differ per locale", () => {
    const pairs = routing.locales.map((locale) => {
      const { container, unmount } = renderFooter(locale);
      const line = copyrightText(container);
      unmount();
      return line;
    });

    expect(new Set(pairs).size).toBe(routing.locales.length);
  });

  it("prints the licence number, which is what puts it on both views (gp-dln.9)", () => {
    const { container } = renderFooter();

    expect(copyrightText(container)).toContain(getSite().license);
  });

  it("prints the year as a plain year, not a grouped number", () => {
    const { container } = renderFooter();

    expect(copyrightText(container)).toContain(String(new Date().getFullYear()));
    expect(copyrightText(container)).not.toMatch(/\d,\d{3}/u);
  });

  it("marks the line up as a <small>, as 04 §3.1 asks", () => {
    const { container } = renderFooter();

    expect(container.querySelector("small")).not.toBeNull();
  });
});

describe("the link list renders whole on both views (OQ-04.6)", () => {
  it("renders every site.nav.footer[] entry — the six routes and Contact", () => {
    renderFooter();

    const links = [...screen.getByRole("navigation").querySelectorAll("a")];
    expect(links).toHaveLength(getSite().nav.footer.length);
    expect(links.map((link) => link.textContent)).toEqual(
      getSite().nav.footer.map((item) => (reference.common.nav as Record<string, string>)[item.id]),
    );
  });

  it("carries no md:/lg: hidden toggle on any row, so membership cannot differ per view", () => {
    renderFooter();

    for (const link of screen.getByRole("navigation").querySelectorAll("a")) {
      expect(link.className).not.toMatch(/(^|\s)(md|lg):hidden(\s|$)/u);
      expect(link.parentElement?.className ?? "").not.toMatch(/(^|\s)(md|lg):hidden(\s|$)/u);
    }
  });

  it("sends Contact to the Visit section, the same target as the CTA (04 §4)", () => {
    renderFooter();

    const site = getSite();
    const contact = site.nav.footer.find((item) => item.href !== undefined);
    const label = (reference.common.nav as Record<string, string>)[contact?.id ?? ""];

    expect(screen.getByText(label ?? "").closest("a")).toHaveAttribute(
      "href",
      `#${site.nav.cta.href.slice(2)}`,
    );
  });
});

describe("the landmark and the logo", () => {
  it("is a footer holding a named nav landmark", () => {
    const { container } = renderFooter();

    expect(container.querySelector("footer")).not.toBeNull();
    expect(screen.getByRole("navigation")).toHaveAttribute(
      "aria-label",
      reference.common.nav.label,
    );
  });

  it("puts the logo in the white card, named from common.logo.alt", () => {
    const { container } = renderFooter();

    const logo = container.querySelector("img");
    expect(logo?.getAttribute("alt")).toContain(getSite().brand.shortName[routing.defaultLocale]);
    expect(logo?.closest("span")?.className).toContain("rounded-logo-card");
  });
});
