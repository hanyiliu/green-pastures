import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { Button, buttonRecipe } from "@/components/ui/Button";
import { routing } from "@/i18n/routing";

/**
 * The pill. Two contracts matter beyond rendering: the 44px hit area of
 * INV-04.7, which the design's own padding does not reach at the nav size, and
 * the fact that the recipe is available as a class string so `BookTourButton`
 * can dress a client `TrackedLink` without a second copy of it (`D-04.1`).
 */
function renderIn(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale={routing.defaultLocale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );
}

describe("Button", () => {
  it("renders a locale-aware link by default", () => {
    renderIn(<Button href="/#visit">Book a tour</Button>);

    const href = screen.getByRole("link", { name: "Book a tour" }).getAttribute("href");
    expect(href).toMatch(new RegExp(`^/${routing.defaultLocale}\\b`));
    expect(href).toContain("#visit");
  });

  it("renders a real button when asked, defaulting to type=button", () => {
    renderIn(
      <>
        <Button as="button">Open</Button>
        <Button as="button" type="submit">
          Request a tour
        </Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "Request a tour" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("meets the 44px hit area in both axes on every size (INV-04.7)", () => {
    for (const size of ["nav", "hero", "submit"] as const) {
      const recipe = buttonRecipe(size, "sage");

      expect(recipe).toContain("min-h-(--tap-min)");
      expect(recipe).toContain("min-w-(--tap-min)");
    }
  });

  it("is a pill on the radius token, never a raw radius", () => {
    expect(buttonRecipe("hero", "sage")).toContain("rounded-pill");
    expect(buttonRecipe("hero", "sage")).not.toMatch(/\[\d/);
  });

  it("pairs each placement with 03 §5's shadow for the sage pill", () => {
    expect(buttonRecipe("nav", "sage")).toContain("shadow-primary-sm");
    expect(buttonRecipe("hero", "sage")).toContain("shadow-primary");
    expect(buttonRecipe("submit", "sage")).toContain("shadow-submit");
  });

  it("gives the Yelp tone its own fill, face and shadow", () => {
    const yelp = buttonRecipe("hero", "yelp");

    expect(yelp).toContain("bg-yelp");
    expect(yelp).toContain("shadow-yelp");
    expect(yelp).toContain("font-body");
    // The sage pill's placement shadow must not leak onto the red one.
    expect(yelp).not.toContain("shadow-primary");
  });

  it("lifts on hover from a token duration, and not at all under reduced motion", () => {
    const recipe = buttonRecipe("nav", "sage");

    expect(recipe).toContain("hover:-translate-y-px");
    expect(recipe).toContain("duration-(--dur-word-swap)");
    expect(recipe).toContain("ease-soft");
    expect(recipe).toContain("motion-reduce:hover:translate-y-0");
  });

  it("goes full width below md on the two placements the design stacks", () => {
    expect(buttonRecipe("hero", "sage")).toContain("w-full");
    expect(buttonRecipe("submit", "sage")).toContain("w-full");
    expect(buttonRecipe("nav", "sage")).not.toContain("w-full");
  });

  describe("caller classes", () => {
    it("takes a class that sets a property the recipe leaves alone", () => {
      renderIn(
        <Button href="/#visit" className="self-start">
          Book a tour
        </Button>,
      );

      expect(screen.getByRole("link")).toHaveClass("self-start");
    });

    it("refuses the width the stacked placements already set", () => {
      expect(() =>
        renderIn(
          <Button href="/#visit" size="hero" className="w-auto">
            Book a tour
          </Button>,
        ),
      ).toThrow(/"w-auto"/u);
    });

    it("takes the same width marked important", () => {
      renderIn(
        <Button href="/#visit" size="hero" className="w-auto!">
          Book a tour
        </Button>,
      );

      expect(screen.getByRole("link")).toHaveClass("w-auto!");
    });
  });
});
