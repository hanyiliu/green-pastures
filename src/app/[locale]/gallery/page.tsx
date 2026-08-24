import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { SubpageBar } from "@/components/layout/SubpageBar";
import { SubpageHeader } from "@/components/layout/SubpageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { Reveal } from "@/components/motion/Reveal";
import { GalleryExplorer } from "@/components/pages/gallery/GalleryExplorer";
import type { GalleryFilter } from "@/components/pages/gallery/GalleryFilters";
import { GALLERY_COLUMN, GALLERY_HEADER, GALLERY_HINT } from "@/components/pages/gallery/layout";
import type { GalleryItem } from "@/components/pages/gallery/types";
import { routeHref } from "@/components/pages/route-href";
import { getGallery } from "@/content/collections";
import { notFound } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * `/{locale}/gallery` (06 `D-06.1`, `D-06.3`; 04 §1, §3.6).
 *
 * `PageTransition` → `SubpageBar` → `SubpageHeader` → the explorer and the
 * hint. Three of those four are the shell PR-6.1 built and this page only
 * configures: `SubpageBar` renders the tinted panel, the sticky bar, the
 * `<main id="main">` landmark and the "← Back" pill that owns focus on both
 * legs of the slide, and `SubpageHeader` reads `gallery.heading` out of the
 * page's own namespace. 06 §6.2 forbids route groups, so the composition is a
 * component chain rather than a shared layout, and every page repeats it.
 *
 * ── The page is where the collection is read, and the boundary is here ───
 *
 * `getGallery(locale)` joins `site.gallery.photos[]` and `categories[]` with
 * this locale's `collections.gallery.*` through the Zod schema that makes a
 * missing `alt` a build failure rather than an unlabelled image (INV-02.3).
 * That accessor is async and **server-only** (02 `D-02.16`), so this is an
 * async Server Component reading its own copy through `getTranslations`, and
 * the client explorer below it receives flat, already-translated props. The
 * only namespace that reaches the browser for this row is
 * `common.lightbox.*` (04 §6).
 *
 * ── The hint is rendered here, not in the explorer ───────────────────────
 *
 * `gallery.hint` is static copy under the wall (D L507, M L405) and nothing
 * about it is stateful, so it stays on the server. That is also what keeps 04
 * §6's client-namespace row honest: hand it to the explorer and the `gallery`
 * namespace would have to cross the boundary for one sentence.
 *
 * ── What the design draws and this page does not ─────────────────────────
 *
 * Both references open the column with an eyebrow — "OUR PHOTO WALL" (D L486,
 * M L389) — above the heading. There is no `gallery.eyebrow` key in any locale,
 * 04 §6's key table for this page lists `kicker|heading|hint|filters.all|meta.*`
 * and no eyebrow, and `SubpageHeader` says in as many words that "`gallery`,
 * `reviews` and `team` have neither". So the documents deliberately drop it and
 * this page follows them rather than inventing copy in three languages. The
 * component is already built for the reversal: add `gallery.eyebrow` to all
 * three locales and `SubpageHeader` renders it with no code change (INV-04.4).
 */

/** The `site.routes[]` id, which is also this page's message namespace. */
const ROUTE_ID = "gallery";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // The same guard the layout runs: `generateMetadata` is called first, so an
  // unknown prefix would reach `buildMetadata` before `notFound()` ever ran.
  if (!hasLocale(routing.locales, locale)) notFound();

  return buildMetadata({ locale, href: routeHref(ROUTE_ID), namespace: ROUTE_ID });
}

export default async function GalleryPage() {
  const locale = await getLocale();
  const t = await getTranslations(ROUTE_ID);
  const { categories, photos } = await getGallery(locale);

  const items: readonly GalleryItem[] = photos.map((photo) => ({
    id: photo.id,
    src: photo.src,
    width: photo.width,
    height: photo.height,
    alt: photo.text.alt,
    category: photo.category,
    onMobile: photo.onMobile,
  }));

  const filters: readonly GalleryFilter[] = categories.map((category) => ({
    id: category.id,
    label: category.name,
    onMobile: category.onMobile,
  }));

  return (
    <PageTransition>
      <SubpageBar routeId={ROUTE_ID} contentClassName={GALLERY_COLUMN}>
        <SubpageHeader page={ROUTE_ID} className={GALLERY_HEADER} />

        <GalleryExplorer
          items={items}
          categories={filters}
          allLabel={t("filters.all")}
          groupLabel={t("heading")}
        />

        <Reveal id="gallery.hint" variant="rise">
          <p className={GALLERY_HINT}>{t("hint")}</p>
        </Reveal>
      </SubpageBar>
    </PageTransition>
  );
}
