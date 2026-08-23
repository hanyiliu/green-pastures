import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * `PageTransition` and `view-transitions.css` (05 §5.7, `D-05.10`, spike
 * `OQ-05.2`).
 *
 * **Why `react` is mocked.** `ViewTransition` is not exported by the published
 * `react` package at any 19.x version; it comes from the canary build Next
 * vendors as `next/dist/compiled/react` and aliases `react` to at build time
 * (`create-compiler-aliases.js`). Vitest resolves the published package, so the
 * export is `undefined` here and rendering the real component would fail on a
 * missing element type — a fact about the test runner, not about the app. The
 * mock adds the one export and passes everything else through, which lets this
 * file assert the part that is ours: the map from transition type to
 * view-transition-class.
 *
 * The CSS half is asserted as text. That is unusual and deliberate: jsdom
 * implements neither the View Transitions API nor `::view-transition-*`, so
 * there is no DOM to interrogate, and the rules below are the ones the spike
 * found the hard way in a real browser. Losing one of them is silent — the
 * build stays green and the animation is simply wrong — so they are pinned
 * here and re-proven in the browser by 08's `@motion-vt` suite.
 */

const recorded: Array<Record<string, unknown>> = [];

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    ViewTransition: ({ children, ...props }: { children?: ReactNode }) => {
      recorded.push(props);
      return actual.createElement("div", { "data-testid": "view-transition" }, children);
    },
  };
});

const { PageTransition } = await import("@/components/motion/PageTransition");

/** Vitest runs from the repository root, so `src/` is one join away. */
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const css = read("src/components/motion/view-transitions.css");

/** The stylesheet with every comment removed — comments quote what rules must not. */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Collapse whitespace so a selector/declaration can be matched as written. */
const flat = rules.replace(/\s+/g, " ");

describe("PageTransition", () => {
  it("maps only the two subpage types to the animated class, and everything else to none", () => {
    recorded.length = 0;
    render(
      <PageTransition>
        <main />
      </PageTransition>,
    );

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toEqual({
      default: "none",
      enter: { "subpage-enter": "gp-page", default: "none" },
      exit: { "subpage-exit": "gp-page", default: "none" },
    });
  });

  it("renders its child rather than replacing it", () => {
    const { getByTestId } = render(
      <PageTransition>
        <main id="main" />
      </PageTransition>,
    );

    expect(getByTestId("view-transition").querySelector("main")).not.toBeNull();
  });

  it("is a Server Component — no directive, so it costs the client bundle nothing", () => {
    const source = read("src/components/motion/PageTransition.tsx");

    expect(source).not.toMatch(/^\s*["']use client["']/m);
  });
});

describe("view-transitions.css", () => {
  it("takes every duration and easing from a token (INV-03.1–3)", () => {
    expect(rules).not.toMatch(/\b\d+(\.\d+)?m?s\b/);
    expect(rules).not.toMatch(/cubic-bezier/);
    expect(rules).toContain("var(--dur-subpage)");
    expect(rules).toContain("var(--ease-soft)");
    expect(rules).toContain("var(--dur-word-swap)");
  });

  it("makes an untyped navigation instant: no animation, destination only", () => {
    expect(flat).toContain(
      "::view-transition-group(root) { animation: none; opacity: 1 !important; }",
    );
    expect(flat).toContain("::view-transition-old(root) { animation: none; opacity: 0; }");
    expect(flat).toContain("::view-transition-new(root) { animation: none; opacity: 1; }");
  });

  it("keeps the root group painted once its animation is removed (the spike's finding)", () => {
    // Drop this declaration — or drop only its `!important` — and the outgoing
    // page goes white mid-slide. The value being beaten is set by a UA
    // animation on the group, and animations outrank normal author rules.
    expect(flat).toMatch(/::view-transition-group\(root\) \{[^}]*opacity: 1 !important;/);
  });

  it("stops the snapshot overlay swallowing clicks for the length of a slide", () => {
    // The full declaration, as written, for the same reason the reduced-motion
    // block below is pinned whole: a prefix match is how a quiet edit slips
    // past. `::view-transition` is the root of the snapshot tree and
    // `pointer-events` inherits, so this one rule covers the entire overlay —
    // which spans the viewport for all 500 ms of the slide. PR-4.4 shipped
    // without it and measured the cost: every click in that window, in all
    // three engine/viewport combinations.
    expect(flat).toContain("::view-transition { pointer-events: none; }");
  });

  it("slides only under the two typed navigations", () => {
    expect(flat).toContain(
      "html:active-view-transition-type(subpage-enter)::view-transition-new(.gp-page) { animation: gp-slide-in var(--dur-subpage) var(--ease-soft) both; }",
    );
    expect(flat).toContain(
      "html:active-view-transition-type(subpage-exit)::view-transition-old(.gp-page) { animation: gp-slide-out var(--dur-subpage) var(--ease-soft) both; }",
    );

    // No unqualified rule may animate a page: an untyped navigation would slide.
    const unqualifiedSlide = /(^|})\s*::view-transition-(old|new)\(\.gp-page\)/;
    expect(flat).not.toMatch(unqualifiedSlide);
  });

  it("shows the outgoing page under the incoming panel on subpage-enter", () => {
    expect(flat).toContain(
      "html:active-view-transition-type(subpage-enter)::view-transition-old(root) { opacity: 1; }",
    );
    expect(flat).toContain(
      "html:active-view-transition-type(subpage-enter)::view-transition-new(root) { opacity: 0; }",
    );
  });

  it("travels 103% so the panel and its shadow start off-screen", () => {
    expect(flat).toContain("@keyframes gp-slide-in { from { translate: 103% 0; } to");
    expect(flat).toContain("@keyframes gp-slide-out { from { translate: 0 0; } to");
  });

  it("removes the slide entirely under reduced motion", () => {
    const reduced = flat.slice(flat.indexOf("@media (prefers-reduced-motion: reduce)"));

    // Full declarations, `!important` included. These are not redundant
    // defaults: each one beats a UA *animation*, and an automated "this opacity
    // is already 1" cleanup has silently stripped them once already.
    expect(reduced).toContain(
      "::view-transition-group(*) { animation: none !important; opacity: 1 !important; }",
    );
    expect(reduced).toContain(
      "::view-transition-old(*) { animation: none !important; opacity: 0 !important; }",
    );
    expect(reduced).toContain(
      "::view-transition-new(*) { animation: none !important; opacity: 1 !important; }",
    );
    // Instant, not merely fast: a shortened slide is still a slide.
    expect(reduced).not.toMatch(/var\(--dur-/);
  });
});
