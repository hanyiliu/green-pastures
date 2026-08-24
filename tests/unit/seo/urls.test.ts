import { describe, expect, it } from "vitest";

import { siteUrl } from "@/config/site-url";
import { getSite } from "@/content/site";
import { LOCALE_META, routing } from "@/i18n/routing";
import {
  absoluteAlternates,
  absoluteUrl,
  canonicalUrl,
  HOME_HREF,
  pageHrefs,
  pathFor,
  relativeAlternates,
  SITEMAP_PATH,
  X_DEFAULT,
} from "@/lib/seo/urls";

/**
 * The URL layer (06 §6.5, INV-06.1, INV-06.4, INV-06.10).
 *
 * Every expectation is derived from `content/site.json` and `routing.locales`.
 * Nothing here writes a locale id, a route path or an origin, so the suite
 * still passes — and still means something — the day a route is added or
 * `zh-Hant` is held back (`D-10.12`).
 */
describe("src/lib/seo/urls", () => {
  it("publishes the home page plus every route in site.json, and nothing else", () => {
    const routes = getSite().routes;

    expect(pageHrefs()).toEqual([HOME_HREF, ...routes.map((route) => route.path)]);
    expect(pageHrefs()).toHaveLength(routes.length + 1);
    expect(pageHrefs().some((href) => href.startsWith("/api"))).toBe(false);
  });

  it("prefixes every locale, including the default one", () => {
    for (const locale of routing.locales) {
      expect(pathFor(locale, HOME_HREF)).toBe(`/${locale}`);
      for (const route of getSite().routes) {
        expect(pathFor(locale, route.path)).toBe(`/${locale}${route.path}`);
      }
    }
  });

  it("resolves relative paths against the environment origin, never by concatenation", () => {
    expect(absoluteUrl(SITEMAP_PATH)).toBe(`${siteUrl.origin}${SITEMAP_PATH}`);
    // A doubled slash is the classic string-concatenation bug; `new URL` cannot
    // produce one.
    expect(absoluteUrl("/en/menu")).not.toContain("//en");
    expect(canonicalUrl(routing.defaultLocale, HOME_HREF)).toBe(
      `${siteUrl.origin}/${routing.defaultLocale}`,
    );
  });

  it("carries no trailing slash on any canonical", () => {
    for (const href of pageHrefs()) {
      for (const locale of routing.locales) {
        expect(canonicalUrl(locale, href).endsWith("/")).toBe(false);
      }
    }
  });

  it("emits one hreflang entry per enabled locale plus x-default", () => {
    for (const href of pageHrefs()) {
      const languages = relativeAlternates(href);

      expect(Object.keys(languages)).toHaveLength(routing.locales.length + 1);
      expect(Object.keys(languages)).toContain(X_DEFAULT);
      for (const locale of routing.locales) {
        expect(languages[LOCALE_META[locale].hreflang]).toBe(pathFor(locale, href));
      }
    }
  });

  it("points x-default at the default locale (D-02.9)", () => {
    for (const href of pageHrefs()) {
      expect(relativeAlternates(href)[X_DEFAULT]).toBe(pathFor(routing.defaultLocale, href));
      expect(absoluteAlternates(href)[X_DEFAULT]).toBe(canonicalUrl(routing.defaultLocale, href));
    }
  });

  it("renders the same set relatively and absolutely", () => {
    for (const href of pageHrefs()) {
      const relative = relativeAlternates(href);
      const absolute = absoluteAlternates(href);

      expect(Object.keys(absolute)).toEqual(Object.keys(relative));
      for (const [tag, path] of Object.entries(relative)) {
        expect(absolute[tag]).toBe(absoluteUrl(path));
      }
    }
  });

  /**
   * The alternate set does not depend on the page it is emitted from — which is
   * what makes reciprocity structural rather than a review item. The end-to-end
   * proof, against the metadata two pages actually return, is in
   * `metadata.test.ts`; this is the property that makes it possible.
   */
  it("advertises the same set from every locale — only the canonical moves", () => {
    for (const href of pageHrefs()) {
      const advertised = absoluteAlternates(href);

      for (const locale of routing.locales) {
        expect(advertised[LOCALE_META[locale].hreflang]).toBe(canonicalUrl(locale, href));
      }

      const canonicals = new Set(routing.locales.map((locale) => canonicalUrl(locale, href)));
      expect(canonicals.size).toBe(routing.locales.length);
    }
  });
});
