import { useFormatter, useTranslations } from "next-intl";

import { SubpageHeader } from "@/components/layout/SubpageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { StarRow } from "@/components/sections/testimonials/StarRow";
import { YelpBadge } from "@/components/sections/testimonials/YelpBadge";

import { COUNT_LINE, RATING_ROW, RATING_VALUE, REVIEWS_HEADER } from "./layout";

/**
 * The reviews page's header — the rating row, the `h1` and the count line
 * (D L518–520, M L418–420).
 *
 * ── The `h1` is still `SubpageHeader`'s ──────────────────────────────────
 *
 * The shell owns the heading and the focus contract that goes with it:
 * `SubpageHeader` reads `reviews.heading` out of the page's own namespace and
 * gives it the id `BackLink` focuses on both legs of the slide, and it renders
 * an eyebrow or an intro the day one is added to all three locales with no code
 * change here (INV-04.4). What it has no slot for is furniture *around* the
 * heading, and this page draws two pieces of it. So the composite is the shell
 * component with a sibling above and below, inside one centred stack; the
 * bottom margin `SectionHeader` reserves for a home section is already shed by
 * `SubpageHeader`, so the stack's own gap is the whole separation here.
 *
 * ── Three reveals, not one ───────────────────────────────────────────────
 *
 * `SubpageHeader` brings its own `Reveal`, so the two siblings get theirs.
 * All three are plain `rise`s on the same pooled observer at the same 16%
 * threshold, and the block is three lines tall — they cross the threshold
 * within a frame of each other and read as one entrance (INV-05.9: the observer
 * count is unchanged either way).
 *
 * ── No count-up here, and that is the drawing's call ─────────────────────
 *
 * The home section animates both numbers, and its reference says so with
 * `data-count="47"` on the count line (D L243). Neither subpage reference
 * carries the attribute (D L519–520, M L419–420), so the two numbers are
 * printed, not counted. That keeps the whole header a server component: the
 * rating goes through 02 `D-02.6`'s named `rating` format — the same
 * `minimumFractionDigits: 1` the ICU side of `common.rating.ariaLabel` uses, so
 * "5.0" is one rule rather than two.
 *
 * ── The accessible name is the group's, not the stars' ───────────────────
 *
 * The glyphs are decorative and the visible "5.0" does not say *out of what*,
 * so the pair sits inside one `role="img"` labelled `common.rating.ariaLabel`.
 * The Yelp badge stays outside that group: `role="img"` replaces its subtree
 * for a screen reader, and the badge is a word of its own. `ReviewsHeader` and
 * `TrustRow` both already read it this way.
 *
 * ── `StarRow` and `YelpBadge` are imported from the home section ─────────
 *
 * Neither lives where 04 §3.2 puts it — `StarRow` belongs in `components/ui`
 * and its own file says the lift is a bead — and this page would be the third
 * hand-rolled star row on the site. Importing the second is the smaller wrong
 * thing; see `ReviewCard` for the same note and the same filed follow-up.
 */

/** The page's message namespace, which is also its `site.routes[]` id. */
const PAGE = "reviews";

export type ReviewsPageHeaderProps = {
  /** `site.yelp.rating` — never a literal (INV-04.11). */
  readonly rating: number;
  /** `site.yelp.reviewCount`. */
  readonly reviewCount: number;
};

export function ReviewsPageHeader({ rating, reviewCount }: ReviewsPageHeaderProps) {
  const t = useTranslations(PAGE);
  const tCommon = useTranslations("common");
  const format = useFormatter();

  return (
    <div className={REVIEWS_HEADER}>
      <Reveal id="reviews.rating" variant="rise">
        <p className={RATING_ROW}>
          <span
            role="img"
            aria-label={tCommon("rating.ariaLabel", { rating })}
            className={RATING_ROW}
          >
            <StarRow size="header" />
            <span className={RATING_VALUE}>{format.number(rating, "rating")}</span>
          </span>
          <YelpBadge />
        </p>
      </Reveal>

      <SubpageHeader page={PAGE} />

      <Reveal id="reviews.count" variant="rise">
        {/*
          `countLine` is a rich message: `<count>` wraps the number so a locale
          can style or reorder it, and the plural and the number itself read a
          separate `reviews` argument. That split is not cosmetic — one name
          cannot be both a tag function and a number, and every spelling of the
          single-argument form failed. `ReviewsHeader` carries the full
          diagnosis; this row is where the same one-word fix landed on
          `reviews.countLine`.
        */}
        <p className={COUNT_LINE}>
          {t.rich("countLine", {
            reviews: reviewCount,
            count: (chunks) => <span>{chunks}</span>,
          })}
        </p>
      </Reveal>
    </div>
  );
}
