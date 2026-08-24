import { useTranslations } from "next-intl";

import { RevealItem } from "@/components/motion/Reveal";
import { renderRichText } from "@/components/sections/testimonials/SpeechBubble";
import { StarRow } from "@/components/ui/StarRow";
import type { TestimonialEntry } from "@/content/collections";

import { CARD, CARD_AUTHOR, CARD_BODY, CARD_DISPLAY, CARD_QUOTE, CARD_RELATION } from "./layout";

/**
 * One review on the subpage (04 §3.6 `ReviewCard`; D L523–527, M L421–425).
 *
 * A plain white card — not the home page's speech bubble. The two are different
 * drawings: the bubble has a squared tail corner, `--radius-bubble-*`, an
 * avatar slot and the `bubble` entrance that inflates it from that corner
 * (D L245–252); this is a rectangle with four equal corners, no avatar, and the
 * `riseChild` entrance 04 §3.6 gives the list. The words inside are the same
 * collection, and that is the only thing the two share.
 *
 * ── `StarRow` is `components/ui`'s now, and draws this card's own size ────
 *
 * It used to be imported from `components/sections/testimonials`, where the
 * home section had built it locally, and this card took its `bubble` size —
 * 14/16px against the 12/14px drawn here (D L524, M L422) — because that was
 * what the import offered. `StarRow` sits in `components/ui` where 04 §3.2
 * puts it, `card` is this row's own size, and it is exact on both views
 * (gp-dln.216).
 *
 * ── `renderRichText` is still the home section's, and still shouldn't be ──
 *
 * It reaches across from `components/pages` into
 * `components/sections/testimonials`, which is not where it belongs either.
 * Its destination is not `StarRow`'s, though: `D-04.13` reserves
 * `components/ui/rich.tsx` for `richTags()`, and `renderRichText` is a
 * deliberate stand-in for that helper rather than a primitive of its own — so
 * it moves when `richTags()` is built, and a second stand-in here would be a
 * second thing to delete. Filed, not done.
 *
 * ── The quotation marks and the separator are punctuation ────────────────
 *
 * `common.punctuation.quoteOpen` / `quoteClose` supply the marks — the marks a
 * locale uses are the locale's, and a stored quote carrying its own would
 * freeze `en`'s choice into all three (02). The `·` between the name and the
 * relation is on 08 `D-08.2`'s symbol allowlist and is markup, not copy: it is
 * a separator the design draws, not a word anyone translates.
 */

export type ReviewCardProps = {
  /** One joined `site.testimonials[]` entry with this locale's text. */
  readonly item: TestimonialEntry;
  /** DOM position in the stagger group. */
  readonly index: number;
};

export function ReviewCard({ item, index }: ReviewCardProps) {
  const t = useTranslations("common.punctuation");

  return (
    <RevealItem
      as="li"
      variant="riseChild"
      index={index}
      className={`${item.onMobile ? CARD_DISPLAY.both : CARD_DISPLAY.desktopOnly} ${CARD}`}
    >
      <figure data-review={item.id} className={CARD_BODY}>
        <StarRow size="card" />

        <blockquote className={CARD_QUOTE}>
          <p>
            {t("quoteOpen")}
            {renderRichText(item.text.quote, `collections.testimonials.${item.id}.quote`)}
            {t("quoteClose")}
          </p>
        </blockquote>

        <figcaption className={CARD_AUTHOR}>
          {item.text.author} <span className={CARD_RELATION}>· {item.text.relation}</span>
        </figcaption>
      </figure>
    </RevealItem>
  );
}
