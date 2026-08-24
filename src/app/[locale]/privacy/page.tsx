import type { Metadata } from "next";
import { hasLocale } from "next-intl";

import { SubpageBar } from "@/components/layout/SubpageBar";
import { SubpageHeader } from "@/components/layout/SubpageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { PRIVACY_COLUMN } from "@/components/pages/privacy/layout";
import { PrivacyNotice } from "@/components/pages/privacy/PrivacyNotice";
import { routeHref } from "@/components/pages/route-href";
import { notFound } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The Privacy page (10 PR-6.9; 06 §6.2's conditional row and 06 `OQ-06.4`;
 * 07 §4, which is where the facts it describes are specified).
 *
 * **It exists because `OQ-07.5` came back yes.** Until then 06 carried
 * `/{l}/privacy` as "page · static · **conditional**" and 10 carried this row
 * as blocked; 12's fallback was that no privacy route ships at all.
 *
 * ── The one way it differs from the other six ────────────────────────────
 *
 * It is a **standalone** route: its `site.routes[]` entry carries no
 * `homeAnchor`, because there is no home-page section it expands. Everything
 * that follows from that is settled in the shell rather than here — the panel
 * takes the site's base ground instead of a section's palette, "← Back" goes to
 * the top of the home page instead of to a section, and the footer entry that
 * names this route resolves to `/privacy` instead of to a hash. So this file
 * composes the same three pieces in the same order as `team/page.tsx` and reads
 * the same.
 *
 * It is reached from the footer on every page and from the privacy line under
 * the tour-request form (07 §4: "this doc only needs a link target for the
 * notice"), and from no "learn more →" anywhere, because it expands nothing.
 *
 * **The copy is a placeholder and is meant to fail the release gate.** See
 * `PrivacyNotice` for what guards it and why one guard would not be enough.
 */

/** This page's `site.routes[]` id, which is also its message namespace. */
const ROUTE_ID = "privacy";

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

export default function PrivacyPage() {
  return (
    <PageTransition>
      <SubpageBar routeId={ROUTE_ID} contentClassName={PRIVACY_COLUMN}>
        <SubpageHeader page={ROUTE_ID} />
        <PrivacyNotice />
      </SubpageBar>
    </PageTransition>
  );
}
