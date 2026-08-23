import { render, screen, waitFor } from "@testing-library/react";
import type { TargetAndTransition } from "motion/react";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { WordSwap } from "@/components/motion/WordSwap";
import {
  revealMotionVariants,
  type RevealCustom,
  type RevealVariantOptions,
} from "@/components/motion/variants";
import { stagger } from "@/design/tokens";

import { installMatchMedia } from "./harness";

/**
 * `WordSwap` (05 `D-05.9`, §5.6; PR-4.3b's acceptance row).
 *
 * Two claims are worth more than the rest and are what most of this file is
 * about.
 *
 * **`mode="wait"`.** The menu's sample line is a paragraph of text; if the
 * outgoing and incoming days overlapped for 200 ms the block would double in
 * height and shove the page (INV-05.7). "Wait" is therefore not a taste
 * decision, and the test for it asserts the frame that would prove it broken —
 * the one immediately after the key changes, where the *old* line must still be
 * the only line.
 *
 * **The entrance is the catalogue's, not a copy of it.** 05 §5.6 gives the
 * locale cascade and this swap the same 200 ms / 6 px rise, and the cascade's
 * `min(i × 14 ms, 300 ms)` delay lives in that one row. `revealMotionVariants`
 * is spied on rather than reproduced, so a future edit that hand-rolls the
 * entrance here fails even if it happens to write the same numbers.
 *
 * `revealMotionVariants` is spied through `importOriginal`, so the real
 * catalogue still drives the DOM and only the call is observed.
 */

const variantsSpy = vi.hoisted(() => vi.fn());

vi.mock("@/components/motion/variants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/motion/variants")>();
  variantsSpy.mockImplementation(actual.revealMotionVariants);
  return { ...actual, revealMotionVariants: variantsSpy };
});

beforeAll(() => {
  // `WordSwap` asks `useReducedMotionConfig`, which reads a media query jsdom
  // does not implement. Not reduced; the reduced case uses `MotionProvider`'s
  // own override (05 §5.9's testing hook).
  installMatchMedia(false);
});

beforeEach(() => {
  variantsSpy.mockClear();
});

function renderSwap(node: ReactNode, reducedMotion?: "always" | "user") {
  return render(<MotionProvider reducedMotion={reducedMotion}>{node}</MotionProvider>);
}

function swapElement(): HTMLElement {
  const element = document.querySelector("[data-word-swap]");
  if (!(element instanceof HTMLElement)) throw new Error("no word swap in the document");
  return element;
}

/**
 * Resolve one state of the `swap` row against a `custom` payload.
 *
 * Motion types a dynamic variant as its three-argument `TargetResolver`
 * (`custom`, `current`, `velocity`); the catalogue reads only the first, and
 * the two empty objects are what the type asks for rather than anything the
 * row consults.
 */
function resolveSwap(
  state: "hidden" | "visible",
  custom: RevealCustom = {},
  options: RevealVariantOptions = {},
): TargetAndTransition {
  const variant = revealMotionVariants("swap", options)[state];
  if (typeof variant !== "function") throw new Error("the `swap` row is not dynamic");
  return variant(custom, {}, {}) as TargetAndTransition;
}

describe("the line it wraps", () => {
  it("renders the caller's server-rendered children", () => {
    renderSwap(<WordSwap swapKey="mon">oatmeal, chicken rice, apple slices</WordSwap>);

    expect(screen.getByText("oatmeal, chicken rice, apple slices")).toBeInTheDocument();
  });

  it("is a span by default, so it can sit inside a sentence", () => {
    renderSwap(<WordSwap swapKey="mon">line</WordSwap>);

    expect(swapElement().tagName).toBe("SPAN");
  });

  it("renders the element the caller asks for, so semantics survive the wrapper", () => {
    renderSwap(
      <WordSwap swapKey="mon" as="p">
        line
      </WordSwap>,
    );

    expect(swapElement().tagName).toBe("P");
  });

  it("publishes the key it is swapping on", () => {
    renderSwap(<WordSwap swapKey="wed">line</WordSwap>);

    expect(swapElement()).toHaveAttribute("data-word-swap", "wed");
  });

  it("keeps caller classes", () => {
    renderSwap(
      <WordSwap swapKey="mon" className="text-sample-line">
        line
      </WordSwap>,
    );

    expect(swapElement()).toHaveClass("text-sample-line");
  });
});

describe("the first render", () => {
  it("does not animate in: the server's default day is already on screen", () => {
    renderSwap(<WordSwap swapKey="mon">monday</WordSwap>);

    const element = swapElement();
    expect(element.style.opacity).not.toBe("0");
    expect(element.style.transform ?? "").not.toContain("translateY(6px)");
  });
});

describe("changing the key", () => {
  it("waits: the outgoing line is still the only line on the frame after the change", () => {
    const { rerender } = renderSwap(<WordSwap swapKey="mon">monday</WordSwap>);

    rerender(
      <MotionProvider>
        <WordSwap swapKey="wed">wednesday</WordSwap>
      </MotionProvider>,
    );

    expect(screen.getByText("monday")).toBeInTheDocument();
    expect(screen.queryByText("wednesday")).not.toBeInTheDocument();
  });

  it("replaces the line, and only one of the two is ever mounted", async () => {
    const { rerender } = renderSwap(<WordSwap swapKey="mon">monday</WordSwap>);

    rerender(
      <MotionProvider>
        <WordSwap swapKey="wed">wednesday</WordSwap>
      </MotionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("wednesday")).toBeInTheDocument();
    });
    expect(screen.queryByText("monday")).not.toBeInTheDocument();
    expect(document.querySelectorAll("[data-word-swap]")).toHaveLength(1);
  });
});

describe("where the motion comes from", () => {
  it("takes its entrance from the catalogue's `swap` row rather than restating it", () => {
    renderSwap(<WordSwap swapKey="mon">line</WordSwap>);

    expect(variantsSpy).toHaveBeenCalledWith("swap", { reduced: false });
  });

  it("asks the catalogue for the reduced form under reduced motion (05 §5.9)", () => {
    renderSwap(<WordSwap swapKey="mon">line</WordSwap>, "always");

    expect(variantsSpy).toHaveBeenCalledWith("swap", { reduced: true });
  });

  it("inherits the row's `min(i × 14 ms, 300 ms)` cascade delay", () => {
    for (const index of [0, 1, 10, 21, 22, 40]) {
      const { transition } = resolveSwap("visible", { index });
      expect(transition?.delay).toBeCloseTo(
        Math.min(index * stagger.word, stagger.wordCap),
        // The tokens are seconds; 14 ms is 0.014, so five places is exact.
        5,
      );
    }
  });

  it("rises 6 px in the default form and not at all in the reduced one", () => {
    expect(resolveSwap("hidden")).toMatchObject({ opacity: 0, y: 6 });
    expect(resolveSwap("hidden", {}, { reduced: true })).toEqual({ opacity: 0 });
  });
});
