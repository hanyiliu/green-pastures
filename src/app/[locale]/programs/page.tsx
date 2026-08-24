import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { SubpageBar } from "@/components/layout/SubpageBar";
import { SubpageHeader } from "@/components/layout/SubpageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { Reveal } from "@/components/motion/Reveal";
import { PROGRAMS_COLUMN, PROGRAMS_FOOTNOTE } from "@/components/pages/programs/layout";
import { RoomCards } from "@/components/pages/programs/RoomCards";
import { routeHref } from "@/components/pages/route-href";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The Programs route — `/{locale}/programs` (06 `D-06.1`, §6.1; 04 §3.6).
 *
 * `PageTransition` → `SubpageBar` → `SubpageHeader` → `RoomCards` → the
 * footnote, which is the chain 04 §1 spells for all six detail pages. Three
 * things about that shape are decisions rather than arrangement, and all three
 * are settled elsewhere:
 *
 * - **The folder is the route.** 06 `D-06.3` gives every detail page its own
 *   folder and 06 §6.2 rules out a route group, so the shell is composed as a
 *   component here rather than inherited from a `(detail)/layout.tsx`.
 * - **`PageTransition` is in the page, never a layout.** A layout persists
 *   across a navigation, so its subtree neither enters nor exits and the slide
 *   would never fire (05 `D-05.10`).
 * - **`<main id="main">` is `SubpageBar`'s.** The shell renders the landmark so
 *   the skip link's target cannot be forgotten by six separate rows; the home
 *   page keeps its own because it is the only one that scroll-snaps (04 §1).
 *
 * ── Rendering ───────────────────────────────────────────────────────────
 *
 * Static, three times, one per locale (06 `D-06.4`): the `[locale]` layout owns
 * `generateStaticParams`, this file adds no `dynamic` override and reads no
 * request-time API. `getLocale()` resolves through `next/root-params`, which is
 * a build-time read here.
 *
 * ── Metadata ────────────────────────────────────────────────────────────
 *
 * One `buildMetadata` call (06 `D-06.10`, INV-06.3). The canonical, the four
 * `hreflang` entries and the Open Graph block all come from it, so nothing in
 * this file spells a URL, an origin or a locale tag — the `href` is read out of
 * `content/site.json`'s `routes[]`, which is the single source 06 `D-06.2` and
 * `D-06.6` name.
 */

/** This page's `site.routes[]` id, which is also its message namespace. */
const ROUTE_ID = "programs";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    locale: await getLocale(),
    href: routeHref(ROUTE_ID),
    namespace: ROUTE_ID,
  });
}

export default async function ProgramsPage() {
  const t = await getTranslations(ROUTE_ID);

  return (
    <PageTransition>
      <SubpageBar routeId={ROUTE_ID} contentClassName={PROGRAMS_COLUMN}>
        <SubpageHeader page={ROUTE_ID} />

        <RoomCards />

        {/*
          The footnote is its own `rise`, not a stagger child: 04 §3.6 gives the
          stagger to the card list alone, and the reference draws the line as a
          separate block under it (D L428, M L319).
        */}
        <Reveal id="programs.footnote" variant="rise" as="p" className={PROGRAMS_FOOTNOTE}>
          {t("footnote")}
        </Reveal>
      </SubpageBar>
    </PageTransition>
  );
}
