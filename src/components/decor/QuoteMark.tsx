import { useTranslations } from "next-intl";

import { PHILOSOPHY_QUOTE_MARK } from "@/components/sections/philosophy/layout";

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
 * ── The odd one out in this folder ───────────────────────────────────────
 *
 * 04 §2 files `QuoteMark` here and 04 §3.4 lists it among the decorations, but
 * INV-04.5's eight — `Sun`, `Leaf`, `ScrollCue`, `Plate`, `Polaroid`,
 * `SteppingStone`, `Bubble`, `TeacherFrame` — do not include it, and 04 §3.4
 * marks it `(S)`. So it is the one decoration that is a server component with
 * no loop, no `id`, no `data-deco` and no two-layer contract (INV-05.5):
 * nothing about it is addressable from the motion layer, and it takes no props
 * at all.
 *
 * Its drawing therefore stays in `sections/philosophy/layout.ts`, which is
 * where D-04.6 puts a section's geometry and where the two reference files'
 * 84/58px, `--text-quote-mark` and `--color-quote-mark-text` were read off. Only the
 * component moved; the numbers did not, and the one caller is still
 * `PullQuote`.
 */
export function QuoteMark() {
  const t = useTranslations("common.punctuation");

  return (
    <p aria-hidden className={PHILOSOPHY_QUOTE_MARK}>
      {t("quoteOpen")}
    </p>
  );
}
