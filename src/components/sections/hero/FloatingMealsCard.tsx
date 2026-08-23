import { useTranslations } from "next-intl";

import { Emoji } from "@/components/ui/Emoji";
import { getSite } from "@/content/site";

import { HERO_MEALS_CARD, HERO_MEALS_DOT } from "./layout";

/**
 * The white card that floats off the hero photo's bottom-left corner
 * (04 §3.5; D L130–133, M L68–71).
 *
 * The 🍎 is `site.hero.mealsIcon` — a standalone element beside the words
 * rather than a glyph inside them, which is why 02 keeps it in `site.json` as
 * data (`D-02.5`) and why it renders through `Emoji` with no label: the two
 * lines next to it already say "breakfast, lunch & snack" (`D-03.8`).
 *
 * Its dot is a **fixed** 30/38px box (03 §9) so a platform whose emoji is drawn
 * wider than another's cannot reflow the card around it.
 *
 * ── One type token 03 §3.2 does not name ─────────────────────────────────
 *
 * The title is `--text-chip-trust` (12/14px), which is the hero's own small
 * bold label and the exact pair the references draw here. The **sub line** is
 * 10/12px Nunito 600 on `--color-muted`; 03 §2.1 names the colour for it by
 * name ("lang toggle, meals-card sub line") but §3.2 mints no size, and
 * `--text-copyright` is the only 10/12px step in the scale. It is borrowed
 * here rather than invented, and a `--text-meals-sub` is requested of 03.
 */
export function FloatingMealsCard() {
  const t = useTranslations("home.hero.mealsCard");
  const icon = getSite().hero.mealsIcon;

  return (
    <div
      className={`${HERO_MEALS_CARD} flex items-center gap-2.25 rounded-card-sm bg-white px-3.25 py-2.5 shadow-float md:gap-2.75 md:px-4.25 md:py-3.25`}
    >
      <span className={HERO_MEALS_DOT}>
        <Emoji symbol={icon} className="text-sm md:text-lg" />
      </span>

      <span className="block">
        <span className="block font-body text-chip-trust font-bold text-ink">{t("title")}</span>
        <span className="block font-body text-copyright font-semibold text-muted">
          <span className="md:hidden">{t("subtitleShort")}</span>
          <span className="hidden md:inline">{t("subtitle")}</span>
        </span>
      </span>
    </div>
  );
}
