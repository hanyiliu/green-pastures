import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { imageRole } from "@/components/ui/image-role";

/**
 * 04 §3.2's rule for a graphic, asserted where it is actually consumed: the
 * accessibility tree. Every case below queries by role and by accessible name,
 * because the attributes are only the mechanism — what is contractual is
 * whether a screen reader reaches the element at all, and what it reads out
 * when it does. Assert `aria-hidden="true"` is present and the test still
 * passes with the role left dangling beside it; assert `queryByRole` finds
 * nothing and it does not.
 */
describe("imageRole", () => {
  it("puts a named graphic into the accessibility tree under that name", () => {
    render(<span {...imageRole("A child painting at an easel")} />);

    expect(screen.getByRole("img", { name: "A child painting at an easel" })).toBeInTheDocument();
  });

  it("keeps an unnamed graphic out of the accessibility tree entirely", () => {
    render(<span {...imageRole(undefined)} data-graphic="decorative" />);

    // Not merely unnamed. There is no `img` to find, and none even when the
    // query is told to include hidden elements — the role is gone with it.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { hidden: true })).not.toBeInTheDocument();
    expect(document.querySelector("[data-graphic]")).toBeInTheDocument();
  });

  /**
   * The failure this whole module exists to prevent, and the one no attribute
   * assertion catches: an accessible name is computed from an element's
   * contents, and a decorative glyph that is not hidden is read out as part of
   * the name of whatever encloses it. The two cases are each other's inverse —
   * swap the branches and the expected names swap with them.
   */
  describe("the name its container computes", () => {
    it("excludes a decorative graphic's contents", () => {
      render(
        <button type="button">
          <span {...imageRole(undefined)}>🎨</span>
          {" Gallery"}
        </button>,
      );

      expect(screen.getByRole("button", { name: "Gallery" })).toBeInTheDocument();
    });

    it("includes a named graphic's name", () => {
      render(
        <button type="button">
          <span {...imageRole("Art")}>🎨</span>
          {" Gallery"}
        </button>,
      );

      expect(screen.getByRole("button", { name: "Art Gallery" })).toBeInTheDocument();
    });
  });

  /**
   * The union type refuses half of the rule at compile time; this is the same
   * claim at run time, so a later edit that widens the type to a record of
   * optional attributes cannot quietly reintroduce an `img` with no name.
   */
  it("never emits half of the rule", () => {
    const hidden = imageRole(undefined);
    expect(hidden).toEqual({ "aria-hidden": true });

    const named = imageRole("Our Fremont classroom");
    expect(named).toEqual({ role: "img", "aria-label": "Our Fremont classroom" });
  });
});
