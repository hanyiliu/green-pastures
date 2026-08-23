import { act, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CountUp } from "@/components/motion/CountUp";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { markRevealed, resetRevealRegistry } from "@/components/motion/registry";
import { Reveal } from "@/components/motion/Reveal";
import { dur, ease } from "@/design/tokens";

import { installIntersectionObserverStub, installMatchMedia } from "./harness";

/**
 * `CountUp` (05 `D-05.8`, §5.5; PR-4.3b's acceptance row).
 *
 * The row's load-bearing clause is **"the count-up's final value is in the SSR
 * HTML"**, so the first describe block below renders the component the way a
 * crawler receives it — through `renderToStaticMarkup`, with no DOM, no
 * effects and no hydration — rather than asserting a client render and calling
 * it server-shaped.
 *
 * `animate` is replaced with a spy instead of being left to run. What belongs
 * to this component is *which* animation it asks for and what it does with the
 * frames it gets back; the tween itself is Motion's, and driving `onUpdate` by
 * hand is both faster and stricter than waiting a real second for the same
 * three assertions (08 `D-08.13` — synchronise, never extend the clock).
 */

const animateSpy = vi.hoisted(() => vi.fn());

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, animate: animateSpy };
});

/** The last options `CountUp` handed `animate`. */
type CountUpOptions = {
  duration?: number;
  ease?: unknown;
  onUpdate?: (latest: number) => void;
  onComplete?: () => void;
};

function lastAnimateCall(): { from: number; to: number; options: CountUpOptions } {
  const call = animateSpy.mock.calls.at(-1);
  if (call === undefined) throw new Error("animate was never called");
  const [from, to, options] = call as [number, number, CountUpOptions];
  return { from, to, options };
}

let observer: ReturnType<typeof installIntersectionObserverStub>;

beforeAll(() => {
  observer = installIntersectionObserverStub();
  // Not reduced: the reduced-motion cases below use `MotionProvider`'s own
  // override, which is 05 §5.9's testing hook and does not need a media query.
  installMatchMedia(false);
});

beforeEach(() => {
  resetRevealRegistry();
  animateSpy.mockReset();
  animateSpy.mockReturnValue({ stop: vi.fn() });
});

/** The Reviews header, as 04 §3.3 places it: a `CountUp` inside its `Reveal`. */
function reviewsHeader(children: ReactNode, reducedMotion?: "always" | "user"): ReactNode {
  return (
    <NextIntlClientProvider locale="en">
      <MotionProvider reducedMotion={reducedMotion}>
        <Reveal id="testimonials.header">{children}</Reveal>
      </MotionProvider>
    </NextIntlClientProvider>
  );
}

function countElement(): HTMLElement {
  const element = document.querySelector("[data-countup]");
  if (!(element instanceof HTMLElement)) throw new Error("no count-up in the document");
  return element;
}

function revealElement(): Element {
  const element = document.querySelector('[data-reveal-id="testimonials.header"]');
  if (element === null) throw new Error("no reveal in the document");
  return element;
}

describe("the server HTML", () => {
  it("carries the final value, not a zero — the row's SEO and no-JS clause", () => {
    const html = renderToStaticMarkup(reviewsHeader(<CountUp value={47} />));

    expect(html).toContain(">47<");
    expect(html).not.toContain(">0<");
  });

  it("carries the rating at its decimals, so 5 is published as 5.0", () => {
    const html = renderToStaticMarkup(reviewsHeader(<CountUp value={5} decimals={1} />));

    expect(html).toContain(">5.0<");
  });

  it("reserves the final string's width in the markup itself (INV-05.7)", () => {
    const html = renderToStaticMarkup(reviewsHeader(<CountUp value={5} decimals={1} />));

    // "5.0" is three characters; the box is reserved before a digit moves.
    expect(html).toContain("min-width:3ch");
  });
});

describe("the run", () => {
  it("drops to zero once hydrated, while its Reveal is still hidden", () => {
    render(reviewsHeader(<CountUp value={47} />));

    expect(countElement()).toHaveTextContent("0");
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it("counts from zero to the value over the count-up token, on ease-out cubic", () => {
    render(reviewsHeader(<CountUp value={47} />));
    observer.enterViewport(revealElement());

    const { from, to, options } = lastAnimateCall();

    expect(from).toBe(0);
    expect(to).toBe(47);
    expect(options.duration).toBe(dur.countup);
    expect(options.ease).toBe(ease.outCubic);
  });

  it("formats every frame it is given, and snaps to the final value on complete", () => {
    render(reviewsHeader(<CountUp value={47} />));
    observer.enterViewport(revealElement());

    const { options } = lastAnimateCall();

    act(() => {
      options.onUpdate?.(23.7);
    });
    expect(countElement()).toHaveTextContent("24");

    act(() => {
      options.onComplete?.();
    });
    expect(countElement()).toHaveTextContent("47");
  });
});

describe("the cases that never animate", () => {
  it("shows the final value under reduced motion and never swaps to zero (05 §5.9)", () => {
    render(reviewsHeader(<CountUp value={47} />, "always"));

    expect(countElement()).toHaveTextContent("47");
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it("still does not animate under reduced motion once the Reveal is in view", () => {
    render(reviewsHeader(<CountUp value={47} />, "always"));
    observer.enterViewport(revealElement());

    expect(countElement()).toHaveTextContent("47");
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it("runs once per session: a Reveal that already played re-mounts on the final value", () => {
    markRevealed("testimonials.header");

    render(reviewsHeader(<CountUp value={47} />));

    expect(countElement()).toHaveTextContent("47");
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it("outside a Reveal there is no entrance to wait for, so it prints the value", () => {
    render(
      <NextIntlClientProvider locale="en">
        <MotionProvider>
          <CountUp value={47} />
        </MotionProvider>
      </NextIntlClientProvider>,
    );

    expect(countElement()).toHaveTextContent("47");
    expect(animateSpy).not.toHaveBeenCalled();
  });
});

describe("formatting", () => {
  it("goes through the locale's number formatter, grouping included", () => {
    markRevealed("testimonials.header");
    render(reviewsHeader(<CountUp value={1234} />));

    expect(countElement()).toHaveTextContent("1,234");
  });

  it("keeps the caller's decimals rather than guessing them from the value", () => {
    markRevealed("testimonials.header");
    render(reviewsHeader(<CountUp value={5} decimals={1} />));

    expect(countElement()).toHaveTextContent("5.0");
  });
});

describe("layout stability (INV-05.7)", () => {
  it("is tabular and holds the final string's width", () => {
    markRevealed("testimonials.header");
    render(reviewsHeader(<CountUp value={47} />));

    const element = countElement();
    expect(element).toHaveClass("tabular-nums");
    // `min-width` only applies to a box that is not inline.
    expect(element).toHaveClass("inline-block");
    expect(element.style.minWidth).toBe("2ch");
  });

  it("keeps caller classes", () => {
    markRevealed("testimonials.header");
    render(reviewsHeader(<CountUp value={47} className="font-display" />));

    expect(countElement()).toHaveClass("font-display");
  });
});

describe("the count line during the run", () => {
  it("never widens: the reserved box is the final value's, not the current frame's", () => {
    render(reviewsHeader(<CountUp value={47} />));
    observer.enterViewport(revealElement());

    // Mid-run the text is one character; the box is still two.
    act(() => {
      lastAnimateCall().options.onUpdate?.(3);
    });

    const element = countElement();
    expect(element).toHaveTextContent("3");
    expect(element.style.minWidth).toBe("2ch");
  });
});
