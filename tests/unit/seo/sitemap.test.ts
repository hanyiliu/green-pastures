import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { siteUrl } from "@/config/site-url";
import { getSite } from "@/content/site";
import { LOCALE_META, routing } from "@/i18n/routing";
import { absoluteAlternates, canonicalUrl, pageHrefs, X_DEFAULT } from "@/lib/seo/urls";

/**
 * `/sitemap.xml` (06 `D-06.12`, INV-06.4).
 *
 * The count is asserted as **`routes × locales`**, never as the number 21.
 * That is the whole point of `D-06.12`: holding `zh-Hant` back at the Phase 8
 * gate (`D-10.12`) drops the sitemap to 14 entries and this file keeps passing
 * without an edit, while a sitemap that stopped iterating one of the two lists
 * fails whatever the current numbers are.
 */
describe("app/sitemap.ts", () => {
  const entries = sitemap();

  it("has one entry per page route per enabled locale", () => {
    expect(entries).toHaveLength(pageHrefs().length * routing.locales.length);
    expect(pageHrefs()).toHaveLength(getSite().routes.length + 1);
  });

  it("lists every route × locale exactly once", () => {
    const expected = pageHrefs().flatMap((href) =>
      routing.locales.map((locale) => canonicalUrl(locale, href)),
    );

    expect(entries.map((entry) => entry.url).sort()).toEqual([...expected].sort());
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(entries.length);
  });

  it("carries the full hreflang set on every entry", () => {
    for (const href of pageHrefs()) {
      for (const locale of routing.locales) {
        const entry = entries.find((candidate) => candidate.url === canonicalUrl(locale, href));
        const languages = entry?.alternates?.languages;

        expect(languages).toBeDefined();
        expect(Object.keys(languages ?? {})).toHaveLength(routing.locales.length + 1);
        expect(languages?.[X_DEFAULT]).toBe(canonicalUrl(routing.defaultLocale, href));
      }
    }
  });

  it("matches the alternate set the page's own <head> emits", () => {
    for (const href of pageHrefs()) {
      const expected = absoluteAlternates(href);

      for (const locale of routing.locales) {
        const entry = entries.find((candidate) => candidate.url === canonicalUrl(locale, href));

        expect(entry?.alternates?.languages).toEqual(expected);
        expect(entry?.alternates?.languages?.[LOCALE_META[locale].hreflang]).toBe(entry?.url);
      }
    }
  });

  it("excludes /api, the metadata routes and every query or hash variant", () => {
    for (const entry of entries) {
      expect(entry.url.startsWith(siteUrl.origin)).toBe(true);
      expect(entry.url).not.toContain("/api");
      expect(entry.url).not.toContain(".xml");
      expect(entry.url).not.toContain(".txt");
      expect(entry.url).not.toContain("?");
      expect(entry.url).not.toContain("#");
    }
  });

  it("carries no lastModified, priority or changeFrequency (D-06.12)", () => {
    for (const entry of entries) {
      expect(entry.lastModified).toBeUndefined();
      expect(entry.priority).toBeUndefined();
      expect(entry.changeFrequency).toBeUndefined();
    }
  });
});
