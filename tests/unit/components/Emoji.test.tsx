import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Emoji } from "@/components/ui/Emoji";

/**
 * Emoji are the icon set (03 `D-03.8`), which makes two things contractual:
 * whether a given glyph is announced at all, and whether a platform's wider
 * glyph can push the layout around it (03 §9's fixed boxes).
 */
describe("Emoji", () => {
  it("is announced as an image when the caller supplies a name", () => {
    render(<Emoji symbol="🌱" label="Certified Montessori" />);

    expect(screen.getByRole("img", { name: "Certified Montessori" })).toHaveTextContent("🌱");
  });

  it("is hidden from the accessibility tree when it repeats the words beside it", () => {
    const { container } = render(<Emoji symbol="🎨" />);
    const emoji = container.firstElementChild;

    expect(emoji).toHaveAttribute("aria-hidden", "true");
    expect(emoji).not.toHaveAttribute("role");
    expect(emoji).not.toHaveAttribute("aria-label");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("always renders in the emoji font stack", () => {
    const { container } = render(<Emoji symbol="🍎" />);

    expect(container.firstElementChild).toHaveClass("font-emoji");
  });

  it("gives the icon containers a fixed box so a glyph width cannot reflow the row", () => {
    const { container } = render(
      <>
        <Emoji symbol="🧸" size="dot" />
        <Emoji symbol="🌿" size="tile" />
      </>,
    );
    const [dot, tile] = Array.from(container.children);

    // 48px on both views for the tile, 48 → 56px for the teachers' icon dot.
    expect(dot).toHaveClass("size-12", "md:size-14");
    expect(tile).toHaveClass("size-12");
    expect(tile).not.toHaveClass("md:size-14");
  });

  it("gives an inline emoji no box, so it advances with the text", () => {
    const { container } = render(<Emoji symbol="🌾" />);

    expect(container.firstElementChild?.className).not.toMatch(/\bsize-/);
  });

  describe("caller classes", () => {
    it("takes a class that sets a property the recipe leaves alone", () => {
      const { container } = render(<Emoji symbol="🥦" className="mr-1" />);

      expect(container.firstElementChild).toHaveClass("mr-1");
    });

    it("refuses a box size the recipe already sets", () => {
      expect(() => render(<Emoji symbol="🥦" size="dot" className="size-8" />)).toThrow(
        /"size-8"/u,
      );
      // …including through the shorthand: `size-12` is a width and a height.
      expect(() => render(<Emoji symbol="🥦" size="dot" className="h-8" />)).toThrow(/"h-8"/u);
    });

    it("takes the same size marked important", () => {
      const { container } = render(<Emoji symbol="🥦" size="dot" className="size-8!" />);

      expect(container.firstElementChild).toHaveClass("size-8!");
    });
  });
});
