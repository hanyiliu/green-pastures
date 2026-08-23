import { useTranslations } from "next-intl";

import { TrackedLink } from "@/components/layout/TrackedLink";

/**
 * "Read all reviews on Yelp →" (04 §3.5; D L271, M L184).
 *
 * **It leaves the site, so it is not a `LearnMoreLink`.** That primitive
 * resolves a `site.routes[]` id into an internal next-intl `Link` carrying the
 * `subpage-enter` transition; this one points at `site.yelp.url`. 04 §3.5 names
 * the shape instead: `TrackedLink external`, which renders
 * `target="_blank" rel="noopener noreferrer"` and fires `yelp_click` — one of
 * the two link events 07 §4 lists, and the reason `TrackedLink`'s own docstring
 * already names "the home Yelp link" among its callers.
 *
 * The **design draws it as a subpage link** (`data-subpage="reviews"` on both
 * references) and 04 §3.5 draws it as an outbound Yelp link. That is the one
 * place in this section where a document overrules the drawing, and it is the
 * right way round: the label says "on Yelp", `site.yelp.url` exists for it, and
 * the reviews subpage keeps its own "Open our Yelp page ↗" button (D L544).
 *
 * The recipe is `LearnMoreLink`'s, restated rather than imported because the
 * element underneath is a different one: `--text-blurb` is 13px `< md` and 15px
 * `≥ md`, exactly the two link sizes both references draw; the colour and the
 * rule are the section role variables `--section-link` and
 * `--section-link-underline`; and the 44px hit area sits on the anchor while
 * the 2px rule sits on an inner span, so the target is reachable without the
 * underline drifting off the words (INV-04.7).
 *
 * The new-tab warning is a visually hidden sibling inside the anchor, so it
 * joins the accessible name — "Read all reviews on Yelp → opens in a new tab" —
 * rather than needing a `title` nobody hears (04 §3.5, `common.links.newTab`).
 */

/** `LearnMoreLink`'s recipe, on an outbound anchor. */
const LINK =
  "inline-flex min-h-(--tap-min) items-center font-body text-blurb font-bold text-(color:--section-link)";

export type YelpLinkProps = {
  /** `site.yelp.url`. */
  readonly href: string;
};

export function YelpLink({ href }: YelpLinkProps) {
  const t = useTranslations("home.testimonials");
  const tCommon = useTranslations("common");

  return (
    <TrackedLink event="yelp_click" external href={href} className={LINK}>
      <span className="border-b-2 border-(color:--section-link-underline) pb-0.5">{t("link")}</span>
      {/*
        The separator is markup, not copy. Two adjacent inline boxes concatenate
        with nothing between them in the accessible-name computation, and
        "…on Yelp →opens in a new tab" is what a screen reader would then read.
        A JSX space expression is the one spelling that is a space and never a
        translatable string — INV-02.1 is about words, and this is whitespace.
      */}{" "}
      <span className="sr-only">{tCommon("links.newTab")}</span>
    </TrackedLink>
  );
}
