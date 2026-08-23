import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { LearnMoreLink } from "@/components/ui/LearnMoreLink";
import { getMenu } from "@/content/collections";
import { getSite } from "@/content/site";
import { defaultMenuDay, weekdayDate } from "@/lib/menu-day";

import { DietaryChips } from "./DietaryChips";
import { MENU_FOOTER, MENU_STAGGER } from "./layout";
import { MenuDayChips, type MenuDay } from "./MenuDayChips";
import { Plate } from "./Plate";
import { dishesFor, SampleLine } from "./SampleLine";

/**
 * The Menu section (04 §3.5, §4; 05 §5.3, §5.6; `docs/design/desktop/README.md`
 * §4 and `docs/design/mobile/README.md` §4).
 *
 * Header, plate, five day chips, the sample line they swap, two dietary chips
 * and one link out to `/menu`. It composes what Phase 4 built — `Section`,
 * `SectionHeader`, `Reveal`, `Chip`, `Eyebrow`, `LearnMoreLink`, `WordSwap` —
 * and adds its own four leaves and its geometry (`layout.ts`, `D-04.6`).
 *
 * ── The one hard requirement: no SSR/CSR day mismatch (`D-04.10`) ────────
 *
 * The selected day is *today* in `America/Los_Angeles`, and it is decided here,
 * on the server, by `src/lib/menu-day.ts` over `site.timeZone`. It travels to
 * `MenuDayChips` as `defaultDay`, which opens `useState` on it. So the server
 * HTML, the pre-hydration paint, the first client render and the no-JS page all
 * name the same day, mark the same chip and show the same line. A `new Date()`
 * in the browser would answer with the reader's zone instead and desynchronise
 * the first two.
 *
 * Saturday and Sunday are not in `site.menu.days`, so they fall back to the
 * first day the sample week declares — `mon`, which is 04's stated rule.
 *
 * ── What crosses the client boundary, and what does not ─────────────────
 *
 * Only strings, one day id, and five already-rendered server nodes. The chip
 * labels are formatted here with `weekdayShort`; the sample lines are
 * `SampleLine` elements, rendered on the server and handed over as a prop; the
 * tablist's name is `menu.dayChips.label`, read here. `src/i18n/messages.ts`
 * leaves `menu` out of `CLIENT_NAMESPACES` precisely because of this shape, and
 * no dish string is ever in the client bundle (`D-04.10`, `D-04.2`).
 *
 * ── Per-view drawing is CSS, never a branch (`D-04.5`, INV-04.4) ────────
 *
 * The intro is `introDesktopOnly` — 04 §4's Menu row marks `home.menu.intro`
 * desktop-only, and the mobile reference draws the header with two lines, not
 * three (M L119–121). The dietary chips render both their labels and let `md:`
 * pick. The bottom row is a column on the narrow view and a row on the wide
 * one. Nothing here reads a viewport, and nothing reads a locale.
 *
 * ── The entrance, read off the reference's own handler ──────────────────
 *
 * `data-stagger` in both references wraps the plate, the chip row and the
 * sample line, and the reference's own script gives this section child 0
 * `gproll` and every later child `gpdrop` (D L609) — 05 §5.2's `roll` and
 * `drop`. So one `Reveal stagger` holds three `RevealItem`s, two of which
 * `MenuDayChips` renders. Header and bottom row are ordinary `rise`s, which is
 * what 04 §4's Menu row lists.
 */

/** The section id, which is also `site.routes[menu].homeAnchor` (INV-04.8). */
const MENU_SECTION_ID = "menu";

/** The `h2`'s id, which the `Section` points `aria-labelledby` at (INV-04.8). */
const MENU_TITLE_ID = "menu-title";

/** `deco-menu-plate` — the decoration identity INV-05.5 asks for. */
const MENU_PLATE_ID = "deco-menu-plate";

export default async function MenuSection() {
  const locale = await getLocale();
  const t = await getTranslations("home.menu");
  const tMenu = await getTranslations("menu");
  const format = await getFormatter();
  const menu = await getMenu(locale);

  /** Mon–Fri with their `weekdayShort` labels, in `site.menu.days` order. */
  const days: readonly MenuDay[] = menu.days.map((id) => ({
    id,
    label: format.dateTime(weekdayDate(id), "weekdayShort"),
  }));

  /** One server-rendered line per day; `MenuDayChips` mounts the selected one. */
  const lines: Record<string, ReactNode> = Object.fromEntries(
    menu.days.map((id) => [id, <SampleLine key={id} day={id} dishes={dishesFor(menu.week, id)} />]),
  );

  return (
    <Section id={MENU_SECTION_ID} labelledBy={MENU_TITLE_ID}>
      <Reveal id="menu.header" variant="rise">
        <SectionHeader
          titleId={MENU_TITLE_ID}
          eyebrow={t("eyebrow")}
          title={t("title")}
          intro={t("intro")}
          introDesktopOnly
        />
      </Reveal>

      <Reveal id="menu.plate" stagger className={MENU_STAGGER}>
        <RevealItem variant="roll" index={0}>
          <Plate
            id={MENU_PLATE_ID}
            dots={menu.meals.map((id) => ({ id, label: tMenu(`meals.${id}`) }))}
          />
        </RevealItem>

        <MenuDayChips
          days={days}
          lines={lines}
          defaultDay={defaultMenuDay(menu.days, getSite().timeZone)}
          groupLabel={tMenu("dayChips.label")}
        />
      </Reveal>

      <Reveal id="menu.footer" variant="rise" className={MENU_FOOTER}>
        <DietaryChips items={menu.dietary.filter((item) => item.onHome)} />
        <LearnMoreLink routeId={MENU_SECTION_ID}>{t("link")}</LearnMoreLink>
      </Reveal>
    </Section>
  );
}
