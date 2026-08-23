import { getLocale } from "next-intl/server";

import { Section } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { getTestimonials } from "@/content/collections";
import { getSite } from "@/content/site";

import { TESTIMONIALS_GRID, TESTIMONIALS_LINK_ROW, TESTIMONIALS_MIDDLE_PUSH } from "./layout";
import { ReviewsHeader } from "./ReviewsHeader";
import { SpeechBubble } from "./SpeechBubble";
import { YelpLink } from "./YelpLink";

/**
 * The testimonials section (04 §3.5, §6, §7; 05 §5.3; `docs/design/desktop` §06
 * and `docs/design/mobile` §06).
 *
 * It composes what Phase 4 built — `Section`, `Reveal`/`RevealItem`,
 * `SectionTitle`, `Chip`, `PhotoSlot`, `CountUp`, `TrackedLink` — and adds only
 * its own five leaves (`ReviewsHeader`, `YelpBadge`, `StarRow`, `SpeechBubble`,
 * `Bubble`, `YelpLink`) and its geometry (`layout.ts`, `D-04.6`).
 *
 * ── The only async section so far, and why ────────────────────────────────
 *
 * The bubbles are a **collection**: `getTestimonials(locale)` joins
 * `site.testimonials[]`'s ids, ratings and surface flags with one locale's
 * quotes (02 `D-02.11`). That accessor is async and server-only, so this
 * component is an async Server Component and every message read below it stays
 * in a synchronous child — `useTranslations` works there, needs no mock to
 * test, and keeps this file's own surface down to two data calls.
 *
 * ── Three reveals ─────────────────────────────────────────────────────────
 *
 * 05 §5.3: the header rises (and carries both `CountUp`s, which read
 * `useRevealed()` from it rather than adding an observer of their own —
 * INV-05.9), the bubbles are a stagger group of `bubble` items, and the link
 * row rises. The stagger container is a `<ul>` and is never itself transformed
 * (INV-05.4).
 *
 * ── Surfaces are data, never a branch ─────────────────────────────────────
 *
 * `onHome` filters the list — Alan W. is `false` and belongs to the reviews
 * subpage — and `onMobile` reaches `Bubble` as a class toggle, so Karen T.
 * renders on both views and `lg:` decides (02 `D-02.13`, INV-04.4). Neither
 * flag is read from a viewport and neither produces a second tree.
 *
 * ── `site.yelp` is required here, unlike in the trust row ─────────────────
 *
 * The schema makes it optional and `TrustRow` honours that, because the hero
 * row has an age range to fall back on. This section does not: the rating, the
 * count line and the outbound link are all Yelp, and a section that quietly
 * dropped three of its four parts is worse than one readable failure. So it
 * throws, the way `HeroSection` throws for a missing `philosophy` route.
 */

/** The `h2`'s id, which the `Section` points `aria-labelledby` at (INV-04.8). */
const TESTIMONIALS_TITLE_ID = "testimonials-title";

/**
 * The centre column of the three, dropped 30px (D L253). It is an index rather
 * than an id because the design pushes a *position*, not a reviewer — swap the
 * order in `site.json` and the middle card is still the one that drops.
 */
const MIDDLE_COLUMN_INDEX = 1;

export async function TestimonialsSection() {
  const yelp = getSite().yelp;

  if (yelp === undefined) {
    throw new Error(
      "TestimonialsSection needs site.yelp, which content/site.json does not declare " +
        "(02 D-02.12): the rating, the count line and the outbound link all read it.",
    );
  }

  const locale = await getLocale();
  const testimonials = (await getTestimonials(locale)).filter((entry) => entry.onHome);

  return (
    <Section id="testimonials" labelledBy={TESTIMONIALS_TITLE_ID}>
      <Reveal id="testimonials.header" variant="rise">
        <ReviewsHeader
          titleId={TESTIMONIALS_TITLE_ID}
          rating={yelp.rating}
          reviewCount={yelp.reviewCount}
        />
      </Reveal>

      <Reveal id="testimonials.bubbles" stagger as="ul" className={TESTIMONIALS_GRID}>
        {testimonials.map((item, index) => (
          <SpeechBubble
            key={item.id}
            item={item}
            index={index}
            className={index === MIDDLE_COLUMN_INDEX ? TESTIMONIALS_MIDDLE_PUSH : undefined}
          />
        ))}
      </Reveal>

      <Reveal id="testimonials.link" variant="rise" className={TESTIMONIALS_LINK_ROW}>
        <YelpLink href={yelp.url} />
      </Reveal>
    </Section>
  );
}

export default TestimonialsSection;
