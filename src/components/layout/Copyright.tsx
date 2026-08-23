import { useLocale, useTranslations } from "next-intl";

import { getSite } from "@/content/site";
import { LOCALE_META } from "@/i18n/routing";

/**
 * The footer copyright line (04 §3.1, `D-04.17`).
 *
 * One message, four arguments, no literals:
 * `common.footer.copyright` = "© {year} {brandName} · {brandNameOther} ·
 * Fremont, CA · License # {license}". The separators, the city and the word
 * "License" all live inside the translated string, which is why this component
 * assembles nothing and concatenates nothing.
 *
 * **Both brand names come from configuration, not from a locale branch.**
 * `brandName` is `site.brand.name[locale]` and `brandNameOther` is
 * `site.brand.name[LOCALE_META[locale].brandPairLocale]` — the pairing is a
 * field on the locale's own row (02 `D-02.19`), so a reader on `zh-Hant` sees
 * 優朵幼兒園 beside the English name without a single `locale === …`
 * (INV-02.9). `{brandNameZh}` is retired and appears nowhere.
 *
 * **The licence number renders on both views.** It is one argument of one
 * string, so there is no mobile variant that could drop it — which is the
 * shape `gp-dln.9` asks for, arrived at by the content tree rather than by a
 * component branch.
 *
 * `{year}` is passed as a string on purpose: a number in a bare ICU argument is
 * formatted by `Intl.NumberFormat` and would print "2,026".
 *
 * 04 `D-04.17` puts this lookup in a `brandArgs(locale)` helper in
 * `src/content/site.ts`. That file belongs to another row and has two more call
 * sites still to come (`GallerySection`, 06's metadata); until it exists the
 * pairing is read here, in the one place that needs it today.
 */
export function Copyright() {
  const t = useTranslations("common");
  const locale = useLocale();
  const site = getSite();

  const brandName = site.brand.name[locale];
  const brandNameOther = site.brand.name[LOCALE_META[locale].brandPairLocale];

  return (
    <small className="font-body text-copyright text-sub-visit-copyright">
      {t("footer.copyright", {
        year: String(new Date().getFullYear()),
        brandName,
        brandNameOther,
        license: site.license,
      })}
    </small>
  );
}
