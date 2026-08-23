import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { Reveal } from "@/components/motion/Reveal";
import { rise } from "@/design/tokens";

import { installIntersectionObserverStub, installMatchMedia } from "./harness";

/**
 * 05 §5.3: below `md` the `rise` entrance travels 18 px, not 26 — "delivered by
 * the variant factory reading `rise.sm` … under the mobile breakpoint hook".
 * `riseChild` is unaffected and stays at 22 px.
 *
 * A file of its own because `Reveal` caches one `MediaQueryList` at module
 * scope (one listener for the whole page, INV-05.9's spirit), so a suite can
 * only answer one breakpoint.
 */

beforeAll(() => {
  installIntersectionObserverStub();
  installMatchMedia(false);
});

function revealElement(id: string): HTMLElement {
  const element = document.querySelector(`[data-reveal-id="${id}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`no reveal with id ${id}`);
  return element;
}

describe("below the md breakpoint", () => {
  it("rises 18 px instead of 26", () => {
    render(
      <MotionProvider>
        <Reveal id="programs.header" variant="rise">
          <span>header</span>
        </Reveal>
      </MotionProvider>,
    );

    expect(rise.sm).toBe(18);
    expect(revealElement("programs.header").style.transform).toContain("translateY(18px)");
  });

  it("leaves riseChild at its 22 px, which the design does not change by view", () => {
    render(
      <MotionProvider>
        <Reveal id="menu.chips" variant="riseChild">
          <span>chips</span>
        </Reveal>
      </MotionProvider>,
    );

    expect(revealElement("menu.chips").style.transform).toContain("translateY(22px)");
  });
});
