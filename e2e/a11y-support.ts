import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";

import type { Locale } from "@/i18n/routing";

import { openSettled } from "./visual-support";

/**
 * The accessibility suite's instrument (PR-8.4 · 08 §6 · D-08.8 · 05 §5.14).
 *
 * ## What changed under this file, and why it is not a refactor
 *
 * `D-08.8` names `@axe-core/playwright`, and PR-5.10 could not add it: 10 §7
 * gives that row `e2e/form*` and gives `e2e/a11y*` — this family — to PR-8.4.
 * So `e2e/form-axe.ts` stood in with a resolver that walked pnpm's virtual
 * store looking for `axe-core`, and `e2e/axe-exceptions.json`, which `D-08.8`
 * specifies by name, did not exist: its entries lived inline in that file.
 * Both were reported (`gp-dln.233`) rather than fixed, because fixing them
 * meant editing `package.json`.
 *
 * This row owns both. `@axe-core/playwright` and `axe-core` are devDependencies
 * now, the store walk is gone, `e2e/axe-exceptions.json` exists, and
 * `e2e/form-axe.ts` is a re-export of this module so PR-5.10's spec keeps
 * working untouched.
 *
 * ## Why a scan has to be *settled* before it is read
 *
 * This is the finding that shaped the file. axe composites the colour it
 * reports out of the element's *current* rendering, so an element caught
 * mid-entrance reports the colour it has at that instant, not the colour it
 * comes to rest at. A first sweep of every route × locale × viewport produced
 * **61 distinct colour pairs**; the same sweep after waiting for the page to
 * stop moving produced **34**, and the 27 that vanished were things like
 * `#f1f2f0 on #6b865c` and `#96b288 on #364a2f` — the submit button and the
 * Visit panel's labels, photographed at 62 % and 91 % of the way through a
 * fade. An allowlist keyed on hex values cannot be written against numbers like
 * those: they differ every run. So {@link settleMotion} waits for the page's own
 * animations to finish, {@link openA11yPage} walks the page first so every
 * entrance has actually started, and every scan after an interaction settles
 * again before it reads anything.
 *
 * ## Where the scans run
 *
 * The viewport is the Playwright project's (08 §5): `chromium-desktop` is 1280
 * and `webkit-mobile` is 390, so "route × locale × viewport" is the matrix
 * below crossed with the project list rather than a third loop inside a test.
 * The two engines were compared before this was relied on — a full home-page
 * sweep in chromium at 390 and in webkit at 393 reports the *same 24 pairs with
 * the same hexes and the same ratios*, because axe computes contrast from
 * computed styles rather than from pixels.
 */

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

/** `D-08.8`: all of WCAG 2.2 AA, which is the union of these four tag sets. */
export const WCAG_TAGS: readonly string[] = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

/* -------------------------------------------------------------------------- *
 * The allowlist — `e2e/axe-exceptions.json`, which `D-08.8` names
 * -------------------------------------------------------------------------- */

/** Where a run proves the entry still matches something real. */
export type ExceptionWitness = {
  /** Locale-less route path, e.g. `/` or `/menu`. */
  readonly route: string;
  /** Viewport widths at which the pair is observable. */
  readonly widths: readonly number[];
};

export type ContrastException = {
  readonly id: string;
  /** Documentation of where the pair lives, asserted to still select something. */
  readonly selector: string;
  readonly witness: ExceptionWitness;
  /**
   * Text colour, as axe composites it — and matched **as** the text colour.
   *
   * The pair is oriented, not a set. `#ffffff` on `#6f8a5f` is the audited
   * submit button; `#6f8a5f` on `#ffffff` is sage used as *type* on a card —
   * the same two colours, the same 3.83, and one of them a failure 03 §10 never
   * passed. axe always reports `fgColor` as the text colour, so orienting the
   * match costs nothing and stops an allowance for a fill from excusing the
   * inverse as text.
   */
  readonly fg: string;
  readonly bg: string;
  /** The ratio the audit records, to two decimals. */
  readonly ratio: number;
  /** `03 §10` for a row of that table, `unaudited` for a pair it has no row for. */
  readonly audit: "03 §10" | "unaudited";
  readonly reason: string;
  /** The open question whose answer retires the entry. */
  readonly expires: "OQ-03.2";
};

const EXCEPTIONS_FILE = join(REPO_ROOT, "e2e", "axe-exceptions.json");

function loadExceptions(): readonly ContrastException[] {
  const parsed: unknown = JSON.parse(readFileSync(EXCEPTIONS_FILE, "utf8"));
  const entries = (parsed as { exceptions?: readonly ContrastException[] }).exceptions ?? [];

  // An allowlist that silently reads as empty is an axe run that fails on every
  // audited pair; an allowlist that silently reads as *everything* is worse.
  // Both are louder as a throw than as a red suite nobody can explain.
  if (entries.length === 0) {
    throw new Error(`${EXCEPTIONS_FILE} carries no "exceptions" array.`);
  }

  const ids = new Set<string>();
  const pairs = new Map<string, string>();

  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate axe exception id: ${entry.id}`);
    ids.add(entry.id);

    // Widened to `string` on purpose: the type says `"OQ-03.2"`, and this is
    // the check that the file on disk agrees with it. Comparing the declared
    // type against itself would narrow to `never` and assert nothing.
    const gate: string = entry.expires;
    if (gate !== "OQ-03.2") {
      throw new Error(`Axe exception ${entry.id} names an unknown expiry gate: ${gate}`);
    }

    /*
     * Two entries may not describe the same oriented pair at the same ratio,
     * and this is what makes `e2e/a11y-exceptions.spec.ts` a proof rather than
     * a gesture. {@link matchException} returns the *first* entry that matches,
     * so a duplicate pair would let entry B shadow entry A: A would look live
     * in the report while deleting it changed nothing, because B would go on
     * excusing the same node. With the pair unique, "this entry matched" and
     * "deleting this entry leaves that node unmatched, and the sweep red" are
     * the same statement.
     */
    const key = `${entry.fg.toLowerCase()} on ${entry.bg.toLowerCase()} @ ${String(entry.ratio)}`;
    const owner = pairs.get(key);
    if (owner !== undefined) {
      throw new Error(`Axe exceptions ${owner} and ${entry.id} both claim ${key}.`);
    }
    pairs.set(key, entry.id);
  }

  return entries;
}

export const CONTRAST_EXCEPTIONS: readonly ContrastException[] = loadExceptions();

/** How far an observed ratio may sit from the audited one and still match. */
const RATIO_TOLERANCE = 0.05;

/* -------------------------------------------------------------------------- *
 * The expiry gate
 * -------------------------------------------------------------------------- */

const DOC_03 = join(REPO_ROOT, "docs", "technical", "03-design-system-tokens.md");

/**
 * Has `OQ-03.2` been answered?
 *
 * `D-08.8` dates every entry to "the phase gate that answers OQ-03.2", and an
 * entry past its expiry has to fail the job. A phase gate is not a date this
 * repository can read, but the event the gate *is* — 03's open question being
 * answered — is written down in one place and in one shape: the document marks
 * an answered question by putting the word `answered` in its bullet, which is
 * exactly what OQ-03.3, OQ-03.4 and OQ-03.7 already look like. So the gate is
 * read from the register rather than from a calendar, and the day someone
 * records the palette decision the allowlist stops being accepted on trust.
 */
export function expiryGateHasPassed(): boolean {
  const doc = readFileSync(DOC_03, "utf8");
  const bullet = /^- \*\*OQ-03\.2\*\*[\s\S]*?(?=\n- \*\*OQ-|\n## )/m.exec(doc)?.[0];

  if (bullet === undefined) {
    throw new Error("OQ-03.2 is not in docs/technical/03-design-system-tokens.md any more.");
  }

  return /\banswered\b/i.test(bullet);
}

/* -------------------------------------------------------------------------- *
 * Running axe
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

/** The split `D-08.8` asks for: what fails the job, and what is merely reported. */
export type AxeOutcome = {
  readonly unexpected: readonly AxeViolation[];
  readonly allowed: readonly string[];
  /** The ids of the entries that matched, so a caller can prove one is live. */
  readonly matched: readonly string[];
};

export type AxeScope = {
  /** Restrict the scan to this selector. Omit to scan the whole document. */
  readonly include?: string;
};

type ColourData = {
  readonly fgColor?: string;
  readonly bgColor?: string;
  readonly contrastRatio?: number;
};

/** Run axe over the page (or `scope.include`) and split the result. */
export async function runAxe(page: Page, scope: AxeScope = {}): Promise<AxeOutcome> {
  let builder = new AxeBuilder({ page }).withTags([...WCAG_TAGS]);
  if (scope.include !== undefined) builder = builder.include(scope.include);

  const results = await builder.analyze();

  const allowed: string[] = [];
  const matched: string[] = [];
  const unexpected: AxeViolation[] = [];

  for (const violation of results.violations) {
    const remaining: AxeNode[] = [];

    for (const raw of violation.nodes) {
      const colours = raw.any.find((check) => check.id === "color-contrast")?.data as
        ColourData | undefined;

      const node: AxeNode = {
        target: raw.target.map(String).join(" "),
        fg: colours?.fgColor,
        bg: colours?.bgColor,
        ratio: colours?.contrastRatio,
      };

      const entry = violation.id === "color-contrast" ? matchException(node) : undefined;
      if (entry === undefined) {
        remaining.push(node);
      } else {
        matched.push(entry.id);
        allowed.push(`${node.target}: ${describeNode(node)} — ${entry.reason}`);
      }
    }

    if (remaining.length > 0) {
      unexpected.push({
        id: violation.id,
        impact: violation.impact ?? "unknown",
        help: violation.help,
        nodes: remaining,
      });
    }
  }

  return { unexpected, allowed, matched };
}

function sameColour(a: string | undefined, b: string): boolean {
  return a !== undefined && a.toLowerCase() === b.toLowerCase();
}

export function matchException(node: AxeNode): ContrastException | undefined {
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

/**
 * Scan, and put the audited half where a job summary can find it.
 *
 * `D-08.8`'s two halves are split across this function and its caller on
 * purpose: a violation matching an audited pair is *reported*, which happens
 * here as a test annotation, and an **unmatched** one fails the job, which
 * happens in the spec as a plain `expect`. Hiding the assertion inside a helper
 * would leave tests whose body contains no `expect` at all — which is both what
 * `playwright/expect-expect` objects to and a fair description of what those
 * tests would look like to a reader.
 */
export async function scanAxe(
  page: Page,
  info: TestInfo,
  scope: AxeScope = {},
): Promise<AxeOutcome> {
  const outcome = await runAxe(page, scope);

  for (const entry of outcome.allowed) {
    info.annotations.push({ type: "axe-exception", description: entry });
  }

  return outcome;
}

/* -------------------------------------------------------------------------- *
 * Settling
 * -------------------------------------------------------------------------- */

/**
 * How long to keep asking whether the page has stopped moving.
 *
 * A bound on a synchronisation, not a sleep (`D-08.13`): the condition is the
 * observable end state — no finite animation is still running — and the wait
 * ends the frame it holds.
 */
const QUIET_TIMEOUT_MS = 15_000;

/**
 * Wait until nothing on the page is still animating.
 *
 * Infinite animations are excluded by construction, and they have to be: 05
 * §5.4's ambient loops (`L1`–`L3`) never finish, so a predicate that waited for
 * `document.getAnimations()` to empty would wait forever on the home page.
 * Under `prefers-reduced-motion: reduce` those loops are `animation: none`
 * anyway (05 §5.9) — the filter is what makes the same helper usable in the
 * default-motion suites as well.
 *
 * This is the half `playEveryReveal` does not cover. That helper waits for
 * `[data-reveal]` opacity, which is right for entrances and blind to everything
 * else: the hamburger sheet's `rise`, the day chip's `WordSwap` crossfade and
 * the count-up all animate elements that carry no `data-reveal`. Measured: a
 * scan taken the instant the sheet appeared reported its links at
 * `#f1efe6 on #fbf8f0` — a 1.08:1 "failure" that is a picture of a fade at 1 %.
 */
export async function settleMotion(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document.getAnimations().filter((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return animation.playState === "running" && timing?.iterations !== Infinity;
      }).length === 0,
    undefined,
    { timeout: QUIET_TIMEOUT_MS },
  );
}

/**
 * Open a page and leave it in the state a reader settles into.
 *
 * `openSettled` (PR-8.6's) stubs Turnstile, navigates, walks the page so every
 * `IntersectionObserver` fires, and waits for every reveal and every web font.
 * {@link settleMotion} then covers the animations that are not reveals. Reusing
 * the walk rather than writing a second one is deliberate: PR-8.6 records that
 * a walk which does not wait per step outruns the observer and leaves 32 of 49
 * reveals permanently hidden on a slow host, and a second copy of that helper
 * would be a second chance to get it wrong.
 */
export async function openA11yPage(page: Page, url: string): Promise<void> {
  await openSettled(page, url);
  await settleMotion(page);
}

/**
 * Put the page back at the top, and wait until it has stopped moving.
 *
 * Every scan in this family is taken from scroll 0, and that is a requirement
 * rather than a habit. The sticky header's background is a **92 %-opaque** cream
 * layer (`--color-nav-bg`, 03 §2.4), so the ground axe composites for the header's
 * own text is 8 % of whatever happens to be underneath it — and axe reports the
 * composite. Clicking a day chip scrolls the chip into view, which slid the menu
 * section under the header and turned the locale toggle's audited
 * `#8a8170 on #fbf8f0` into `#8a8170 on #fbf8ee`: the same 3.62:1, two units of
 * blue apart, and an unmatched violation.
 *
 * Scrolling back is what makes the hex reproducible; it is not what makes the
 * question go away. `e2e/a11y-axe.spec.ts`'s last describe asks it directly —
 * whether the nav's own text still clears AA over *every* ground the page can
 * put beneath it — because that is a design property, and one axe can only ever
 * sample by accident.
 */
export async function restScroll(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.scrollTo(0, 0);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
  await settleMotion(page);
}

/* -------------------------------------------------------------------------- *
 * The matrix
 * -------------------------------------------------------------------------- */

/**
 * A URL that resolves to the localised not-found page — 08 §6 scans 404 too.
 *
 * The path is one `[...rest]` catch-all segment that no `site.json` route
 * declares, so it is a not-found by the routing tree's own rules rather than by
 * a string this file believes is unrouted.
 */
export function notFoundUrlFor(locale: Locale): string {
  return `/${locale}/this-route-does-not-exist`;
}

/*
 * There is deliberately no `isViewportWide()` helper here.
 *
 * The three tests that care which width they are at — the wide nav row, the
 * hamburger sheet, and the reduced-motion hover row — **pin** their viewport
 * with `test.use` instead of asking at runtime and branching. That is not a
 * style preference: `playwright/no-skipped-test` and
 * `playwright/no-conditional-in-test` both refuse the branch, and pinning is
 * the better answer anyway, because it runs each of those interactions in
 * *both* engines rather than in whichever project happens to match.
 */
