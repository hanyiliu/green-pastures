import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { getSite } from "@/content/site";
import { parseCssTokens } from "@/design/css-tokens";
import { pngSize, shareCard, shareCardSize } from "@/lib/seo/share-card";

/**
 * The Open Graph placeholder card (06 §6.5, `OQ-06.7`, `gp-dln.196`).
 *
 * The card is proved twice and the two halves answer different questions.
 * `e2e/routes.spec.ts` fetches the served bytes and asserts the URL a crawler
 * is given answers 200 with a PNG of the promised size; nothing there can see
 * *what* was drawn. These assertions read the element tree instead, and pin the
 * three properties a valid-but-blank image would still satisfy: the canvas is
 * `site.json`'s, every colour on it is a token, and the wordmark is really on
 * it, at the aspect ratio of the file on disk.
 */

const LOGO = readFileSync(join(process.cwd(), "public", "brand", "logo.png"));
const TOKEN_VALUES = new Set(
  parseCssTokens(readFileSync(join(process.cwd(), "src", "styles", "tokens.css"), "utf8")).values(),
);

/** Anything that could be a colour: a hex triplet or a functional notation. */
const COLOUR_LIKE = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(|color-mix\(/i;

type Styled = { readonly style?: Record<string, unknown>; readonly children?: unknown };

function styleOf(element: ReactElement): Record<string, unknown> {
  return (element.props as Styled).style ?? {};
}

/** Every element in the tree, parents before children. */
function walk(node: unknown, found: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, found);
    return found;
  }
  if (!isValidElement(node)) return found;
  found.push(node);
  return walk((node.props as Styled).children, found);
}

/** The one box carrying the wordmark, as a style object. */
function wordmarkBox(elements: readonly ReactElement[]): Record<string, unknown> | undefined {
  return elements.map(styleOf).find((style) => typeof style.backgroundImage === "string");
}

describe("shareCardSize", () => {
  it("is the canvas site.json promises in the Open Graph tags", () => {
    expect(shareCardSize()).toEqual({
      width: getSite().images.og.width,
      height: getSite().images.og.height,
    });
  });
});

describe("pngSize", () => {
  it("reads the wordmark's own dimensions", () => {
    const size = pngSize(LOGO);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });

  it("refuses bytes that are not a PNG", () => {
    expect(() => pngSize(Buffer.from("not a png at all, but long enough"))).toThrow();
  });
});

describe("shareCard", () => {
  const card = shareCard();
  const elements = walk(card);

  it("draws on the canvas site.json declares", () => {
    const { width, height } = getSite().images.og;
    expect(styleOf(card)).toMatchObject({ width, height });
  });

  it("spells no colour of its own (INV-03.1)", () => {
    const colours = elements
      .flatMap((element) => Object.values(styleOf(element)))
      .filter((value): value is string => typeof value === "string" && COLOUR_LIKE.test(value));

    // The guard against a vacuous pass: a card that set no colours at all would
    // satisfy "every colour is a token" and be a blank canvas.
    expect(colours.length).toBeGreaterThan(0);
    for (const colour of colours) {
      expect(TOKEN_VALUES, `${colour} is not a value in tokens.css`).toContain(colour);
    }
  });

  it("draws the wordmark at the aspect ratio of the file on disk", () => {
    const intrinsic = pngSize(LOGO);
    const box = wordmarkBox(elements);
    expect(box, "no element carries the wordmark").toBeDefined();

    const width = Number(box?.width);
    const height = Number(box?.height);
    expect(width).toBeGreaterThan(0);
    // Within a pixel: the drawn height is the intrinsic ratio, rounded.
    expect(Math.abs(height - (width * intrinsic.height) / intrinsic.width)).toBeLessThan(1);
  });

  it("embeds the wordmark itself, so the card needs no network", () => {
    const url = String(wordmarkBox(elements)?.backgroundImage);
    const encoded = /^url\(data:image\/png;base64,(.+)\)$/.exec(url)?.[1];
    expect(encoded, "the wordmark is not an inline PNG data URI").toBeDefined();
    expect(Buffer.from(encoded ?? "", "base64").equals(LOGO)).toBe(true);
  });
});
