import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { hasRevealed, markLocaleSwap, resetRevealRegistry } from "@/components/motion/registry";
import { Reveal, RevealItem } from "@/components/motion/Reveal";

import { installIntersectionObserverStub, type IntersectionObserverStub } from "./harness";

/**
 * `Reveal` end to end in the DOM (05 §5.1, §5.3, §5.6, §5.9; PR-4.3a's
 * acceptance row).
 *
 * No `matchMedia` is installed, so the breakpoint store answers "desktop" and
 * `rise` travels its 26 px — the same path a wide viewport takes.
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
