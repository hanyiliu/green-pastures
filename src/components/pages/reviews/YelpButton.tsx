import { useTranslations } from "next-intl";

import { TrackedLink } from "@/components/layout/TrackedLink";
import { buttonRecipe } from "@/components/ui/Button";

/**
 * "Open our Yelp page ↗" (04 §3.6 `YelpButton`; D L544, M L438).
 *
 * 04 §3.6 spells the shape exactly: "`Button tone="yelp"` rendered through
 * `TrackedLink external event="yelp_click"`; `↗` stays in the string". Three
 * things follow from that one line.
 *
 * **It is `buttonRecipe`, not `<Button>`.** `Button` renders either a next-intl
 * `Link` or a `<button>`, and this leaves the site — it needs
 * `target="_blank" rel="noopener noreferrer"` and an analytics `onClick`, which
 * `D-04.1` allows on exactly one component. `buttonRecipe` is exported for this
 * case, and `BookTourButton` already uses it the same way: the pill styling
 * without a second copy of the recipe.
 *
 * **`size="nav"`.** The wide reference draws `13×26` at 15px and the narrow
 * `12×22` at 13px; of the three placements `nav` (`10×16` / `12×24`, at
 * `--text-button`'s 13px/16px) is the only one that is not full-width below
 * `md`, and `submit`/`hero` both are — a full-bleed pill is not what either
 * reference draws here. `tone="yelp"` brings `--color-yelp` and
 * `--shadow-yelp`, which is the desktop drawing's shadow to the digit.
 *
 * **The `↗` is inside the message.** 02 §5.4 keeps a directional glyph in the
 * string it belongs to; nothing here appends one.
 *
 * The new-tab warning is a visually hidden sibling *inside* the anchor, so it
 * joins the accessible name — "Open our Yelp page ↗ opens in a new tab" —
 * rather than needing a `title` nobody hears. `YelpLink` on the home page makes
 * the same choice for the same reason (04 §3.5, `common.links.newTab`).
 */

export type YelpButtonProps = {
  /** `site.yelp.url` — never a literal (INV-04.11). */
  readonly href: string;
};

export function YelpButton({ href }: YelpButtonProps) {
  const t = useTranslations("reviews");
  const tCommon = useTranslations("common");

  return (
    <TrackedLink event="yelp_click" external href={href} className={buttonRecipe("nav", "yelp")}>
      {t("yelpCta")}
      {/*
        The separator is markup, not copy. Two adjacent inline boxes concatenate
        with nothing between them in the accessible-name computation, and
        "…Yelp page ↗opens in a new tab" is what a screen reader would read.
        A JSX space expression is the one spelling that is a space and never a
        translatable string — INV-02.1 is about words, and this is whitespace.
      */}{" "}
      <span className="sr-only">{tCommon("links.newTab")}</span>
    </TrackedLink>
  );
}
