import { describe, expect, it } from "vitest";

import { getProvisionalPaths, getSite } from "@/content/site";
import { LOCALE_META, routing } from "@/i18n/routing";
import { buildChildCareJsonLd, serialiseJsonLd } from "@/lib/seo/json-ld";
import { canonicalUrl, HOME_HREF } from "@/lib/seo/urls";

/**
 * The `ChildCare` object (06 §6.6, `D-06.13`, `D-10.11`).
 *
 * Two things this suite is about, beyond "the fields are there":
 *
 * - **It is complete in every locale.** HD-7 replaced the old "emit only the
 *   facts with no placeholder marker on them" rule with sample defaults plus
 *   the `provisional` registry, so a builder that skipped a field because it
 *   looked like a placeholder would be the retired behaviour wearing a new
 *   name. (The marker word stays unspelled here for the reason `json-ld.ts`
 *   gives: `check:todo` greps text, and prose about the rule is text.)
 * - **Three fields are absent on purpose** and stay absent — `aggregateRating`,
 *   `priceRange`, `geo`. An absence nobody asserts is an absence that comes
 *   back.
 */
const DESCRIPTION = "A warm, bilingual Montessori home in Fremont.";

/** Read a dotted `site.json` path — the same addressing the registry uses. */
function valueAt(path: string): string {
  let node: unknown = getSite();
  for (const key of path.split(".")) {
    node = typeof node === "object" && node !== null ? Reflect.get(node, key) : undefined;
  }
  if (typeof node !== "string") throw new Error(`site.json path "${path}" is not a string.`);
  return node;
}

describe("src/lib/seo/json-ld", () => {
  it("emits every field site.json has, in every locale", () => {
    const site = getSite();

    for (const locale of routing.locales) {
      const graph = buildChildCareJsonLd({ locale, description: DESCRIPTION });
      const home = canonicalUrl(locale, HOME_HREF);

      expect(graph["@context"]).toBe("https://schema.org");
      expect(graph["@type"]).toBe("ChildCare");
      expect(graph["@id"]).toBe(`${home}#business`);
      expect(graph.url).toBe(home);
      expect(graph.inLanguage).toBe(LOCALE_META[locale].htmlLang);
      expect(graph.description).toBe(DESCRIPTION);

      expect(graph.name).toBe(site.brand.name[locale]);
      expect(graph.alternateName).toBe(site.brand.name[LOCALE_META[locale].brandPairLocale]);
      expect(graph.name).not.toBe(graph.alternateName);

      expect(graph.telephone).toBe(site.contact.phone);
      expect(graph.email).toBe(site.contact.email);

      expect(graph.address).toEqual({
        "@type": "PostalAddress",
        streetAddress: site.contact.address.street,
        addressLocality: site.contact.address.city,
        addressRegion: site.contact.address.region,
        postalCode: site.contact.address.postalCode,
        addressCountry: site.contact.address.country,
      });

      expect(graph.image).toBe(new URL(site.images.hero.src, home).toString());
      expect(graph.logo.endsWith(".png")).toBe(true);
      expect(graph.logo.startsWith(new URL(home).origin)).toBe(true);

      // No field is empty, undefined or a leftover marker.
      const entries = Object.entries(graph);
      expect(entries.filter(([, value]) => value === undefined).map(([key]) => key)).toEqual([]);
      expect(entries.filter(([, value]) => value === "").map(([key]) => key)).toEqual([]);
      expect(
        entries
          .filter(([, value]) => typeof value === "string" && value.includes("⟦"))
          .map(([key]) => key),
      ).toEqual([]);
    }
  });

  it("carries the owner facts that are still provisional samples (D-10.11)", () => {
    // Every one of these paths is in `site.json.provisional` today, and the
    // object renders their values anyway. `validate:content --release` is what
    // blocks launch while they are samples (INV-02.10); this builder must not
    // second-guess it by dropping a field that looks like a placeholder.
    const registry = getProvisionalPaths();
    const graph = buildChildCareJsonLd({
      locale: routing.defaultLocale,
      description: DESCRIPTION,
    });
    const serialised = serialiseJsonLd(graph);

    const sampled = ["contact.phone", "contact.email", "contact.address.street", "yelp.url"];

    expect(sampled.filter((path) => !registry.includes(path))).toEqual([]);
    expect(sampled.filter((path) => !serialised.includes(valueAt(path)))).toEqual([]);
  });

  it("maps hours.days to schema.org day names and keeps the open/close times", () => {
    const site = getSite();
    const [hours] = buildChildCareJsonLd({
      locale: routing.defaultLocale,
      description: DESCRIPTION,
    }).openingHoursSpecification;

    expect(hours?.["@type"]).toBe("OpeningHoursSpecification");
    expect(hours?.dayOfWeek).toHaveLength(site.hours.days.length);
    expect(hours?.dayOfWeek.every((day) => /^[A-Z][a-z]+day$/.test(day))).toBe(true);
    expect(hours?.opens).toBe(site.hours.open);
    expect(hours?.closes).toBe(site.hours.close);
  });

  it("puts the Yelp and social profiles in sameAs, and nothing else", () => {
    const site = getSite();
    const expected = [
      site.yelp?.url,
      site.social?.instagram,
      site.social?.facebook,
      site.social?.wechat,
    ].filter((url) => url !== undefined);

    const graph = buildChildCareJsonLd({ locale: routing.defaultLocale, description: DESCRIPTION });

    expect(graph.sameAs).toEqual(expected);
    expect(graph.sameAs.every((url) => URL.canParse(url))).toBe(true);
  });

  it("lists routing.locales verbatim in knowsLanguage — the ids are the tags", () => {
    const graph = buildChildCareJsonLd({ locale: routing.defaultLocale, description: DESCRIPTION });

    expect(graph.knowsLanguage).toEqual([...routing.locales]);
  });

  it("omits aggregateRating, review, priceRange and geo (06 §6.6)", () => {
    const graph: Record<string, unknown> = buildChildCareJsonLd({
      locale: routing.defaultLocale,
      description: DESCRIPTION,
    });

    const forbidden = ["aggregateRating", "review", "reviewCount", "priceRange", "geo"];

    expect(forbidden.filter((field) => field in graph)).toEqual([]);
  });

  it("escapes every < so no content value can close the script element", () => {
    const serialised = serialiseJsonLd({ description: "</script><img onerror=alert(1)>" });

    expect(serialised).not.toContain("<");
    expect(serialised).toContain("\\u003c");
    expect(JSON.parse(serialised)).toEqual({ description: "</script><img onerror=alert(1)>" });
  });

  it("round-trips the real object through the escape unchanged", () => {
    const graph = buildChildCareJsonLd({ locale: routing.defaultLocale, description: DESCRIPTION });

    expect(JSON.parse(serialiseJsonLd(graph))).toEqual(JSON.parse(JSON.stringify(graph)));
  });
});
