import { getLocale, getTranslations } from "next-intl/server";

import { Sun } from "@/components/decor/Sun";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Reveal } from "@/components/motion/Reveal";
import { LearnMoreLink } from "@/components/ui/LearnMoreLink";
import { getPrograms } from "@/content/collections";

import { PROGRAMS_LINK, PROGRAMS_SUN } from "./layout";
import { StonePath } from "./StonePath";

/**
 * The Programs section (04 §3.5, §4; 05 §5.3; `docs/design/desktop/README.md`
 * §3 and `docs/design/mobile/README.md` §3).
 *
 * Header, three stepping stones, one link out to `/programs`. It composes what
 * Phase 4 built — `Section`, `SectionHeader`, `Reveal`, `LearnMoreLink`,
 * `PhotoSlot`, `Sun` — and adds only its own two leaves (`StonePath`,
 * `SteppingStone`) and its geometry (`layout.ts`, `D-04.6`).
 *
 * ── The first async section, and why ─────────────────────────────────────
 *
 * The hero reads `site.json` alone, so it is a synchronous RSC with
 * `useTranslations`. This one needs `collections.programs` as well, and 04 §5.1
 * / §2's data-flow paragraph name exactly one way to get it: `getPrograms()`
 * from `src/content/collections.ts`, with the locale from next-intl's
 * `getLocale()` — which makes the component `async` and its messages
 * `getTranslations` ("`getTranslations` in async RSC, `useTranslations` in sync
 * RSC").
 *
 * Reading the same text through `useTranslations('collections.programs')`
 * instead would keep the component synchronous and is a real option the message
 * tree allows — and it is the wrong one here, because it loses the fallback
 * 02 built the loader for: collections merge over `en` in **every** environment
 * precisely so that a missing `photoAlt` is an English `alt` rather than a
 * `⟦collections.programs.infant.photoAlt⟧` marker read out as an image's name.
 * Both Chinese `collections/programs.json` files are `{}` today, so that is not
 * a hypothetical.
 *
 * ── Everything per-view is CSS, nothing is a branch (`D-04.5`, INV-04.4) ──
 *
 * The intro is `introDesktopOnly`: 04 §4's Programs row marks `home.programs.
 * intro` "desktop-only → hidden `< md`", and the mobile reference draws the
 * header with no third line (M L96–98). Infant's `summaryShort` and the
 * alternating path are the same story one level down, in `StonePath`. No
 * component here reads a viewport and none reads a locale.
 *
 * ── The link is a route, not an anchor ───────────────────────────────────
 *
 * Unlike the hero's two in-page links, "See all programs →" points at the
 * Programs *subpage* (`data-subpage="programs"`, D L183), so it is
 * `LearnMoreLink routeId="programs"` — resolved through `site.routes[]` and
 * carrying the `subpage-enter` transition. The arrow lives inside the
 * translated string (02 §5.4); nothing is appended here.
 */

/** The section id, which is also `site.routes[programs].homeAnchor` (INV-04.8). */
const PROGRAMS_SECTION_ID = "programs";

/** The `h2`'s id, which the `Section` points `aria-labelledby` at (INV-04.8). */
const PROGRAMS_TITLE_ID = "programs-title";

export default async function ProgramsSection() {
  const t = await getTranslations("home.programs");
  const programs = await getPrograms(await getLocale());

  return (
    <Section
      id={PROGRAMS_SECTION_ID}
      labelledBy={PROGRAMS_TITLE_ID}
      decor={<Sun id="deco-programs-sun" size="programs" loop={false} className={PROGRAMS_SUN} />}
    >
      <Reveal id="programs.header" variant="rise">
        <SectionHeader
          titleId={PROGRAMS_TITLE_ID}
          eyebrow={t("eyebrow")}
          title={t("title")}
          intro={t("intro")}
          introDesktopOnly
        />
      </Reveal>

      <StonePath items={programs} />

      <Reveal id="programs.link" variant="rise" className={PROGRAMS_LINK}>
        <LearnMoreLink routeId={PROGRAMS_SECTION_ID}>{t("link")}</LearnMoreLink>
      </Reveal>
    </Section>
  );
}
