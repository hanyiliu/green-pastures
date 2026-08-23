import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionTitle } from "@/components/ui/SectionTitle";

/**
 * The heading recipe. The interesting assertions are the two the spec argues
 * about: that `text-wrap: balance` is unconditional across locales (03 §3.3),
 * and that the `section` size names `--text-section-title--line-height` rather
 * than inventing a leading 03 has not decided (bead `gp-dln.38`).
 */
describe("SectionTitle", () => {
  it("renders the requested rank and can be pointed at by aria-labelledby", () => {
    render(
      <SectionTitle as="h1" id="hero-title" size="headline">
        A gentle place to grow
      </SectionTitle>,
    );

    const heading = screen.getByRole("heading", { level: 1, name: "A gentle place to grow" });
    expect(heading).toHaveAttribute("id", "hero-title");
  });

  it("defaults to an h2 at the section size", () => {
    render(<SectionTitle>Growing with us</SectionTitle>);
    const heading = screen.getByRole("heading", { level: 2 });

    expect(heading).toHaveClass("text-section-title");
    expect(heading).toHaveClass("font-display");
    expect(heading).toHaveClass("text-ink");
  });

  it("balances every locale's headings, not just the Chinese ones", () => {
    render(<SectionTitle>我们的理念</SectionTitle>);

    expect(screen.getByRole("heading")).toHaveClass("text-balance");
  });

  it("names the section-title leading variable instead of minting a number", () => {
    render(<SectionTitle>Growing with us</SectionTitle>);

    // 03 §3.2 declares no base `--text-section-title--line-height`; naming it
    // keeps the `:root:lang(zh)` value live and picks up an `en` value for free
    // the day 03 mints one.
    expect(screen.getByRole("heading")).toHaveClass("leading-(--text-section-title--line-height)");
  });

  it("uses the display face at each size, with the design's weight", () => {
    render(
      <>
        <SectionTitle size="headline">headline</SectionTitle>
        <SectionTitle size="quote">quote</SectionTitle>
      </>,
    );

    expect(screen.getByText("headline")).toHaveClass("text-headline", "font-semibold");
    expect(screen.getByText("quote")).toHaveClass("text-quote", "font-medium");
  });

  it("honours a message's line break only when asked to", () => {
    render(
      <>
        <SectionTitle id="plain">plain</SectionTitle>
        <SectionTitle id="broken" preserveLineBreaks>
          broken
        </SectionTitle>
      </>,
    );

    expect(screen.getByText("plain")).not.toHaveClass("whitespace-pre-line");
    expect(screen.getByText("broken")).toHaveClass("whitespace-pre-line");
  });
});
