import { useTranslations } from "next-intl";

/**
 * The skip link (04 §3.1, 06 §6.2).
 *
 * First focusable element on every page, invisible until it takes focus, and
 * pointed at the `#main` landmark each `page.tsx` renders. It is a plain `<a>`
 * rather than a next-intl `Link` on purpose: the target is a fragment of the
 * document already on screen, so a router navigation would be wrong — INV-02.7
 * is about *locale-bearing* navigation, and a bare `#main` carries no locale.
 *
 * `sr-only` and `focus:not-sr-only` are Tailwind's own pair; the positioning
 * classes are what stop the revealed link from displacing the sticky header
 * when it appears.
 */
export function SkipLink() {
  const t = useTranslations("common");

  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:inline-flex focus:min-h-(--tap-min) focus:items-center focus:rounded-card-sm focus:bg-cream focus:px-4 focus:font-body focus:text-nav focus:font-bold focus:text-ink focus:shadow-nav"
    >
      {t("a11y.skipToContent")}
    </a>
  );
}
