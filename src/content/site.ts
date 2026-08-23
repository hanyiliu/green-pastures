import siteJson from "../../content/site.json";

import { parseContent } from "./schemas/primitives";
import { SiteSchema, type Site, type SiteConfig } from "./schemas/site";

/**
 * The typed accessor for `content/site.json` (02 `D-02.7`, `D-02.12`).
 *
 * **Parsed on first use, once.** The JSON is a static import, so the bundler
 * sees it; the Zod parse runs the first time a caller asks for the config and
 * the result is memoised. That is what makes an invalid `site.json` fail
 * `next build` — every page reads the config through here — with a readable
 * issue list rather than a `TypeError` three components later.
 *
 * **The registry never reaches the browser.** `site.json` is shipped to the
 * client where it is needed, so {@link getSite} returns the file *without*
 * `provisional` (02 `D-02.12`). The registry is development bookkeeping for
 * `pnpm validate:content` and the launch gate; it is available here through
 * {@link getProvisionalPaths}, which the validator calls and no component does.
 *
 * Unlike `src/content/collections.ts` this module is **not** server-only: the
 * config carries no secrets (07 keeps API keys in environment variables) and
 * client components legitimately read the phone number and the brand names.
 */

const SOURCE = "content/site.json";

/** The file split in two at parse time, so the registry is never re-derived. */
type Parsed = { readonly config: SiteConfig; readonly provisional: readonly string[] };

let parsed: Parsed | undefined;

function parseOnce(): Parsed {
  if (parsed === undefined) {
    const { provisional, ...config } = parseContent(SiteSchema, siteJson, SOURCE);
    parsed = { config, provisional };
  }
  return parsed;
}

/**
 * The shared config, validated and without the provisional registry.
 *
 * ```ts
 * const site = getSite();
 * const name = site.brand.name[locale];        // localized value, D-02.19
 * const tour = site.routes.find((route) => route.id === "programs");
 * ```
 */
export function getSite(): SiteConfig {
  return parseOnce().config;
}

/**
 * The `provisional` registry (02 `D-02.20`) — for `pnpm validate:content` and
 * the launch gate only. Every path here has already been proven to resolve
 * (INV-02.10); what the validator adds is the current value, the file it lives
 * in, and the `--release` failure while the list is non-empty.
 */
export function getProvisionalPaths(): readonly string[] {
  return parseOnce().provisional;
}

export type { Site, SiteConfig };
