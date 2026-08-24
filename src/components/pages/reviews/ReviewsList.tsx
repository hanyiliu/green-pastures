import { Reveal } from "@/components/motion/Reveal";
import type { TestimonialEntry } from "@/content/collections";

import { ReviewCard } from "./ReviewCard";
import { REVIEWS_GRID } from "./layout";

/**
 * Every review (04 §3.6 `ReviewsList`; D L522–543, M L421–437).
 *
 * ── The page shows all four, and the flags decide the views ──────────────
 *
 * `site.testimonials[]` carries two surface flags and this page reads them in
 * opposite directions from the home section (02 `D-02.13`, 04 §6):
 *
 * - **`onHome` is not filtered here.** Alan W. is `onHome: false` — he is the
 *   subpage's own review, which is what "`alanW` subpage-only" means in 04 §6's
 *   row for this page. Filtering by `onHome` on the page `onHome: false` exists
 *   for would drop the one review the flag was written to add.
 * - **`onMobile` reaches the card as a class**, not as a filter. Karen T. is
 *   `false`, so the wide view draws four cards and the narrow three, from one
 *   tree with `md:` deciding (`D-04.5`, INV-04.4).
 *
 * Neither flag is read from a viewport and neither produces a second tree.
 *
 * ── One stagger group ────────────────────────────────────────────────────
 *
 * The `<ul>` is a `Reveal stagger` and each card a `riseChild` 110 ms behind
 * the last (04 §3.6's motion column). A stagger container is never itself
 * transformed (INV-05.4) and no `RevealItem` observes anything, so the page
 * still has the one pooled observer (INV-05.9).
 *
 * **The stagger index is the DOM position, including the hidden card.** Karen
 * T. is `display: none` below `md`, not absent, so the narrow view's third card
 * is child 3 and enters 330 ms in rather than 220. That is 110 ms of dead air
 * once, on a list already on screen, and the alternative is a second index
 * computed from a viewport — which is the branch `D-04.5` exists to forbid.
 */

export type ReviewsListProps = {
  /** Every testimonial, joined with this locale's text, in `site.json` order. */
  readonly items: readonly TestimonialEntry[];
};

export function ReviewsList({ items }: ReviewsListProps) {
  return (
    <Reveal id="reviews.list" stagger as="ul" className={REVIEWS_GRID}>
      {items.map((item, index) => (
        <ReviewCard key={item.id} item={item} index={index} />
      ))}
    </Reveal>
  );
}
