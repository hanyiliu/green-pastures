import { useTranslations } from "next-intl";

import { CountUp } from "@/components/motion/CountUp";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StarRow } from "@/components/ui/StarRow";

import { TESTIMONIALS_HEADER, TESTIMONIALS_RATING_ROW } from "./layout";
import { YelpBadge } from "./YelpBadge";

/**
 * The testimonials header (04 §3.5; D L236–243, M L163–170).
 *
 * Three lines: the rating row (stars · 5.0 · Yelp), the `h2`, and the count
 * line. It is **not** a `SectionHeader`: that recipe's first slot is an
 * `Eyebrow`, which upper-cases its children and must never carry a star or an
 * arrow (03 §3.1, 04 §5.4), and its third slot paints `--section-sub`, which is
 * the *quote* colour here rather than the count line's. The stack, the gaps and
 * the two type recipes are this section's own, which is what 04 §3.5 means by
 * listing `ReviewsHeader` as a component beside `TestimonialsSection`.
 *
 * ── Both count-ups live here, and neither is a second observer ────────────
 *
 * 04 §3.3 places both `CountUp`s in this component and says how they are
 * triggered: they read `useRevealed()` from the enclosing
 * `Reveal id="testimonials.header"`, so the entrance reaches them through
 * context rather than a callback prop, and the page's observer count is
 * unchanged (05 §5.1, INV-05.9). Nothing here observes anything.
 *
 * The rating is `site.yelp.rating` at one fraction digit and the count is
 * `site.yelp.reviewCount` at none — the design's own `data-dec` (D L238, L243).
 * `CountUp` guarantees the *final* value is in the server HTML, so a crawler
 * and a reader with no JavaScript both see "5.0" and "47" (INV-05.10); nothing
 * below defeats that, and the SSR test asserts it.
 *
 * ── The accessible name is the group's, not the stars' ────────────────────
 *
 * The glyphs are decorative and the visible "5.0" does not say *out of what*,
 * so the pair sits inside one `role="img"` labelled `common.rating.ariaLabel` —
 * "Rated 5.0 out of 5 on Yelp" — exactly as `sections/hero/TrustRow.tsx` does.
 * The Yelp badge stays **outside** that group: `role="img"` replaces its
 * subtree for a screen reader, and the badge is a word of its own.
 *
 * The count line is `aria-live="off"` (04 §3.5): the digits change while the
 * count-up runs, and none of those frames is an announcement — the final value
 * was in the markup before the animation started.
 *
 * ── Two type tokens that are a step off the drawing ───────────────────────
 *
 * The `h2` is `SectionTitle size="section"` → `--text-section-title`, 28px
 * `< md` / 40px `≥ md`. The reference draws **26px / 36px** (D L242, M L169),
 * which 03 §3.2 records inside the same row ("Reviews 26px", "Reviews 36px")
 * without minting a name for it. `src/styles/tokens.css` states the convention
 * that follows: a row quoting several values holds the first and "a sub-token
 * must be added to 03 first". So the title takes the token and 03 owes this
 * section a `--text-section-title-reviews`, the way it already minted
 * `--text-subhead-section` and the four `--text-chip-*`.
 *
 * The count line is `--text-subhead-section` — 13px / 17px against the drawing's
 * 13px / 16px (D L243, M L170) — the same one-step story, and the token whose
 * role ("the section intro under a section title") is this line's.
 */

/** 02 `D-02.6`'s `rating` format renders `5` as "5.0"; the count-up matches it. */
const RATING_DECIMALS = 1;

/** The review count is a whole number (D L243's `data-count` carries no `data-dec`). */
const COUNT_DECIMALS = 0;

/** The count-up's own type: Fredoka 600 on `--color-ink` at `--text-countup` (D L238). */
const RATING_TYPE = "font-display text-countup font-semibold text-ink";

/**
 * The count line: Nunito 600 on `--color-sub-testimonials-count`, the token 03
 * §2.3 minted for this one line ("47 reviews · Fremont parents" — desktop
 * L243). It is a per-section colour named directly rather than through a
 * `--section-*` role variable, because `Section` exposes five roles and this is
 * a sixth; `D-04.3`'s rule is about not *inventing* a per-section colour, and
 * this one is 03's, minted for this consumer.
 */
const COUNT_LINE = "font-body text-subhead-section font-semibold text-sub-testimonials-count";

export type ReviewsHeaderProps = {
  /** The `h2`'s id, which the enclosing `Section` points `aria-labelledby` at. */
  readonly titleId: string;
  /** `site.yelp.rating` — never a literal (INV-04.11). */
  readonly rating: number;
  /** `site.yelp.reviewCount`. */
  readonly reviewCount: number;
};

export function ReviewsHeader({ titleId, rating, reviewCount }: ReviewsHeaderProps) {
  const t = useTranslations("home.testimonials");
  const tCommon = useTranslations("common");

  /*
   * ── The tag and the number are two keys, and had to become two ──────────
   *
   * `countLine` used to read
   *
   *   "<count>{count, number}</count> {count, plural, one {review} other …}"
   *
   * and ICU resolves a rich tag and an argument out of the *same* values
   * object, so that one name had to be a function (for `<count>`) and a number
   * (for `{count, number}` and the plural) at once. next-intl cannot be handed
   * both under one key: passing the number fails the tag outright
   * (`FORMATTING_ERROR: Value for "count" must be of type function`) and falls
   * back to printing the key, passing the function makes the plural select
   * `other` off a `NaN`, and a hybrid does not survive because next-intl
   * rewraps every function value before formatting. next-intl's generated
   * message types say the same thing at compile time: the argument's type came
   * out as `(number | bigint) & RichTagsFunction`, which nothing inhabits, so
   * the call did not type-check either.
   *
   * The fix is content, not code, and it is one word per locale: the plural and
   * the number now take a `reviews` argument, leaving `count` as the tag name
   * alone. `<count>` stays inside 02 `D-02.5`'s closed tag allowlist, the three
   * locales keep identical argument and tag sets (INV-02.2), and the plural is
   * a real plural again. `reviews.countLine` on the subpage still carries the
   * old shape and will need the same edit when PR-6.x renders it.
   */
  const countUp = () => <CountUp value={reviewCount} decimals={COUNT_DECIMALS} />;

  return (
    <div className={TESTIMONIALS_HEADER}>
      <p className={TESTIMONIALS_RATING_ROW}>
        <span
          role="img"
          aria-label={tCommon("rating.ariaLabel", { rating })}
          className={TESTIMONIALS_RATING_ROW}
        >
          <StarRow size="header" />
          <CountUp value={rating} decimals={RATING_DECIMALS} className={RATING_TYPE} />
        </span>
        <YelpBadge />
      </p>

      <SectionTitle as="h2" id={titleId}>
        {t("title")}
      </SectionTitle>

      <p aria-live="off" className={COUNT_LINE}>
        {t.rich("countLine", { reviews: reviewCount, count: countUp })}
      </p>
    </div>
  );
}
