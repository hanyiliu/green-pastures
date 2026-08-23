import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { REVEAL_THRESHOLD } from "@/design/tokens";
import { Reveal, RevealItem } from "@/components/motion/Reveal";

import { installIntersectionObserverStub, type IntersectionObserverStub } from "./harness";

/**
 * INV-05.9 — "exactly two IntersectionObservers on the home page (reveal pool +
 * ambient pause)". This file owns the first of the two: however many `Reveal`s
 * a page carries, they must share **one** observer.
 *
 * That works because Motion pools observers in a module-scope map keyed by the
 * serialised viewport options, so the guarantee is really about `Reveal`
 * passing the same frozen `{ once: true, amount: 0.16, margin: "0px" }` every
 * time. The second test is the other half of the claim: vary one option and the
 * pool splits, which is why 05 §5.1 calls those three props test-only.
 *
 * The file is on its own because Motion's pool and this stub's counter are both
 * module state, and Vitest isolates modules per file, not per test.
 */

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

const SECTIONS = [
  "hero.text",
  "philosophy.quote",
  "programs.header",
  "menu.header",
  "gallery.header",
  "testimonials.header",
  "teachers.header",
  "visit.title",
];

describe("the reveal observer pool", () => {
  it("uses one observer for a page full of reveals and their staggered children", () => {
    render(
      <MotionProvider>
        {SECTIONS.map((id) => (
          <Reveal key={id} id={id} variant="rise">
            <span>{id}</span>
          </Reveal>
        ))}
        <Reveal id="programs.stones" as="ul" stagger>
          {[0, 1, 2].map((index) => (
            <RevealItem key={index} as="li" variant="sprout" index={index}>
              <span>stone</span>
            </RevealItem>
          ))}
        </Reveal>
      </MotionProvider>,
    );

    expect(observer.constructed).toHaveLength(1);
    expect(observer.constructed[0]).toEqual({
      root: undefined,
      rootMargin: "0px",
      threshold: REVEAL_THRESHOLD,
    });

    // The containers only: a `RevealItem` rides its parent's variant
    // propagation and never observes anything of its own.
    expect(observer.observedCount()).toBe(SECTIONS.length + 1);
  });

  it("splits the pool if a reveal varies its viewport options, which is why they are test-only", () => {
    render(
      <MotionProvider>
        <Reveal id="test.override" variant="rise" amount="all">
          <span>override</span>
        </Reveal>
      </MotionProvider>,
    );

    expect(observer.constructed).toHaveLength(2);
  });
});
