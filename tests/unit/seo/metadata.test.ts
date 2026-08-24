import type { Metadata } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { siteUrl } from "@/config/site-url";
import { getSite } from "@/content/site";
import { MESSAGE_NAMESPACES, reference } from "@/i18n/messages";
import { LOCALE_META, routing, type Locale } from "@/i18n/routing";
import type { MetaNamespace } from "@/lib/seo/metadata";

import { intlFixture } from "./intl-server";

vi.mock("next-intl/server", async () => {
  const { createIntlServerStub } = await import("./intl-server");
  return createIntlServerStub();
});

const { buildHomeMetadata, buildMetadata, buildRootMetadata } = await import("@/lib/seo/metadata");
const { HOME_HREF, pageHrefs, pathFor, X_DEFAULT } = await import("@/lib/seo/urls");

/**
 * The shared metadata helper (06 §6.5, `D-06.10`, INV-06.3).
 *
 * Every assertion here is a property over **every page route × every enabled
 * locale**, not a spot check on one page. `hreflang` reciprocity in particular
 * is the kind of thing that looks right on the page you happen to open and is
 * wrong on the twentieth, so it is proved across the whole set: the alternate
 * page A advertises for locale B is compared against the canonical page B
 * actually returns, from two separate calls to the helper.
 */

/** Every (route, locale) pair the site publishes — the sitemap's rows, as inputs. */
function everyPage(): Array<{ href: string; locale: Locale }> {
  return pageHrefs().flatMap((href) => routing.locales.map((locale) => ({ href, locale })));
}

/**
 * The namespace whose `meta.*` pair a route reads: `/menu` → `menu`, `/` →
 * `home`. Route ids and message namespaces share a spelling by 02's convention
 * (`D-02.4` rule 7), which this resolves through `MESSAGE_NAMESPACES` rather
 * than assuming — a route whose id has no namespace fails here, loudly.
 */
function namespaceFor(href: string): MetaNamespace {
  const route = getSite().routes.find((candidate) => candidate.path === href);
  const id = route?.id ?? "home";
  const namespace = MESSAGE_NAMESPACES.find((candidate) => candidate === id);

  if (namespace === undefined) {
    throw new Error(`Route "${href}" has id "${id}", which is not a message namespace.`);
  }
  return namespace as MetaNamespace;
}

function languagesOf(metadata: Metadata): Record<string, string> {
  return (metadata.alternates?.languages ?? {}) as Record<string, string>;
}

/** `metadataBase`, narrowed — Next types it as `string | URL | null | undefined`. */
function baseOf(metadata: Metadata): URL {
  const { metadataBase } = metadata;
  if (!(metadataBase instanceof URL)) throw new Error("metadataBase is not a URL.");
  return metadataBase;
}

/** The title as text, whether the page returned a bare string or `{ absolute }`. */
function titleTextOf(metadata: Metadata): string {
  const { title } = metadata;
  return typeof title === "string" ? title : ((title as { absolute: string }).absolute ?? "");
}

beforeEach(() => {
  intlFixture.locale = routing.defaultLocale;
});

describe("buildRootMetadata", () => {
  it("sets metadataBase from the environment, not from site.json", async () => {
    const base = baseOf(await buildRootMetadata(routing.defaultLocale));

    expect(base.origin).toBe(siteUrl.origin);
    // INV-06.10: `brand.url` is the owner's record, never the metadata origin.
    expect(base.href).not.toContain(new URL(getSite().brand.url).hostname);
  });

  it("hands Next a fresh URL rather than the shared frozen origin", async () => {
    const base = baseOf(await buildRootMetadata(routing.defaultLocale));

    expect(base).not.toBe(siteUrl);
    expect(Object.isFrozen(base)).toBe(false);
  });

  it("fills the title template's brand argument and leaves %s for Next", async () => {
    for (const locale of routing.locales) {
      const metadata = await buildRootMetadata(locale);
      const title = metadata.title as { default: string; template: string };
      const brandName = getSite().brand.name[locale];

      expect(title.default).toBe(brandName);
      expect(title.template).toContain("%s");
      expect(title.template).toContain(brandName);
      expect(title.template).not.toContain("{brandName}");
    }
  });

  it("carries the shared social card, the robots defaults and the phone opt-out", async () => {
    const site = getSite();
    const metadata = await buildRootMetadata(routing.defaultLocale);
    const openGraph = metadata.openGraph as {
      type: string;
      siteName: string;
      images: Array<{ url: string; width: number; height: number; alt: string }>;
    };

    expect(openGraph.type).toBe("website");
    expect(openGraph.images[0]).toEqual({
      url: site.images.og.src,
      width: site.images.og.width,
      height: site.images.og.height,
      alt: reference.common.meta.ogImageAlt,
    });
    expect(metadata.twitter).toEqual({ card: "summary_large_image" });
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.formatDetection).toEqual({ telephone: false });
  });

  it("names the other enabled locales as og:locale:alternate", async () => {
    for (const locale of routing.locales) {
      const openGraph = (await buildRootMetadata(locale)).openGraph as {
        locale: string;
        alternateLocale: string[];
      };

      expect(openGraph.locale).toBe(LOCALE_META[locale].ogLocale);
      expect(openGraph.alternateLocale).toEqual(
        routing.locales
          .filter((other) => other !== locale)
          .map((other) => LOCALE_META[other].ogLocale),
      );
      expect(openGraph.alternateLocale).not.toContain(openGraph.locale);
    }
  });
});

describe("buildMetadata", () => {
  it("returns a relative canonical that is this page's own URL", async () => {
    for (const { href, locale } of everyPage()) {
      const metadata = await buildMetadata({ locale, href, namespace: namespaceFor(href) });

      expect(metadata.alternates?.canonical).toBe(pathFor(locale, href));
    }
  });

  it("emits one hreflang entry per enabled locale plus x-default, on every page", async () => {
    for (const { href, locale } of everyPage()) {
      const languages = languagesOf(
        await buildMetadata({ locale, href, namespace: namespaceFor(href) }),
      );

      expect(Object.keys(languages)).toHaveLength(routing.locales.length + 1);
      expect(languages[X_DEFAULT]).toBe(pathFor(routing.defaultLocale, href));
      for (const other of routing.locales) {
        expect(languages[LOCALE_META[other].hreflang]).toBeDefined();
      }
    }
  });

  /**
   * Reciprocity, proved end to end: for every route and every ordered pair of
   * locales, what A's metadata advertises for B is exactly what B's metadata
   * claims as its canonical. Two separate calls, compared — a set that is
   * complete but points one route sideways fails here.
   */
  it("is reciprocal across every route and every ordered pair of locales", async () => {
    for (const href of pageHrefs()) {
      const namespace = namespaceFor(href);
      const pages = new Map<Locale, Metadata>();

      for (const locale of routing.locales) {
        pages.set(locale, await buildMetadata({ locale, href, namespace }));
      }

      for (const [from, metadata] of pages) {
        const languages = languagesOf(metadata);

        for (const [to, target] of pages) {
          expect({ from, to, href, advertised: languages[LOCALE_META[to].hreflang] }).toEqual({
            from,
            to,
            href,
            advertised: target.alternates?.canonical,
          });
        }

        // The set is identical everywhere; only the canonical moves.
        expect(languages).toEqual(languagesOf(pages.get(routing.defaultLocale) as Metadata));
      }
    }
  });

  it("never points a canonical across locales", async () => {
    for (const { href, locale } of everyPage()) {
      const metadata = await buildMetadata({ locale, href, namespace: namespaceFor(href) });

      expect(metadata.alternates?.canonical).toBe(pathFor(locale, href));
      for (const other of routing.locales.filter((candidate) => candidate !== locale)) {
        expect(metadata.alternates?.canonical).not.toBe(pathFor(other, href));
      }
    }
  });

  /**
   * Next merges metadata shallowly: a page that sets `openGraph` at all
   * *replaces* the layout's. So the helper has to re-emit `og:type`,
   * `og:site_name` and the share image on every page, or the card silently
   * loses its image everywhere but the home page.
   */
  it("re-emits the shared Open Graph defaults, which Next would otherwise drop", async () => {
    const site = getSite();

    for (const { href, locale } of everyPage()) {
      const metadata = await buildMetadata({ locale, href, namespace: namespaceFor(href) });
      const openGraph = metadata.openGraph as {
        type: string;
        siteName: string;
        images: Array<{ url: string }>;
        locale: string;
        url: string;
        title: string;
        description: string;
      };

      expect(openGraph.type).toBe("website");
      expect(openGraph.siteName).toBe(site.brand.name[locale]);
      expect(openGraph.images[0]?.url).toBe(site.images.og.src);
      expect(openGraph.locale).toBe(LOCALE_META[locale].ogLocale);
      expect(openGraph.url).toBe(pathFor(locale, href));
      expect(openGraph.title).toBe(titleTextOf(metadata));
      expect(openGraph.description).toBe(metadata.description);
    }
  });

  it("leaves `twitter` alone so the layout's card type is inherited", async () => {
    const metadata = await buildMetadata({
      locale: routing.defaultLocale,
      href: HOME_HREF,
      namespace: "home",
    });

    expect(metadata.twitter).toBeUndefined();
  });

  it("uses the template for detail pages and an absolute title for the home page", async () => {
    const brandName = getSite().brand.name[routing.defaultLocale];
    const home = await buildHomeMetadata(routing.defaultLocale);

    // The home title already names the brand, so the "%s · {brandName}"
    // template would print it twice; `{ absolute }` is how a page opts out.
    expect(home.title).toHaveProperty("absolute");
    expect(titleTextOf(home)).toContain(brandName);

    const first = getSite().routes[0]?.path ?? HOME_HREF;
    const detail = await buildMetadata({
      locale: routing.defaultLocale,
      href: first,
      namespace: namespaceFor(first),
    });

    // A bare string goes through the layout's template.
    expect(typeof detail.title).toBe("string");
    expect(detail.title).not.toContain(brandName);
  });

  it("reads title and description from the route's own meta.* pair", async () => {
    for (const route of getSite().routes) {
      const namespace = namespaceFor(route.path);
      const metadata = await buildMetadata({
        locale: routing.defaultLocale,
        href: route.path,
        namespace,
      });
      const source = reference[namespace] as { meta: { title: string; description: string } };

      expect(metadata.title).toBe(source.meta.title);
      expect(metadata.description).toBe(source.meta.description);
      expect(metadata.description).not.toContain("⟦");
    }
  });

  it("builds the home page's metadata through the same helper", async () => {
    const viaHelper = await buildHomeMetadata(routing.defaultLocale);
    const direct = await buildMetadata({
      locale: routing.defaultLocale,
      href: HOME_HREF,
      namespace: "home",
      absoluteTitle: true,
    });

    expect(viaHelper).toEqual(direct);
  });
});
