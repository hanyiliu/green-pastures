import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getLocale } from "next-intl/server";

import { SubpageBar } from "@/components/layout/SubpageBar";
import { PageTransition } from "@/components/motion/PageTransition";
import { Reveal } from "@/components/motion/Reveal";
import { REVIEWS_COLUMN, YELP_ROW } from "@/components/pages/reviews/layout";
import { ReviewsList } from "@/components/pages/reviews/ReviewsList";
import { ReviewsPageHeader } from "@/components/pages/reviews/ReviewsPageHeader";
import { YelpButton } from "@/components/pages/reviews/YelpButton";
import { routeHref } from "@/components/pages/route-href";
import { getTestimonials } from "@/content/collections";
import { getSite } from "@/content/site";
import { notFound } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * `/{locale}/reviews` (06 `D-06.1`, `D-06.3`; 04 §1, §3.6).
 *
 * `PageTransition` → `SubpageBar` → the header, the list and the Yelp button.
 * The shell is PR-6.1's and this page only configures it: `SubpageBar` renders
 * the tinted panel, the sticky bar, the `<main id="main">` landmark and the
 * "← Back" pill. 06 §6.2 forbids route groups, so the composition is a
 * component chain and every page repeats it.
 *
 * **The panel's colours are the testimonials section's, and the route id is not
 * the anchor.** `site.routes[]` gives `reviews` the `homeAnchor`
 * `testimonials`, so `SubpageBar` resolves the role variables from that
 * section: `--section-bg` is `--color-bg-testimonials`, `--section-sub` is the
 * quote colour, and Back points at `/{locale}#testimonials` (02 `D-02.12`,
 * 06 `D-06.6`). Nothing on this page names one of those colours.
 *
 * ── Why the collection is read here ──────────────────────────────────────
 *
 * `getTestimonials(locale)` joins `site.testimonials[]`'s ids, ratings and
 * surface flags with this locale's quotes (02 `D-02.11`). That accessor is
 * async and server-only (`D-02.16`), so this is an async Server Component and
 * every message below it is read in a synchronous child — where
 * `useTranslations` works, needs no mock to test, and keeps this file's own
 * surface to two data calls. `TestimonialsSection` is async for the same reason.
 *
 * **Nothing on this page is a client component.** The home section's two
 * count-ups are the only client leaf in that whole surface, and neither subpage
 * reference draws one (see `ReviewsPageHeader`), so this page ships no
 * JavaScript of its own beyond `Reveal` and `TrackedLink`'s click handler.
 *
 * ── `site.yelp` is required, as it is in the home section ────────────────
 *
 * The schema makes it optional and `TrustRow` honours that, because the hero
 * row has an age range to fall back on. This page does not: the rating, the
 * count line and the outbound button are all Yelp, and a page that quietly
 * dropped three of its four parts is worse than one readable failure.
 */

/** The `site.routes[]` id, which is also this page's message namespace. */
const ROUTE_ID = "reviews";

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

export default async function ReviewsPage() {
  const yelp = getSite().yelp;

  if (yelp === undefined) {
    throw new Error(
      "The reviews page needs site.yelp, which content/site.json does not declare " +
        "(02 D-02.12): the rating, the count line and the outbound button all read it.",
    );
  }

  const locale = await getLocale();
  // Every testimonial, not the `onHome` subset: `alanW` is `onHome: false`
  // precisely because this page is where he belongs (04 §6).
  const testimonials = await getTestimonials(locale);

  return (
    <PageTransition>
      <SubpageBar routeId={ROUTE_ID} contentClassName={REVIEWS_COLUMN}>
        <ReviewsPageHeader rating={yelp.rating} reviewCount={yelp.reviewCount} />

        <ReviewsList items={testimonials} />

        <Reveal id="reviews.cta" variant="rise" className={YELP_ROW}>
          <YelpButton href={yelp.url} />
        </Reveal>
      </SubpageBar>
    </PageTransition>
  );
}
