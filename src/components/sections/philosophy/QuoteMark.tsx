import { useTranslations } from "next-intl";

import { PHILOSOPHY_QUOTE_MARK } from "./layout";

/**
 * The oversized opening quotation mark above the pull-quote (04 §3.4's
 * `QuoteMark` row; D L144, M L82).
 *
 * Purely decorative — 03 §10 measures it at 1.33:1 on the section background
 * and files it under "decorative, `aria-hidden`" — so it is hidden from the
 * accessibility tree and the `<blockquote>` beside it carries the meaning.
 *
 * **The glyph is content, not a literal.** `common.punctuation.quoteOpen`
 * already exists in all three locales for the review bubbles (04 §3), and a
 * `“` typed into this file would be an INV-02.1 defect whether or not a screen
 * reader ever reaches it. Reading the shared key also means a locale that
 * wants `「` gets it here for free.
 *
 * 04 §2 files `QuoteMark` under `components/decor/`, and that directory does
 * exist — PR-4.3b created it for `Sun`, `Leaf` and `ScrollCue`. This file's
 * earlier note said otherwise and was wrong on the day it was written. What is
 * still true is the placement: it sits beside its one caller, and it is the
 * only decoration in 04 §3.4 that is a server component with no loop, no `id`
 * and no two-layer contract (INV-05.5) — nothing about it is addressable from
 * the motion layer. Lifting it into `components/decor/` is a file move and a
 * bead, not a design question.
 */
export function QuoteMark() {
  const t = useTranslations("common.punctuation");

  return (
    <p aria-hidden className={PHILOSOPHY_QUOTE_MARK}>
      {t("quoteOpen")}
    </p>
  );
}
