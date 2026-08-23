"use client";

import { useTranslations } from "next-intl";
import type { Ref } from "react";

/**
 * The sheet trigger, `< lg` only (04 §3.1, `D-04.9`).
 *
 * A real `<button aria-expanded aria-controls>` with a hit area of at least
 * `--tap-min`, and three bars drawn in CSS — no icon font, no SVG, nothing to
 * translate. Its accessible name flips between `common.nav.menuOpen` and
 * `common.nav.menuClose`, which is the pair 02 authored for exactly this
 * control; the bars themselves are `aria-hidden` decoration.
 *
 * It owns no state: `MobileMenu` does, because the sheet's focus return, scroll
 * lock and `inert` all have to be released by whoever put them in place.
 */

export type HamburgerProps = {
  /** The `id` of the sheet this button controls. */
  readonly controlsId: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly ref?: Ref<HTMLButtonElement>;
};

const BAR_CLASS =
  "absolute inset-x-0 h-0.5 rounded-pill bg-nav-link transition-transform duration-(--dur-word-swap) ease-soft";

export function Hamburger({ controlsId, expanded, onToggle, ref }: HamburgerProps) {
  const t = useTranslations("common");

  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={expanded}
      aria-controls={controlsId}
      aria-label={expanded ? t("nav.menuClose") : t("nav.menuOpen")}
      onClick={onToggle}
      className="inline-flex size-(--tap-min) shrink-0 items-center justify-center rounded-card-sm lg:hidden"
    >
      <span aria-hidden="true" className="relative block h-4 w-6">
        <span className={`${BAR_CLASS} ${expanded ? "top-1.75 rotate-45" : "top-0"}`} />
        <span
          className={`${BAR_CLASS} top-1.75 transition-opacity ${expanded ? "opacity-0" : "opacity-100"}`}
        />
        <span className={`${BAR_CLASS} ${expanded ? "top-1.75 -rotate-45" : "top-3.5"}`} />
      </span>
    </button>
  );
}
