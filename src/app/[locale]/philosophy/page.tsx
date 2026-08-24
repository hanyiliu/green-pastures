import type { Metadata } from "next";
import { hasLocale } from "next-intl";

import { SubpageBar } from "@/components/layout/SubpageBar";
import { SubpageHeader } from "@/components/layout/SubpageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { DailyTimeline } from "@/components/pages/philosophy/DailyTimeline";
import { PHILOSOPHY_COLUMN } from "@/components/pages/philosophy/layout";
import { PhilosophyBadges } from "@/components/pages/philosophy/PhilosophyBadges";
import { PrinciplesList } from "@/components/pages/philosophy/PrinciplesList";
import { getSite } from "@/content/site";
import { notFound } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The Philosophy page (06 `D-06.1`, `D-06.3`, §6.1; 04 §1, §3.6;
 * `docs/design/desktop/…` L349–L386 and `docs/design/mobile/…` L257–L289).
 *
 * `PageTransition` → `SubpageBar` → the header and the three composites, which
 * is 04 §1's chain for every detail page. Everything above the composites is
 * PR-6.1's: `SubpageBar` renders the tinted panel, the sticky "← Back" bar and
 * the `<main id="main">` the skip link targets, and `BackLink` owns the focus
 * move on both legs of the navigation (05 §5.7). Nothing here re-implements any
 * of it.
 *
 * **The page is its own folder, not a `[slug]`** (06 `D-06.3`): each detail
 * route has a distinct composition and its own metadata, and a `[slug]` page
 * would move the route set into runtime data.
 *
 * The one class override is this page's config, not the shell's — the
 * reference draws a 940px column here and 880px on Programs — and it lives in
 * `components/pages/philosophy/layout.ts` beside the rest of the geometry
 * (04 `D-04.6`).
 */

/** This page's `site.routes[]` id, which is also its message namespace. */
const ROUTE_ID = "philosophy";

/**
 * The unprefixed route path, read from `content/site.json` rather than spelled
 * (02 `D-02.12`, 06 `D-06.2`). `SubpageBar` throws for a namespace with no
 * route, so a missing entry cannot reach a rendered page; this throws for the
 * same reason one segment earlier, where `generateMetadata` would otherwise
 * emit a canonical for a path that does not exist.
 */
function routeHref(): string {
  const route = getSite().routes.find((entry) => entry.id === ROUTE_ID);

  if (route === undefined) {
    throw new Error(
      `content/site.json declares no route with the id "${ROUTE_ID}" (02 D-02.12), so this ` +
        `page has no canonical URL to publish (06 D-06.10).`,
    );
  }

  return route.path;
}

/**
 * Title, description, canonical and the full `hreflang` set — one call to the
 * shared helper, which is what keeps canonical URLs to one implementation
 * (06 `D-06.10`, INV-06.3). The guard is the layout's, repeated because
 * `generateMetadata` runs before the layout body.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return buildMetadata({ locale, href: routeHref(), namespace: ROUTE_ID });
}

export default function PhilosophyPage() {
  return (
    <PageTransition>
      <SubpageBar routeId={ROUTE_ID} contentClassName={PHILOSOPHY_COLUMN}>
        <SubpageHeader page={ROUTE_ID} />
        <PrinciplesList />
        <DailyTimeline />
        <PhilosophyBadges />
      </SubpageBar>
    </PageTransition>
  );
}
