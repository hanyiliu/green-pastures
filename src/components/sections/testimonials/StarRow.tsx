/**
 * Five `★` glyphs — the scale, never the rating (04 §3.2, 03 §10).
 *
 * The glyphs are decorative and carry `aria-hidden`: the accessible text is
 * always a sibling, either the visible rating beside them (the header, where
 * the pair sits inside one `role="img"` named `common.rating.ariaLabel`) or the
 * quote itself (a bubble, where the design prints no number at all). That is
 * the same reading `sections/hero/TrustRow.tsx` already made for the trust row,
 * restated here rather than re-derived.
 *
 * **This is a local copy of a primitive 04 §3.2 places in `components/ui`.**
 * `StarRow` is listed there with a `rating` and a `size` prop; nothing in
 * `src/components/ui/` builds it yet, so the hero inlined its own row and this
 * section inlines a second. Lifting the two into one `components/ui/StarRow`
 * is a bead, not this row's work — and the `rating` prop goes with it, since
 * neither caller draws a partial star: both designs print five filled glyphs
 * and let the number beside them carry the value.
 *
 * ### The two sizes, and the one place the design wins and the gate does not
 *
 * 03 mints no type token for the stars, so — exactly as `TrustRow` and `Emoji`
 * do — they take Tailwind's own steps rather than inventing a px:
 *
 * - `header` is 17px `< md` and 24px `≥ md` (D L237, M L164) → `text-lg` (18px)
 *   and `text-2xl` (24px);
 * - `bubble` is 13px and 15px (D L246, M L174) → `text-sm` (14px) and
 *   `text-base` (16px), which keeps the design's step up between the views.
 *
 * **Tracking is 1px on both sizes here, and the desktop header draws 2px.**
 * `--tracking-stars` is 03's only star tracking and holds 1px; its own comment
 * in `src/styles/tokens.css` records the gap — "count-up stars use 2px — no
 * token name in 03". Writing `tracking-[2px]` would be a raw px in a class
 * (INV-03.2) and is refused by ESLint's `arbitraryValue` ban, so the token
 * stands and 03 owns the miss. This is the one place in this section where a
 * document overrules the drawing.
 */

/** The 04 §3.2 sizes this section draws. */
const SIZE = {
  /** The section header's rating row — 17/24px (D L237, M L164). */
  header: "text-lg md:text-2xl",
  /** A review bubble's row — 13/15px (D L246, M L174). */
  bubble: "text-sm md:text-base",
} as const;

export type StarRowSize = keyof typeof SIZE;

/** Five glyphs. The scale, not the rating — the rating is data (04 §3.2). */
const STARS = [1, 2, 3, 4, 5] as const;

export type StarRowProps = {
  readonly size?: StarRowSize;
};

export function StarRow({ size = "bubble" }: StarRowProps) {
  return (
    <span aria-hidden className={`leading-none tracking-stars text-amber ${SIZE[size]}`}>
      {STARS.map((star) => (
        <span key={star}>★</span>
      ))}
    </span>
  );
}
