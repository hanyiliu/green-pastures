import { render } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { Leaf } from "@/components/decor/Leaf";
import { MotionProvider } from "@/components/motion/MotionProvider";

/**
 * `Leaf` (04 §3.4, `D-04.15`; 05 §5.4, INV-05.5, INV-04.5).
 *
 * Eleven leaves across the two references and only four of them move, so the
 * interesting cases here are the two that decide whether a given instance is
 * animated at all — `loop` and `variant` — and the two-layer structure that
 * lets a *static* leaf still carry the reference's resting rotation without the
 * loop, when it has one, ever overwriting it.
 */

function renderLeaf(node: ReactNode) {
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
    renderLeaf(<Leaf id="deco-hero-leaf-1" size={40} tint="hero-1" />);

    expect(outerLayer("deco-hero-leaf-1")).toHaveAttribute("data-deco", "deco-hero-leaf-1");
  });

  it("forwards the ref to itself — the element a scrub would attach to", () => {
    const ref = createRef<HTMLDivElement>();
    renderLeaf(<Leaf id="deco-hero-leaf-1" size={40} tint="hero-1" ref={ref} />);

    expect(ref.current).toBe(outerLayer("deco-hero-leaf-1"));
  });

  it("holds the resting rotation the references give the static leaves", () => {
    renderLeaf(
      <Leaf
        id="deco-philosophy-leaf-2"
        size={24}
        tint="philosophy"
        loop={false}
        className="absolute -rotate-30 opacity-70"
      />,
    );

    // The tilt lives on the outer layer, where the loop below it cannot
    // overwrite it (INV-05.5).
    expect(outerLayer("deco-philosophy-leaf-2")).toHaveClass("-rotate-30", "opacity-70");
  });

  it("is hidden from the accessibility tree", () => {
    renderLeaf(<Leaf id="deco-visit-leaf" size={34} tint="visit" loop={false} />);

    expect(outerLayer("deco-visit-leaf")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("which loop attaches", () => {
  it("floats up and clockwise by default (gpfloat)", () => {
    renderLeaf(<Leaf id="deco-hero-leaf-1" size={40} tint="hero-1" />);

    const inner = innerLayer("deco-hero-leaf-1");
    expect(inner).toHaveClass("loop");
    expect(inner).toHaveAttribute("data-loop", "leaf");
  });

  it("floats the other way for variant b — the desktop hero's 28 px leaf", () => {
    renderLeaf(<Leaf id="deco-hero-leaf-2" size={28} tint="hero-2" variant="b" />);

    expect(innerLayer("deco-hero-leaf-2")).toHaveAttribute("data-loop", "leaf-b");
  });

  it("drops the loop class for the seven leaves the design draws still", () => {
    renderLeaf(<Leaf id="deco-teachers-leaf-1" size={30} tint="teachers" loop={false} />);

    expect(innerLayer("deco-teachers-leaf-1")).not.toHaveClass("loop");
  });
});

describe("speed", () => {
  it("sits on the 8 s base unless the instance asks otherwise", () => {
    renderLeaf(<Leaf id="deco-hero-leaf-1" size={40} tint="hero-1" />);

    expect(innerLayer("deco-hero-leaf-1")).toHaveAttribute("data-speed", "base");
  });

  it("publishes the 7 s and 9 s instances the hero draws", () => {
    renderLeaf(
      <>
        <Leaf id="deco-hero-leaf-1" size={40} tint="hero-1" speed="fast" />
        <Leaf id="deco-hero-leaf-3" size={22} tint="hero-3" speed="slow" />
      </>,
    );

    expect(innerLayer("deco-hero-leaf-1")).toHaveAttribute("data-speed", "fast");
    expect(innerLayer("deco-hero-leaf-3")).toHaveAttribute("data-speed", "slow");
  });
});

describe("the drawing", () => {
  it("draws at the size the section's layout gives it", () => {
    renderLeaf(<Leaf id="deco-hero-leaf-1" size={40} tint="hero-1" />);

    const inner = innerLayer("deco-hero-leaf-1");
    expect(inner).toHaveAttribute("width", "40");
    expect(inner).toHaveAttribute("height", "40");
  });

  it("takes its fill from the named leaf token, never from a hue (03 D-03.1)", () => {
    renderLeaf(
      <>
        <Leaf id="deco-hero-leaf-2" size={28} tint="hero-2" />
        <Leaf id="deco-teachers-leaf-2" size={22} tint="teachers" loop={false} />
      </>,
    );

    expect(innerLayer("deco-hero-leaf-2").querySelector("path")).toHaveClass("fill-leaf-hero-2");
    expect(innerLayer("deco-teachers-leaf-2").querySelector("path")).toHaveClass(
      "fill-leaf-teachers",
    );
  });

  it("is the same leaf shape in both references", () => {
    renderLeaf(<Leaf id="deco-hero-leaf-1" size={40} tint="hero-1" />);

    expect(innerLayer("deco-hero-leaf-1").querySelector("path")).toHaveAttribute(
      "d",
      "M14 2 C22 6 24 18 14 26 C4 18 6 6 14 2 Z",
    );
  });
});
