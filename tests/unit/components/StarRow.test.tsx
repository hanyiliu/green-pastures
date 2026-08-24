import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StarRow, type StarRowSize } from "@/components/ui/StarRow";

/**
 * The star row is the one primitive that draws a symbol nobody reads.
 *
 * Two things are therefore contractual and neither is visible in a screenshot:
 * the glyphs stay out of the accessibility tree (03 §10, 04 §3.2 — the name
 * belongs to the group around them, which every caller owns), and each size
 * resolves to the type step its own reference draws. The second is what failed
 * before this component moved: the reviews page took the size that happened to
 * be the default and drew its cards 2px large on both views (gp-dln.216), and
 * nothing failed, because no test had ever named a size.
 */

/**
 * Every size, against the px its references draw and the Tailwind step that
 * carries it. 03 mints no star type token, so the steps are Tailwind's own
 * (INV-03.2); `header` and `bubble` are a step above their drawing and
 * `StarRow`'s own file records why.
 */
const SIZES = [
  { size: "trust", drawn: "14 / 18px", narrow: "text-sm", wide: "md:text-lg" },
  { size: "header", drawn: "17 / 24px", narrow: "text-lg", wide: "md:text-2xl" },
  { size: "bubble", drawn: "13 / 15px", narrow: "text-sm", wide: "md:text-base" },
  { size: "card", drawn: "12 / 14px", narrow: "text-xs", wide: "md:text-sm" },
] as const satisfies readonly {
  readonly size: StarRowSize;
  readonly drawn: string;
  readonly narrow: string;
  readonly wide: string;
}[];

function rowOf(container: HTMLElement): HTMLElement {
  const row = container.firstElementChild;
  expect(row).toBeInstanceOf(HTMLElement);
  return row as HTMLElement;
}

describe("StarRow", () => {
  it("draws five glyphs — the scale, never the rating", () => {
    const { container } = render(<StarRow size="bubble" />);
    const glyphs = [...rowOf(container).children];

    expect(glyphs).toHaveLength(5);
    expect(glyphs.every((glyph) => glyph.textContent === "★")).toBe(true);
  });

  it("stays out of the accessibility tree, so the group beside it names the rating", () => {
    const { container } = render(<StarRow size="header" />);
    const row = rowOf(container);

    expect(row).toHaveAttribute("aria-hidden", "true");
    expect(row).not.toHaveAttribute("role");
    expect(row).not.toHaveAttribute("aria-label");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("paints the amber and the one tracking token 03 mints for stars", () => {
    const { container } = render(<StarRow size="trust" />);

    // `--tracking-stars` is 1px; the two header rows draw 2px and 03 mints no
    // name for it, so the token stands rather than an arbitrary px (INV-03.2).
    expect(rowOf(container)).toHaveClass("text-amber", "tracking-stars", "leading-none");
  });

  describe.each(SIZES)("size $size ($drawn)", (variant) => {
    it("takes the narrow step its reference draws", () => {
      const { container } = render(<StarRow size={variant.size} />);

      expect(rowOf(container)).toHaveClass(variant.narrow);
    });

    it("steps up at md, and only at md", () => {
      const { container } = render(<StarRow size={variant.size} />);
      const classes = rowOf(container).className.split(" ");

      expect(classes).toContain(variant.wide);
      // INV-03.3: `md:` / `lg:` / `xl:` are the only breakpoints on the site,
      // so a size that reached for `sm:` would be drawing a view nothing else has.
      expect(classes.filter((name) => name.includes(":"))).toEqual([variant.wide]);
    });
  });

  it("gives every size its own pair of steps, so no two rows share a drawing", () => {
    const pairs = SIZES.map((variant) => `${variant.narrow} ${variant.wide}`);

    expect(new Set(pairs).size).toBe(SIZES.length);
  });
});
