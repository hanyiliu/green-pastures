import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { siteUrl } from "@/config/site-url";
import { getSite, type SiteConfig } from "@/content/site";
import type { Messages, MessageNamespace } from "@/i18n/messages";
import { LOCALE_META, routing, type Locale } from "@/i18n/routing";

import { canonicalUrl, HOME_HREF, pathFor, relativeAlternates } from "./urls";

/**
 * The one place page metadata is built (06 §6.5, `D-06.10`, INV-06.3).
 *
 * `buildRootMetadata` is the `[locale]` layout's block — `metadataBase`, the
 * title template, the shared social card, the robots and format defaults.
 * `buildMetadata` is what every `page.tsx` returns from its `generateMetadata`,
 * one call each: title, description, canonical, the full `hreflang` set and the
 * page's own Open Graph copy.
 *
 * ── Why the social card is rebuilt on every page ─────────────────────────
 *
 * Next merges metadata **shallowly** down the segment tree: a page that defines
 * `openGraph` at all *replaces* the layout's `openGraph` wholesale rather than
 * merging into it `[verified: generate-metadata "Merging"]`. A helper that
 * returned only `{title, description, url, locale}` under `openGraph` — which
 * is what 06 §6.5's sketch does — would therefore delete `og:type`,
 * `og:site_name` and the 1200×630 share image from every page but the ones that
 * export no metadata at all. The defaults are built by
 * {@link openGraphDefaults} and spread into both callers, which is the pattern
 * Next's own docs prescribe for exactly this trap.
 *
 * `twitter` is left to the layout on purpose: the page sets no `twitter` key, so
 * the layout's `summary_large_image` card is inherited intact, and Twitter reads
 * the title, description and image off the Open Graph tags.
 */

/** A namespace whose messages carry a `meta.title` / `meta.description` pair. */
type MetaShape = { readonly meta: { readonly title: string; readonly description: string } };

/**
 * The namespaces `buildMetadata` may be pointed at — derived from the `en`
 * reference tree, never listed. A namespace that grows a `meta` block becomes a
 * legal argument on the same commit that adds it, and one that loses it stops
 * compiling at its call site instead of rendering `⟦…⟧` in a `<title>`.
 */
export type MetaNamespace = {
  [K in MessageNamespace]: Messages[K] extends MetaShape ? K : never;
}[MessageNamespace];

export type PageMetadataOptions = {
  readonly locale: Locale;
  /** The unprefixed route path — `/philosophy`, or `/` for the home page. */
  readonly href: string;
  /** Which `<page>.meta.*` pair to read (02 `D-02.4` rule 7). */
  readonly namespace: MetaNamespace;
  /**
   * Skip the layout's `"%s · {brandName}"` template. The home page sets this:
   * its `home.meta.title` already names the brand, so the template would print
   * it twice.
   */
  readonly absoluteTitle?: boolean;
};

/**
 * The Open Graph fields that are the same on every page — `og:type`,
 * `og:site_name`, the share image and the locale pair.
 *
 * `alternateLocale` is `routing.locales` minus the current one. That is a
 * comparison of two variables, not of a locale against a literal, so INV-02.9
 * holds and holding a locale back removes its `og:locale:alternate` tag with no
 * edit here.
 */
function openGraphDefaults(
  locale: Locale,
  site: SiteConfig,
  siteName: string,
  imageAlt: string,
): NonNullable<Metadata["openGraph"]> {
  return {
    type: "website",
    siteName,
    locale: LOCALE_META[locale].ogLocale,
    alternateLocale: routing.locales
      .filter((other) => other !== locale)
      .map((other) => LOCALE_META[other].ogLocale),
    images: [
      {
        url: site.images.og.src,
        width: site.images.og.width,
        height: site.images.og.height,
        alt: imageAlt,
      },
    ],
  };
}

/**
 * The `[locale]` layout's metadata (`D-06.10`, `D-06.11`).
 *
 * `metadataBase` is a fresh `URL` built from the frozen origin rather than the
 * frozen instance itself: Next resolves every relative `canonical`,
 * `alternates.languages` entry and image path against it, and handing a shared
 * frozen object to code that may normalise it in place is a needless risk.
 *
 * `title.default` is the brand name and `title.template` is
 * `common.meta.titleTemplate` with its `{brandName}` argument already filled,
 * leaving the literal `%s` for Next to substitute the page title into
 * `[verified: title.template]`.
 */
export async function buildRootMetadata(locale: Locale): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "common" });
  const site = getSite();
  const brandName = site.brand.name[locale];
  const siteName = t("meta.siteName", { brandName });

  return {
    metadataBase: new URL(siteUrl.href),
    title: {
      default: siteName,
      template: t("meta.titleTemplate", { brandName }),
    },
    openGraph: openGraphDefaults(locale, site, siteName, t("meta.ogImageAlt")),
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
    // The phone number is a `tel:` link the design draws; Safari must not also
    // underline every digit string it finds in the copy.
    formatDetection: { telephone: false },
  };
}

/**
 * One page's metadata. Every route's `generateMetadata` is a single call to
 * this (INV-06.3), which is what keeps canonical URLs to one implementation.
 *
 * The canonical and the alternates are **relative**: Next resolves them against
 * `metadataBase`, so the same code emits the production apex in Production and
 * the deployment's own host on a Preview without branching on the environment.
 */
export async function buildMetadata({
  locale,
  href,
  namespace,
  absoluteTitle = false,
}: PageMetadataOptions): Promise<Metadata> {
  const common = await getTranslations({ locale, namespace: "common" });
  const t = await getTranslations({ locale, namespace });
  const site = getSite();
  const brandName = site.brand.name[locale];

  const title = t("meta.title", { brandName });
  const description = t("meta.description");
  const path = pathFor(locale, href);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: path,
      languages: relativeAlternates(href),
    },
    openGraph: {
      ...openGraphDefaults(
        locale,
        site,
        common("meta.siteName", { brandName }),
        common("meta.ogImageAlt"),
      ),
      title,
      description,
      url: path,
    },
  };
}

/**
 * The home page's metadata — the one route that opts out of the title template
 * (06 §6.5) and the only one whose href is not in `site.json.routes[]`.
 */
export function buildHomeMetadata(locale: Locale): Promise<Metadata> {
  return buildMetadata({ locale, href: HOME_HREF, namespace: "home", absoluteTitle: true });
}

/** Re-exported so a caller that needs the absolute form does not build its own. */
export { canonicalUrl };
