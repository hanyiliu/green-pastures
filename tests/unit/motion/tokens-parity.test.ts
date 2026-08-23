import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { breakpoints, dur, ease, REVEAL_THRESHOLD, rise, stagger } from "@/design/tokens";

/**
 * CSS ↔ TS parity for the motion tokens (03 INV-03.4, 05 §5.14).
 *
 * `src/styles/tokens.css` is the declaration of record and `src/design/tokens.ts`
 * is its mirror in Motion's units. This asserts both directions: every mapped
 * custom property has the TS value it should, **and** every motion custom
 * property in the stylesheet has a mapping here — so adding a `--dur-*` without
 * a TS twin fails, and so does silently dropping one.
 *
 * Two deliberate asymmetries, both from 03 §7:
 * `REVEAL_THRESHOLD` has no CSS twin (nothing in CSS can read an
 * IntersectionObserver threshold), and `--breakpoint-xl` has no TS twin
 * (it only caps `--container-page`, which no JS reads).
 *
 * 08 §4 asks for the fuller version of this — a postcss parse plus a file
 * snapshot, in `tests/unit/design` — as part of the tokens PR. This is the
 * motion slice of it, and it lives here because PR-4.3a is what created the
 * mirror.
 */

const TOKENS_CSS = resolve(process.cwd(), "src/styles/tokens.css");

/** Every `--name: value` in the stylesheet, comments stripped first. */
function readCustomProperties(): ReadonlyMap<string, string> {
  const source = readFileSync(TOKENS_CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const declarations = new Map<string, string>();

  for (const [, name, value] of source.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) {
    if (name !== undefined && value !== undefined) declarations.set(name, value.trim());
  }

  return declarations;
}

const css = readCustomProperties();

function declaration(name: string): string {
  const value = css.get(name);
  if (value === undefined) throw new Error(`${name} is not declared in src/styles/tokens.css`);
  return value;
}

function toSeconds(value: string): number {
  const match = /^([\d.]+)(ms|s)$/.exec(value);
  if (match?.[1] === undefined) throw new Error(`not a duration: ${value}`);
  return match[2] === "ms" ? Number(match[1]) / 1000 : Number(match[1]);
}

function toPx(value: string): number {
  const match = /^([\d.]+)px$/.exec(value);
  if (match?.[1] === undefined) throw new Error(`not a px length: ${value}`);
  return Number(match[1]);
}

function toBezier(value: string): number[] {
  const match = /^cubic-bezier\(([^)]+)\)$/.exec(value);
  if (match?.[1] === undefined) throw new Error(`not a cubic-bezier: ${value}`);
  return match[1].split(",").map((part) => Number(part.trim()));
}

/** rem → px at the 16px root the design assumes (03 §8). */
function remToPx(value: string): number {
  const match = /^([\d.]+)rem$/.exec(value);
  if (match?.[1] === undefined) throw new Error(`not a rem length: ${value}`);
  return Number(match[1]) * 16;
}

const DURATIONS: Readonly<Record<string, keyof typeof dur>> = {
  "--dur-rise": "rise",
  "--dur-ink": "ink",
  "--dur-polaroid": "polaroid",
  "--dur-polaroid-fade": "polaroidFade",
  "--dur-visit-fade": "visitFade",
  "--dur-subpage": "subpage",
  "--dur-word-swap": "wordSwap",
  "--dur-sprout": "sprout",
  "--dur-roll": "roll",
  "--dur-drop": "drop",
  "--dur-swing": "swing",
  "--dur-bubble": "bubble",
  "--dur-bubble-fade": "bubbleFade",
  "--dur-leaf": "leaf",
  "--dur-leaf-fast": "leafFast",
  "--dur-leaf-slow": "leafSlow",
  "--dur-sun": "sun",
  "--dur-cue": "cue",
  "--dur-countup": "countup",
};

const STAGGERS: Readonly<Record<string, keyof typeof stagger>> = {
  "--stagger-child": "child",
  "--stagger-word": "word",
  "--stagger-word-cap": "wordCap",
};

const EASINGS: Readonly<Record<string, keyof typeof ease>> = {
  "--ease-soft": "soft",
  "--ease-spring": "spring",
  "--ease-std": "std",
  "--ease-out-cubic": "outCubic",
};

const DISTANCES: Readonly<Record<string, keyof typeof rise>> = {
  "--reveal-rise": "base",
  "--reveal-rise-sm": "sm",
  "--reveal-rise-child": "child",
  "--swap-rise": "swap",
};

/** Six significant figures, so a division by 1000 cannot fail on a float tail. */
function round(value: number): number {
  return Number(value.toFixed(6));
}

/**
 * Both sides of one group, keyed by the TS field name, so a failure names the
 * token that drifted instead of just its value.
 */
function compare<K extends string>(
  mapping: Readonly<Record<string, K>>,
  fromCss: (value: string) => number,
  fromTs: Readonly<Record<K, number>>,
): { css: Record<string, number>; ts: Record<string, number> } {
  const css: Record<string, number> = {};
  const ts: Record<string, number> = {};

  for (const [property, key] of Object.entries(mapping)) {
    css[key] = round(fromCss(declaration(property)));
    ts[key] = round(fromTs[key]);
  }

  return { css, ts };
}

describe("src/design/tokens.ts mirrors src/styles/tokens.css", () => {
  it("converts every duration to seconds", () => {
    const { css: fromCss, ts } = compare(DURATIONS, toSeconds, dur);
    expect(ts).toEqual(fromCss);
  });

  it("converts every stagger to seconds", () => {
    const { css: fromCss, ts } = compare(STAGGERS, toSeconds, stagger);
    expect(ts).toEqual(fromCss);
  });

  it("turns every cubic-bezier into the bezier array Motion takes", () => {
    const fromCss: Record<string, number[]> = {};
    const ts: Record<string, number[]> = {};

    for (const [property, key] of Object.entries(EASINGS)) {
      fromCss[key] = toBezier(declaration(property));
      ts[key] = [...ease[key]];
    }

    expect(ts).toEqual(fromCss);
  });

  it("carries the reveal distances across as plain px numbers", () => {
    const { css: fromCss, ts } = compare(DISTANCES, toPx, rise);
    expect(ts).toEqual(fromCss);
  });

  it("carries the two breakpoints JS asks about, in px", () => {
    expect({ md: breakpoints.md, lg: breakpoints.lg }).toEqual({
      md: remToPx(declaration("--breakpoint-md")),
      lg: remToPx(declaration("--breakpoint-lg")),
    });
  });
});

describe("neither side has grown a token the other does not know about", () => {
  it("maps every motion custom property in the stylesheet", () => {
    const mapped = new Set([
      ...Object.keys(DURATIONS),
      ...Object.keys(STAGGERS),
      ...Object.keys(EASINGS),
      ...Object.keys(DISTANCES),
      // 03 §8: only caps `--container-page`; no JS consumer, so no TS twin.
      "--breakpoint-xl",
      "--breakpoint-md",
      "--breakpoint-lg",
    ]);

    const motionProperties = [...css.keys()].filter((name) =>
      /^--(dur-|stagger-|ease-|reveal-rise|swap-rise|breakpoint-)/.test(name),
    );

    expect(motionProperties.length).toBeGreaterThan(0);
    expect(motionProperties.filter((name) => !mapped.has(name))).toEqual([]);
  });

  it("maps every field of the TS mirror", () => {
    expect(Object.keys(dur).sort()).toEqual(Object.values(DURATIONS).sort());
    expect(Object.keys(stagger).sort()).toEqual(Object.values(STAGGERS).sort());
    expect(Object.keys(ease).sort()).toEqual(Object.values(EASINGS).sort());
    expect(Object.keys(rise).sort()).toEqual(Object.values(DISTANCES).sort());
    expect(Object.keys(breakpoints).sort()).toEqual(["lg", "md"]);
  });

  it("keeps REVEAL_THRESHOLD out of the stylesheet, where it would mean nothing", () => {
    expect(REVEAL_THRESHOLD).toBe(0.16);
    expect(css.has("--reveal-threshold")).toBe(false);
  });
});
