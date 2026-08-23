import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { hasRevealed, markLocaleSwap, resetRevealRegistry } from "@/components/motion/registry";
import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { rise, stagger } from "@/design/tokens";

import { installIntersectionObserverStub, type IntersectionObserverStub } from "./harness";

/**
 * `Reveal` end to end in the DOM (05 §5.1, §5.3, §5.6, §5.9; PR-4.3a's
 * acceptance row).
 *
 * No `matchMedia` is installed, so the breakpoint store answers "desktop" and
 * `rise` travels its 26 px — the same path a wide viewport takes.
 *
 * **jsdom can watch an entrance run.** It implements no Web Animations API, so
 * Motion falls back to its own frame loop and writes `style.opacity` and
 * `style.transform` on every tick — which is precisely what makes the
 * "a staggered child plays" block below a behaviour test rather than a
 * restatement of the markup. Resolution is one animation frame (~16 ms), and the
 * timing assertion leaves room for it.
 */

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  resetRevealRegistry();
});

function renderInProvider(children: ReactNode, reducedMotion?: "always" | "never" | "user") {
  return render(<MotionProvider reducedMotion={reducedMotion}>{children}</MotionProvider>);
}

function revealElement(id: string): HTMLElement {
  const element = document.querySelector(`[data-reveal-id="${id}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`no reveal with id ${id}`);
  return element;
}

/** The `li` a staggered child rendered into, by the text it wraps. */
function itemLabelled(label: string): HTMLElement {
  const item = screen.getByText(label).closest("li");
  if (!(item instanceof HTMLElement)) throw new Error(`no list item around ${label}`);
  return item;
}

/**
 * When each element first left `opacity: 0`, in milliseconds from the call,
 * sampled once per animation frame for `windowMs`.
 *
 * An element that never moves simply gets no entry — which is how the stagger
 * defect reads here, and why {@link startTimesInOrder} turns a missing entry
 * into a named failure rather than a zero.
 */
async function sampleStarts(
  items: readonly HTMLElement[],
  windowMs: number,
): Promise<ReadonlyMap<HTMLElement, number>> {
  const started = new Map<HTMLElement, number>();
  const origin = performance.now();

  await act(async () => {
    await new Promise<void>((resolve) => {
      const sample = () => {
        const elapsed = performance.now() - origin;
        for (const item of items) {
          if (!started.has(item) && Number(item.style.opacity || "0") > 0) {
            started.set(item, elapsed);
          }
        }
        if (elapsed >= windowMs) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  });

  return started;
}

async function startTimesInOrder(
  items: readonly HTMLElement[],
  windowMs: number,
): Promise<readonly number[]> {
  const started = await sampleStarts(items, windowMs);
  return items.map((item, index) => {
    const time = started.get(item);
    if (time === undefined) {
      throw new Error(
        `staggered child ${String(index)} never left opacity 0 within ${String(windowMs)} ms`,
      );
    }
    return time;
  });
}

/** The gaps between consecutive entries, without indexing back into the array. */
function consecutiveGaps(times: readonly number[]): readonly number[] {
  const gaps: number[] = [];
  let previous: number | undefined;
  for (const time of times) {
    if (previous !== undefined) gaps.push(time - previous);
    previous = time;
  }
  return gaps;
}

/** Parse a server-rendered string back into elements, the way a browser would. */
function parseServerHtml(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

describe("the hidden state", () => {
  it("renders the catalogue's hidden target and marks the element for the noscript rule", () => {
    renderInProvider(
      <Reveal id="programs.header" variant="rise">
        <p>header</p>
      </Reveal>,
    );

    const element = revealElement("programs.header");
    expect(element).toHaveAttribute("data-reveal");
    expect(element.style.opacity).toBe("0");
    expect(element.style.transform).toContain("translateY(26px)");
  });

  it("renders the element the caller asked for, so semantics survive the wrapper", () => {
    renderInProvider(
      <Reveal id="gallery.polaroids" as="ul" stagger>
        <RevealItem as="li" variant="polaroid" index={0}>
          <span>one</span>
        </RevealItem>
      </Reveal>,
    );

    expect(revealElement("gallery.polaroids").tagName).toBe("UL");
    expect(screen.getByText("one").closest("li")).not.toBeNull();
  });

  it("applies the transform origin 05 §5.2 gives the row", () => {
    renderInProvider(
      <Reveal id="teachers.frames" stagger>
        <RevealItem variant="swing">
          <span>frame</span>
        </RevealItem>
        <RevealItem variant="bubble" tail="right">
          <span>bubble</span>
        </RevealItem>
      </Reveal>,
    );

    const [swing, bubble] = screen.getAllByText(/frame|bubble/).map((node) => node.parentElement);
    expect(swing?.style.transformOrigin).toBe("50% 0%");
    expect(bubble?.style.transformOrigin).toBe("88% 100%");
  });

  it("leaves the opacity track alone when the caller asks for opaque", () => {
    renderInProvider(
      <Reveal id="hero.photo" variant="rise" opaque>
        <span>photo</span>
      </Reveal>,
    );

    const element = revealElement("hero.photo");
    expect(element.style.opacity).toBe("");
    expect(element.style.transform).toContain("translateY(26px)");
  });

  it("gives a stagger container no transform of its own (INV-05.4)", () => {
    renderInProvider(
      <Reveal id="programs.stones" as="ul" stagger>
        <RevealItem as="li" variant="sprout" index={0}>
          <span>stone</span>
        </RevealItem>
      </Reveal>,
    );

    const container = revealElement("programs.stones");
    expect(container.style.transform).toBe("");
    expect(container.style.opacity).toBe("");
  });
});

/**
 * The block the rest of this file was missing.
 *
 * Every other assertion here is about a state the element is *put into* — the
 * hidden target, a transform origin, the final state on a second mount — and all
 * of them stay true while a staggered child never animates at all. They did:
 * `RevealItem` used to spell its hidden state as `initial="hidden"`, and Motion
 * reads a *variant label* in any of `initial` / `animate` / `while*` / `exit` as
 * "this element drives its own variants" (`isControllingVariants`). Such an
 * element is never added to its parent's `variantChildren`, so the container's
 * `staggerChildren` sequenced an empty set and every child sat at `opacity: 0`
 * for good — on every stagger group on the homepage.
 *
 * So these tests watch the entrance actually run: that each child reaches
 * `opacity: 1`, and that they reach it `--stagger-child` apart rather than
 * together. A fix that made the group appear all at once would satisfy the first
 * and fail the second.
 */
describe("a staggered child plays (05 §5.3, D-05.6)", () => {
  const STONES = ["outdoors", "music", "practical-life"] as const;

  function renderStones() {
    renderInProvider(
      <Reveal id="programs.stones" as="ul" stagger>
        {STONES.map((label) => (
          <RevealItem key={label} as="li" variant="riseChild">
            <span>{label}</span>
          </RevealItem>
        ))}
      </Reveal>,
    );
    return STONES.map(itemLabelled);
  }

  it("carries every child out of the hidden state and into the visible one", async () => {
    const items = renderStones();
    for (const item of items) {
      expect(item.style.opacity).toBe("0");
      expect(item.style.transform).toContain(`translateY(${String(rise.child)}px)`);
    }

    observer.enterViewport(revealElement("programs.stones"));

    await waitFor(
      () => {
        for (const item of items) expect(item.style.opacity).toBe("1");
      },
      { timeout: 4000 },
    );

    for (const item of items) {
      expect(item.style.transform).not.toContain(`translateY(${String(rise.child)}px)`);
    }
  });

  it("starts them one --stagger-child apart, in DOM order", async () => {
    const items = renderStones();
    observer.enterViewport(revealElement("programs.stones"));

    // Long enough for the last of three to start (2 × 110 ms) with room to spare.
    const times = await startTimesInOrder(items, 900);
    const gaps = consecutiveGaps(times);
    const step = stagger.child * 1000;

    expect(gaps).toHaveLength(STONES.length - 1);
    for (const gap of gaps) {
      // The band is wide because the sampler resolves to one animation frame and
      // a loaded machine drops some; it is still nowhere near 0 (all at once) or
      // 14 ms (`--stagger-word`, which belongs to the locale cascade, not here).
      expect(gap).toBeGreaterThan(step / 2);
      expect(gap).toBeLessThan(step * 2.5);
    }
  });

  it("still ships the hidden state in the server HTML, so nothing flashes (INV-05.7)", () => {
    const host = parseServerHtml(
      renderToStaticMarkup(
        <MotionProvider>
          <Reveal id="programs.stones" as="ul" stagger>
            <RevealItem as="li" variant="riseChild">
              <span>stone</span>
            </RevealItem>
          </Reveal>
        </MotionProvider>,
      ),
    );

    const item = host.querySelector("li");
    if (!(item instanceof HTMLElement)) throw new Error("no staggered child in the server HTML");
    expect(item.style.opacity).toBe("0");
    expect(item.style.transform).toBe(`translateY(${String(rise.child)}px)`);
  });
});

describe("reveal once, across a client navigation (05 D-05.6)", () => {
  it("registers the id on the first time in view", () => {
    renderInProvider(
      <Reveal id="menu.header" variant="rise">
        <span>menu</span>
      </Reveal>,
    );

    expect(hasRevealed("menu.header")).toBe(false);

    observer.enterViewport(revealElement("menu.header"));

    expect(hasRevealed("menu.header")).toBe(true);
  });

  it("does not replay, and does not observe again, when the tree re-mounts", () => {
    const first = renderInProvider(
      <Reveal id="menu.header" variant="rise">
        <span>menu</span>
      </Reveal>,
    );

    observer.enterViewport(revealElement("menu.header"));
    const observersAfterFirstMount = observer.constructed.length;
    first.unmount();

    renderInProvider(
      <Reveal id="menu.header" variant="rise">
        <span>menu</span>
      </Reveal>,
    );

    const element = revealElement("menu.header");
    expect(element.style.opacity).not.toBe("0");
    expect(element.style.transform).not.toContain("translateY(26px)");
    expect(observer.observedCount()).toBe(0);
    expect(observer.constructed).toHaveLength(observersAfterFirstMount);
  });

  it("still hides a sibling that had never played", () => {
    const first = renderInProvider(
      <>
        <Reveal id="menu.header" variant="rise">
          <span>menu</span>
        </Reveal>
        <Reveal id="visit.form" variant="fade">
          <span>form</span>
        </Reveal>
      </>,
    );

    observer.enterViewport(revealElement("menu.header"));
    first.unmount();

    renderInProvider(
      <>
        <Reveal id="menu.header" variant="rise">
          <span>menu</span>
        </Reveal>
        <Reveal id="visit.form" variant="fade">
          <span>form</span>
        </Reveal>
      </>,
    );

    expect(revealElement("menu.header").style.opacity).not.toBe("0");
    expect(revealElement("visit.form").style.opacity).toBe("0");
  });

  it("keeps a stagger group's children at their final state on the second mount", () => {
    const first = renderInProvider(
      <Reveal id="programs.stones" as="ul" stagger>
        <RevealItem as="li" variant="sprout" index={0}>
          <span>stone</span>
        </RevealItem>
      </Reveal>,
    );

    observer.enterViewport(revealElement("programs.stones"));
    first.unmount();

    renderInProvider(
      <Reveal id="programs.stones" as="ul" stagger>
        <RevealItem as="li" variant="sprout" index={0}>
          <span>stone</span>
        </RevealItem>
      </Reveal>,
    );

    const item = screen.getByText("stone").closest("li");
    expect(item?.style.opacity).not.toBe("0");
    expect(item?.style.transform ?? "").not.toContain("scale(0.6");
  });
});

describe("the locale cascade (05 §5.6)", () => {
  it("replays an already-revealed block as swap rather than as its own variant", () => {
    const first = renderInProvider(
      <Reveal id="philosophy.quote" variant="ink">
        <span>quote</span>
      </Reveal>,
    );

    observer.enterViewport(revealElement("philosophy.quote"));
    first.unmount();

    markLocaleSwap();
    renderInProvider(
      <Reveal id="philosophy.quote" variant="ink">
        <span>quote</span>
      </Reveal>,
    );

    const element = revealElement("philosophy.quote");
    expect(element.style.opacity).toBe("0");
    expect(element.style.transform).toContain("translateY(6px)");
    expect(element.style.filter).toBe("");
  });

  it("leaves a block that had never played waiting for the scroll", () => {
    markLocaleSwap();
    renderInProvider(
      <Reveal id="visit.form" variant="fade">
        <span>form</span>
      </Reveal>,
    );

    const element = revealElement("visit.form");
    expect(element.style.opacity).toBe("0");
    expect(observer.observedCount()).toBeGreaterThan(0);
  });

  it("carries nav items, whose variant is none, into the cascade", () => {
    const first = renderInProvider(
      <Reveal id="common.nav" variant="none">
        <span>nav</span>
      </Reveal>,
    );

    expect(revealElement("common.nav").style.opacity).toBe("");
    first.unmount();

    markLocaleSwap();
    renderInProvider(
      <Reveal id="common.nav" variant="none">
        <span>nav</span>
      </Reveal>,
    );

    expect(revealElement("common.nav").style.transform).toContain("translateY(6px)");
  });
});

describe("reduced motion (05 §5.9)", () => {
  it("yields opacity only — no transform, no blur", () => {
    renderInProvider(
      <Reveal id="philosophy.quote" variant="ink">
        <span>quote</span>
      </Reveal>,
      "always",
    );

    const element = revealElement("philosophy.quote");
    expect(element.style.opacity).toBe("0");
    expect(element.style.transform).toBe("");
    expect(element.style.filter).toBe("");
  });

  it("drops the y track of a rise as well", () => {
    renderInProvider(
      <Reveal id="programs.header" variant="rise">
        <span>header</span>
      </Reveal>,
      "always",
    );

    expect(revealElement("programs.header").style.transform).toBe("");
  });

  it("drops the transform origin with the transform it belonged to", () => {
    renderInProvider(
      <Reveal id="teachers.frames" stagger>
        <RevealItem variant="swing">
          <span>frame</span>
        </RevealItem>
      </Reveal>,
      "always",
    );

    const item = screen.getByText("frame").parentElement;
    expect(item?.style.transformOrigin).toBe("");
    expect(item?.style.transform).toBe("");
  });

  it("still animates normally when the config says never", () => {
    renderInProvider(
      <Reveal id="programs.header" variant="rise">
        <span>header</span>
      </Reveal>,
      "never",
    );

    expect(revealElement("programs.header").style.transform).toContain("translateY(26px)");
  });
});

describe("the noscript stylesheet (INV-05.10)", () => {
  it("ships a rule that shows every data-reveal element without JavaScript", () => {
    const { container } = renderInProvider(
      <Reveal id="hero.text" variant="rise">
        <span>hero</span>
      </Reveal>,
    );

    const noscript = container.querySelector("noscript");
    expect(noscript?.textContent).toContain("[data-reveal]");
    expect(noscript?.textContent).toContain("opacity:1!important");
    expect(noscript?.textContent).toContain("transform:none!important");
    expect(noscript?.textContent).toContain("filter:none!important");
  });

  it("also ships the reduced-motion rule, which applies before hydration", () => {
    const { container } = renderInProvider(
      <Reveal id="hero.text" variant="rise">
        <span>hero</span>
      </Reveal>,
    );

    const styles = [...container.querySelectorAll("style")].map((node) => node.textContent ?? "");
    const reduced = styles.find((css) => css.includes("prefers-reduced-motion"));
    expect(reduced).toContain("[data-reveal]");
    expect(reduced).toContain("transform:none!important");
  });
});
