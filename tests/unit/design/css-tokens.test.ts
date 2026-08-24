import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { cssToken, parseCssTokens } from "@/design/css-tokens";

/**
 * `src/design/css-tokens.ts` — the reader that lets the share card use tokens
 * without restating them (03 `D-03.1`, INV-03.1).
 *
 * Two halves. The parse is pinned on fixtures, so the rules it implements
 * (comments are not declarations, the first declaration wins) are asserted
 * without depending on what `tokens.css` happens to say today. The lookup is
 * pinned on the real file, because that is the guarantee the card rests on: the
 * value it draws with is the value the stylesheet declares, character for
 * character.
 */

const TOKENS_CSS = join(process.cwd(), "src", "styles", "tokens.css");

describe("parseCssTokens", () => {
  it("reads every custom property in declaration order", () => {
    const tokens = parseCssTokens(":root { --a: 1px; --b: #fff; }");
    expect([...tokens]).toEqual([
      ["--a", "1px"],
      ["--b", "#fff"],
    ]);
  });

  it("keeps a multi-part value whole", () => {
    const tokens = parseCssTokens(":root { --shadow: 0 12px 30px rgb(60 50 40 / 16%); }");
    expect(tokens.get("--shadow")).toBe("0 12px 30px rgb(60 50 40 / 16%)");
  });

  it("does not read a token out of a comment", () => {
    const tokens = parseCssTokens("/* --ghost: #000; */ :root { --real: #111; }");
    expect(tokens.has("--ghost")).toBe(false);
    expect(tokens.get("--real")).toBe("#111");
  });

  it("takes the first declaration, not the media-query override", () => {
    const source = `
      :root { --radius-hero: 22px; }
      @media (width >= 48rem) { :root { --radius-hero: 26px; } }
    `;
    expect(parseCssTokens(source).get("--radius-hero")).toBe("22px");
  });

  it("never mistakes a rule header for a declaration", () => {
    const tokens = parseCssTokens("@theme static { --color-sage: #6f8a5f; }");
    expect([...tokens.keys()]).toEqual(["--color-sage"]);
  });
});

describe("cssToken", () => {
  const declared = parseCssTokens(readFileSync(TOKENS_CSS, "utf8"));

  it.each([
    "--color-cream",
    "--color-sage",
    "--color-forest",
    "--color-sun",
    "--color-white",
    "--radius-card-lg",
    "--shadow-float",
  ])("returns what tokens.css declares for %s", (name) => {
    // Every token the share card asks for, proven to exist in the stylesheet.
    // A rename in `tokens.css` fails here before it reaches the card.
    expect(declared.has(name), `${name} is not declared in tokens.css`).toBe(true);
    expect(cssToken(name)).toBe(declared.get(name));
  });

  it("throws, naming the token, when it is not declared", () => {
    expect(() => cssToken("--color-not-a-token")).toThrow("--color-not-a-token");
  });
});
