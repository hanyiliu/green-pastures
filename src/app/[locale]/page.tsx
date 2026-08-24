import type { Metadata } from "next";
import { hasLocale } from "next-intl";

import { PageTransition } from "@/components/motion/PageTransition";
import { HeroSection } from "@/components/sections/hero/HeroSection";
import PhilosophySection from "@/components/sections/philosophy";
import ProgramsSection from "@/components/sections/programs/ProgramsSection";
import MenuSection from "@/components/sections/menu/MenuSection";
import GallerySection from "@/components/sections/gallery/GallerySection";
import TestimonialsSection from "@/components/sections/testimonials/TestimonialsSection";
import TeachersSection from "@/components/sections/teachers/TeachersSection";
import VisitSection from "@/components/sections/visit/VisitSection";
import { notFound } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { buildHomeMetadata } from "@/lib/seo/metadata";

/**
 * Home route (04 §1, 05 §5.7, §5.8).
 *
 * `PageTransition` → `<main id="main" data-snap-root>` → the home sections, in
 * scroll order. Three things about that shape are decisions rather than
 * arrangement:
 *
 * - **`PageTransition` is here, not in the layout.** A layout persists across a
 *   navigation, so its subtree neither enters nor exits and the subpage slide
 *   would never fire. Two sibling pages each wrapping themselves is what gives
 *   React an exit on one side and an enter on the other (05 `D-05.10`).
 * - **`<main>` is the page's, not the layout's.** The home page is the only one
 *   that scroll-snaps, so it is the only one that may carry `data-snap-root`;
 *   `app/[locale]/layout.tsx` renders no landmark of its own for exactly that
 *   reason (04 §1). The skip link targets `#main` here.
 * - **The child of `PageTransition` is a single element.** React snapshots what
 *   it finds, and a fragment of siblings gives the browser several boxes to
 *   name.
 *
 * The remaining seven sections of 04 §1 land in Phase 5 and slot in below the
 * hero in `SECTION_IDS` order; nothing else in this file changes when they do.
 */

/**
 * Title, description, canonical and the full `hreflang` set (06 `D-06.10`,
 * INV-06.3). One call to the shared helper, exactly as the six detail pages do
 * — this route is the seventh, not an exception.
 *
 * It calls {@link buildHomeMetadata} rather than `buildMetadata` directly
 * because the home page is the one route that differs on two counts, both of
 * them already settled inside that wrapper (06 §6.5): its href is `/`, the only
 * page path not in `site.json.routes[]`, and its `home.meta.title` already names
 * the brand, so it opts out of the layout's `"%s · {brandName}"` template
 * instead of printing the brand twice.
 *
 * **What this returns does not shrink the layout's card.** Next merges metadata
 * shallowly, so the `openGraph` below *replaces* `buildRootMetadata`'s rather
 * than merging into it; the helper spreads the shared defaults back in for
 * exactly that reason, so `og:type`, `og:site_name` and the share image survive.
 * `twitter`, `robots`, `formatDetection` and `metadataBase` are untouched here
 * and inherit intact.
 *
 * The locale guard is the layout's, repeated because `generateMetadata` runs
 * before the layout body — an unknown prefix would otherwise reach
 * `buildHomeMetadata` with a string that is not a `Locale`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return buildHomeMetadata(locale);
}

export default function HomePage() {
  return (
    <PageTransition>
      <main id="main" data-snap-root="">
        <HeroSection />
        <PhilosophySection />
        <ProgramsSection />
        <MenuSection />
        <GallerySection />
        <TestimonialsSection />
        <TeachersSection />
        <VisitSection />
      </main>
    </PageTransition>
  );
}
