import { useTranslations } from "next-intl";

import { RevealItem } from "@/components/motion/Reveal";
import { renderRichText } from "@/components/sections/testimonials/SpeechBubble";
import { StarRow } from "@/components/sections/testimonials/StarRow";
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
 * ── `StarRow` and `renderRichText` are imported, not copied ──────────────
 *
 * 04 §3.2 places `StarRow` in `components/ui` and nothing builds it there: the
 * hero inlined its own five glyphs and the testimonials section built the
 * component locally, with a docstring saying so and calling the lift "a bead,
 * not this row's work". This page would be the third copy, so it imports the
 * second instead. The same goes for `renderRichText`, which `SpeechBubble`
 * exports precisely because it is a stand-in for `richTags()` (`D-04.13`) and
 * a second stand-in would be a second thing to delete.
 *
 * Both imports reach across from `components/pages` into
 * `components/sections/testimonials`, which is not where either belongs. The
 * fix is to lift them, and lifting touches two files this row does not own —
 * filed rather than done.
 *
 * The star sizes are the one thing the import costs. `StarRow`'s `bubble` size
 * is 14px/16px and this card draws 12px/14px (D L524, M L422): a step off, held
 * open the way `StarRow`'s own file holds the tracking gap open, rather than
 * adding a third size to a component that is already in the wrong folder.
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
        <StarRow />

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
