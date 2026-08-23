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

  it("swaps the size token and the tracking together", () => {
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

  it("keeps caller classes", () => {
    render(<Eyebrow className="mt-2">Menu</Eyebrow>);

    expect(screen.getByText("Menu")).toHaveClass("mt-2");
  });
});
