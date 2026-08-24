import { useTranslations } from "next-intl";

import { Leaf } from "@/components/decor/Leaf";
import { Section } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PhotoSlot } from "@/components/ui/PhotoSlot";

import { BadgeRow } from "./BadgeRow";
import {
  PHILOSOPHY_BADGE_ROW,
  PHILOSOPHY_LEAF_1,
  PHILOSOPHY_LEAF_2,
  PHILOSOPHY_LEAF_3,
  PHILOSOPHY_PHOTO,
  PHILOSOPHY_PHOTO_BLOCK,
  PHILOSOPHY_QUOTE_BLOCK,
} from "./layout";
import { PullQuote } from "./PullQuote";

/**
 * The Philosophy section (04 §3.5, §6, §7; 05 §5.2, §5.4;
 * `docs/design/desktop/README.md` §2 and `docs/design/mobile/README.md` §2).
 *
 * Three blocks on a soft green field — the pull-quote, a classroom photo, and
 * the badge row that links into the Philosophy page — plus the leaves in the
 * decoration layer. It composes what Phase 4 built (`Section`, `Eyebrow`,
 * `PhotoSlot`, `Chip`, `LearnMoreLink`, `Reveal`, `Leaf`) and adds only its own
 * two leaves and its geometry (`layout.ts`, `D-04.6`).
 *
 * ── The heading is hidden, and that is the specification ─────────────────
 *
 * 04 §7 is explicit: "The Philosophy section's visible heading is the
 * pull-quote, so its `h2` is a visually-hidden eyebrow text." So the section
 * carries a `sr-only` `h2` holding `home.philosophy.eyebrow`, `aria-labelledby`
 * points at it, and the eyebrow the reader sees is a `<p>` — 04 §3 rejects
 * promoting that `<p>` to the heading in as many words ("`h2` = eyebrow? No").
 * The `h2` sits outside the reveals so the section's label is never inside an
 * animated wrapper.
 *
 * The cost is that a screen reader meets "Our philosophy" twice — once as the
 * heading, once as the visible eyebrow beneath it. That is inherent to 04's
 * shape, not to this file, and it is filed rather than quietly patched with an
 * `aria-hidden` the document does not ask for.
 *
 * ── Three reveals, all `ink` ─────────────────────────────────────────────
 *
 * 05 §5.2's `ink` is this section's variant and nothing else's: the block
 * fades up from `blur(14px) scale(.97)` over `--dur-ink` (950 ms), and its
 * reduced form is opacity-only, because `filter` is the one track Motion's own
 * `reducedMotion` gate does not cover (05 §5.9 E2). The quote block and the
 * badge row are 04 §3.5's and 05 §5.2's two; the photo is the third, and it is
 * a **judgement call worth naming**:
 *
 * > The mobile reference animates the photo (M L86 carries `data-anim`) and the
 * > desktop one does not (D L148 does not), and 05 §5.2 records exactly that —
 * > "mobile only: photo block `ink`". A `Reveal` is a component, not a media
 * > query, so honouring the split would take a viewport read in JavaScript,
 * > which `D-04.5` / INV-04.4 forbid. Of the two whole-view answers, animating
 * > both keeps the entrance the narrow view is drawn with (and that the design
 * > README asks to build more of) and costs the wide view one calm 950 ms
 * > fade; dropping it would take an entrance away from the view that has one.
 *
 * Neither reveal is a stagger container: this section has no staggered group.
 *
 * ── The leaves ───────────────────────────────────────────────────────────
 *
 * Two drawn on the wide view, one on the narrow (04 §3.4) — from three
 * instances, because the corner both views draw floats on one and is still on
 * the other, and `Leaf`'s `loop` is a prop rather than a media query.
 * `layout.ts` carries the measurement behind that.
 *
 * No `AmbientScope` wraps them — still true, for a different reason than this
 * note used to give. The component exists now (`components/motion/`, where 04
 * §3.3 places it); what does not exist is any section that mounts it, so
 * `ambient.css`'s `[data-ambient="paused"]` hook stays inert here exactly as it
 * does on the hero. Wiring it is a bead of its own and lands on both sections
 * together: 04 §3.3 mounts one here at the mobile breakpoint only, and
 * `tests/unit/sections/hero/HeroSection.test.tsx` asserts the hero adds no
 * second `IntersectionObserver` today, which is the assertion that has to move
 * in the same change (08 §5 puts the count at two once the hero carries one).
 */

/** The `h2`'s id, which the `Section` points `aria-labelledby` at (INV-04.8). */
const PHILOSOPHY_TITLE_ID = "philosophy-title";

export function PhilosophySection() {
  const t = useTranslations("home.philosophy");

  return (
    <Section
      id="philosophy"
      labelledBy={PHILOSOPHY_TITLE_ID}
      decor={
        <>
          <Leaf
            id="deco-philosophy-leaf-1"
            size={24}
            tint="philosophy"
            className={PHILOSOPHY_LEAF_1}
          />
          <Leaf
            id="deco-philosophy-leaf-2"
            size={34}
            tint="philosophy"
            loop={false}
            className={PHILOSOPHY_LEAF_2}
          />
          <Leaf
            id="deco-philosophy-leaf-3"
            size={24}
            tint="philosophy"
            loop={false}
            className={PHILOSOPHY_LEAF_3}
          />
        </>
      }
    >
      <h2 id={PHILOSOPHY_TITLE_ID} className="sr-only">
        {t("eyebrow")}
      </h2>

      <Reveal id="philosophy.quote" variant="ink" className={PHILOSOPHY_QUOTE_BLOCK}>
        <Eyebrow as="p">{t("eyebrow")}</Eyebrow>
        <PullQuote />
      </Reveal>

      <Reveal id="philosophy.photo" variant="ink" className={PHILOSOPHY_PHOTO_BLOCK}>
        <PhotoSlot
          slotId="philosophy"
          alt={t("photo.alt")}
          radius="card-md"
          className={PHILOSOPHY_PHOTO}
        />
      </Reveal>

      <Reveal id="philosophy.badges" variant="ink" className={PHILOSOPHY_BADGE_ROW}>
        <BadgeRow />
      </Reveal>
    </Section>
  );
}

export default PhilosophySection;
