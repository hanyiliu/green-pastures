import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Leaf } from "@/components/decor/Leaf";
import { ScrollCue } from "@/components/decor/ScrollCue";
import { Sun } from "@/components/decor/Sun";
import { BookTourButton } from "@/components/layout/BookTourButton";
import { Section } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { Chip } from "@/components/ui/Chip";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getSite } from "@/content/site";

import { FloatingMealsCard } from "./FloatingMealsCard";
import {
  HERO_CTA_ROW,
  HERO_LEAF_1,
  HERO_LEAF_2,
  HERO_LEAF_3,
  HERO_PADDING,
  HERO_PHOTO,
  HERO_PHOTO_BLOCK,
  HERO_SCROLL_CUE,
  HERO_SUBHEAD,
  HERO_SUN,
  HERO_TEXT_COLUMN,
} from "./layout";
import { TrustRow } from "./TrustRow";

/**
 * The hero (04 §3.5, §4; 05 §5.3; `docs/design/desktop/README.md` §1 and
 * `docs/design/mobile/README.md` §1).
 *
 * The first designed section on the page and the one that carries the `h1`.
 * It composes what Phase 4 already built — `Section`, `Chip`, `SectionTitle`,
 * `PhotoSlot`, `BookTourButton`, `Reveal`, `Sun`, `Leaf`, `ScrollCue` — and
 * adds only its own two leaves (`TrustRow`, `FloatingMealsCard`) and its
 * geometry (`layout.ts`, `D-04.6`).
 *
 * ── Two reveals, and why the photo's is `opaque` ─────────────────────────
 *
 * 05 §5.3 gives the hero a text column that rises and a photo block that rises
 * **without the opacity track** — the prototype's default rise fades the photo
 * too, and this one deliberately does not, because the photo is the LCP
 * candidate and an LCP element must never sit at opacity 0 (OQ-05.8,
 * INV-05.7). Neither reveal is a stagger container: the hero has no staggered
 * group.
 *
 * The scroll cue is wrapped in `Reveal variant="none"` — no entrance of any
 * kind, which is exactly what registers it as already-revealed at mount and so
 * joins it to the locale cascade (INV-04.9, 05 §5.6) without adding a second
 * IntersectionObserver: a `"none"` reveal renders `initial={false}` and
 * observes nothing (INV-05.9).
 *
 * ── Both CTAs point *into the page*, not at a route ──────────────────────
 *
 * "Book a tour →" is `BookTourButton placement="hero"`, whose target is
 * `site.nav.cta.href` (`/#visit`) and which fires `cta_book_tour` through the
 * one analytics wrapper (04 §3.1, 07 §4). "See our philosophy" is the
 * design's `data-scrollto="Philosophy"` — a **hash link to `#philosophy` on
 * this page**, not the Philosophy subpage — so it is a plain `<a>`, not
 * `LearnMoreLink` (which resolves `site.routes[].path` and carries
 * `subpage-enter`). The hero renders on the home page and nowhere else, so
 * 06 `D-06.7`'s two-form rule collapses to its same-document half here, the
 * same conclusion `ScrollCue` reached beside it.
 *
 * Both anchors are read from `site.routes[philosophy].homeAnchor`, so renaming
 * that anchor in `content/site.json` moves the link and the cue together.
 *
 * ── The accent word ──────────────────────────────────────────────────────
 *
 * `home.hero.title` carries `<em>` around "big things" / "大大的本领", which the
 * design draws in sage (D L116). `D-04.13` maps `em` to `--section-accent`, and
 * that is right for every section that has one — but 03 §2.3 prints "—" for the
 * hero, so `Section` leaves `--section-accent` unset here and the accent word
 * would inherit the heading's ink. `--color-sage` is the brand token the design
 * actually names for it (03 §2.1: "hero accent word"), so that is what the tag
 * renders. The mapping is inline because `richTags()` (`D-04.13`,
 * `components/ui/rich.tsx`) is not built yet; it belongs there when it lands.
 */

/** The `h1`'s id, which the `Section` points `aria-labelledby` at (INV-04.8). */
const HERO_TITLE_ID = "hero-title";

/** The route whose home anchor both hero links target. */
const PHILOSOPHY_ROUTE_ID = "philosophy";

/** The subhead recipe: Nunito 600 on `--section-sub`, capped at the design's 540px. */
const SUBHEAD = `${HERO_SUBHEAD} font-body text-subhead font-semibold text-(color:--section-sub)`;

/**
 * The secondary CTA (D L120, M L59): Nunito 700 on `--section-link`, over a 2px
 * `--section-link-underline` rule that hugs the words. The 44px hit area sits
 * on the anchor and the rule on an inner span, so the target is reachable
 * without the underline drifting away from the text (INV-04.7) — the same shape
 * `LearnMoreLink` uses, and the reason this is not simply that component is
 * above.
 *
 * 14/16px is the reference's own size (D L120, M L59). 03 §3.2 mints no token
 * for it — §10's contrast table folds this link in with the 15px "learn more"
 * links — so it takes Tailwind's `sm` / `base` steps rather than a px or a
 * token whose value is one step off the drawing.
 */
const SECONDARY_CTA =
  "inline-flex min-h-(--tap-min) items-center font-body text-sm font-bold text-(color:--section-link) md:text-base";

/** `D-04.13`'s `em` for a section with no `--section-accent` — see above. */
function accentWord(chunks: ReactNode) {
  return <em className="text-sage not-italic">{chunks}</em>;
}

export function HeroSection() {
  const t = useTranslations("home.hero");
  const route = getSite().routes.find((entry) => entry.id === PHILOSOPHY_ROUTE_ID);

  if (route === undefined) {
    throw new Error(
      `HeroSection needs the "${PHILOSOPHY_ROUTE_ID}" route, which content/site.json does not ` +
        `declare in routes[] (02 D-02.12); both hero links target its homeAnchor.`,
    );
  }

  const philosophyHref = `#${route.homeAnchor}`;

  return (
    <Section
      id="hero"
      labelledBy={HERO_TITLE_ID}
      className={HERO_PADDING}
      decor={
        <>
          <Sun id="deco-hero-sun" className={HERO_SUN} />
          <Leaf
            id="deco-hero-leaf-1"
            size={26}
            tint="hero-1"
            speed="fast"
            className={HERO_LEAF_1}
          />
          <Leaf id="deco-hero-leaf-2" size={28} tint="hero-2" variant="b" className={HERO_LEAF_2} />
          <Leaf
            id="deco-hero-leaf-3"
            size={22}
            tint="hero-3"
            speed="slow"
            className={HERO_LEAF_3}
          />
        </>
      }
    >
      <Reveal id="hero.text" variant="rise" className={HERO_TEXT_COLUMN}>
        <Chip>{t("badge")}</Chip>

        {/*
          The `\n` in `home.hero.title` is honoured `>= md` only: the desktop
          reference breaks after "Where small hands" (D L116) and the mobile one
          runs the line on (M L55). `whitespace-pre-line` behind the `md:`
          variant is that toggle — below it the newline collapses to a space,
          which is what the mobile drawing shows (02 §Line breaks).
        */}
        <SectionTitle as="h1" size="headline" id={HERO_TITLE_ID} className="md:whitespace-pre-line">
          {t.rich("title", { em: accentWord })}
        </SectionTitle>

        <p className={`${SUBHEAD} md:hidden`}>{t("subtitleShort")}</p>
        <p className={`${SUBHEAD} hidden md:block`}>{t("subtitle")}</p>

        <div className={HERO_CTA_ROW}>
          <BookTourButton placement="hero" />
          <a href={philosophyHref} className={SECONDARY_CTA}>
            <span className="border-b-2 border-(color:--section-link-underline) pb-0.5">
              {t("ctaSecondary")}
            </span>
          </a>
        </div>

        <TrustRow />
      </Reveal>

      <Reveal id="hero.photo" variant="rise" opaque className={HERO_PHOTO_BLOCK}>
        <PhotoSlot slotId="hero" alt={t("photo.alt")} className={HERO_PHOTO} />
        <FloatingMealsCard />
      </Reveal>

      <Reveal id="hero.cue" variant="none">
        <ScrollCue id="deco-hero-cue" href={philosophyHref} className={HERO_SCROLL_CUE}>
          {t("scrollCue")}
        </ScrollCue>
      </Reveal>
    </Section>
  );
}
