// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

/**
 * The font declaration (03 §3.1, `D-03.4`, `D-03.5`, `D-03.14`).
 *
 * `next/font/google` is a build-time construct: the published
 * `next/font/google` entry point is an empty module, and the real loader is
 * substituted by the compiler. So the loaders are stubbed and this file asserts
 * the only thing `src/design/fonts.ts` decides — **which faces, which weights,
 * which `display`, and which custom-property names** are handed to them. Every
 * value below is transcribed from 03 §3.1 by hand rather than imported, so a
 * silent edit to the module fails here instead of shipping.
 *
 * The last case is the seam that matters at runtime: `--font-display` and
 * `--font-body` in `src/styles/tokens.css` are `var(--font-fredoka)` /
 * `var(--font-nunito)`, which resolve only because `variable` below spells the
 * same two names. Rename one side and the brand type silently degrades to the
 * CJK system stack with no error anywhere — this pair is the check.
 */

type LoaderOptions = {
  subsets: string[];
  weight: string[];
  display: string;
  variable: string;
};

const loaded = vi.hoisted(() => ({
  fredoka: [] as unknown[],
  nunito: [] as unknown[],
}));

vi.mock("next/font/google", () => ({
  Fredoka: (options: unknown) => {
    loaded.fredoka.push(options);
    return { className: "fredoka", variable: "fredoka-variable", style: {} };
  },
  Nunito: (options: unknown) => {
    loaded.nunito.push(options);
    return { className: "nunito", variable: "nunito-variable", style: {} };
  },
}));

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/** Importing the module is what calls the loaders; the arrays fill on load. */
await import("@/design/fonts");

const options = (calls: unknown[]): LoaderOptions => calls[0] as LoaderOptions;

describe("src/design/fonts.ts", () => {
  it("loads each face exactly once", () => {
    expect(loaded.fredoka).toHaveLength(1);
    expect(loaded.nunito).toHaveLength(1);
  });

  it("declares Fredoka as 03 §3.1 prints it", () => {
    expect(options(loaded.fredoka)).toEqual({
      subsets: ["latin"],
      weight: ["500", "600"],
      display: "swap",
      variable: "--font-fredoka",
    });
  });

  it("declares Nunito as 03 §3.1 prints it — including the 800 of D-03.4", () => {
    expect(options(loaded.nunito)).toEqual({
      subsets: ["latin"],
      weight: ["600", "700", "800"],
      display: "swap",
      variable: "--font-nunito",
    });
  });

  it("loads no Chinese webfont (D-03.5, HD-14)", () => {
    const source = readFileSync(join(REPO_ROOT, "src/design/fonts.ts"), "utf8");
    const imported = source.match(/import\s*\{([^}]*)\}\s*from\s*"next\/font\/google"/);
    const loaders = (imported?.[1] ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "");

    expect(loaders.toSorted()).toEqual(["Fredoka", "Nunito"]);
    expect(source).not.toMatch(/next\/font\/local/);
  });

  it("names the two custom properties tokens.css reads", () => {
    const tokens = readFileSync(join(REPO_ROOT, "src/styles/tokens.css"), "utf8");

    for (const calls of [loaded.fredoka, loaded.nunito]) {
      expect(tokens).toContain(`var(${options(calls).variable})`);
    }
  });
});
