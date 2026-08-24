import { useTranslations } from "next-intl";

import { StarRow } from "@/components/ui/StarRow";
import { getSite } from "@/content/site";

import { HERO_TRUST_ROW } from "./layout";

/**
 * The hero's trust row (04 §3.5): five stars, the Yelp rating, a hairline
 * divider, and the age range (D L122–126, M L61–65).
 *
 * ── Three things worth knowing ───────────────────────────────────────────
 *
 * **The rating is not a literal.** `home.hero.trust.yelp` is
 * `"{rating, number, rating} on Yelp"` and the number comes from
 * `site.yelp.rating` through 02's named `rating` format, so "5.0" is one
 * formatted value in three locales rather than a string anyone types
 * (INV-04.11).
 *
 * **`site.yelp` is optional in the schema**, so this renders the Yelp half only
 * when the config carries one. Dropping the Yelp figures from `site.json`
 * leaves the age range and the row's shape intact rather than throwing — the
 * field is genuinely optional, unlike the route ids `LearnMoreLink` refuses.
 *
 * **The accessible name is the whole group's, not the stars'.** The glyphs are
 * decorative (03 §10, 04 §3.2 — `aria-hidden`), and the visible "5.0 on Yelp"
 * beside them does not say *out of what*. So the pair sits inside one
 * `role="img"` labelled with `common.rating.ariaLabel` — "Rated 5.0 out of 5 on
 * Yelp" — which is the key 04 §4 lists for this section and announces the
 * rating once, in full, instead of twice in half.
 *
 * ── The per-view copy is a CSS toggle, never a branch (`D-04.5`) ──────────
 *
 * `trust.ages` and `trust.agesShort` both render; `md:` picks one. No component
 * here reads a viewport, so there is no hydration mismatch and no shift.
 *
 * ── Two type sizes 03 §3.2 does not name ─────────────────────────────────
 *
 * The row's words are `--text-chip-trust` (12/14px), which 03 §3.2 mints for
 * exactly this row. The **stars** are 14px / 18px in the references (D L123,
 * M L62) and 03 mints nothing for them, so they take Tailwind's own `sm` / `lg`
 * steps — the same answer `Emoji` reaches for its `text-2xl` / `text-3xl` dot,
 * and the only one that does not invent a px.
 *
 * ── The stars are `StarRow`'s, not this row's ────────────────────────────
 *
 * They used to be five glyphs written out here, because `components/ui/StarRow`
 * did not exist and the testimonials section had built a second copy locally.
 * It exists now (04 §3.2), and `trust` is the size that carries exactly the
 * 14/18px this row was inlining — same element, same classes, same
 * `aria-hidden`. The `role="img"` group around it stays here, because the name
 * belongs to the stars and the "5.0 on Yelp" beside them together.
 */

export function TrustRow() {
  const t = useTranslations("home.hero.trust");
  const tCommon = useTranslations("common");
  const yelp = getSite().yelp;

  return (
    <p className={HERO_TRUST_ROW}>
      {yelp === undefined ? null : (
        <>
          <span
            role="img"
            aria-label={tCommon("rating.ariaLabel", { rating: yelp.rating })}
            className="inline-flex items-center gap-1.5 md:gap-2"
          >
            <StarRow size="trust" />
            <span className="font-body text-chip-trust font-bold text-(color:--section-sub)">
              {t("yelp", { rating: yelp.rating })}
            </span>
          </span>
          <span aria-hidden className="h-4 w-px bg-divider md:h-5" />
        </>
      )}

      <span className="font-body text-chip-trust font-bold text-(color:--section-sub)">
        <span className="md:hidden">{t("agesShort")}</span>
        <span className="hidden md:inline">{t("ages")}</span>
      </span>
    </p>
  );
}
