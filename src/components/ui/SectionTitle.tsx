import type { ReactNode } from "react";

/**
 * The heading recipe (04 §3.2): display face, `text-wrap: balance` on every
 * locale (03 §3.3), and the type token that goes with the heading's rank.
 *
 * **Known token gap (bead `gp-dln.38`).** 03 §3.2 gives `--text-section-title`
 * no base `line-height` — only `:root:lang(zh)` declares
 * `--text-section-title--line-height`. Tailwind therefore emits no leading for
 * the `text-section-title` utility and the Chinese override cannot bind through
 * it. Rather than mint a number 03 has not decided, the `section` size names
 * that variable directly with `leading-(…)`: for `en` it is undefined, the
 * declaration is invalid at computed-value time and the leading inherits
 * exactly as it does today; for `zh` it resolves to 03's `1.3`, so the rule 03
 * already wrote starts working. The day 03 mints a base value, this recipe
 * picks it up with no code change.
 */

/**
 * Family, weight and size per rank, from the design handoff:
 * headline Fredoka 600 (`docs/design/desktop/README.md` §1), section title
 * Fredoka 600 (desktop reference L161), philosophy quote Fredoka 500 (L145).
 */
const SIZE = {
  headline: "font-display text-headline font-semibold",
  section:
    "font-display text-section-title leading-(--text-section-title--line-height) font-semibold",
  quote: "font-display text-quote font-medium",
} as const;

export type SectionTitleSize = keyof typeof SIZE;

export type SectionTitleProps = {
  readonly children: ReactNode;
  /** The heading rank. One `h1` per page (INV-04.8) — the page decides which. */
  readonly as?: "h1" | "h2" | "h3";
  readonly size?: SectionTitleSize;
  /** Set so a `Section` can point `aria-labelledby` at this heading. */
  readonly id?: string;
  /**
   * `true` when the message carries `\n` and the break is meant to render
   * (02 §Line breaks). The hero honours its break only `≥ md`, which is the
   * hero's own `md:` toggle, not a prop here.
   */
  readonly preserveLineBreaks?: boolean;
  readonly className?: string;
};

export function SectionTitle({
  children,
  as: Tag = "h2",
  size = "section",
  id,
  preserveLineBreaks = false,
  className,
}: SectionTitleProps) {
  return (
    <Tag
      id={id}
      className={`text-balance text-ink ${SIZE[size]} ${preserveLineBreaks ? "whitespace-pre-line" : ""} ${className ?? ""}`}
    >
      {children}
    </Tag>
  );
}
