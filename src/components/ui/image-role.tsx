/**
 * 04 §3.2's accessibility rule for a graphic, written once.
 *
 * Two primitives render something that is *only* a picture — `Emoji`'s glyph
 * and `PhotoSlot`'s reserved box — and 04 §3.2 gives them the same rule in the
 * same words: with a name the element is `role="img"` carrying that name as its
 * accessible name; without one it is `aria-hidden`, which is the right answer
 * whenever the words beside it already say what the picture says.
 *
 * Each primitive used to spell that out for itself, in three ternaries over an
 * identical `label !== undefined`. The copies had not drifted, and that is the
 * only reason this is a refactor rather than a bug report — but the thing being
 * duplicated is not cosmetic. Both ways of getting it wrong are silent to
 * everyone who does not use a screen reader: one announces a decorative glyph
 * that repeats its own caption, the other drops a meaningful picture out of the
 * page entirely. One copy is one place to read the rule and one place to change
 * it.
 *
 * ── The two states are exclusive by construction ──────────────────────────
 *
 * {@link ImageRoleProps} is a union, not a record of three optional attributes.
 * So there is no spelling of it that puts `role="img"` on an element with
 * nothing to name it — `img` is a role whose accessible name is required, and
 * an unnamed one is announced as bare "image" — and none that leaves
 * `aria-hidden` sitting over a name that will therefore never be read. Half of
 * the rule is the shape a hand-kept copy drifts into, and the type refuses it.
 *
 * ── An empty name is not this module's to catch ───────────────────────────
 *
 * `imageRole("")` would produce exactly the unnamed `role="img"` above, and it
 * is guarded a layer earlier instead: every name reaching these primitives is a
 * content value, and `pnpm validate:content` fails on an empty or
 * whitespace-only value in any locale (INV-02.8, D-02.8). Re-checking it here
 * would put the same rule in two places, which is the defect this file exists
 * to remove rather than a precaution worth taking twice.
 *
 * ── What does not route through here ──────────────────────────────────────
 *
 * Only a graphic whose name is *optional* has a decision to make. `StarRow`,
 * `Leaf`, `Sun` and `QuoteMark` are decorative in every drawing and write
 * `aria-hidden` outright; the rating groups in `TrustRow`, `ReviewsHeader` and
 * `ReviewsPageHeader` are named in every drawing and write `role="img"` with
 * their `common.rating.ariaLabel` outright. A branch with one live arm is not
 * this decision, and dressing it up as one would hide which of the two things
 * each element actually is.
 */

/**
 * The attributes 04 §3.2 puts on a graphic — named and announced, or hidden.
 * Never both, and never half of either.
 */
export type ImageRoleProps =
  { readonly role: "img"; readonly "aria-label": string } | { readonly "aria-hidden": true };

/**
 * 04 §3.2's rule, applied to one graphic.
 *
 * @param name  The accessible name, always from the message tree or a
 *   collection — never a literal (INV-02.1). Omit it when the picture repeats
 *   what the words beside it already say.
 * @returns The attributes to spread onto the element: `role="img"` carrying
 *   `name`, or `aria-hidden` when there is no name to carry.
 */
export function imageRole(name: string | undefined): ImageRoleProps {
  return name === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": name };
}
