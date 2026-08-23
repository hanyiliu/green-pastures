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
import { withOverrides } from "@/components/ui/class-names";
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
});
