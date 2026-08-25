import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { beforeAll, afterEach, describe, expect, it } from "vitest";

import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { bucketsOf, withOverrides } from "@/components/ui/class-names";
import { Emoji } from "@/components/ui/Emoji";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { LearnMoreLink } from "@/components/ui/LearnMoreLink";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { routing } from "@/i18n/routing";

/**
 * The `className` contract, proved against the stylesheet Tailwind actually
 * emits rather than against the class attribute.
 *
 * `toHaveClass` was what let the defect ship: every primitive appended the
 * caller's classes, every test asserted the class was *present*, and none of
 * them asked which rule the cascade takes. Tailwind v4 sorts `@layer utilities`
 * by property, so `.bg-white` is emitted before `.bg-yelp-pill-bg` and a gold
 * chip handed `className="bg-white"` stayed gold with `bg-white` sitting right
 * there in the attribute.
 *
 * So this file compiles the real thing — Tailwind's own compiler over
 * `src/styles/tokens.css`, fed the exact classes the components render — puts
 * the result in the document, and asks `getComputedStyle` who won. jsdom
 * implements source order and `!important`, which is the whole mechanism under
 * test.
 *
 * Values that resolve through `var(--token)` cannot be read back this way
 * (jsdom does not substitute custom properties), so the colour case — the chip
 * canary — is proved on the emitted CSS text, rule order plus the `!important`
 * flag, and the computed-style assertions take the recipe properties that
 * compile to a literal: `display`, `width`, `position`, `text-transform` and
 * `white-space`.
 */

// `import.meta.url` is a jsdom `http:` URL under this environment, so both
// paths are resolved from Vitest's root, which is the repository root.
const require = createRequire(path.join(process.cwd(), "package.json"));
const TAILWIND_ENTRY = require.resolve("tailwindcss/index.css");
const TOKENS = path.join(process.cwd(), "src", "styles", "tokens.css");

/** The stylesheet Tailwind emits for exactly these classes, tokens included. */
async function compileStylesheet(candidates: readonly string[]): Promise<string> {
  const { compile } = await import("tailwindcss");

  const compiler = await compile(`@import "tailwindcss" source(none);\n@import "${TOKENS}";\n`, {
    base: path.dirname(TAILWIND_ENTRY),
    loadStylesheet: async (id: string, base: string) => {
      const target = id === "tailwindcss" ? TAILWIND_ENTRY : path.resolve(base, id);
      return { path: target, base: path.dirname(target), content: await readFile(target, "utf8") };
    },
    loadModule: () => {
      throw new Error("This stylesheet loads no plugins.");
    },
  });

  return compiler.build([...candidates]);
}

/**
 * One pair from every family the vocabulary sweep below found unguarded: two
 * utilities that write the same property from two different first segments, so
 * the bucket fallback filed them apart and {@link withOverrides} waved the
 * caller's class through. Which of the two rules the browser then took was
 * decided by nothing but where Tailwind happened to emit them.
 *
 * `tabular-nums` against `proportional-nums` is the one that was reported —
 * `CountUp`'s recipe carries `tabular-nums` — and it turned out to have
 * twenty-odd siblings.
 */
const SAME_PROPERTY = [
  { property: "font-variant-numeric", recipe: "tabular-nums", caller: "proportional-nums" },
  { property: "font-variant-numeric", recipe: "tabular-nums", caller: "normal-nums" },
  { property: "font-variant-numeric", recipe: "lining-nums", caller: "oldstyle-nums" },
  { property: "font-variant-numeric", recipe: "diagonal-fractions", caller: "stacked-fractions" },
  { property: "display", recipe: "block", caller: "table-caption" },
  { property: "display", recipe: "block", caller: "inline-table" },
  { property: "display", recipe: "flex", caller: "line-clamp-3" },
  { property: "overflow", recipe: "overflow-hidden", caller: "line-clamp-3" },
  { property: "white-space", recipe: "truncate", caller: "whitespace-nowrap" },
  { property: "text-overflow", recipe: "truncate", caller: "text-ellipsis" },
  { property: "visibility", recipe: "invisible", caller: "collapse" },
  { property: "isolation", recipe: "isolate", caller: "isolation-auto" },
  { property: "font-smoothing", recipe: "antialiased", caller: "subpixel-antialiased" },
  { property: "overflow-wrap", recipe: "break-normal", caller: "wrap-anywhere" },
  { property: "flex-grow", recipe: "flex-1", caller: "grow" },
  { property: "flex-shrink", recipe: "flex-1", caller: "shrink-0" },
  { property: "flex-basis", recipe: "flex-1", caller: "basis-0" },
  { property: "align-content", recipe: "place-content-center", caller: "content-center" },
  { property: "justify-content", recipe: "place-content-center", caller: "justify-center" },
  { property: "align-items", recipe: "place-items-center", caller: "items-center" },
  { property: "align-self", recipe: "place-self-center", caller: "self-center" },
  { property: "width", recipe: "container", caller: "w-full" },
  { property: "max-width", recipe: "container", caller: "max-w-md" },
  { property: "block-size", recipe: "block-4", caller: "h-4" },
  { property: "inline-size", recipe: "inline-4", caller: "w-4" },
  { property: "min-block-size", recipe: "min-block-4", caller: "min-h-4" },
  { property: "max-inline-size", recipe: "max-inline-4", caller: "max-w-md" },
  { property: "margin-block-start", recipe: "mbs-2", caller: "mt-2" },
  { property: "margin-block-end", recipe: "mbe-2", caller: "mb-2" },
  { property: "padding-block-start", recipe: "pbs-2", caller: "pt-2" },
  { property: "padding-block-end", recipe: "pbe-2", caller: "pb-2" },
  { property: "inset-inline-start", recipe: "start-0", caller: "left-0" },
  { property: "inset-inline-end", recipe: "end-0", caller: "right-0" },
  { property: "position", recipe: "sr-only", caller: "absolute" },
  { property: "width", recipe: "sr-only", caller: "w-full" },
  { property: "padding", recipe: "sr-only", caller: "px-4" },
  { property: "margin", recipe: "sr-only", caller: "mt-2" },
  { property: "white-space", recipe: "sr-only", caller: "whitespace-nowrap" },
  { property: "border-width", recipe: "sr-only", caller: "border-2" },
  { property: "position", recipe: "not-sr-only", caller: "relative" },
  { property: "transform", recipe: "transform-none", caller: "rotate-x-45" },
  { property: "transform", recipe: "transform-none", caller: "skew-3" },
] as const;

/**
 * The design system, which knows the whole utility vocabulary and what each
 * member of it compiles to. Same stylesheet the components are built against.
 */
async function loadDesignSystem(): Promise<{
  getClassList: () => readonly (readonly [string, unknown])[];
  candidatesToCss: (classes: string[]) => (string | null)[];
}> {
  const { __unstable__loadDesignSystem } = await import("tailwindcss");

  return __unstable__loadDesignSystem(
    `@import "tailwindcss" source(none);\n@import "${TOKENS}";\n`,
    {
      base: path.dirname(TAILWIND_ENTRY),
      loadStylesheet: async (id: string, base: string) => {
        const target = id === "tailwindcss" ? TAILWIND_ENTRY : path.resolve(base, id);
        return {
          path: target,
          base: path.dirname(target),
          content: await readFile(target, "utf8"),
        };
      },
      loadModule: () => {
        throw new Error("This stylesheet loads no plugins.");
      },
    },
  );
}

/** One declaration of a utility's own rule, and the variables its value reads. */
type Declaration = {
  readonly context: string;
  readonly property: string;
  readonly reads: readonly string[];
};

/**
 * The declarations a utility's own rules write. `@property` blocks are skipped:
 * Tailwind emits one for every variable a value *references*, not only for the
 * one the utility writes, so counting them would make everything look alike.
 * The selector each declaration sits under is kept, so `space-x-4` — which
 * writes margins on children — is never read as a claim on the element itself.
 */
function declarationsIn(css: string): readonly Declaration[] {
  const found: Declaration[] = [];
  const stack: string[] = [];
  let buffer = "";
  let skipDepth = -1;

  const context = (): string =>
    stack
      .filter((entry) => !entry.startsWith("@"))
      .map((entry) => entry.replaceAll(/\.(?:\\.|[-\w])+/gu, "&"))
      .join(" ");

  for (const character of css) {
    if (character === "{") {
      const header = buffer.trim();
      stack.push(header);
      if (skipDepth < 0 && header.startsWith("@property")) skipDepth = stack.length;
      buffer = "";
    } else if (character === "}") {
      if (skipDepth === stack.length) skipDepth = -1;
      stack.pop();
      buffer = "";
    } else if (character === ";") {
      const colon = buffer.indexOf(":");
      const property = colon > 0 ? buffer.slice(0, colon).trim() : "";
      if (skipDepth < 0 && stack.length > 0 && /^-{0,2}[a-zA-Z][-a-zA-Z0-9]*$/u.test(property)) {
        const reads = [...buffer.slice(colon + 1).matchAll(/var\(\s*(--[-\w]+)/gu)].map(
          (match) => match[1] as string,
        );
        found.push({ context: context(), property, reads: [...new Set(reads)] });
      }
      buffer = "";
    } else {
      buffer += character;
    }
  }

  return found;
}

/**
 * The longhands a property covers, so `sr-only`'s `margin` is seen to overlap
 * `mbs-2`'s `margin-block-start` and `flex-1`'s `flex` to overlap `grow`'s
 * `flex-grow`. Only the families Tailwind's own vocabulary emits are listed;
 * anything absent stands for itself.
 */
const EDGES = ["top", "right", "bottom", "left"] as const;
const LOGICAL: Readonly<Record<string, string>> = {
  top: "block-start",
  right: "inline-end",
  bottom: "block-end",
  left: "inline-start",
};
const AXES: Readonly<Record<string, readonly string[]>> = {
  block: ["top", "bottom"],
  inline: ["left", "right"],
};
const LONGHANDS: Record<string, readonly string[]> = {};

function boxFamily(atom: string, spell: (part: string) => string): void {
  LONGHANDS[spell("")] = EDGES.map((edge) => `${atom}-${edge}`);
  for (const edge of EDGES) {
    LONGHANDS[spell(edge)] = [`${atom}-${edge}`];
    LONGHANDS[spell(LOGICAL[edge] as string)] = [`${atom}-${edge}`];
  }
  for (const [axis, edges] of Object.entries(AXES)) {
    LONGHANDS[spell(axis)] = edges.map((edge) => `${atom}-${edge}`);
  }
}

for (const [family, atom] of [
  ["margin", "mar"],
  ["padding", "pad"],
  ["scroll-margin", "smar"],
  ["scroll-padding", "spad"],
] as const) {
  boxFamily(atom, (part) => (part === "" ? family : `${family}-${part}`));
}
boxFamily("ins", (part) =>
  part === "" ? "inset" : EDGES.includes(part as (typeof EDGES)[number]) ? part : `inset-${part}`,
);
for (const facet of ["width", "color", "style"] as const) {
  boxFamily(`bor-${facet}`, (part) =>
    part === "" ? `border-${facet}` : `border-${part}-${facet}`,
  );
}
Object.assign(LONGHANDS, {
  "border-radius": ["rad-tl", "rad-tr", "rad-br", "rad-bl"],
  "border-top-left-radius": ["rad-tl"],
  "border-top-right-radius": ["rad-tr"],
  "border-bottom-right-radius": ["rad-br"],
  "border-bottom-left-radius": ["rad-bl"],
  "border-start-start-radius": ["rad-tl"],
  "border-start-end-radius": ["rad-tr"],
  "border-end-end-radius": ["rad-br"],
  "border-end-start-radius": ["rad-bl"],
  gap: ["row-gap", "column-gap"],
  overflow: ["overflow-x", "overflow-y"],
  "overscroll-behavior": ["overscroll-behavior-x", "overscroll-behavior-y"],
  outline: ["outline-color", "outline-style", "outline-width"],
  flex: ["flex-grow", "flex-shrink", "flex-basis"],
  "place-content": ["align-content", "justify-content"],
  "place-items": ["align-items", "justify-items"],
  "place-self": ["align-self", "justify-self"],
  "grid-column": ["grid-column-start", "grid-column-end"],
  "grid-row": ["grid-row-start", "grid-row-end"],
  "inline-size": ["width"],
  "block-size": ["height"],
  "min-inline-size": ["min-width"],
  "min-block-size": ["min-height"],
  "max-inline-size": ["max-width"],
  "max-block-size": ["max-height"],
});

type Claimant = {
  readonly candidate: string;
  /** What {@link withOverrides} would compare, resolved once. */
  readonly buckets: ReadonlySet<string>;
  readonly bucketKey: string;
  /** `context property` -> the `--tw-*` variables that claim's value reads. */
  readonly claims: ReadonlyMap<string, ReadonlySet<string>>;
  /** `context --tw-var` for every custom property the utility writes. */
  readonly writes: ReadonlySet<string>;
};

function intersects(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

/**
 * Tailwind composes several utilities onto one property through `--tw-*` slots:
 * each writes its own slot and the property reads the whole set, so the two
 * apply together instead of one beating the other. `text-sm` writes
 * `line-height: var(--tw-leading, …)` and `leading-none` writes `--tw-leading`;
 * `blur-sm` and `brightness-50` share `filter` the same way. Those pairs are
 * cooperation, not collision, and refusing them would be the worse defect.
 */
function composes(left: Claimant, right: Claimant, claim: string): boolean {
  if (intersects(left.writes, right.writes)) return false;
  const leftReads = left.claims.get(claim) ?? new Set<string>();
  const rightReads = right.claims.get(claim) ?? new Set<string>();
  return intersects(leftReads, right.writes) || intersects(rightReads, left.writes);
}

/**
 * Every pair of utilities in Tailwind's vocabulary that writes one property,
 * does not compose onto it, and that {@link withOverrides} nonetheless lets
 * through — reported one line per pair of bucket sets, which is the grain the
 * two tables in `class-names.tsx` are written at.
 */
async function unguardedPairs(): Promise<readonly string[]> {
  const design = await loadDesignSystem();
  const names = design.getClassList().map(([name]) => name);
  const sheets = design.candidatesToCss([...names]);

  const claimants: Claimant[] = [];
  const shapes = new Set<string>();
  for (const [index, candidate] of names.entries()) {
    const css = sheets[index];
    if (css === null || css === undefined) continue;

    const claims = new Map<string, Set<string>>();
    const writes = new Set<string>();
    for (const { context, property, reads } of declarationsIn(css)) {
      if (property.startsWith("--")) {
        writes.add(`${context} ${property}`);
        continue;
      }
      const scoped = reads.map((name) => `${context} ${name}`);
      for (const longhand of LONGHANDS[property] ?? [property]) {
        const key = `${context} ${longhand}`;
        const existing = claims.get(key) ?? new Set<string>();
        for (const read of scoped) existing.add(read);
        claims.set(key, existing);
      }
    }
    if (claims.size === 0) continue;

    // One representative per distinct bucket-and-claim shape: `text-red-500`
    // and `text-sage` prove nothing the other does not, and there are 27,000.
    const buckets = new Set(bucketsOf(candidate));
    const bucketKey = [...buckets].sort().join(",");
    const shape = [...claims]
      .map(([key, reads]) => `${key}<${[...reads].sort().join("+")}>`)
      .sort()
      .join(",");
    const key = `${bucketKey}|${shape}|${[...writes].sort().join(",")}`;
    if (shapes.has(key)) continue;
    shapes.add(key);
    claimants.push({ candidate, buckets, bucketKey, claims, writes });
  }

  const byClaim = new Map<string, Claimant[]>();
  for (const claimant of claimants) {
    for (const claim of claimant.claims.keys()) {
      const sharing = byClaim.get(claim);
      if (sharing === undefined) byClaim.set(claim, [claimant]);
      else sharing.push(claimant);
    }
  }

  const escapes = new Map<string, string>();
  for (const [claim, sharing] of byClaim) {
    for (let i = 0; i < sharing.length; i += 1) {
      for (let j = i + 1; j < sharing.length; j += 1) {
        const [left, right] = [sharing[i] as Claimant, sharing[j] as Claimant];
        const key = `${left.bucketKey}::${right.bucketKey}`;
        if (escapes.has(key)) continue;
        if (intersects(left.buckets, right.buckets)) continue;
        if (composes(left, right, claim)) continue;
        escapes.set(key, `${left.candidate} and ${right.candidate} both write ${claim.slice(2)}`);
      }
    }
  }

  return [...escapes.values()].sort();
}

function withIntl(node: ReactNode): ReactElement {
  return (
    <NextIntlClientProvider locale={routing.defaultLocale} messages={{}}>
      {node}
    </NextIntlClientProvider>
  );
}

/**
 * All nine PR-4.2 primitives, each with one override that collides with its own
 * recipe, chosen so the property it lands on compiles to a literal — a value
 * that resolves through `var(--token)` cannot be read back out of jsdom.
 *
 * Every case puts its recipe on the outermost element it renders, which is what
 * {@link subjectOf} reads.
 */
const CASES = [
  {
    name: "Eyebrow",
    element: (className?: string) => <Eyebrow className={className}>Our philosophy</Eyebrow>,
    override: "normal-case!",
    property: "textTransform",
    recipeValue: "uppercase",
    overriddenValue: "none",
  },
  {
    name: "SectionTitle",
    element: (className?: string) => (
      <SectionTitle className={className} preserveLineBreaks>
        A day here
      </SectionTitle>
    ),
    override: "whitespace-normal!",
    property: "whiteSpace",
    recipeValue: "pre-line",
    overriddenValue: "normal",
  },
  {
    name: "LearnMoreLink",
    element: (className?: string) =>
      withIntl(
        <LearnMoreLink routeId="philosophy" className={className}>
          Read our philosophy →
        </LearnMoreLink>,
      ),
    override: "block!",
    property: "display",
    recipeValue: "inline-flex",
    overriddenValue: "block",
  },
  {
    name: "Button",
    element: (className?: string) => (
      <Button as="button" size="hero" className={className}>
        Book a tour
      </Button>
    ),
    override: "w-auto!",
    property: "width",
    recipeValue: "100%",
    overriddenValue: "auto",
  },
  {
    name: "Chip",
    element: (className?: string) => (
      <Chip tone="gold" className={className}>
        5.0 on Yelp
      </Chip>
    ),
    override: "block!",
    property: "display",
    recipeValue: "inline-flex",
    overriddenValue: "block",
  },
  {
    name: "Emoji",
    element: (className?: string) => <Emoji symbol="🌿" size="dot" className={className} />,
    override: "block!",
    property: "display",
    recipeValue: "inline-flex",
    overriddenValue: "block",
  },
  {
    name: "PhotoSlot",
    element: (className?: string) => <PhotoSlot slotId="philosophy" className={className} />,
    override: "w-auto!",
    property: "width",
    recipeValue: "100%",
    overriddenValue: "auto",
  },
  {
    name: "Section",
    element: (className?: string) => (
      <Section id="gallery" labelledBy="gallery-title" className={className}>
        <span>content</span>
      </Section>
    ),
    override: "absolute!",
    property: "position",
    recipeValue: "relative",
    overriddenValue: "absolute",
  },
  {
    name: "SectionHeader",
    element: (className?: string) => (
      <SectionHeader titleId="gallery-title" title="Moments from our days" className={className} />
    ),
    override: "block!",
    property: "display",
    recipeValue: "flex",
    overriddenValue: "block",
  },
] as const;

/** The element the case's recipe classes are on: the outermost one it renders. */
function subjectOf(container: HTMLElement): HTMLElement {
  const first = container.firstElementChild;
  expect(first).toBeInstanceOf(HTMLElement);
  return first as HTMLElement;
}

/** The class demonstrations that are not a component, so the sheet covers them too. */
const DEMONSTRATION_CLASSES = ["block inline-flex", "w-auto w-full"] as const;

/**
 * Every class the nine primitives render, harvested by rendering them — a
 * hand-written list would drift the first time a recipe changes.
 */
function harvestCandidates(): readonly string[] {
  const found = new Set<string>(DEMONSTRATION_CLASSES.flatMap((value) => value.split(" ")));

  for (const testCase of CASES) {
    for (const element of [testCase.element(), testCase.element(testCase.override)]) {
      const { container } = render(element);
      for (const node of container.querySelectorAll("*")) {
        for (const name of node.classList) found.add(name);
      }
      cleanup();
    }
  }

  return [...found];
}

/**
 * Drops the `@layer` wrappers, keeping every rule and its position.
 *
 * jsdom does not implement cascade layers and skips the rules nested inside
 * one, which would leave the assertions below reading initial values and
 * passing on nothing. Tailwind puts all of its utilities in a single layer, so
 * flattening changes no outcome — it only makes the sheet one jsdom can read.
 */
function unwrapLayers(css: string): string {
  const opening = /@layer[^{;]*\{/u.exec(css);
  if (opening?.index === undefined) return css.replace(/@layer[^;{}]*;/gu, "");

  const start = opening.index + opening[0].length;
  let depth = 1;
  let end = start;
  while (end < css.length && depth > 0) {
    const character = css.charAt(end);
    if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
    end += 1;
  }

  const inside = css.slice(start, end - 1);
  return unwrapLayers(`${css.slice(0, opening.index)}${inside}${css.slice(end)}`);
}

let stylesheet = "";

beforeAll(async () => {
  stylesheet = await compileStylesheet([...harvestCandidates(), "bg-white", "bg-white!"]);
}, 30_000);

/** Puts the compiled stylesheet in the document for the cascade to run against. */
function useStylesheet(): void {
  const style = document.createElement("style");
  style.textContent = unwrapLayers(stylesheet);
  document.head.append(style);
}

afterEach(() => {
  for (const style of document.head.querySelectorAll("style")) style.remove();
});

/** The 1-based line a selector's rule opens on, so two rules can be ordered. */
function ruleLine(selector: string): number {
  const lines = stylesheet.split("\n");
  const index = lines.findIndex((line) => line.trim() === `${selector} {`);
  expect(index, `${selector} is not in the compiled stylesheet`).toBeGreaterThan(-1);
  return index + 1;
}

describe("the className override contract", () => {
  describe("what the compiled stylesheet says", () => {
    it("emits .bg-white before .bg-yelp-pill-bg, so appending it can never win", () => {
      expect(ruleLine(".bg-white")).toBeLessThan(ruleLine(".bg-yelp-pill-bg"));
    });

    it("compiles the important modifier the contract asks callers for", () => {
      const important = stylesheet.slice(stylesheet.indexOf(".bg-white\\! {"));

      expect(important.slice(0, important.indexOf("}"))).toContain("!important");
    });

    it("still emits the important rule first — order is not what makes it win", () => {
      expect(ruleLine(".bg-white\\!")).toBeLessThan(ruleLine(".bg-yelp-pill-bg"));
    });
  });

  describe("what the browser then computes", () => {
    it("takes the rule the stylesheet emits last, whatever the attribute says", () => {
      useStylesheet();
      // Not a component: the bare demonstration that writing a class last wins
      // nothing. `.block` is emitted before `.inline-flex`, so `.inline-flex`
      // is what applies — which is the defect, in two classes.
      render(<span data-testid="appended" className="block inline-flex" />);

      expect(getComputedStyle(screen.getByTestId("appended")).display).toBe("inline-flex");
    });

    it("does the same for the width the hero button sets", () => {
      useStylesheet();
      render(<span data-testid="appended" className="w-auto w-full" />);

      expect(getComputedStyle(screen.getByTestId("appended")).width).toBe("100%");
    });

    it("leaves the recipe's other properties standing — !important is per property", () => {
      useStylesheet();
      render(
        <Chip tone="gold" className="block!">
          Certified Montessori
        </Chip>,
      );
      const chip = screen.getByText("Certified Montessori");

      expect(getComputedStyle(chip).display).toBe("block");
      expect(getComputedStyle(chip).fontWeight).not.toBe("");
      expect(chip).toHaveClass("bg-yelp-pill-bg");
    });
  });

  describe.each(CASES)("$name", (testCase) => {
    it("draws its own recipe when the caller overrides nothing", () => {
      useStylesheet();
      const { container } = render(testCase.element());

      expect(getComputedStyle(subjectOf(container))[testCase.property]).toBe(testCase.recipeValue);
    });

    it("gives the property up to an important caller class", () => {
      useStylesheet();
      const { container } = render(testCase.element(testCase.override));

      expect(getComputedStyle(subjectOf(container))[testCase.property]).toBe(
        testCase.overriddenValue,
      );
    });

    it("refuses the same class unmarked, rather than rendering it inert", () => {
      const bare = testCase.override.replace("!", "");

      expect(() => render(testCase.element(bare))).toThrow(new RegExp(`"${bare}"`, "u"));
    });
  });

  describe("the collision guard", () => {
    it("refuses a bare caller class that the cascade would discard", () => {
      expect(() => withOverrides("Chip", "bg-yelp-pill-bg text-chip", "bg-white")).toThrow(
        /bg-white/u,
      );
    });

    it("names the recipe class it collided with, and the fix", () => {
      expect(() => withOverrides("Chip", "bg-yelp-pill-bg", "bg-white")).toThrow(
        /"bg-yelp-pill-bg"[\s\S]*"bg-white!"/u,
      );
    });

    it("accepts the important spellings of both Tailwind generations", () => {
      expect(withOverrides("Chip", "bg-yelp-pill-bg", "bg-white!")).toContain("bg-white!");
      expect(withOverrides("Chip", "bg-yelp-pill-bg", "!bg-white")).toContain("!bg-white");
    });

    it("passes through a class that sets a property the recipe leaves alone", () => {
      expect(withOverrides("Chip", "bg-sage px-4", "mt-2 self-start")).toBe(
        "bg-sage px-4 mt-2 self-start",
      );
    });

    it("reads the shorthand a longhand belongs to", () => {
      expect(() => withOverrides("Button", "px-4 py-2.5", "p-0")).toThrow(/p-0/u);
      expect(() => withOverrides("Button", "px-4", "pl-0")).toThrow(/pl-0/u);
      expect(() => withOverrides("Emoji", "size-12", "h-8")).toThrow(/h-8/u);
      expect(() => withOverrides("Section", "rounded-pill", "rounded-tl-none")).toThrow(/rounded/u);
    });

    it("keeps a variant's claim separate from the base one", () => {
      expect(withOverrides("Button", "md:px-6", "px-0")).toBe("md:px-6 px-0");
      expect(() => withOverrides("Button", "md:px-6", "md:px-0")).toThrow(/md:px-0/u);
    });

    it("groups the valueless utilities by the property they write", () => {
      expect(() => withOverrides("Eyebrow", "uppercase", "normal-case")).toThrow(/normal-case/u);
      expect(() => withOverrides("PhotoSlot", "block", "hidden")).toThrow(/hidden/u);
      expect(() => withOverrides("Section", "relative", "absolute")).toThrow(/absolute/u);
      expect(withOverrides("Chip", "inline-flex", "flex-col")).toBe("inline-flex flex-col");
    });

    it("does not read the `:` inside an arbitrary value as a variant", () => {
      expect(() => withOverrides("Eyebrow", "text-(color:--section-accent)", "text-ink")).toThrow(
        /text-ink/u,
      );
    });

    it("collapses the whitespace it is handed", () => {
      expect(withOverrides("Chip", "  bg-sage   text-white ", " mt-2 ")).toBe(
        "bg-sage text-white mt-2",
      );
    });

    it("is a no-op when the caller passes nothing", () => {
      expect(withOverrides("Chip", "bg-sage text-white")).toBe("bg-sage text-white");
      expect(withOverrides("Chip", "bg-sage text-white", "")).toBe("bg-sage text-white");
    });
  });

  describe.each(SAME_PROPERTY)("$property, from $recipe and $caller", ({ recipe, caller }) => {
    it("refuses the caller's class, which the cascade would decide by emission order", () => {
      expect(() => withOverrides("Probe", recipe, caller)).toThrow(
        new RegExp(`"${caller.replaceAll(/[.[\]()/]/gu, "\\$&")}"`, "u"),
      );
    });

    it("takes the same class marked important", () => {
      expect(withOverrides("Probe", recipe, `${caller}!`)).toBe(`${recipe} ${caller}!`);
    });
  });

  describe("what the whole Tailwind vocabulary says", () => {
    it("puts every two utilities that write one property in buckets that meet", async () => {
      const escapes = await unguardedPairs();

      expect(escapes.slice(0, 40).join("\n")).toBe("");
    }, 60_000);
  });
});
