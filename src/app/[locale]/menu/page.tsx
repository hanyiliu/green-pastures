import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { SubpageBar } from "@/components/layout/SubpageBar";
import { SubpageHeader } from "@/components/layout/SubpageHeader";
import { PageTransition } from "@/components/motion/PageTransition";
import { Reveal } from "@/components/motion/Reveal";
import { DayCards } from "@/components/pages/menu/DayCards";
import {
  MENU_CHIPS_ROW,
  MENU_COLUMN,
  MENU_COLUMN_VARS,
  MENU_NOTE,
} from "@/components/pages/menu/layout";
import { WeeklyMenuTable } from "@/components/pages/menu/WeeklyMenuTable";
import { DietaryChips } from "@/components/sections/menu/DietaryChips";
import { getMenu } from "@/content/collections";
import { getSite } from "@/content/site";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The Menu route — `/{locale}/menu` (06 `D-06.1`, §6.1; 04 §3.6, `D-04.11`).
 *
 * `PageTransition` → `SubpageBar` → `SubpageHeader` → the week, twice → the
 * three dietary chips → the note. The shell chain, the folder-per-route rule
 * and the `<main>` ownership are all as `programs/page.tsx` documents them
 * (06 `D-06.3`, §6.2; 05 `D-05.10`; 04 §1).
 *
 * ── The whole week, where the home section shows one day ────────────────
 *
 * The home Menu section picks *today* and swaps five pre-rendered sample lines
 * behind five chips; this page draws the entire sample week at once, as a table
 * `≥ md` and as five cards `< md` (`D-04.11`). Same collection, same fifteen
 * cells, different question.
 *
 * **This page does not compute a "today" at all**, so the frozen-day tension
 * filed against the home section does not reach it. That tension is real and
 * worth restating: every page here is prerendered at build time (06 `D-06.4`),
 * so `defaultMenuDay()`'s answer on the *home* page is the day the build ran,
 * and it stays that day until the next deployment. Nothing on this route reads
 * a clock — `weekdayDate()` is the other direction, a fixed anchor date whose
 * only purpose is to give `weekdayShort` / `weekdayLong` something to name — so
 * the week it renders is the week `content/` declares and is correct on any
 * day. Reusing `src/lib/menu-day.ts` rather than reimplementing the weekday
 * derivation is exactly why PR-5.3 put the module on that path.
 *
 * ── The dietary chips are the home section's component ──────────────────
 *
 * 04 §3.6 asks for reuse and `DietaryChips` was built to be reused: it takes an
 * already-filtered list, so the home section hands it the two with `onHome` and
 * this page hands it all three. No `surface` prop is needed and none exists —
 * see the note in that file, and this row's report for where 04 §3.6 still
 * spells one.
 *
 * ── Metadata ────────────────────────────────────────────────────────────
 *
 * One `buildMetadata` call (06 `D-06.10`, INV-06.3); the `href` comes from
 * `content/site.json`'s `routes[]`, never from a literal.
 */

/** This page's `site.routes[]` id, which is also its message namespace. */
const ROUTE_ID = "menu";

/**
 * The unprefixed route path, from `content/site.json` rather than typed here —
 * `programs/page.tsx` carries the full note on why.
 */
function routeHref(): string {
  const route = getSite().routes.find((entry) => entry.id === ROUTE_ID);

  if (route === undefined) {
    throw new Error(
      `content/site.json declares no routes[] entry with id "${ROUTE_ID}" (02 D-02.12), ` +
        `so the Menu page has no canonical URL to publish.`,
    );
  }

  return route.path;
}

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    locale: await getLocale(),
    href: routeHref(),
    namespace: ROUTE_ID,
  });
}

export default async function MenuPage() {
  const locale = await getLocale();
  const t = await getTranslations(ROUTE_ID);
  const menu = await getMenu(locale);

  return (
    <PageTransition>
      <SubpageBar routeId={ROUTE_ID} contentClassName={MENU_COLUMN} contentStyle={MENU_COLUMN_VARS}>
        {/*
          04 §4's Menu-page row marks `menu.intro` desktop-only, and the mobile
          reference draws the header with two lines rather than three
          (M L329–331). `SectionHeader` renders the string once and lets `md:`
          hide it, so the copy is never a branch in code (`D-04.5`).
        */}
        <SubpageHeader page={ROUTE_ID} introDesktopOnly />

        <WeeklyMenuTable menu={menu} />
        <DayCards menu={menu} />

        <Reveal id="menu.dietary" variant="rise" className={MENU_CHIPS_ROW}>
          <DietaryChips items={menu.dietary} />
        </Reveal>

        <Reveal id="menu.note" variant="rise" as="p" className={MENU_NOTE}>
          {t("note")}
        </Reveal>
      </SubpageBar>
    </PageTransition>
  );
}
