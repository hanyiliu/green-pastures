import { act, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { describe, expect, it, onTestFinished } from "vitest";

import { Leaf } from "@/components/decor/Leaf";
import { ScrollCue } from "@/components/decor/ScrollCue";
import { Sun } from "@/components/decor/Sun";
import { Section } from "@/components/layout/Section";
import { AmbientScope } from "@/components/motion/AmbientScope";
import { MotionProvider } from "@/components/motion/MotionProvider";

/**
 * `ambient.css` (05 §5.4, `D-05.7`, INV-05.1, INV-05.11; PR-4.3b's acceptance
 * row).
 *
 * Vitest runs with `css: false`, so the `import "./ambient.css"` the three
 * components make is stubbed out and nothing puts these rules in the page on
 * its own. That is a fact about the import, not about jsdom: the file's text is
 * read from disk below, and a `<style>` handed to jsdom is cascaded like any
 * other — selectors match, and `getComputedStyle` answers. So one clause here
 * is asserted on its *effect* (see "the acceptance clauses").
 *
 * The rest is text, because jsdom stops short in two places that matter: it
 * does not resolve `var(--dur-leaf)`, and its media state is fixed, so
 * `prefers-reduced-motion` cannot be flipped. Durations and the reduced-motion
 * clause are therefore proved on the stylesheet's words here and on real
 * behaviour in 08's e2e matrix, which owns them.
 *
 * The other half a unit test owns is the one nobody else checks: that the hooks
 * the components emit are the hooks the stylesheet answers to. It is the half
 * that catches a typo, because a `data-loop` with no matching rule fails
 * silently in every browser.
 *
 * The file lives beside `WordSwap` and `CountUp` in `components/motion` (04 §2)
 * but is tested here, with the three components that import it: it has no
 * behaviour of its own, and a rule is only correct relative to the markup it is
 * written for. `AmbientScope` is here for the same reason — it is the other
 * end of one wire, and the only assertion worth making about it runs the whole
 * length: observer says off-screen → attribute on the section → a real `Leaf`
 * computes `animation-play-state: paused`.
 */

/**
 * Read from the project root rather than from `import.meta.url`: Vitest hands
 * the module a transformed specifier, not a `file:` URL, and `fileURLToPath`
 * rejects it. `process.cwd()` is the Vitest root, which is the repository root.
 */
const AMBIENT_CSS = readFileSync(
  resolve(process.cwd(), "src/components/motion/ambient.css"),
  "utf8",
);

/** Every `@keyframes <name> { … }` block in the file, brace-matched. */
function keyframeBlocks(): Map<string, string> {
  const blocks = new Map<string, string>();
  const opener = /@keyframes\s+([\w-]+)\s*\{/g;

  let match = opener.exec(AMBIENT_CSS);
  while (match !== null) {
    const name = match[1] ?? "";
    let depth = 1;
    let index = opener.lastIndex;
    while (depth > 0 && index < AMBIENT_CSS.length) {
      const character = AMBIENT_CSS[index];
      if (character === "{") depth += 1;
      if (character === "}") depth -= 1;
      index += 1;
    }
    // A name may appear twice — the mobile override redeclares `gpfloat`.
    blocks.set(name, (blocks.get(name) ?? "") + AMBIENT_CSS.slice(opener.lastIndex, index - 1));
    match = opener.exec(AMBIENT_CSS);
  }

  return blocks;
}

/** Every `property: value` pair in a chunk of CSS, ignoring selectors and braces. */
function declarations(css: string): { property: string; value: string }[] {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(";")
    .map((chunk) => /(?:^|\{|\})\s*([\w-]+)\s*:\s*([^{}]+)$/.exec(chunk.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ property: match[1] ?? "", value: (match[2] ?? "").trim() }));
}

function renderDecor(node: ReactNode) {
  return render(<MotionProvider>{node}</MotionProvider>);
}

/**
 * `ambient.css` with its `@layer components { … }` wrapper peeled off.
 *
 * **jsdom does not implement cascade layers.** Not partially — its CSS parser
 * treats `@layer` as an unknown at-rule and discards the block whole, so an
 * unmodified `ambient.css` puts *nothing* in the document and every loop
 * computes `animation-name: none`. Measured against jsdom 27: the same rules
 * injected bare compute `gpfloat` / `paused`, and wrapped compute `none` /
 * `running`.
 *
 * So the wrapper is removed here rather than worked around, and what jsdom is
 * asked about is what it can answer: the cascade *within* the layer, which is
 * the whole of what the rules below assert — which selector beats which, and
 * which hook the components emit. Layer order is a relation between this
 * stylesheet and Tailwind's `utilities`, it has no meaning inside one file, and
 * jsdom loads no Tailwind. The one thing this loses — that the wrapper is
 * present at all — is asserted directly by "sits in @layer components" below,
 * so a wrapper that got deleted still fails a test rather than silently turning
 * this back into a stylesheet no utility can override.
 */
const AMBIENT_RULES = unwrapComponentsLayer(AMBIENT_CSS);

/** Strip one `@layer components { … }` wrapper, brace-matched, if present. */
function unwrapComponentsLayer(css: string): string {
  const open = css.indexOf("@layer components {");
  if (open === -1) return css;

  const bodyStart = css.indexOf("{", open) + 1;
  let depth = 1;
  let index = bodyStart;
  while (index < css.length && depth > 0) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") depth -= 1;
    index += 1;
  }

  return css.slice(0, open) + css.slice(bodyStart, index - 1) + css.slice(index);
}

/**
 * Puts `ambient.css` in the document for the length of one test, so jsdom has a
 * real cascade to compute instead of a stubbed import.
 */
function installAmbientStylesheet(): void {
  const style = document.createElement("style");
  style.textContent = AMBIENT_RULES;
  document.head.append(style);
  onTestFinished(() => {
    style.remove();
  });
}

/**
 * A two-way `IntersectionObserver`, for the length of one test.
 *
 * `tests/unit/motion/harness.ts` has a counting stub already and this is not
 * it: every suite that uses that one is checking a `Reveal`, which is
 * `once: true` and never hears about a departure, so it can only drive an
 * element *into* view. The pause is the other direction and the resume is the
 * bug that matters, so both are needed here — as is the target each observer
 * was pointed at, which is the difference between watching the section and
 * watching `AmbientScope`'s own marker.
 */
type AmbientObserver = {
  /** How many `new IntersectionObserver(…)` since the stub went in (INV-05.9). */
  count: () => number;
  /** Every element currently observed, across every instance. */
  targets: () => Element[];
  /**
   * Deliver one callback for a target. Several states deliver several records
   * in that one callback, oldest first — which is what a real observer does
   * when an element crosses the edge twice between frames.
   */
  report: (element: Element, ...states: readonly boolean[]) => void;
};

function installObserverStub(): AmbientObserver {
  const owners = new Map<Element, StubObserver>();
  const original = globalThis.IntersectionObserver;
  let constructed = 0;

  class StubObserver {
    readonly callback: IntersectionObserverCallback;
    readonly elements = new Set<Element>();

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      constructed += 1;
    }

    observe(element: Element): void {
      this.elements.add(element);
      owners.set(element, this);
    }

    unobserve(element: Element): void {
      this.elements.delete(element);
      owners.delete(element);
    }

    disconnect(): void {
      for (const element of this.elements) owners.delete(element);
      this.elements.clear();
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  globalThis.IntersectionObserver = StubObserver as unknown as typeof IntersectionObserver;
  onTestFinished(() => {
    globalThis.IntersectionObserver = original;
  });

  return {
    count: () => constructed,
    targets: () => [...owners.keys()],
    report: (element, ...states) => {
      const observer = owners.get(element);
      if (observer === undefined) throw new Error("report: the element is not being observed");
      const entries = states.map(
        (isIntersecting) => ({ target: element, isIntersecting }) as IntersectionObserverEntry,
      );
      act(() => {
        observer.callback(entries, observer as unknown as IntersectionObserver);
      });
    },
  };
}

/** `animation-*`, as jsdom computes it for the `.loop` under `selector`. */
function loopStyle(container: HTMLElement, selector: string): CSSStyleDeclaration {
  const element = container.querySelector(`${selector} .loop`);
  if (element === null) throw new Error(`no .loop under ${selector}`);
  return window.getComputedStyle(element);
}

/** The values a rendered decoration puts on the named attribute. */
function hooks(attribute: string, node: ReactNode): string[] {
  const { container } = renderDecor(node);
  return Array.from(container.querySelectorAll(`[${attribute}]`)).map(
    (element) => element.getAttribute(attribute) ?? "",
  );
}

const loopHooks = (node: ReactNode) => hooks("data-loop", node);
const speedHooks = (node: ReactNode) => hooks("data-speed", node);

describe("the loops 05 §5.4 names", () => {
  /**
   * The wrapper the rest of this file has to remove before jsdom will read it.
   *
   * It is what lets a Tailwind utility reach a loop at all (05 §5.4): imported
   * by a component, this stylesheet ships unlayered, and unlayered normal
   * declarations outrank every layered one whatever their specificity — so
   * before the wrapper, `md:[&>svg]:animate-none` lost to `.loop[data-loop=…]`
   * on layer order with no specificity a caller could add to win. `components`
   * is the layer Tailwind v4 declares immediately before `utilities`. Deleting
   * the wrapper changes no rule in this file and silently removes the only way
   * to turn one loop off at one breakpoint, which is exactly the kind of edit
   * that needs a failing test rather than a comment.
   */
  it("sits in @layer components, so any utility can override it", () => {
    const declarations = (css: string) => css.replaceAll(/\/\*[\s\S]*?\*\//gu, "");

    expect(declarations(AMBIENT_CSS)).toMatch(/@layer\s+components\s*\{/u);
    // One wrapper around the whole file, not a layer per section.
    expect(declarations(unwrapComponentsLayer(AMBIENT_CSS))).not.toMatch(/@layer/u);
    expect(declarations(unwrapComponentsLayer(AMBIENT_CSS))).toContain('.loop[data-loop="leaf"]');
  });

  it("declares all four, under the design's own keyframe names", () => {
    expect([...keyframeBlocks().keys()].sort()).toEqual([
      "gpbounce",
      "gpfloat",
      "gpfloat2",
      "gpsun",
    ]);
  });

  it("animates nothing but transform (INV-05.1)", () => {
    for (const [name, block] of keyframeBlocks()) {
      const properties = declarations(block).map((declaration) => declaration.property);
      expect(properties.length, `${name} declares nothing`).toBeGreaterThan(0);
      expect(new Set(properties), `${name} animates more than transform`).toEqual(
        new Set(["transform"]),
      );
    }
  });

  it("takes every duration from a --dur-* token, never a literal (INV-05.6)", () => {
    const durations = declarations(AMBIENT_CSS)
      .filter((declaration) => declaration.property === "animation-duration")
      .map((declaration) => declaration.value);

    expect(durations.length).toBeGreaterThan(0);
    for (const duration of durations) {
      expect(duration).toMatch(/^var\(--dur-[\w-]+\)$/);
    }
  });

  it("covers the leaf's 7 s and 9 s instances as well as the 8 s base", () => {
    expect(AMBIENT_CSS).toContain("var(--dur-leaf)");
    expect(AMBIENT_CSS).toContain("var(--dur-leaf-fast)");
    expect(AMBIENT_CSS).toContain("var(--dur-leaf-slow)");
  });
});

describe("the acceptance clauses", () => {
  it("stops the loops under reduced motion outright, rather than shortening them", () => {
    const reducedMotion = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(
      AMBIENT_CSS,
    );

    expect(reducedMotion).not.toBeNull();
    expect(reducedMotion?.[1]).toMatch(/\.loop\s*\{[^}]*animation:\s*none\s*!important/);
  });

  /**
   * `D-05.7`'s pause, as far as anything can prove it today.
   *
   * The rule's *effect* is what the test asserts, not its spelling: the
   * stylesheet goes into the document, a leaf is rendered under a scope
   * element, and jsdom computes `animation-play-state` across the descendant
   * combinator. A deleted rule, a mistyped attribute value, a selector that
   * misses the markup, or a `.loop` that turned out not to be animating in the
   * first place all fail here — which the regex this replaced did not.
   *
   * It asserts the *rule*, and nothing about what moves the attribute: the
   * test sets it by hand. "Off-screen" is therefore still absent from the name
   * — the trigger is `AmbientScope` and it has a describe of its own below,
   * which drives an observer instead. Keeping the two apart is what says which
   * half broke when one of them goes red.
   */
  it("pauses a loop whose scope is marked paused, and only that scope (D-05.7)", () => {
    installAmbientStylesheet();

    const { container } = renderDecor(
      <>
        <section id="scope">
          <Leaf id="deco-hero-leaf-1" size={40} tint="hero-1" />
        </section>
        <section id="elsewhere">
          <Leaf id="deco-hero-leaf-2" size={28} tint="hero-2" variant="b" />
        </section>
      </>,
    );

    // A pause proves nothing about an element that was never animating.
    expect(loopStyle(container, "#scope").animationName).toBe("gpfloat");
    expect(loopStyle(container, "#scope").animationPlayState).toBe("running");

    const scope = container.querySelector("#scope");
    scope?.setAttribute("data-ambient", "paused");

    expect(loopStyle(container, "#scope").animationPlayState).toBe("paused");
    // Scoped to the section that left the viewport, never to the page.
    expect(loopStyle(container, "#elsewhere").animationPlayState).toBe("running");

    scope?.removeAttribute("data-ambient");
    expect(loopStyle(container, "#scope").animationPlayState).toBe("running");
  });
});

/* -------------------------------------------------------------------------- *
 * AmbientScope — the trigger the rule above waits for
 * -------------------------------------------------------------------------- */

/** The `h1` id `Section` points `aria-labelledby` at (INV-04.8). */
const HERO_TITLE_ID = "hero-title";

/**
 * The hero, as `HeroSection` composes it: a real `Section`, a looping `Leaf`
 * in its `decor`, and the scope beside them. Nothing is mocked between the
 * observer and the computed style.
 *
 * `scoped` is how the mobile-only case is expressed — 04 §3.3 mounts a scope on
 * `PhilosophySection` at one breakpoint and not the other, so the scope can go
 * away while its section stays.
 */
function HeroLikeSection({ scoped }: { scoped: boolean }) {
  return (
    <Section
      id="hero"
      labelledBy={HERO_TITLE_ID}
      decor={
        <>
          {scoped ? <AmbientScope /> : null}
          <Leaf id="deco-hero-leaf-1" size={40} tint="hero-1" />
        </>
      }
    >
      <h1 id={HERO_TITLE_ID}>hero</h1>
    </Section>
  );
}

describe("AmbientScope, the trigger (D-05.7)", () => {
  function renderHero(scoped = true) {
    installAmbientStylesheet();
    const observer = installObserverStub();
    const view = renderDecor(<HeroLikeSection scoped={scoped} />);
    const section = view.container.querySelector<HTMLElement>("#hero");
    if (section === null) throw new Error("no #hero section");
    return { ...view, observer, section };
  }

  it("pauses the section's loops when it leaves the viewport, and resumes them", () => {
    const { container, observer, section } = renderHero();

    // Running until the observer says otherwise: the attribute is absent, not
    // set to some third value, so a section is never paused before its first
    // callback.
    expect(section.hasAttribute("data-ambient")).toBe(false);
    expect(loopStyle(container, "#hero").animationName).toBe("gpfloat");
    expect(loopStyle(container, "#hero").animationPlayState).toBe("running");

    observer.report(section, false);

    expect(section.getAttribute("data-ambient")).toBe("paused");
    expect(loopStyle(container, "#hero").animationPlayState).toBe("paused");

    observer.report(section, true);

    expect(section.hasAttribute("data-ambient")).toBe(false);
    expect(loopStyle(container, "#hero").animationPlayState).toBe("running");
  });

  it("builds one observer, and points it at the section rather than its own marker", () => {
    const { observer, section } = renderHero();

    // INV-05.9 counts observers, and this is the one 08 §5's `@motion-obs`
    // expects beside the frozen reveal pool.
    expect(observer.count()).toBe(1);
    // A zero-size marker crosses the viewport edge at a different moment than
    // the section it stands in for, so watching it would pause at the wrong
    // scroll position — and watching it while the *section* carries the
    // attribute is a bug no computed style would reveal.
    expect(observer.targets()).toEqual([section]);
  });

  it("takes the newest record in a batch, not any record in it", () => {
    const { container, observer, section } = renderHero();

    // One callback, two crossings: in, then out. The section is off screen at
    // the end of it, so it pauses. Asking whether *any* record intersected
    // reads this batch as "still visible" and leaves a departed hero running.
    observer.report(section, true, false);

    expect(section.getAttribute("data-ambient")).toBe("paused");
    expect(loopStyle(container, "#hero").animationPlayState).toBe("paused");
  });

  it("leaves no section paused behind it when the scope unmounts", () => {
    const { container, observer, section, rerender } = renderHero();

    observer.report(section, false);
    expect(loopStyle(container, "#hero").animationPlayState).toBe("paused");

    rerender(
      <MotionProvider>
        <HeroLikeSection scoped={false} />
      </MotionProvider>,
    );

    // The section outlives the scope, which is what 04 §3.3's philosophy leaf
    // does at the `md` boundary. A loop frozen by a component that is gone
    // could never start again.
    expect(section.hasAttribute("data-ambient")).toBe(false);
    expect(loopStyle(container, "#hero").animationPlayState).toBe("running");
  });

  it("observes nothing at all outside a section, rather than pausing the page", () => {
    installAmbientStylesheet();
    const observer = installObserverStub();

    const { container } = renderDecor(
      <>
        <AmbientScope />
        <Leaf id="deco-hero-leaf-1" size={40} tint="hero-1" />
      </>,
    );

    // `[data-ambient="paused"]` is a descendant combinator, so a scope that
    // resolved to `body` would stop every loop on the page at once. Finding no
    // `[data-section]` is the one case where doing nothing is the answer.
    expect(observer.count()).toBe(0);
    expect(container.querySelector("[data-ambient]")).toBeNull();
    expect(loopStyle(container, "div").animationPlayState).toBe("running");
  });
});

describe("the hooks the components emit", () => {
  it("has a rule for every data-loop value the three decorations render", () => {
    const emitted = new Set([
      ...loopHooks(<Sun id="deco-hero-sun" />),
      ...loopHooks(<Leaf id="deco-hero-leaf-1" size={40} tint="hero-1" />),
      ...loopHooks(<Leaf id="deco-hero-leaf-2" size={28} tint="hero-2" variant="b" />),
      ...loopHooks(
        <ScrollCue id="deco-hero-cue" href="#philosophy">
          scroll
        </ScrollCue>,
      ),
    ]);

    expect(emitted).toEqual(new Set(["sun", "leaf", "leaf-b", "cue"]));
    for (const hook of emitted) {
      expect(AMBIENT_CSS, `no rule for data-loop="${hook}"`).toContain(
        `.loop[data-loop="${hook}"]`,
      );
    }
  });

  it("has a rule for the two speeds that are not the base", () => {
    const speeds = new Set([
      ...speedHooks(<Leaf id="deco-hero-leaf-1" size={40} tint="hero-1" speed="fast" />),
      ...speedHooks(<Leaf id="deco-hero-leaf-2" size={28} tint="hero-2" />),
      ...speedHooks(<Leaf id="deco-hero-leaf-3" size={22} tint="hero-3" speed="slow" />),
    ]);

    expect(speeds).toEqual(new Set(["fast", "base", "slow"]));
    for (const speed of ["fast", "slow"]) {
      expect(AMBIENT_CSS, `no rule for data-speed="${speed}"`).toContain(
        `.loop[data-speed="${speed}"]`,
      );
    }
    // `base` is deliberately unstyled: the `data-loop` rule already carries
    // `--dur-leaf`, so a third rule would be a second place to keep in step.
    expect(AMBIENT_CSS).not.toContain('.loop[data-speed="base"]');
  });
});
