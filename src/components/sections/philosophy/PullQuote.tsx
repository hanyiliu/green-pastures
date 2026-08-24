import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { QuoteMark } from "@/components/decor/QuoteMark";
import { getSite } from "@/content/site";

import { PHILOSOPHY_ATTRIBUTION, PHILOSOPHY_PULL_QUOTE, PHILOSOPHY_QUOTE } from "./layout";

/**
 * The section's visible heading, which is not a heading (04 §3, §7; D L144–146,
 * M L82–84).
 *
 * `<blockquote>` → the decorative mark, the quote, and a `<footer>` for the
 * attribution: the element the words actually are. The section's `h2` is a
 * visually-hidden eyebrow rendered by `PhilosophySection`, because 04 §7 is
 * explicit that "the Philosophy section's visible heading is the pull-quote, so
 * its `h2` is a visually-hidden eyebrow text" — a `<blockquote>` cannot be a
 * heading and a pull-quote drawn at 44px is not an `h2` in disguise.
 *
 * ── The accent phrase ────────────────────────────────────────────────────
 *
 * `home.philosophy.quote` carries `<em>` around "guiding, not pushing" /
 * "引导，而非催促", which the design draws in sage (D L145). `D-04.13` maps `em`
 * to `--section-accent`, and unlike the hero this section *has* one (03 §2.3
 * gives philosophy `#6f8a5f`), so the tag needs no per-section colour of its
 * own. `not-italic` is the design's: the reference draws a coloured `<span>`,
 * not an italic. The mapping is inline because `richTags()` (`D-04.13`,
 * `components/ui/rich.tsx`) is not built yet; it belongs there when it lands.
 *
 * ── The brand name in the attribution ────────────────────────────────────
 *
 * `attribution` is "— the Montessori promise at {brandShortName}". The name is
 * a fact, not a translated sentence, so it comes from `site.brand.shortName`
 * for the active locale (02's shared config) rather than being spelled into
 * three message files.
 */

/** `D-04.13`'s `em`, on a section that has an accent of its own. */
function accentPhrase(chunks: ReactNode) {
  return <em className="text-(color:--section-accent) not-italic">{chunks}</em>;
}

export function PullQuote() {
  const t = useTranslations("home.philosophy");
  const locale = useLocale();
  const brandShortName = getSite().brand.shortName[locale];

  return (
    <blockquote className={PHILOSOPHY_PULL_QUOTE}>
      <QuoteMark />

      <p className={PHILOSOPHY_QUOTE}>{t.rich("quote", { em: accentPhrase })}</p>

      <footer className={PHILOSOPHY_ATTRIBUTION}>{t("attribution", { brandShortName })}</footer>
    </blockquote>
  );
}
