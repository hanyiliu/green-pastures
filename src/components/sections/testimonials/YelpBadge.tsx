import { useTranslations } from "next-intl";

import { Chip } from "@/components/ui/Chip";

/**
 * The red "Yelp" pill beside the rating (04 §3.5; D L240, M L167).
 *
 * It is a {@link Chip} with four properties replaced, not a second pill recipe:
 * the design draws the same inline box with the same centred label, and the
 * only differences are the fill, the label colour, the weight and the corner.
 * Each override is important, because each replaces a property `Chip`'s recipe
 * already sets — 04 §3.2's `className` contract, kept by `withOverrides`.
 *
 * - `bg-yelp!` / `text-white!` — 03 §2.4's `--color-yelp` on white. 04 §3.5
 *   notes the pair is AA.
 * - `font-extrabold!` — the reference sets `font:800`, and `Chip`'s recipe is
 *   700 for every other pill on the site.
 * - `rounded-badge!` — 6px `< md`, 7px `≥ md` (03 §5, "`--radius-badge`: 6px
 *   mobile; 7px at >= md (Yelp)"). `Chip` is otherwise a `--radius-pill`.
 * - `p-(--chip-yelp)!` — 4px 9px `< md`, 5px 11px `≥ md` (03 §4). One class
 *   covers both views because the token itself flips at `md`, and one
 *   `!important` beats `Chip`'s `md:px-3.75` as squarely as its `px-3.25`:
 *   `!important` outranks a media-query rule that does not carry it.
 *
 * **What it renders at, and what the design draws.** `Chip` hard-codes
 * `text-chip` for every role it serves, so this pill takes the hero badge's
 * type token — 11px `< md`, 13px `≥ md`. The reference draws 11px and **14px**
 * (D L240, M L167), so the mobile size is exact and the desktop size is one
 * step small. 03 §3.2 mints no `--text-chip-yelp` to point at, and the sibling
 * gap — a size prop on `Chip` — is filed rather than fixed here.
 */
export function YelpBadge() {
  const t = useTranslations("common.brand");

  return (
    <Chip className="rounded-badge! bg-yelp! p-(--chip-yelp)! font-extrabold! text-white!">
      {t("yelp")}
    </Chip>
  );
}
