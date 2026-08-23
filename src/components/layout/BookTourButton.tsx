import { useTranslations } from "next-intl";

import { buttonRecipe } from "@/components/ui/Button";
import { withOverrides } from "@/components/ui/class-names";
import { getSite } from "@/content/site";

import { TrackedLink } from "./TrackedLink";

/**
 * The "Book a tour" pill (04 §3.1, 07 §6).
 *
 * A server component that resolves its label and its target and hands both to
 * the one client leaf that carries the analytics handler (`TrackedLink`,
 * 04 `D-04.1`) — so the copy stays server-rendered and no server component
 * grows an `onClick`.
 *
 * Three placements, three recipes, one target. The target is
 * `site.nav.cta.href` (`/#visit`) in every one of them: there is no contact
 * route, and the Visit section is the address/hours/form surface (04 §4). It
 * reaches `TrackedLink` as an internal href, which means it obeys 06 `D-06.7`
 * like every other in-page link — a plain `#visit` anchor on the home page, a
 * `/{locale}#visit` router navigation from a subpage.
 *
 * The label is `common.nav.bookTour` in the nav and the sheet and
 * `home.hero.ctaPrimary` in the hero, which is 02's split: the hero CTA carries
 * its own arrow ("Book a tour →") and the nav pill does not. Both are read from
 * the root translator so that only the `hero` placement ever touches the `home`
 * namespace.
 */

export type BookTourPlacement = "nav" | "hero" | "sheet";

export type BookTourButtonProps = {
  readonly placement: BookTourPlacement;
};

/**
 * The sheet pill is the nav recipe at full width — `docs/design/mobile/README.md`
 * gives every sheet-width CTA 44 px of height and the full column.
 */
const EXTRA_CLASS = { nav: undefined, hero: undefined, sheet: "w-full" } as const;

export function BookTourButton({ placement }: BookTourButtonProps) {
  const t = useTranslations();
  const cta = getSite().nav.cta;

  const label = placement === "hero" ? t("home.hero.ctaPrimary") : t("common.nav.bookTour");
  const size = placement === "hero" ? "hero" : "nav";

  return (
    <TrackedLink
      href={cta.href}
      event="cta_book_tour"
      params={{ placement }}
      className={withOverrides(
        "BookTourButton",
        buttonRecipe(size, "sage"),
        EXTRA_CLASS[placement],
      )}
    >
      {label}
    </TrackedLink>
  );
}
