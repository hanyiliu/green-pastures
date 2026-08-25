// @vitest-environment node
import { globSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * What Tailwind is allowed to read (`src/app/globals.css`).
 *
 * Tailwind v4's extractor is not language-aware: it pulls class-shaped tokens
 * out of every non-ignored file in the project, and a class name *written
 * about* is indistinguishable from one used. This file is scanned by nothing,
 * which is the whole point of it — and it is also the tripwire for the day that
 * stops being true.
 *
 * ── The sentinel ──────────────────────────────────────────────────────────
 *
 * `rotate-180` below is a real Tailwind utility, it is used nowhere in `src/`,
 * and this comment is the only place in the repository that spells it. So it is
 * a live probe of the scanner's reach: with the source scan pointed at `src/`
 * alone the production stylesheet has no `.rotate-180` rule, and the moment
 * anything re-widens the scan it acquires one. Measured on this tree, not
 * assumed — with the scan widened, that rule is emitted; with it narrowed, it
 * is not.
 *
 * That was never hypothetical. Under the blocklist this replaced, thirty rules
 * shipped to production for no reason but that `tests/` was scanned: every
 * `not.toHaveClass(…)` mints the class it proves absent, `withOverrides` fixture
 * strings minted `absolute!` / `block!` / `normal-case!` / `whitespace-normal!`,
 * and a *prose comment* in `Chip.test.tsx` minted `bg-bg-teachers` on its own.
 *
 * ── Why the shape is asserted and not the exclusions ──────────────────────
 *
 * The predecessor of this rule was a list of `@source not` lines, one per
 * incident — `docs/`, then `.beads/`. A blocklist is only ever as complete as
 * the last thing that went wrong, so the assertions below are about the
 * *direction* rather than the membership: detection off, one tree on. A fourth
 * tree of prose can then be added to the repository without anybody having to
 * remember this file exists.
 */

const GLOBALS = readFileSync(new URL("../../../src/app/globals.css", import.meta.url), "utf8");

/**
 * The entry point with its comments removed.
 *
 * Every assertion below is about what the file *declares*, and the file's
 * comments quote the very directives being matched — the note explaining why
 * the blocklist was retired says `@source not` in as many words. Matching the
 * raw text would fail on the explanation rather than on the CSS.
 */
const DECLARATIONS = GLOBALS.replace(/\/\*[\s\S]*?\*\//gu, "");

/** Every `@source "…"` in the entry point, in source order. */
const sourced = [...DECLARATIONS.matchAll(/@source\s+(?:not\s+)?["']([^"']+)["']/gu)].map(
  ([, path]) => path,
);

describe("the Tailwind source scan", () => {
  it("turns automatic detection off at the import", () => {
    expect(DECLARATIONS).toMatch(/@import\s+["']tailwindcss["']\s+source\(none\)/u);
  });

  it("scans src/ and nothing else", () => {
    expect(sourced).toEqual(["../../src"]);
  });

  it("keeps the allowlist an allowlist", () => {
    expect(DECLARATIONS).not.toMatch(/@source\s+not/u);
  });

  it("does not spell its sentinel anywhere under src/", () => {
    const root = new URL("../../../src/", import.meta.url).pathname;
    const files = globSync("**/*.{ts,tsx,css}", { cwd: root });
    const offenders = files.filter((file) =>
      readFileSync(`${root}${file}`, "utf8").includes("rotate-180"),
    );

    expect(offenders).toEqual([]);
  });
});
