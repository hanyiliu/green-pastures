import type { Metadata } from "next";
import { hasLocale } from "next-intl";

import { SubpageBar } from "@/components/layout/SubpageBar";
import { SubpageHeader } from "@/components/layout/SubpageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { routeHref } from "@/components/pages/route-href";
import { TEAM_COLUMN } from "@/components/pages/team/layout";
import { TeamBio } from "@/components/pages/team/TeamBio";
import { notFound } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The Team page (06 `D-06.1`, §6.1; 04 §1, §3.6;
 * `docs/design/desktop/…` L548–L574 and `docs/design/mobile/…` L441–L468).
 *
 * **"Staff" is Team** (06 `D-06.1`): one page, the `team` namespace, no `staff`
 * route and no `staff` namespace. Its home anchor is `#teachers`, which
 * `SubpageBar` reads off `site.routes[]` — the one place the route id and the
 * section id differ on this page.
 *
 * `PageTransition` → `SubpageBar` → header + `TeamBio`, 04 §1's chain. The
 * panel, the sticky "← Back" bar, the `<main id="main">` and the focus move are
 * all PR-6.1's and are not re-implemented here.
 */

/** This page's `site.routes[]` id, which is also its message namespace. */
const ROUTE_ID = "team";

/**
 * Title, description, canonical and the full `hreflang` set — one call to the
 * shared helper (06 `D-06.10`, INV-06.3). The locale guard is the layout's,
 * repeated because `generateMetadata` runs before the layout body.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return buildMetadata({ locale, href: routeHref(ROUTE_ID), namespace: ROUTE_ID });
}

export default function TeamPage() {
  return (
    <PageTransition>
      <SubpageBar routeId={ROUTE_ID} contentClassName={TEAM_COLUMN}>
        <SubpageHeader page={ROUTE_ID} />
        <TeamBio />
      </SubpageBar>
    </PageTransition>
  );
}
