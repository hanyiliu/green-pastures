import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { describe, expect, it, onTestFinished } from "vitest";

import { Leaf } from "@/components/decor/Leaf";
import { ScrollCue } from "@/components/decor/ScrollCue";
import { Sun } from "@/components/decor/Sun";
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
 * written for.
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
 * Puts `ambient.css` in the document for the length of one test, so jsdom has a
 * real cascade to compute instead of a stubbed import.
 */
function installAmbientStylesheet(): void {
  const style = document.createElement("style");
  style.textContent = AMBIENT_CSS;
  document.head.append(style);
  onTestFinished(() => {
    style.remove();
  });
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
   * What no test can assert yet is the *trigger*. The attribute is set by
   * `AmbientScope`, the single `useInView` 05 §5.4 asks for; 04 §3.3 places that
   * component and no Phase 4 row builds it, which `ambient.css` §3 says in its
   * own words. Nothing in the shipping site sets `data-ambient` at all. So
   * "off-screen" is deliberately not in the name below: green here means the
   * CSS half is correct and waiting, not that a loop has ever stopped.
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
