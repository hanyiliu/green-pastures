import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";

/**
 * axe-core inside Playwright, for the form states 08 §6 names (PR-5.10).
 *
 * **Why this file exists instead of an import.** `D-08.8` specifies
 * `@axe-core/playwright`, and that package is not a dependency of this
 * repository — nor is `axe-core` itself, which is present only as a transitive
 * dependency of `eslint-plugin-jsx-a11y` and is therefore not resolvable from
 * the project root under pnpm's non-hoisted layout. Adding it edits
 * `package.json` and `pnpm-lock.yaml`, which PR-5.10 does not own: 10 §7 gives
 * this PR `e2e/form*`, and gives `e2e/a11y*` — the family that will want the
 * same helper for every other route — to PR-8.4. So the dependency is
 * *reported* rather than added, and the resolver below stands in until the
 * wrapper lands.
 *
 * **The stand-in cannot silently do nothing.** {@link axeSource} either finds
 * axe-core or throws, and it throws from inside the test, so a layout change
 * that hides the package reds the run instead of reporting a scan that measured
 * zero rules. When the dependency does land, the first branch —
 * `require.resolve("axe-core/axe.min.js")` — starts answering, the store walk
 * stops being reached, and this whole file can be replaced by
 * `new AxeBuilder({ page })` with no change to the spec that calls it.
 */

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const resolveFrom = createRequire(import.meta.url);

/** `D-08.8`: all of WCAG 2.2 AA, which is the union of these four tag sets. */
export const WCAG_TAGS: readonly string[] = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

let cachedSource: string | undefined;

function axeSource(): string {
  if (cachedSource !== undefined) return cachedSource;

  try {
    cachedSource = resolveFrom.resolve("axe-core/axe.min.js");
    return cachedSource;
  } catch {
    // Not a direct dependency yet — fall through to pnpm's virtual store.
  }

  const store = join(REPO_ROOT, "node_modules", ".pnpm");
  const directory = existsSync(store)
    ? readdirSync(store).find((name) => name.startsWith("axe-core@"))
    : undefined;

  const candidate =
    directory === undefined
      ? undefined
      : join(store, directory, "node_modules", "axe-core", "axe.min.js");

  if (candidate === undefined || !existsSync(candidate)) {
    throw new Error(
      "axe-core was not found. Add @axe-core/playwright as a devDependency (08 D-08.8) " +
        "and replace e2e/form-axe.ts with AxeBuilder.",
    );
  }

  cachedSource = candidate;
  return cachedSource;
}

/* -------------------------------------------------------------------------- *
 * The contrast exceptions — `D-08.8`'s mechanism, this family's entries
 * -------------------------------------------------------------------------- */

/**
 * One colour pair 03 §10 has already computed as failing AA.
 *
 * `D-08.8` is explicit that `color-contrast` is **not** blanket-disabled: each
 * violation is matched against a list of audited pairs, a matched one is
 * reported, an unmatched one fails the job. The list lives in
 * `e2e/axe-exceptions.json` in that decision, and that file is PR-8.4's — so
 * the entries this family needs live here instead, in the same shape, ready to
 * be lifted into the JSON when PR-8.4 creates it.
 *
 * The pairs are 03 §10's own, unchanged, and 03 `OQ-03.2`'s default is what
 * makes them expected rather than new: *"ship design values, keep this table as
 * the known-failure list"*. They leave this list as OQ-03.2's replacements land
 * — a token edit changes the observed hex, the entry stops matching, and the
 * run fails until the entry is deleted. That is the intended direction.
 *
 * The ratio is part of the match, not decoration. Matching on hexes alone would
 * accept the same two colours composited over a different ground; requiring the
 * ratio 03 §10 computed means a change in what sits *behind* the text is an
 * unmatched violation and fails.
 */
export type ContrastException = {
  /**
   * Text colour, as axe composites it — and matched **as** the text colour.
   *
   * The pair is oriented, not a set. An earlier revision matched `fg`/`bg` in
   * either order, and that quietly made one entry cover two different defects:
   * `#ffffff` on `#6f8a5f` is the audited submit button, while `#6f8a5f` on
   * `#ffffff` is sage used as *text* on the card — the same two colours, the
   * same 3.83, and one of them a failure 03 §10 never passed. axe always
   * reports `fgColor` as the text colour, so orienting the match costs nothing
   * and stops an allowance for a fill from excusing the inverse as type.
   */
  readonly fg: string;
  readonly bg: string;
  /** The ratio 03 §10 records, to two decimals. */
  readonly ratio: number;
  readonly reason: string;
};

/** How far an observed ratio may sit from the audited one and still match. */
const RATIO_TOLERANCE = 0.05;

export const CONTRAST_EXCEPTIONS: readonly ContrastException[] = [
  {
    fg: "#8a8170",
    bg: "#fbf8f0",
    ratio: 3.63,
    reason: "03 §10 / D-03.12 — muted on cream (required legend, privacy line)",
  },
  {
    fg: "#8a8170",
    bg: "#ffffff",
    ratio: 3.84,
    reason: "03 §10 / D-03.12 — the same muted pair over the form card's white",
  },
  {
    fg: "#a89e8a",
    bg: "#fbf8f0",
    ratio: 2.49,
    reason: "03 §10 / D-03.12 — muted-2 on cream (the two select placeholders)",
  },
  {
    fg: "#ffffff",
    bg: "#6f8a5f",
    ratio: 3.83,
    reason: "03 §10 / D-03.12 — white on sage (the submit button)",
  },

  /*
   * Every entry above is a 03 §10 row verbatim, and that is now the whole list.
   *
   * PR-5.10 also carried two entries that were **not** audited rows — sage
   * (`#6f8a5f`) as link text at 12–14 px bold in `FormAlert`, `SuccessPanel`
   * and `NoscriptFallback`, where 4.5:1 is the threshold and 03 §10 passes that
   * pair only as AA-large. They were a finding, not an allowance, and they are
   * gone because the finding is fixed: those three links bind to
   * `--color-form-link` (03 §2.3, `#4f6b43`) instead, which measures 5.63:1 on
   * cream and 5.97:1 on the card's white.
   *
   * Deleting them is the test — a regression to sage puts the banner's
   * violation straight back with nothing left to match it. That is true of the
   * success panel's too only because {@link ContrastException} now matches an
   * oriented pair: while the match ran in either direction, the audited
   * white-on-sage button covered sage-on-white text as well, and deleting that
   * second entry proved nothing at all.
   */
];

/* -------------------------------------------------------------------------- *
 * Running it
 * -------------------------------------------------------------------------- */

/** One violating node, with the colour data `color-contrast` attaches to it. */
export type AxeNode = {
  readonly target: string;
  readonly fg: string | undefined;
  readonly bg: string | undefined;
  readonly ratio: number | undefined;
};

export type AxeViolation = {
  readonly id: string;
  readonly impact: string;
  readonly help: string;
  readonly nodes: readonly AxeNode[];
};

type AxeCheckResult = {
  readonly id: string;
  readonly data?: unknown;
};

type AxeRunResults = {
  readonly violations: ReadonlyArray<{
    readonly id: string;
    readonly impact?: string | null;
    readonly help: string;
    readonly nodes: ReadonlyArray<{
      readonly target: readonly unknown[];
      readonly any: readonly AxeCheckResult[];
    }>;
  }>;
};

type AxeGlobal = {
  readonly run: (context: unknown, options: unknown) => Promise<AxeRunResults>;
};

/** The split `D-08.8` asks for: what fails the job, and what is merely reported. */
export type AxeOutcome = {
  readonly unexpected: readonly AxeViolation[];
  readonly allowed: readonly string[];
};

/**
 * Run axe over `selector` and split the result into unexpected and audited.
 *
 * The scope is a selector rather than the whole document on purpose: every
 * other region of `/` belongs to another PR's section, and a form suite that
 * failed on the hero's contrast would be reporting someone else's defect at the
 * wrong gate. PR-8.4's route-wide sweep is where the document-level rules —
 * landmarks, page title, heading order — get asserted.
 */
export async function runAxe(page: Page, selector: string): Promise<AxeOutcome> {
  await page.addScriptTag({ path: axeSource() });

  const violations = await page.evaluate(
    async ([root, tags]) => {
      const axe = (globalThis as unknown as { axe?: AxeGlobal }).axe;
      if (axe === undefined) throw new Error("axe-core did not attach to the page.");

      const results = await axe.run(root, { runOnly: { type: "tag", values: tags } });

      return results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? "unknown",
        help: violation.help,
        nodes: violation.nodes.map((node) => {
          const colours = node.any.find((check) => check.id === "color-contrast")?.data as
            { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined;

          return {
            target: node.target.map(String).join(" "),
            fg: colours?.fgColor,
            bg: colours?.bgColor,
            ratio: colours?.contrastRatio,
          };
        }),
      }));
    },
    [selector, WCAG_TAGS] as const,
  );

  const allowed: string[] = [];
  const unexpected: AxeViolation[] = [];

  for (const violation of violations) {
    const remaining: AxeNode[] = [];

    for (const node of violation.nodes) {
      const exception = violation.id === "color-contrast" ? matchException(node) : undefined;
      if (exception === undefined) remaining.push(node);
      else allowed.push(`${node.target}: ${describeNode(node)} — ${exception.reason}`);
    }

    if (remaining.length > 0) unexpected.push({ ...violation, nodes: remaining });
  }

  return { unexpected, allowed };
}

function sameColour(a: string | undefined, b: string): boolean {
  return a !== undefined && a.toLowerCase() === b.toLowerCase();
}

function matchException(node: AxeNode): ContrastException | undefined {
  return CONTRAST_EXCEPTIONS.find(
    (entry) =>
      sameColour(node.fg, entry.fg) &&
      sameColour(node.bg, entry.bg) &&
      Math.abs((node.ratio ?? 0) - entry.ratio) <= RATIO_TOLERANCE,
  );
}

function describeNode(node: AxeNode): string {
  if (node.fg === undefined || node.bg === undefined) return "no colour data";
  return `${node.fg} on ${node.bg} at ${String(node.ratio ?? 0)}:1`;
}

/** A one-line-per-node summary, so a red run names the rule and the element. */
export function describeViolations(violations: readonly AxeViolation[]): string {
  return violations
    .flatMap((violation) =>
      violation.nodes.map(
        (node) =>
          `${violation.id} (${violation.impact}) on ${node.target}: ${violation.help}` +
          (node.fg === undefined ? "" : ` [${describeNode(node)}]`),
      ),
    )
    .join("\n");
}
