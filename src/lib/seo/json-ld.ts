import { getSite, type SiteConfig } from "@/content/site";
import type { DayId } from "@/content/schemas/menu";
import { LOCALE_META, routing, type Locale } from "@/i18n/routing";

import { absoluteUrl, canonicalUrl, HOME_HREF } from "./urls";

/**
 * The `ChildCare` structured-data object (06 §6.6, `D-06.13`).
 *
 * One object, on the home page, once per locale. `ChildCare` is schema.org's
 * subtype of `LocalBusiness`, which is what lets the graph say "daycare" rather
 * than "business that happens to mention children".
 *
 * ── It ships complete, and that is a decision ────────────────────────────
 *
 * An earlier revision emitted only the facts that carried no placeholder
 * marker, so the object grew a field at a time as the owner filled the file in.
 * HD-7 retired that: telephone, e-mail, street address and the Yelp URL now
 * exist as **provisional sample defaults** (`D-02.20`), registered in
 * `site.json.provisional`. So this builder emits every field the config has and
 * branches on none of them — the shape a crawler sees today is the shape it
 * sees at launch — and `pnpm validate:content --release` is what refuses to
 * call the site ready while a sample is still in the registry (INV-02.10).
 * Nothing here inspects that registry; a builder that quietly dropped a field
 * because it was provisional would be the old behaviour under a new name.
 *
 * The marker word that retired revision keyed on is described, never spelled:
 * `check:todo` (08 §2, TRAP-11.9) bans it from the text of `src/`, `tests/` and
 * `scripts/`, and a comment *about* the rule is text like any other — backticks
 * do not exempt it. Do not "clarify" this paragraph by writing the word out.
 *
 * ── What is deliberately absent ──────────────────────────────────────────
 *
 * - `aggregateRating` and `review`: self-serving review markup is against
 *   Google's guidelines. The Yelp figures stay visible text on the page.
 * - `priceRange`: not in the design, and inventing a band is inventing content.
 * - `geo`: coordinates are not in `site.json` and deriving them from a
 *   provisional street address would publish a guess.
 *
 * Detail pages carry no JSON-LD at launch; `BreadcrumbList` is a cheap later
 * addition.
 */

/**
 * `site.json` day ids → the day names schema.org's `dayOfWeek` takes.
 *
 * Configuration, not translation: these strings are never rendered, they are
 * vocabulary terms in a machine-readable graph, so they stay English in every
 * locale and INV-02.1 has nothing to catch. Sunday and Saturday are present
 * because `hours.days` may name them, not because the daycare opens then.
 */
const SCHEMA_DAY: Record<DayId, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** schema.org's `PostalAddress`, from `site.json` → `contact.address`. */
type PostalAddress = {
  readonly "@type": "PostalAddress";
  readonly streetAddress: string;
  readonly addressLocality: string;
  readonly addressRegion: string;
  readonly postalCode: string;
  readonly addressCountry: string;
};

/** One opening-hours row: the days the daycare is open, and when. */
type OpeningHours = {
  readonly "@type": "OpeningHoursSpecification";
  readonly dayOfWeek: readonly string[];
  readonly opens: string;
  readonly closes: string;
};

export type ChildCareJsonLd = {
  readonly "@context": "https://schema.org";
  readonly "@type": "ChildCare";
  readonly "@id": string;
  readonly name: string;
  readonly alternateName: string;
  readonly url: string;
  readonly inLanguage: string;
  readonly description: string;
  readonly telephone: string;
  readonly email: string;
  readonly address: PostalAddress;
  readonly openingHoursSpecification: readonly OpeningHours[];
  readonly image: string;
  readonly logo: string;
  readonly sameAs: readonly string[];
  readonly knowsLanguage: readonly string[];
};

/**
 * Every profile the daycare owns elsewhere, in `site.json` order.
 *
 * Both blocks are optional in the schema — a daycare with no Yelp page deletes
 * the whole `yelp` object — so `sameAs` shrinks rather than carrying an
 * `undefined`, and disappears entirely if both are gone.
 */
function sameAs(site: SiteConfig): readonly string[] {
  const profiles = [
    site.yelp?.url,
    site.social?.instagram,
    site.social?.facebook,
    site.social?.wechat,
  ];
  return profiles.filter((url): url is string => url !== undefined);
}

export type ChildCareJsonLdOptions = {
  readonly locale: Locale;
  /** `home.meta.description` — the same sentence the home page's `<meta>` carries. */
  readonly description: string;
};

/**
 * Build the object. Pure: every value comes from `content/site.json`,
 * `routing.ts` and the caller's description, and nothing reads the clock, the
 * request or the environment beyond the shared origin.
 */
export function buildChildCareJsonLd({
  locale,
  description,
}: ChildCareJsonLdOptions): ChildCareJsonLd {
  const site = getSite();
  const home = canonicalUrl(locale, HOME_HREF);
  const { address } = site.contact;

  return {
    "@context": "https://schema.org",
    "@type": "ChildCare",
    // Per locale, so the three home pages are three nodes rather than one node
    // claimed three times with different names.
    "@id": `${home}#business`,
    name: site.brand.name[locale],
    // The bilingual pairing the footer prints (02 `D-02.19`) — a field on the
    // locale's own row, never a `locale === …` branch (INV-02.9).
    alternateName: site.brand.name[LOCALE_META[locale].brandPairLocale],
    url: home,
    inLanguage: LOCALE_META[locale].htmlLang,
    description,
    telephone: site.contact.phone,
    email: site.contact.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: address.street,
      addressLocality: address.city,
      addressRegion: address.region,
      postalCode: address.postalCode,
      addressCountry: address.country,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: site.hours.days.map((day) => SCHEMA_DAY[day]),
        opens: site.hours.open,
        closes: site.hours.close,
      },
    ],
    image: absoluteUrl(site.images.hero.src),
    // The wordmark of 03 `D-03.9`, read from `site.json` `images.logo` — the
    // same declaration `LogoCard` draws, so the mark this markup advertises
    // cannot drift from the one the pages render.
    logo: absoluteUrl(site.images.logo.src),
    sameAs: sameAs(site),
    // The locale ids **are** BCP 47 tags (02 `D-02.1`), so nothing maps here —
    // and the list shrinks with `routing.locales` if a locale is held back.
    knowsLanguage: [...routing.locales],
  };
}

/**
 * Serialise for injection into a `<script>`.
 *
 * `JSON.stringify` does not escape `<`, so a content value containing
 * `</script>` would close the element and everything after it would be parsed
 * as markup. Replacing every `<` with its `\u003c` escape is still valid JSON,
 * parses to the identical string for every consumer, and makes that sequence
 * unrepresentable. Exported so the escape is testable without a DOM.
 */
export function serialiseJsonLd(data: unknown): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}
