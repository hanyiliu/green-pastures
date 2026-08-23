import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Section, SECTION_IDS, sectionRoleVariables } from "@/components/layout/Section";
import { getSite } from "@/content/site";

/**
 * `Section` is the shell every home section wears (04 `D-04.3`, INV-04.8), so
 * the contract under test is the shell's promises, not "it renders": the ids
 * come from `content/site.json` rather than from the component, the scroll and
 * background properties are present as token utilities, and the role variables
 * are exactly the ones 03 §2.2/§2.3 mints a token for.
 */
describe("Section", () => {
  describe("section ids", () => {
    it("is site.routes[].homeAnchor in scroll order, between the two bookends", () => {
      const anchors = getSite().routes.map((route) => route.homeAnchor);

      expect(SECTION_IDS).toEqual(["hero", ...anchors, "visit"]);
    });

    it("covers every route's home anchor, so no section can lose its colours", () => {
      for (const route of getSite().routes) {
        expect(SECTION_IDS).toContain(route.homeAnchor);
      }
    });
  });

  describe("role variables (D-04.3)", () => {
    it("points each role at 03's canonical --color-<role>-<id> token", () => {
      expect(sectionRoleVariables("philosophy")).toEqual({
        "--section-bg": "var(--color-bg-philosophy)",
        "--section-accent": "var(--color-accent-philosophy)",
        "--section-link": "var(--color-link-philosophy)",
        "--section-link-underline": "var(--color-link-underline-philosophy)",
        "--section-sub": "var(--color-sub-philosophy)",
      });
    });

    it("leaves a role unset where 03 §2.3 mints no token", () => {
      // 03 §2.3 prints "—" for the hero and testimonial accents…
      expect(sectionRoleVariables("hero")).not.toHaveProperty("--section-accent");
      expect(sectionRoleVariables("testimonials")).not.toHaveProperty("--section-accent");
      // …and gives the Visit link no underline.
      expect(sectionRoleVariables("visit")).not.toHaveProperty("--section-link-underline");
    });

    it("gives every other section all five roles", () => {
      const complete = SECTION_IDS.filter(
        (id) => id !== "hero" && id !== "testimonials" && id !== "visit",
      );

      expect(complete).not.toHaveLength(0);
      for (const id of complete) {
        expect(Object.keys(sectionRoleVariables(id))).toHaveLength(5);
      }
    });

    it("re-points the focus ring on the Visit section only (03 D-03.11)", () => {
      expect(sectionRoleVariables("visit")["--color-focus"]).toBe("var(--color-sun)");

      for (const id of SECTION_IDS.filter((candidate) => candidate !== "visit")) {
        expect(sectionRoleVariables(id)).not.toHaveProperty("--color-focus");
      }
    });
  });

  describe("markup", () => {
    it("is a landmark named by the heading the caller points it at", () => {
      render(
        <Section id="philosophy" labelledBy="philosophy-title">
          <h2 id="philosophy-title">Our philosophy</h2>
        </Section>,
      );

      const section = screen.getByRole("region", { name: "Our philosophy" });
      expect(section).toHaveAttribute("id", "philosophy");
      expect(section).toHaveAttribute("data-section", "philosophy");
    });

    it("carries the scroll and padding contract as token utilities", () => {
      const { container } = render(
        <Section id="menu" labelledBy="menu-title">
          <span>content</span>
        </Section>,
      );
      const section = container.querySelector("section");

      expect(section).toHaveClass("snap-start");
      expect(section).toHaveClass("scroll-mt-(--nav-h)");
      expect(section).toHaveClass("bg-(color:--section-bg)");
      expect(section).toHaveClass("px-(--section-px)");
      expect(section).toHaveClass("py-(--section-py)");
    });

    it("writes the role variables onto the wrapper as inline custom properties", () => {
      const { container } = render(
        <Section id="gallery" labelledBy="gallery-title">
          <span>content</span>
        </Section>,
      );
      const section = container.querySelector("section");

      expect(section?.getAttribute("style")).toContain("--section-bg: var(--color-bg-gallery)");
      expect(section?.getAttribute("style")).toContain("--section-link: var(--color-link-gallery)");
    });

    it("centres its content in the --container-content box", () => {
      const { container } = render(
        <Section id="teachers" labelledBy="teachers-title">
          <span>content</span>
        </Section>,
      );

      const content = container.querySelector("section > div");
      expect(content).toHaveClass("mx-auto");
      expect(content).toHaveClass("max-w-content");
      expect(content).toHaveTextContent("content");
    });

    it("renders decorations ahead of the content and keeps the box positioned", () => {
      const { container } = render(
        <Section id="hero" labelledBy="hero-title" decor={<span data-deco="deco-hero-sun" />}>
          <span>content</span>
        </Section>,
      );
      const section = container.querySelector("section");

      expect(section).toHaveClass("relative");
      expect(section?.firstElementChild).toHaveAttribute("data-deco", "deco-hero-sun");
    });

    /**
     * The gallery's `px` bleed and the hero's own padding both *replace* the
     * shared `--section-px`, and appending a plain `px-2.5` never did that:
     * Tailwind emits `.px-2.5` before `.px-(--section-px)`, so the shell kept
     * its own padding. The bleed is written important, and the plain spelling
     * is refused rather than silently ignored.
     */
    it("takes an important override of the padding it sets, for the gallery bleed", () => {
      const { container } = render(
        <Section
          id="gallery"
          labelledBy="gallery-title"
          className="px-2.5!"
          contentClassName="grid"
        >
          <span>content</span>
        </Section>,
      );

      expect(container.querySelector("section")).toHaveClass("px-2.5!");
      expect(container.querySelector("section > div")).toHaveClass("grid");
    });

    it("refuses the same padding unmarked, on the shell and on the container", () => {
      expect(() =>
        render(
          <Section id="gallery" labelledBy="gallery-title" className="px-2.5">
            <span>content</span>
          </Section>,
        ),
      ).toThrow(/"px-2.5"/u);

      expect(() =>
        render(
          <Section id="gallery" labelledBy="gallery-title" contentClassName="max-w-none">
            <span>content</span>
          </Section>,
        ),
      ).toThrow(/"max-w-none"/u);
    });
  });
});
