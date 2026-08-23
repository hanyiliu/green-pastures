import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui/Eyebrow";
import { SectionTitle } from "@/components/ui/SectionTitle";

/**
 * The eyebrow → title → intro stack every section and subpage opens with
 * (04 §3.2).
 *
 * The gaps are the design's: 9–10px between the three lines with 26–30px below
 * the stack on mobile, 12px and 40–44px on desktop (03 §4 "header stack"). They
 * are written on Tailwind's `--spacing` scale — `gap-2.5` is 10px, `gap-3` 12px,
 * `mb-7` 28px, `mb-11` 44px — because 03 §4 quotes those numbers without minting
 * a token for them, and a raw px would break INV-03.2.
 *
 * **Per-view copy never branches in code** (`D-04.5`). Passing `introShort`
 * renders *both* strings and lets `md:` choose; an intro the design shows only
 * on the wide view is `introDesktopOnly`. Neither reads the viewport in JS, so
 * there is no hydration mismatch and no layout shift.
 *
 * **Known token gap (03 §3.2).** The section intro is 13–14px `< md` and 17px
 * `≥ md` in the design, but `--text-subhead` carries the *hero* subhead's values
 * (15px / 19px) — 03 §3.2 writes the section values as prose in the same row
 * and mints no second token. The intro therefore renders one step large until
 * 03 mints `--text-subhead-section`; inventing a px here would break INV-03.2.
 */

const ALIGN = {
  center: "items-center text-center",
  start: "items-start text-start",
} as const;

export type SectionHeaderAlign = keyof typeof ALIGN;

/** The intro recipe: Nunito 600 on `--section-sub`, capped at the design's 560px. */
const INTRO = "font-body text-subhead max-w-140 font-semibold text-(color:--section-sub)";

export type SectionHeaderProps = {
  /** The heading's `id`, which the enclosing `Section` points `aria-labelledby` at. */
  readonly titleId: string;
  readonly title: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly intro?: ReactNode;
  /** The `< md` twin of `intro` (`D-04.5`); both render, `md:` picks one. */
  readonly introShort?: ReactNode;
  /** `true` when the design shows the intro only `≥ md` (e.g. `home.programs.intro`). */
  readonly introDesktopOnly?: boolean;
  readonly align?: SectionHeaderAlign;
  /** One `h1` per page (INV-04.8): subpage headers pass `h1`, home sections `h2`. */
  readonly as?: "h1" | "h2";
  readonly className?: string;
};

export function SectionHeader({
  titleId,
  title,
  eyebrow,
  intro,
  introShort,
  introDesktopOnly = false,
  align = "center",
  as = "h2",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={`mb-7 flex flex-col gap-2.5 md:mb-11 md:gap-3 ${ALIGN[align]} ${className ?? ""}`}
    >
      {eyebrow === undefined ? null : <Eyebrow>{eyebrow}</Eyebrow>}

      <SectionTitle as={as} id={titleId} size="section">
        {title}
      </SectionTitle>

      {introShort === undefined ? null : <p className={`${INTRO} md:hidden`}>{introShort}</p>}

      {intro === undefined ? null : (
        <p
          className={`${INTRO} ${introShort === undefined && !introDesktopOnly ? "" : "hidden md:block"}`}
        >
          {intro}
        </p>
      )}
    </div>
  );
}
