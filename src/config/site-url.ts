/**
 * The one origin, and it is the environment's (06 `D-06.11`, INV-06.10).
 *
 * `metadataBase`, every canonical and `hreflang` URL, the sitemap, robots and
 * the JSON-LD `@id` resolve against the single frozen `URL` this module
 * exports. Nothing else in `src/` may write an absolute origin — not even now
 * that the production value is known (HD-13 settled the domain: apex, with
 * `www` 308ing to it at the Vercel domain level, 09 `D-09.5`). The name itself
 * is written in 06 §6.5 and in the Vercel Production scope, and nowhere in
 * `src/` — INV-06.10 is a rule about this tree, comments included.
 *
 * **Knowing the value is not a reason to inline it.** Preview and Development
 * must not claim the production host, and flipping the public form to `www` has
 * to stay one Vercel setting plus one environment value. So the variable stays
 * the source and this file stays the only reader.
 *
 * **The variable is never simply "required".** A relative `alternates.canonical`
 * with an undefined `metadataBase` is a *build error* in Next, so an unset
 * `NEXT_PUBLIC_SITE_URL` may not leave the origin undefined. It resolves down a
 * chain instead — the explicit variable, then Vercel's production alias, then
 * this deployment's own alias, then localhost — which is why 09 sets the
 * variable in the Production scope only. A Preview whose canonicals point at
 * the preview host is harmless: previews carry Vercel's automatic `noindex`
 * header (`D-06.12`).
 *
 * `site.json.brand.url` is deliberately not in the chain (INV-06.10). It is the
 * owner's record of the intended public origin, a provisional sample today, and
 * no metadata code path may read it — one origin per environment can only come
 * from the environment.
 */

/** The last resort, and the value `.env.example` documents. */
const LOCAL_ORIGIN = "http://localhost:3000";

/** One link of the chain: where a candidate origin came from, and what it said. */
type OriginCandidate = {
  /** The environment variable's name, for the error message when it is unusable. */
  readonly source: string;
  readonly value: string | undefined;
};

/**
 * Vercel's `VERCEL_URL` / `VERCEL_PROJECT_PRODUCTION_URL` are bare hosts
 * (`green-pastures.vercel.app`), never full origins, so they need a scheme
 * before `new URL()` will look at them. `NEXT_PUBLIC_SITE_URL` already carries
 * one and is passed through untouched.
 */
function withScheme(host: string | undefined): string | undefined {
  if (host === undefined) return undefined;
  const trimmed = host.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.includes("://") ? trimmed : `https://${trimmed}`;
}

/**
 * The chain of `D-06.11`, in order.
 *
 * `process.env.NEXT_PUBLIC_SITE_URL` is spelled out as a literal member access
 * because that is the only form Next's bundler substitutes at build time; a
 * computed lookup would read `undefined` in the browser bundle.
 */
function candidates(): readonly OriginCandidate[] {
  return [
    { source: "NEXT_PUBLIC_SITE_URL", value: process.env.NEXT_PUBLIC_SITE_URL },
    {
      source: "VERCEL_PROJECT_PRODUCTION_URL",
      value: withScheme(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    },
    { source: "VERCEL_URL", value: withScheme(process.env.VERCEL_URL) },
    { source: "fallback", value: LOCAL_ORIGIN },
  ];
}

/**
 * The first candidate that carries a value, parsed.
 *
 * A candidate that is set but unparseable **throws**, naming the variable. The
 * alternative — skipping it and quietly taking the next link — is how a typo in
 * the Production scope ships a site whose every canonical, sitemap entry and
 * JSON-LD `@id` says `http://localhost:3000`, silently and to crawlers. A build
 * that stops with the variable's name in the message is the cheaper failure.
 *
 * Exported so the chain can be exercised without re-importing this module once
 * per case.
 */
export function resolveSiteUrl(chain: readonly OriginCandidate[]): URL {
  for (const { source, value } of chain) {
    if (value === undefined || value.trim().length === 0) continue;
    try {
      return new URL(value.trim());
    } catch {
      throw new Error(
        `${source} is not a valid absolute URL: ${JSON.stringify(value)}. ` +
          "It is the site origin (06 D-06.11) and must include a scheme, e.g. https://example.com.",
      );
    }
  }

  // Unreachable while the chain ends in `LOCAL_ORIGIN`; kept so a future edit to
  // `candidates()` that drops the fallback fails loudly instead of returning
  // `undefined` into `metadataBase`.
  throw new Error("No site origin resolved; NEXT_PUBLIC_SITE_URL is unset (06 D-06.11).");
}

/**
 * The site origin for this environment. Parsed once, at import.
 *
 * Frozen because it is shared by every metadata path in the app and a mutated
 * `pathname` on the shared instance would rewrite every canonical on the page.
 * Build absolute URLs with `new URL(path, siteUrl)` — never by mutating this.
 */
export const siteUrl: URL = Object.freeze(resolveSiteUrl(candidates()));
