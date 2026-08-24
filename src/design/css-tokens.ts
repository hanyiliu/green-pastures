import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `src/styles/tokens.css` read as **data**, for the one surface that cannot
 * read it as CSS (03 `D-03.1`, INV-03.1).
 *
 * Every other consumer of a token is a stylesheet or a Tailwind utility, and
 * the browser resolves `var(--color-sage)` for it. The share-card image
 * (`src/lib/seo/share-card.tsx`) is rendered by Satori, which has no cascade,
 * no `:root` and therefore no custom properties at all — it is handed a plain
 * object of resolved values. Writing `#6f8a5f` into that object would put a
 * second spelling of a colour into the tree, which INV-03.1 exists to forbid
 * and which ESLint's `inlineStyleColour` ban would report anyway.
 *
 * So the values are *read out of the declaration of record* instead. There is
 * still exactly one place a colour is written down; this module is a reader,
 * not a mirror, and a renamed token fails loudly at the call site rather than
 * drifting silently. That is the same bargain `src/design/tokens.ts` makes for
 * the motion tokens (INV-03.4), minus the copy — nothing here has to be kept in
 * step with anything, because nothing here restates a value.
 *
 * **It reads the file, so it is build-time-only code.** The one caller is a
 * `force-static` route handler, which Next evaluates during `next build` with
 * the project root as the working directory. Nothing in a client bundle, and
 * nothing on a request path, may import this module.
 */

/** The declaration of record, relative to the project root. */
const TOKENS_CSS = join("src", "styles", "tokens.css");

/**
 * CSS block comments, stripped before anything is parsed. `tokens.css`
 * documents itself heavily and names tokens in prose; a token mentioned in a
 * comment is not a declaration.
 */
const COMMENT = /\/\*[\s\S]*?\*\//g;

/**
 * One custom-property declaration. The value stops at the `;` and may not
 * contain a brace, so a rule header can never be mistaken for a value.
 */
const DECLARATION = /(--[a-z0-9-]+)\s*:\s*([^;{}]+);/gi;

/**
 * Every custom property declared in `source`, **first declaration wins**.
 *
 * 03 §1 declares per-view tokens mobile-first and re-declares the desktop value
 * inside `@media (width >= 48rem)`; `:lang()` does the same for the two Chinese
 * scripts. A 1200×630 canvas has neither a viewport nor a language, so there is
 * no honest way to pick an override — the base declaration is the value, and a
 * token whose two views differ is one this reader should not be asked for.
 *
 * Exported so the parse can be exercised on a fixture rather than on the real
 * file, which is what lets a test pin the comment-stripping and the
 * first-wins rule without depending on today's `tokens.css`.
 */
export function parseCssTokens(source: string): ReadonlyMap<string, string> {
  const tokens = new Map<string, string>();
  for (const match of source.replace(COMMENT, "").matchAll(DECLARATION)) {
    const name = match[1];
    const value = match[2];
    if (name === undefined || value === undefined || tokens.has(name)) continue;
    tokens.set(name, value.trim());
  }
  return tokens;
}

let cached: ReadonlyMap<string, string> | undefined;

/** The parsed file, read once per process. */
function tokens(): ReadonlyMap<string, string> {
  cached ??= parseCssTokens(readFileSync(join(process.cwd(), TOKENS_CSS), "utf8"));
  return cached;
}

/**
 * One token's value — `cssToken("--color-sage")` → `"#6f8a5f"`.
 *
 * Throws when the token is absent. A share card drawn in whatever colour a
 * missing lookup happened to leave behind is the failure this is here to
 * prevent, and the build is the cheapest place to have it.
 */
export function cssToken(name: string): string {
  const value = tokens().get(name);
  if (value === undefined) {
    throw new Error(`${name} is not declared in ${TOKENS_CSS} (03 D-03.1, INV-03.1).`);
  }
  return value;
}
