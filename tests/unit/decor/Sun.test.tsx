import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Sun } from "@/components/decor/Sun";
import { MotionProvider } from "@/components/motion/MotionProvider";

/**
 * `Sun` (04 §3.4, `D-04.15`; 05 §5.4, INV-05.5, INV-04.5).
 *
 * The contract under test is the **two-layer** one, which is the whole reason
 * these are components rather than inline SVG in a section: an outer `m.*`
 * layer that a later parallax can attach to, and an inner layer that carries
 * the CSS loop, so the two transforms compose instead of overwriting each
 * other. A regression here is invisible until the day someone tries to scrub
 * the sun and finds the keyframes fighting them, which is exactly why it is
 * asserted now rather than then.
 */

function renderSun(node: React.ReactNode) {
  return render(<MotionProvider>{node}</MotionProvider>);
}

function outerLayer(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`no decoration with id ${id}`);
  return element;
}

function innerLayer(id: string): Element {
  const inner = outerLayer(id).firstElementChild;
  if (inner === null) throw new Error(`decoration ${id} has no inner layer`);
  return inner;
}

describe("the outer layer (INV-05.5, INV-04.5)", () => {
  it("carries the stable id and repeats it as data-deco", () => {
    renderSun(<Sun id="deco-hero-sun" />);

    expect(outerLayer("deco-hero-sun")).toHaveAttribute("data-deco", "deco-hero-sun");
  });

  it("forwards the ref to itself — the element a scrub would attach to", () => {
    const ref = createRef<HTMLDivElement>();
    renderSun(<Sun id="deco-hero-sun" ref={ref} />);

    expect(ref.current).toBe(outerLayer("deco-hero-sun"));
  });

  it("takes the section's placement classes, and does not pass them to the drawing", () => {
    renderSun(<Sun id="deco-visit-sun" size="visit" className="absolute top-12 opacity-50" />);

    expect(outerLayer("deco-visit-sun")).toHaveClass("absolute", "top-12", "opacity-50");
    expect(innerLayer("deco-visit-sun")).not.toHaveClass("opacity-50");
  });

  it("is hidden from the accessibility tree: it says nothing the words do not", () => {
    renderSun(<Sun id="deco-hero-sun" />);

    expect(outerLayer("deco-hero-sun")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("the inner layer", () => {
  it("is a separate element from the outer one, so the transforms compose", () => {
    renderSun(<Sun id="deco-hero-sun" />);

    const inner = innerLayer("deco-hero-sun");
    expect(inner.tagName.toLowerCase()).toBe("svg");
    expect(inner).not.toBe(outerLayer("deco-hero-sun"));
  });

  it("attaches the gpsun loop, pivoting on the disc rather than a fixed pixel", () => {
    renderSun(<Sun id="deco-hero-sun" />);

    const inner = innerLayer("deco-hero-sun");
    expect(inner).toHaveClass("loop");
    expect(inner).toHaveAttribute("data-loop", "sun");
    expect(inner).toHaveClass("origin-center");
  });

  it("drops the loop class when the design draws the sun still (05 §5.4)", () => {
    renderSun(<Sun id="deco-programs-sun" size="programs" loop={false} />);

    const inner = innerLayer("deco-programs-sun");
    expect(inner).not.toHaveClass("loop");
    // The hook stays; without `.loop` no keyframes attach to it.
    expect(inner).toHaveAttribute("data-loop", "sun");
  });
});

describe("the drawn sizes", () => {
  it("grows the hero sun from 72 px to 118 px at md", () => {
    renderSun(<Sun id="deco-hero-sun" size="hero" />);

    // 18 × 4px = 72, 29.5 × 4px = 118 (desktop L110, mobile L51).
    expect(innerLayer("deco-hero-sun")).toHaveClass("size-18", "md:size-29.5");
  });

  it("holds the programs sun at one size, because mobile draws none", () => {
    renderSun(<Sun id="deco-programs-sun" size="programs" loop={false} />);

    const inner = innerLayer("deco-programs-sun");
    expect(inner).toHaveClass("size-25");
    expect(inner.className).not.toContain("md:size-");
  });

  it("grows the visit sun from 70 px to 120 px at md", () => {
    renderSun(<Sun id="deco-visit-sun" size="visit" loop={false} />);

    expect(innerLayer("deco-visit-sun")).toHaveClass("size-17.5", "md:size-30");
  });
});

describe("the drawing", () => {
  it("fills disc and rays from the one sun token (INV-03.1)", () => {
    renderSun(<Sun id="deco-hero-sun" />);

    const inner = innerLayer("deco-hero-sun");
    expect(inner.querySelector("circle")).toHaveClass("fill-sun");
    expect(inner.querySelector("g")).toHaveClass("stroke-sun");
  });

  it("draws the reference's eight rays", () => {
    renderSun(<Sun id="deco-hero-sun" />);

    expect(innerLayer("deco-hero-sun").querySelectorAll("line")).toHaveLength(8);
  });
});
