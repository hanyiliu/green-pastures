import { render, screen } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { ScrollCue } from "@/components/decor/ScrollCue";
import { MotionProvider } from "@/components/motion/MotionProvider";

/**
 * `ScrollCue` (04 §3.4, `D-04.15`; 05 §5.4).
 *
 * The prototype draws the cue as a `div` with a `data-scrollto` attribute and a
 * `cursor: pointer`, which is unreachable by keyboard and invisible to a screen
 * reader. 04 §3.4 upgrades it to a real anchor, and that upgrade is the thing
 * most likely to be undone by someone matching the reference more literally —
 * so it is the first thing asserted here.
 */

function renderCue(node: ReactNode) {
  return render(<MotionProvider>{node}</MotionProvider>);
}

function outerLayer(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`no decoration with id ${id}`);
  return element;
}

describe("the cue is a link", () => {
  it("is reachable and announced, with the section's own words as its name", () => {
    renderCue(
      <ScrollCue id="deco-hero-cue" href="#philosophy">
        scroll to come inside ⌄
      </ScrollCue>,
    );

    const link = screen.getByRole("link", { name: "scroll to come inside ⌄" });
    expect(link).toHaveAttribute("href", "#philosophy");
  });

  it("is not hidden from the accessibility tree the way the other decorations are", () => {
    renderCue(
      <ScrollCue id="deco-hero-cue" href="#philosophy">
        scroll
      </ScrollCue>,
    );

    expect(outerLayer("deco-hero-cue")).not.toHaveAttribute("aria-hidden");
  });
});

describe("the two layers (INV-05.5, INV-04.5)", () => {
  it("carries the stable id and repeats it as data-deco", () => {
    renderCue(
      <ScrollCue id="deco-hero-cue" href="#philosophy">
        scroll
      </ScrollCue>,
    );

    expect(outerLayer("deco-hero-cue")).toHaveAttribute("data-deco", "deco-hero-cue");
  });

  it("forwards the ref to the outer layer, not to the link", () => {
    const ref = createRef<HTMLDivElement>();
    renderCue(
      <ScrollCue id="deco-hero-cue" href="#philosophy" ref={ref}>
        scroll
      </ScrollCue>,
    );

    expect(ref.current).toBe(outerLayer("deco-hero-cue"));
    expect(ref.current?.tagName).toBe("DIV");
  });

  it("puts the bounce on the link, one element below the positioning layer", () => {
    renderCue(
      <ScrollCue id="deco-hero-cue" href="#philosophy">
        scroll
      </ScrollCue>,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveClass("loop");
    expect(link).toHaveAttribute("data-loop", "cue");
    expect(link.parentElement).toBe(outerLayer("deco-hero-cue"));
  });

  it("keeps caller classes on the outer layer", () => {
    renderCue(
      <ScrollCue id="deco-hero-cue" href="#philosophy" className="mt-12">
        scroll
      </ScrollCue>,
    );

    expect(outerLayer("deco-hero-cue")).toHaveClass("mt-12");
  });
});

describe("the type", () => {
  it("is drawn from tokens, never from a raw size or colour (INV-03.1, INV-03.2)", () => {
    renderCue(
      <ScrollCue id="deco-hero-cue" href="#philosophy">
        scroll
      </ScrollCue>,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveClass("font-body", "text-scroll-cue", "tracking-label", "text-muted-2");
  });
});
