import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import process from "node:process";

/**
 * `pnpm check:tokens` — the CSS half of the token invariants (08 §2, §9).
 *
 * 08 §9 maps three invariants onto this file and 08 §2 states each scan in one
 * sentence. Those sentences are the whole specification and this header does
 * not extend them:
 *
 * | Check | 08 §2 says | Invariant |
 * |---|---|---|
 * | `font-stack` | "`check-tokens.ts` fails on any `--font-cjk-(sc\|tc)` reference in `src/**\/*.css` outside `src/styles/tokens.css`" | INV-03.6 |
 * | `breakpoints` | "fails on any `@media` or `@import` condition carrying a length `src/styles/tokens.css` does not declare as a `--breakpoint-*`, and on any `@variant` whose name is not one of those tokens'" | INV-03.3 |
 * | `reduced-motion` | "and on a `prefers-reduced-motion` media query missing from a file that declares `@keyframes`" | INV-05.8 |
 *
 * The TypeScript halves of the same three invariants are elsewhere and stay
 * there: ESLint bans the two `font-cjk-*` utilities and the
 * `sm:` / `2xl:` variants in `className`, INV-02.9's locale-comparison rule
 * covers the "no locale branch in TypeScript" half of INV-03.6, and the
 * `@motion` end-to-end tags cover the runtime half of INV-05.8. This file is
 * the part none of those can see, because none of them reads a stylesheet.
 *
 * Exit codes: 0 clean, 1 a check fired, 2 the gate could not run. Callers only
 * need "non-zero is bad", but the third is deliberately not silence — the same
 * three-way contract `scripts/ci/todo-grep.sh`, `scripts/ci/coverage-report.sh`
 * and `scripts/ci/build-budget.ts` publish, and for the same reason.
 *
 * ## One script, two callers (INV-08.6)
 *
 * `ci.yml`'s `tokens` job and `pnpm verify` both run `pnpm run check:tokens`,
 * so the local verdict and the CI verdict are the *same* verdict rather than
 * two that happen to agree. That is not a style preference: the marker gate ran
 * in CI and nowhere else until `gp-dln.206`, `pnpm verify` reported clean over
 * a tree the pull request was about to go red on, and `main` broke that way on
 * 2026-08-23. Every gate that can be a script rather than a workflow body
 * should be one (08 §11 (c)).
 *
 * It is a `tokens` **job** and not a step inside `static` because 10 §10's
 * serialisation rule for `.github/workflows/ci.yml` is "additions are new jobs,
 * never edits to an existing job", and a step appended to `static` would have
 * been the edit. `budget` made the same call for the same rule ("it is in
 * `budget` rather than `build` because 10 §10's `ci.yml` rule makes additions
 * new jobs and never edits to an existing one"). 10 §10 records two named
 * exceptions to that rule; this needed neither, so none is claimed.
 *
 * ## Where the numbers come from, and why none of them is written here
 *
 * `src/styles/tokens.css` is the declaration of record (03 D-03.1). This file
 * reads the `--breakpoint-*` declarations out of it and asks that the rest of
 * the stylesheets restate *those* values and no others. Nothing in this script
 * spells `48rem`, and that is load-bearing twice over. A gate that hard-coded
 * the value would go stale the day a breakpoint moved — and worse, it would
 * pass while the tree was inconsistent, which is the failure mode it exists to
 * catch. `src/components/motion/ambient.css` states the problem from the other
 * side: "a media query cannot read a custom property: `--breakpoint-md: 48rem`
 * in `src/styles/tokens.css` is the value of record and this is its one
 * restatement." The restatement is unavoidable; an *unchecked* restatement is
 * not, and this is the check.
 *
 * The variant names are read from the same place: the breakpoints this project
 * declares are the breakpoints its CSS may use. Today that resolves to exactly
 * `md`, `lg` and `xl`, which is INV-03.3 verbatim, and it keeps banning
 * Tailwind's stock `sm` and `2xl` — those are defaults the project never
 * declares, so they are never in the allowed set (03 §8).
 *
 * ## What would have to be true for this to pass on a violating tree
 *
 * This repository has catalogued eight guards that could not fire, so the
 * question is asked before the script is written rather than after. Seven
 * answers are load-bearing here and each is a line of code below.
 *
 *   1. **The violating file is not in the scanned set.** A glob or a walk that
 *      matches nothing passes every assertion silently — `lighthouserc.cjs`
 *      grew a guard for exactly this after a URL matched neither pattern. So
 *      the walk is a plain recursive read of `src/`, an empty result is fatal,
 *      and the run prints how many stylesheets it scanned. A run that scanned
 *      one file is visibly wrong on the face of the output.
 *   2. **The scanner never saw the file it exempts.** `font-stack` exempts one
 *      path. An exemption whose path matches nothing exempts nothing and is
 *      invisible either way, so the walk is asserted to have produced it. If
 *      `src/styles/tokens.css` is renamed, this gate stops rather than quietly
 *      scanning a tree it no longer understands.
 *   3. **The allowed set is empty.** No declared breakpoints means every
 *      `@media` length is unrecognised, which reads as three hundred failures
 *      or — if the tree also happens to have no media queries — as a clean run
 *      over a check that did nothing. Fatal instead.
 *   4. **A comment satisfies a requirement.** `reduced-motion` asks whether a
 *      guard is *present*; a `prefers-reduced-motion` inside a block comment
 *      would satisfy a naive text search while guarding nothing. Comments are
 *      blanked before any scan, which closes that door and, in the same move,
 *      stops prose that merely names a script stack from firing `font-stack`.
 *      Blanked, not deleted: every character becomes a space and every newline
 *      survives, so reported line numbers are the file's own.
 *   5. **A file cannot be read.** A `catch` that skips the file turns an
 *      unreadable stylesheet into an unscanned one and reports clean. Fatal.
 *   6. **A width is spelled in a form the regex does not know.** `min-width`,
 *      `max-width` and the range forms (`width >= 48rem`, `48rem <= width`,
 *      `400px < width < 900px`) are five spellings of one thing, and a check
 *      written against the feature names would miss whichever spelling nobody
 *      thought of. So the scan does not look for width features at all: it
 *      takes **every length literal in a media prelude** and asks whether this
 *      project declared it. Nothing in CSS puts a length in a media prelude
 *      except a width or a height query, both of which are breakpoints, and
 *      `dppx` / `dpi` / `x` / bare ratios are not lengths and are not matched.
 *      A media query needing a length this project has not declared is a fourth
 *      breakpoint, and it goes to 03 §8 before it goes into a stylesheet.
 *   7. **The gate aborts before it reaches its own guards.** A static `import`
 *      from `@/` is resolved before the first statement runs, so the draft that
 *      borrowed `parseCssTokens` from `src/design/css-tokens.ts` exited **1**
 *      with a module-resolution stack trace when `src/` was absent — a
 *      cannot-run wearing a check-fired exit code, six guards upstream of the
 *      one written for it. This file imports nothing from the tree it judges;
 *      see the note above `declaredBreakpoints`.
 *
 * Dependencies: Node. Never `bd`.
 */

/* ------------------------------------------------------------------------- *
 * The specification, as constants
 * ------------------------------------------------------------------------- */

/** The tree the three scans cover, exactly as 08 §2 writes it. */
const CSS_ROOT = join("src");

/**
 * The declaration of record (03 D-03.1) — the one file allowed to name the
 * script stacks, and the file the breakpoints are read out of.
 */
const TOKENS_CSS = join("src", "styles", "tokens.css");

/**
 * The two script-specific stacks. They exist only to be selected by the
 * `:lang()` rules in `TOKENS_CSS` (03 D-03.14); a stylesheet that names either
 * one is choosing a script by hand, which is the locale branch INV-03.6 forbids
 * wearing a CSS hat.
 *
 * Written as one alternation and never as two whole utility names, here or in
 * the prose above — the same trick `scripts/ci/todo-grep.sh` plays with its own
 * vocabulary, and for a sharper reason. Tailwind v4 scans the project for class
 * candidates and `src/app/globals.css` excludes only `docs` and `.beads`, so
 * `scripts/` is scanned: a draft of this file that spelled both names in a
 * sentence made Tailwind **emit** both of them as real utilities into the
 * production stylesheet — the gate against those utilities generating them.
 * This paragraph is written the way it is for the same reason; spelling either
 * name in full to explain the trap would spring it.
 * Measured at 128 bytes of dead CSS, harmless and absurd. The real fix is an
 * `@source not` line for `scripts/` beside the two already in `globals.css`;
 * that file belongs to another lane, so this one keeps its own house clean and
 * the pointer is in 08 §2.
 */
const SCRIPT_STACKS = /--font-cjk-(sc|tc)\b/g;

/**
 * CSS block comments. Blanked rather than removed — see the header, item 4.
 * `src/design/css-tokens.ts` states the same rule for its own parse; this file
 * scans raw text rather than declarations, so it needs the stripper without the
 * parser, and importing half of `src/` to borrow one regex would be the worse
 * trade. An unterminated `/*` has no closing delimiter and so matches nothing,
 * which means a malformed comment cannot swallow the rest of a file.
 */
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;

/**
 * The two at-rules that carry a **viewport media condition**, with their
 * preludes — up to the `{` of a block or the `;` of a statement, neither of
 * which a prelude may itself contain. `@import "…" (width >= 40rem);` states a
 * breakpoint exactly as `@media` does, so leaving it out would be a spelling
 * this check does not know about, which is item 6's whole complaint.
 *
 * `@supports` and container queries are deliberately absent and neither is a
 * silent gap. `@supports (width: 1px)` tests whether a declaration parses, so
 * its length is a probe rather than a breakpoint. A container query sizes
 * against an element and not the viewport; 08 §2 does not name it, this project
 * has none, and the day one appears 03 §8 decides whether its size is a token
 * before this file decides anything about it.
 */
const CONDITIONAL_RULE = /@(media|import)\b([^{;]*)[{;]/gi;

/** Tailwind v4's `@variant <name>`. `@custom-variant` has no `@` before `variant`. */
const VARIANT_RULE = /@variant\s+([a-z0-9-]+)/gi;

/**
 * A CSS length. Every unit is a length unit, which is what keeps `2dppx`,
 * `192dpi`, `2x` and `16/9` out of the match: each needs the unit to follow the
 * digits directly, and none of theirs is here.
 */
const LENGTH =
  /\d+(?:\.\d+)?(?:px|rem|em|ex|ch|vw|vh|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|cqw|cqh|cqi|cqb|cm|mm|q|in|pt|pc)\b/gi;

/** The same length, anchored — a token value that is one length and nothing else. */
const LENGTH_ONLY = new RegExp(`^${LENGTH.source}$`, "i");

/**
 * The guard INV-05.8 asks for in CSS (05 §5.9): `(prefers-reduced-motion)` in
 * its boolean form or `(prefers-reduced-motion: reduce)`. `no-preference` is
 * the opposite query and does not satisfy it.
 */
const REDUCED_MOTION = /prefers-reduced-motion\s*(?::\s*reduce\s*)?[),]/i;

/** `@keyframes <name>` — case-insensitive, because CSS at-rules are. */
const KEYFRAMES = /@keyframes\b/i;

/**
 * `--breakpoint-<name>: <value>;` as `TOKENS_CSS` declares it. The value stops
 * at the `;` and may hold no brace, so a rule header can never be read as a
 * declaration — the same shape `src/design/css-tokens.ts` uses, narrowed to the
 * one namespace this gate reads.
 */
const BREAKPOINT_TOKEN = /--breakpoint-([a-z0-9-]+)\s*:\s*([^;{}]+);/gi;

/* ------------------------------------------------------------------------- *
 * Reporting
 * ------------------------------------------------------------------------- */

type Finding = {
  readonly check: string;
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

const findings: Finding[] = [];

const fail = (check: string, file: string, line: number, message: string): void => {
  findings.push({ check, file, line, message });
};

/** The gate could not run. Never silent, never exit 0 — see the header. */
const die = (message: string): never => {
  if (process.env.GITHUB_ACTIONS) {
    process.stderr.write(`::error::check:tokens: ${message}\n`);
  } else {
    process.stderr.write(`check:tokens: ${message}\n`);
  }
  process.exit(2);
};

/* ------------------------------------------------------------------------- *
 * Reading the tree
 * ------------------------------------------------------------------------- */

/**
 * The project root, from this file's own location rather than from git or the
 * working directory. `pnpm run` enters the package root, but a seat running
 * `tsx scripts/ci/check-tokens.ts` from a subdirectory would otherwise scan a
 * `src/` that is not there and find nothing — the silent-nothing of item 1 by a
 * different door. This gate needs no repository, so it asks for none.
 */
const repoRoot = resolve(import.meta.dirname, "..", "..");

const show = (path: string): string => relative(repoRoot, path).split("\\").join("/");

const cssRoot = join(repoRoot, CSS_ROOT);
if (!existsSync(cssRoot)) {
  die(
    `${CSS_ROOT} does not exist under ${repoRoot}, so no stylesheet was scanned. This is not a clean tree.`,
  );
}

/** Every stylesheet under `src/`, sorted so the output is stable run to run. */
const stylesheets: readonly string[] = readdirSync(cssRoot, {
  recursive: true,
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
  .map((entry) => join(entry.parentPath, entry.name))
  .sort((a, b) => a.localeCompare(b));

// Item 1: a walk that matched nothing would pass all three checks in silence.
if (stylesheets.length === 0) {
  die(`no .css file under ${CSS_ROOT}, so nothing was scanned. This is not a clean tree.`);
}

const tokensCss = join(repoRoot, TOKENS_CSS);

// Item 2: `font-stack` exempts exactly this path, and an exemption whose path
// is not in the scanned set exempts nothing while looking identical.
if (!stylesheets.includes(tokensCss)) {
  die(
    `${TOKENS_CSS} is not among the ${String(stylesheets.length)} stylesheet(s) found under ${CSS_ROOT}. It is the declaration of record (03 D-03.1) and the one path the script-stack check exempts; if it has moved, this gate is scanning a tree it no longer understands.`,
  );
}

/** Item 5: an unreadable stylesheet is an unscanned one, and never clean. */
const read = (path: string): string => {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    return die(
      `cannot read ${show(path)}: ${error instanceof Error ? error.message : String(error)}. Nothing was scanned in it, which is not the same as finding nothing.`,
    );
  }
};

/** Item 4: comments blanked, so line numbers survive and prose cannot vote. */
const blankComments = (source: string): string =>
  source.replace(CSS_COMMENT, (block) => block.replace(/[^\n]/g, " "));

const lineOf = (source: string, index: number): number => source.slice(0, index).split("\n").length;

/* ------------------------------------------------------------------------- *
 * The breakpoints this project declares
 * ------------------------------------------------------------------------- */

/**
 * `--breakpoint-<name>: <length>` from the declaration of record, comments
 * blanked first and the first declaration winning — the rules
 * `src/design/css-tokens.ts` states for its own parse and
 * `tests/unit/design/css-tokens.test.ts` pins.
 *
 * That module exports a parser this could have imported, and importing it was
 * the first draft. It is not worth what it costs: a static `import` from `@/`
 * is resolved before the first line of this file runs, so a renamed or deleted
 * `src/design/css-tokens.ts` — or a missing `src/` — aborted the gate with a
 * module-resolution stack trace and **exit 1**, which callers read as "a check
 * fired" rather than "the gate could not run". A gate that cannot tell those
 * two apart is the fail-open this file's header is about, and it is a poor
 * trade for one regex. So `scripts/ci/check-tokens.ts` imports nothing from the
 * tree it judges, reaches every guard below in the order written, and depends
 * on Node alone.
 *
 * A breakpoint whose value is not a length is Tailwind's
 * `--breakpoint-<name>: initial`, which *removes* a stock variant — so it
 * contributes neither a name nor a value here, which is the right answer for
 * both.
 */
const declaredBreakpoints = new Map<string, string>();
for (const declaration of blankComments(read(tokensCss)).matchAll(BREAKPOINT_TOKEN)) {
  const name = (declaration[1] ?? "").toLowerCase();
  const value = (declaration[2] ?? "").trim().toLowerCase();
  if (declaredBreakpoints.has(name) || !LENGTH_ONLY.test(value)) continue;
  declaredBreakpoints.set(name, value);
}

// Item 3: an empty allowed set is not a strict gate, it is an unread one.
if (declaredBreakpoints.size === 0) {
  die(
    `${TOKENS_CSS} declares no \`--breakpoint-*\` token with a length value, so there is no set of allowed breakpoints to check against and the breakpoint scan asserted nothing (03 §8, INV-03.3).`,
  );
}

const allowedLengths = new Set(declaredBreakpoints.values());
const allowedVariants = new Set(declaredBreakpoints.keys());

const breakpointList = [...declaredBreakpoints]
  .map(([name, value]) => `${name} = ${value}`)
  .join(", ");

/* ------------------------------------------------------------------------- *
 * The three scans
 * ------------------------------------------------------------------------- */

for (const path of stylesheets) {
  const file = show(path);
  const source = blankComments(read(path));

  // ── INV-03.6 · the script stacks are `tokens.css`'s alone ────────────────
  if (path !== tokensCss) {
    for (const match of source.matchAll(SCRIPT_STACKS)) {
      fail(
        "font-stack",
        file,
        lineOf(source, match.index),
        `${match[0]} is referenced outside ${TOKENS_CSS}. The two script stacks exist only to be selected by that file's \`:lang()\` rules (03 D-03.14); naming one here picks a script by hand, which is the locale branch INV-03.6 forbids. Use \`--font-display\` or \`--font-body\`, which resolve through \`--font-cjk\` per \`<html lang>\`.`,
      );
    }
  }

  // Read once: both the breakpoint scan and the reduced-motion scan want them.
  const conditionals = [...source.matchAll(CONDITIONAL_RULE)];

  // ── INV-03.3 · no breakpoint this project has not declared ───────────────
  for (const rule of conditionals) {
    const atRule = (rule[1] ?? "").toLowerCase();
    for (const length of (rule[2] ?? "").matchAll(LENGTH)) {
      const value = length[0].toLowerCase();
      if (allowedLengths.has(value)) continue;
      fail(
        "breakpoints",
        file,
        lineOf(source, rule.index),
        `\`@${atRule}\` at ${value}, which is not a breakpoint this project declares (${breakpointList}). A media query cannot read a custom property, so a restatement of a declared value is expected and checked; a new number is a fourth breakpoint, and INV-03.3 says there are three. Move the value into \`--breakpoint-*\` in ${TOKENS_CSS} and 03 §8 first, or use one that is there.`,
      );
    }
  }

  for (const variant of source.matchAll(VARIANT_RULE)) {
    const name = (variant[1] ?? "").toLowerCase();
    if (allowedVariants.has(name)) continue;
    fail(
      "breakpoints",
      file,
      lineOf(source, variant.index),
      `\`@variant ${name}\` is not one of this project's breakpoints (${[...allowedVariants].join(", ")}). Tailwind's stock \`sm\` and \`2xl\` are never declared here and components must not use them (03 §8, INV-03.3).`,
    );
  }

  // ── INV-05.8 · a file that animates says what happens when motion is off ─
  const keyframes = KEYFRAMES.exec(source);
  if (keyframes !== null) {
    const guarded = conditionals.some(
      (rule) => (rule[1] ?? "").toLowerCase() === "media" && REDUCED_MOTION.test(rule[2] ?? ""),
    );
    if (!guarded) {
      fail(
        "reduced-motion",
        file,
        lineOf(source, keyframes.index),
        `this file declares \`@keyframes\` and has no \`@media (prefers-reduced-motion: reduce)\` rule. INV-05.8 is reduced motion *everywhere* (05 §5.9): an ambient loop has no destination, so the answer is \`animation: none\`, not a shorter one. A \`prefers-reduced-motion\` named only in a comment does not count, and neither does \`no-preference\`.`,
      );
    }
  }
}

/* ------------------------------------------------------------------------- *
 * The verdict
 * ------------------------------------------------------------------------- */

for (const finding of findings) {
  if (process.env.GITHUB_ACTIONS) {
    process.stderr.write(
      `::error file=${finding.file},line=${String(finding.line)}::check:tokens ${finding.check}: ${finding.message}\n`,
    );
  } else {
    process.stderr.write(
      `check:tokens ${finding.check}: ${finding.file}:${String(finding.line)}: ${finding.message}\n`,
    );
  }
}

/**
 * Printed on every run, clean or not. A count is the cheapest way to see that
 * the walk found a tree rather than a corner of one, and the breakpoint list is
 * what the two scans above were actually checking against — both are the
 * difference between "found nothing" and "looked at nothing".
 */
process.stdout.write(
  `check:tokens: ${String(stylesheets.length)} stylesheet(s) under ${CSS_ROOT}, breakpoints ${breakpointList}; ` +
    (findings.length === 0 ? "clean.\n" : `${String(findings.length)} failure(s).\n`),
);

process.exit(findings.length === 0 ? 0 : 1);
