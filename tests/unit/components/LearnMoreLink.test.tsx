import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { LearnMoreLink } from "@/components/ui/LearnMoreLink";
import { getSite } from "@/content/site";
import { type Locale, routing } from "@/i18n/routing";

/**
 * The section link resolves its target through `site.routes[]` and takes its
 * whole label — the `→` included — from the message tree. Those two are the
 * contract: a route move must be a `content/site.json` edit, and no component
 * may append punctuation of its own (02 §5.4, 04 §5.4).
 */
function renderIn(locale: Locale, node: ReactNode) {
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );
}

describe("LearnMoreLink", () => {
  it("resolves the href from site.routes[], under the current locale prefix", () => {
    const philosophy = getSite().routes.find((route) => route.id === "philosophy");
    expect(philosophy).toBeDefined();

    renderIn(
      routing.defaultLocale,
      <LearnMoreLink routeId="philosophy">Read our approach →</LearnMoreLink>,
    );

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/${routing.defaultLocale}${philosophy?.path ?? ""}`,
    );
  });

  it("follows the locale rather than hard-coding a prefix", () => {
    const [, second] = routing.locales;
    expect(second).toBeDefined();

    renderIn(
      second ?? routing.defaultLocale,
      <LearnMoreLink routeId="menu">See the full menu →</LearnMoreLink>,
    );

    expect(screen.getByRole("link").getAttribute("href")).toMatch(
      new RegExp(`^/${second ?? routing.defaultLocale}/`),
    );
  });

  it("renders the label verbatim and appends no glyph of its own", () => {
    renderIn(
      routing.defaultLocale,
      <LearnMoreLink routeId="team">Meet the whole team →</LearnMoreLink>,
    );

    expect(screen.getByRole("link")).toHaveTextContent(/^Meet the whole team →$/);
  });

  it("refuses a route id content/site.json does not declare", () => {
    expect(() =>
      renderIn(routing.defaultLocale, <LearnMoreLink routeId="enroll">Enrol</LearnMoreLink>),
    ).toThrow(/routes\[\]/);
  });

  it("takes its colour and rule from the section role variables", () => {
    renderIn(
      routing.defaultLocale,
      <LearnMoreLink routeId="gallery">Browse the gallery →</LearnMoreLink>,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveClass("text-(color:--section-link)");
    expect(link.className).not.toMatch(/--color-link-/);

    const rule = link.querySelector("span");
    expect(rule).toHaveClass("border-b-2");
    expect(rule).toHaveClass("border-(color:--section-link-underline)");
  });

  it("is a 44px target without moving the rule off the words (INV-04.7)", () => {
    renderIn(
      routing.defaultLocale,
      <LearnMoreLink routeId="reviews">Read all reviews →</LearnMoreLink>,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveClass("min-h-(--tap-min)");
    expect(link).toHaveClass("items-center");
    // The rule lives on the inner span, so the 44px box cannot stretch it away.
    expect(link.querySelector("span")).toHaveClass("pb-0.5");
  });

  describe("caller classes", () => {
    it("takes a class that sets a property the recipe leaves alone", () => {
      renderIn(
        routing.defaultLocale,
        <LearnMoreLink routeId="gallery" className="mt-2">
          Browse the gallery →
        </LearnMoreLink>,
      );

      expect(screen.getByRole("link")).toHaveClass("mt-2");
    });

    it("refuses the weight the recipe already sets", () => {
      expect(() =>
        renderIn(
          routing.defaultLocale,
          <LearnMoreLink routeId="gallery" className="font-normal">
            Browse the gallery →
          </LearnMoreLink>,
        ),
      ).toThrow(/"font-normal"/u);
    });

    it("takes the same weight marked important", () => {
      renderIn(
        routing.defaultLocale,
        <LearnMoreLink routeId="gallery" className="font-normal!">
          Browse the gallery →
        </LearnMoreLink>,
      );

      expect(screen.getByRole("link")).toHaveClass("font-normal!");
    });
  });
});
