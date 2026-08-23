import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Eyebrow } from "@/components/ui/Eyebrow";

/**
 * The eyebrow is the one recipe allowed to upper-case (04 §5.5), and the one
 * that proves a primitive can be section-coloured without naming a section
 * (`D-04.3`). Both are asserted here rather than left to the lint gate, which
 * can only see the *absence* of `uppercase` elsewhere.
 */
describe("Eyebrow", () => {
  it("applies uppercase, the eyebrow tracking and the section accent colour", () => {
    render(<Eyebrow>Our philosophy</Eyebrow>);
    const eyebrow = screen.getByText("Our philosophy");

    expect(eyebrow).toHaveClass("uppercase");
    expect(eyebrow).toHaveClass("tracking-eyebrow");
    expect(eyebrow).toHaveClass("text-eyebrow");
    expect(eyebrow).toHaveClass("text-(color:--section-accent)");
    expect(eyebrow).toHaveClass("font-body");
  });

  it("names no per-section colour token", () => {
    render(<Eyebrow>Who we are</Eyebrow>);

    expect(screen.getByText("Who we are").className).not.toMatch(/--color-accent-/);
  });

  /**
   * What this can and cannot prove: `sm` and `panel` name different tokens, and
   * that is the whole of the difference — `--text-eyebrow-sm` and
   * `--text-panel-label` are both 10px `< md` / 12px `≥ md` in `tokens.css`,
   * neither declares a line height, and both sizes take `--tracking-label`, so
   * the two render identically today. The variant stays because 04 §3.2 names
   * three sizes and 03 §3.2 keeps the two tokens on separate rows; the values
   * coinciding is 03's to resolve, and no assertion here should pretend the
   * rendered result differs.
   */
  it("names the size token that goes with the label, and drops the wide tracking", () => {
    render(
      <>
        <Eyebrow size="sm">Ages 2–3</Eyebrow>
        <Eyebrow size="panel">Hours</Eyebrow>
      </>,
    );

    const dense = screen.getByText("Ages 2–3");
    expect(dense).toHaveClass("text-eyebrow-sm");
    expect(dense).toHaveClass("tracking-label");
    expect(dense).not.toHaveClass("tracking-eyebrow");

    const panel = screen.getByText("Hours");
    expect(panel).toHaveClass("text-panel-label");
    expect(panel).toHaveClass("tracking-label");
  });

  it("renders a span by default and honours `as`", () => {
    const { container } = render(
      <>
        <Eyebrow>inline</Eyebrow>
        <Eyebrow as="div">block</Eyebrow>
      </>,
    );

    expect(container.querySelector("span")).toHaveTextContent("inline");
    expect(container.querySelector("div")).toHaveTextContent("block");
  });

  describe("caller classes", () => {
    it("takes a class that sets a property the recipe leaves alone", () => {
      render(<Eyebrow className="mt-2">Menu</Eyebrow>);

      expect(screen.getByText("Menu")).toHaveClass("mt-2");
    });

    it("refuses a tracking the recipe already sets", () => {
      expect(() => render(<Eyebrow className="tracking-label">Menu</Eyebrow>)).toThrow(
        /"tracking-label"/u,
      );
    });

    it("takes the same tracking marked important", () => {
      render(<Eyebrow className="tracking-label!">Menu</Eyebrow>);

      expect(screen.getByText("Menu")).toHaveClass("tracking-label!");
    });
  });
});
