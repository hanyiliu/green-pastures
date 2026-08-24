import { siteUrl } from "@/config/site-url";
import { getSite } from "@/content/site";
import { getPathname } from "@/i18n/navigation";
import { LOCALE_META, routing, type Locale } from "@/i18n/routing";

/**
 * Every URL a crawler sees, built in one place (06 §6.5, INV-06.10, INV-06.1).
 *
 * Canonicals, `hreflang` alternates, sitemap entries and the JSON-LD `@id` all
 * come from the four functions below, so there is exactly one answer to "what
 * is the URL of this page in this locale" and no second implementation to drift
 * from it.
 *
 * Two things are derived rather than written down, and both are load-bearing:
 *
 * - **The route list** is `content/site.json` → `routes[]` plus the home page.
 *   Six detail routes today, so seven page routes; a reserved page (`/faq`,
 *   `/enroll`) enters the sitemap the day its `routes[]` entry does, with no
 *   edit here (`D-06.12`).
 * - **The locale list** is `routing.locales`. Holding `zh-Hant` back at the
 *   Phase 8 gate (`D-10.12`) changes the sitemap from 21 URLs to 14 and the
 *   `hreflang` set from four entries to three, again with no edit here.
 *
 * Nothing in this file compares a locale to a literal (INV-02.9) or spells an
 * origin (INV-06.10).
 */

/**
 * The `hreflang` value for readers no locale claims (`D-02.9`).
 *
 * Not a locale id and not a member of `routing.locales` — it is the sentinel
 * `hreflang` reserves for "the fallback", and 06 §6.5 points it at the default
 * locale's URL. It sits beside the real ids in the same map, which is what
 * makes the emitted set "one entry per locale **plus** `x-default`".
 */
export const X_DEFAULT = "x-default";

/** The home page's href. On 06's two-entry literal-href allowlist. */
export const HOME_HREF = "/";

/**
 * Next's metadata route for the sitemap. Not a page and not a locale prefix, so
 * it never passes through `getPathname`; `robots.txt` names it absolutely.
 */
export const SITEMAP_PATH = "/sitemap.xml";

/**
 * Every page route the site publishes, in sitemap order: the home page, then
 * `site.json.routes[]` as the owner ordered them.
 *
 * The `/api` route handler, the metadata routes (`/sitemap.xml`, `/robots.txt`,
 * `/manifest.webmanifest`), the 404 and every query or hash variant are absent
 * by construction — this list only ever contains page routes (INV-06.4).
 */
export function pageHrefs(): readonly string[] {
  return [HOME_HREF, ...getSite().routes.map((route) => route.path)];
}

/** The locale-prefixed path of a page — `/zh-Hant/menu`. Relative, no origin. */
export function pathFor(locale: Locale, href: string): string {
  return getPathname({ locale, href });
}

/**
 * A path resolved against the environment's origin (`D-06.11`).
 *
 * `new URL(path, siteUrl)` rather than string concatenation, so a missing or
 * doubled slash cannot produce `https://host//en/menu`, and so the shared
 * frozen `siteUrl` is read rather than mutated.
 */
export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl).toString();
}

/** The absolute canonical URL of one page in one locale. */
export function canonicalUrl(locale: Locale, href: string): string {
  return absoluteUrl(pathFor(locale, href));
}

/**
 * The `hreflang` map for a page: one entry per enabled locale plus `x-default`.
 *
 * **It does not take the current locale, and that is the point.** 06 §6.5 says
 * the alternate set is identical on every locale's copy of a page and only the
 * canonical moves; a function that cannot see the current locale cannot make it
 * otherwise, so reciprocity — every alternate lists every other, and each one
 * points back — holds by construction rather than by review.
 *
 * The keys are `LOCALE_META[l].hreflang`, not the locale ids directly. The two
 * are the same string today (`D-02.1`) and reading the metadata row is what
 * keeps them the same string when a locale is added whose tag differs from its
 * id.
 *
 * @param toUrl How to render each alternate — relative for page metadata, which
 *   Next resolves against `metadataBase`, absolute for the sitemap, whose XML
 *   has no base to resolve against.
 */
export function alternateLanguages(
  href: string,
  toUrl: (locale: Locale, href: string) => string,
): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[LOCALE_META[locale].hreflang] = toUrl(locale, href);
  }
  languages[X_DEFAULT] = toUrl(routing.defaultLocale, href);
  return languages;
}

/** The `hreflang` map as relative paths, for `alternates.languages` in metadata. */
export function relativeAlternates(href: string): Record<string, string> {
  return alternateLanguages(href, pathFor);
}

/** The `hreflang` map as absolute URLs, for `sitemap.xml`. */
export function absoluteAlternates(href: string): Record<string, string> {
  return alternateLanguages(href, canonicalUrl);
}
