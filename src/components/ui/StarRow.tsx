/**
 * Five `★` glyphs — the scale, never the rating (04 §3.2, 03 §10).
 *
 * The glyphs are decorative and carry `aria-hidden`: the accessible text is
 * always a sibling. Every caller either wraps the pair in one `role="img"` named
 * `common.rating.ariaLabel` — "Rated 5.0 out of 5 on Yelp", which says *out of
 * what* where the visible number does not — or lets the quote beside them carry
 * the meaning, which is what the two card designs draw, printing no number at
 * all. `TrustRow`, `ReviewsHeader` and `ReviewsPageHeader` each own that group;
 * this row owns nothing but the glyphs.
 *
 * ── No `rating` prop ──────────────────────────────────────────────────────
 *
 * 04 §3.2 sketches one. Nothing on the site draws a partial star: all five
 * drawings print five filled glyphs and let the number beside them — or the
 * group's `aria-label` — carry the value. A `rating` here would have no effect
 * on what renders and would put the accessible name on the wrong element, since
 * the name belongs to the stars *and* the visible number together.
 *
 * ── No `className` prop ──────────────────────────────────────────────────
 *
 * The other primitives take one and pass it through `withOverrides`
 * (`components/ui/class-names.tsx`). No caller needs one here — the four sizes
 * are the whole of the variation the drawings ask for, and every one of them is
 * a `size`, not a caller class. The day a caller does need one, it arrives
 * through `withOverrides` like every other recipe's, not by concatenation.
 *
 * ── `size` is required, and that is the fix for a real defect ─────────────
 *
 * This component used to default to `bubble`, and the reviews page took the
 * default because it was there: its cards drew 14/16px against the reference's
 * 12/14px, purely because that was what the component offered (gp-dln.216).
 * A required `size` makes every call site name the row it is drawing, and the
 * compiler catches the next caller that would otherwise inherit a size the
 * drawing never gave it.
 *
 * ── The four sizes, and where each stands against the drawing ─────────────
 *
 * 03 mints no type token for the stars, so — exactly as `Emoji` does for its
 * dot — they take Tailwind's own steps rather than inventing a px (INV-03.2):
 *
 * | size     | drawn (`< md` / `≥ md`)         | rendered  | off by  |
 * |----------|---------------------------------|-----------|---------|
 * | `trust`  | 14 / 18 (M L62, D L123)         | 14 / 18   | — / —   |
 * | `header` | 17 / 24 (M L165, D L238)        | 18 / 24   | +1 / —  |
 * | `bubble` | 13 / 15 (M L174, D L247)        | 14 / 16   | +1 / +1 |
 * | `card`   | 12 / 14 (M L423, D L524)        | 12 / 14   | — / —   |
 *
 * `header` serves two rows, and the second is a step further out: the reviews
 * page draws 17 / **22** (M L418, D L518), and 22 sits exactly between
 * `text-xl` (20) and `text-2xl` (24), so neither step is nearer and neither is
 * an improvement worth a fifth size. Both header rows therefore render at
 * 18 / 24 until 03 mints a name for 22.
 *
 * ── Tracking is 1px on every size, and two rows draw 2px ──────────────────
 *
 * `--tracking-stars` is 03's only star tracking and holds 1px; its own comment
 * in `src/styles/tokens.css` records the gap — "count-up stars use 2px — no
 * token name in 03" — which is both `header` rows at `≥ md` (D L238, D L518).
 * Writing `tracking-[2px]` would be a raw px in a class (INV-03.2) and is
 * refused by ESLint's `arbitraryValue` ban, so the token stands and 03 owns the
 * miss. It is the one place here where a document overrules the drawing.
 */

/** The four rows the drawings ask for, each named for the row it belongs to. */
const SIZE = {
  /** A rating row above a heading — testimonials (17/24px) and reviews (17/22px). */
  header: "text-lg md:text-2xl",
  /** The hero's trust row — 14/18px (M L62, D L123). */
  trust: "text-sm md:text-lg",
  /** A home-page speech bubble — 13/15px (M L174, D L247). */
  bubble: "text-sm md:text-base",
  /** A reviews-page card — 12/14px (M L423, D L524). */
  card: "text-xs md:text-sm",
} as const;

export type StarRowSize = keyof typeof SIZE;

/** Five glyphs. The scale, not the rating — the rating is data (04 §3.2). */
const STARS = [1, 2, 3, 4, 5] as const;

export type StarRowProps = {
  /** Which row this is. Required — see the note above on the reviews cards. */
  readonly size: StarRowSize;
};

export function StarRow({ size }: StarRowProps) {
  return (
    <span aria-hidden className={`leading-none tracking-stars text-amber ${SIZE[size]}`}>
      {STARS.map((star) => (
        <span key={star}>★</span>
      ))}
    </span>
  );
}
