import { useTranslations } from "next-intl";

import { getSite } from "@/content/site";

import { Copyright } from "./Copyright";
import { FooterLinks } from "./FooterLinks";
import { LogoCard } from "./LogoCard";
import { navLabel, resolveNavItems } from "./SiteHeader";

/**
 * The site footer (04 §3.1; design root README §8, desktop L336–342, mobile
 * L245–249).
 *
 * A row from `lg` — logo card on the left, links, copyright on the right — and
 * a centred column below it. Both columns render the *same* elements: the
 * mobile prototype omits "Contact", and OQ-04.6's default (which ships) is that
 * `site.nav.footer[]` renders whole on both views, so membership is data and
 * never a viewport branch (04 `D-04.5`). The same is true of the licence
 * number: it is an argument of `common.footer.copyright`, so both views print
 * it and `gp-dln.9` needs no per-view component (see `Copyright`).
 *
 * It sits on forest because the design puts it inside the Visit block; its
 * links take that section's link role, `--color-link-visit`, which 03 §10
 * records at 5.38:1 — AA, not AAA.
 *
 * **The `<nav>` landmark has its own name, `common.nav.footerLabel`.** 02
 * authored one nav name and the page carries two `<nav>` landmarks, so both
 * announced as "Main navigation" and neither told a screen-reader user which
 * list it had reached. The second name is a content addition, authored in
 * `content/en/messages/common.json` and read through `t` like every other
 * string — not a literal here, which is what INV-02.1 forbids. The sheet in
 * `MobileMenu` keeps `nav.label`: it is a `role="dialog"`, not a landmark, and
 * it stands in for the header row it replaces below `lg`.
 */
export function SiteFooter() {
  const t = useTranslations("common");
  const site = getSite();

  const items = resolveNavItems(site.nav.footer, site, (id) => navLabel(t, id));

  return (
    <footer className="bg-forest px-(--section-px) pb-8">
      <div className="mx-auto flex max-w-(--container-content) flex-col items-center gap-5 border-t border-footer-rule pt-8 text-center lg:flex-row lg:justify-between lg:gap-8 lg:text-start">
        <LogoCard placement="footer" />

        <nav aria-label={t("nav.footerLabel")} className="lg:flex-1">
          <FooterLinks items={items} />
        </nav>

        <Copyright />
      </div>
    </footer>
  );
}
