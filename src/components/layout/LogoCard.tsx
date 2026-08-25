import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import { getSite } from "@/content/site";

/**
 * The logo, in the two places the design draws it (04 §3.1, 03 §9 / `D-03.9`).
 *
 * In the nav it stands on the translucent cream bar at 38 px, 50 px from `md`.
 * In the footer it stands on forest, which the logo may never do directly, so
 * it sits inside the white card 03 §9 specifies: `--radius-logo-card`, 10×14
 * padding, logo 34 px / 42 px.
 *
 * 04 §3.1 sketches the prop as `height`. It is `placement` here because the two
 * numbers are per-view *pairs* (34/42 in the footer, 38/50 in the nav) rather
 * than one height, and a caller passing a number would be writing a raw px into
 * a component (INV-03.2). Naming the placement keeps both pairs in this file,
 * where 03 §9 put them.
 *
 * It is not a link. The design draws neither logo as one, and every route into
 * the home page already has a control that owns it — the nav list, the footer
 * list and "← Back" — so a fourth, undesigned one would be an invention rather
 * than a default.
 *
 * The alt text is `common.logo.alt` with `{brandShortName}` from the localized
 * value in `content/site.json` (02 `D-02.19`), never a literal (INV-02.1).
 *
 * **The file itself is `site.json` `images.logo`, not a constant here.** The
 * path and its 373×161 (`D-03.9`) used to be written into this file, which made
 * a component the home of a fact — the defect 02 is organised against — and
 * left the same path spelled a second time in `src/lib/seo/json-ld.ts`. Both
 * read the one declaration now. Both dimensions are still passed so Next
 * reserves the box and the rendered height is CSS, which is what keeps the nav
 * row at exactly `--nav-h`.
 */

export type LogoPlacement = "nav" | "footer";

const PLACEMENT_CLASS = {
  /** Nav: 38 px, 50 px from `md` (03 §4's nav row). */
  nav: "h-9.5 w-auto md:h-12.5",
  /** Footer card: 34 px, 42 px from `md` (03 §9). */
  footer: "h-8.5 w-auto md:h-10.5",
} as const satisfies Record<LogoPlacement, string>;

export type LogoCardProps = {
  readonly placement: LogoPlacement;
};

export function LogoCard({ placement }: LogoCardProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  const site = getSite();
  const brandShortName = site.brand.shortName[locale];
  const logo = site.images.logo;

  const image = (
    <Image
      src={logo.src}
      width={logo.width}
      height={logo.height}
      alt={t("logo.alt", { brandShortName })}
      className={PLACEMENT_CLASS[placement]}
    />
  );

  if (placement === "nav") return image;

  return (
    <span className="inline-flex items-center rounded-logo-card bg-white px-3.5 py-2.5">
      {image}
    </span>
  );
}
