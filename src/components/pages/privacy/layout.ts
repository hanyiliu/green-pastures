/**
 * The Privacy page's geometry.
 *
 * **This page has no design reference, and that is a fact about the page rather
 * than a gap in this file.** 07 §4 says so in as many words — "a privacy page is
 * not in the design" — and 06 §6.2 carries it as a conditional route that only
 * exists because `OQ-07.5` came back yes. So there is no `docs/design/**` line
 * number to cite here the way `team/layout.ts` and `reviews/layout.ts` cite
 * theirs, and nothing below is a number lifted from a drawing.
 *
 * What it is instead: the shell's own recipe, narrowed to a reading measure,
 * plus two type tokens borrowed from surfaces 03 §3.2 did mint them for. Both
 * borrowings are named here rather than closed with a raw px (INV-03.2):
 *
 * - `--text-name` (17px) for a section heading. 03 §3.2 mints it for a
 *   teacher's name; it is the smallest Fredoka step above body copy, and this
 *   page's headings are exactly that.
 * - `--text-input` (14px) for the body copy. 03 §3.2 mints it for a form
 *   control's text and gives it the same value on both views. Long prose wants
 *   the larger of the two body steps — `--text-blurb` is 13px and is a card's
 *   size, not a page's.
 *
 * If the owner's counsel supplies real copy and the page acquires a drawing,
 * this is the file that changes and nothing else on the page does.
 */

/**
 * The content column: 720px, narrower than any other subpage.
 *
 * The shell caps at `--container-content` (1080px) and the widest detail page
 * draws 940px, both of which are widths for cards and grids. This page is one
 * column of prose, and a 1080px line of 14px text is roughly 150 characters —
 * about twice a comfortable measure. `max-w-180` is 180 × 4px = 720px, so no
 * arbitrary value is needed.
 *
 * The gap classes are important because each replaces a property `SubpageBar`'s
 * own recipe sets, and the `md:` half is written out rather than left to the
 * base: an important unprefixed class does not outrank its own `md:` twin.
 */
export const PRIVACY_COLUMN = "max-w-180! gap-5! md:gap-7!" as const;

/**
 * The draft banner — the one element on this page that exists to be noticed.
 *
 * `FormAlert`'s recipe with a different border colour: a bordered box on white,
 * against the panel's cream ground. Amber rather than the alert's `--color-yelp`
 * because nothing has gone wrong; the page is simply not finished. The border
 * is 2px where `FormAlert`'s is 1px, because this one has to survive being
 * scrolled past by someone who is not looking for it.
 */
export const PRIVACY_DRAFT_BANNER =
  "flex flex-col gap-1.5 rounded-card-md border-2 border-amber bg-white p-4 md:p-5" as const;

/** The banner's label — `Eyebrow`'s size and weight, on the amber it sits in. */
export const PRIVACY_DRAFT_LABEL = "font-display text-eyebrow font-semibold text-ink" as const;

/** The banner's body. `--text-input` on `--color-ink`, not the muted body ink. */
export const PRIVACY_DRAFT_BODY = "font-body text-input text-ink" as const;

/** One section: heading and body, tighter than the column's own gap. */
export const PRIVACY_SECTION = "flex flex-col gap-2" as const;

export const PRIVACY_SECTION_HEADING = "font-display text-name font-semibold text-ink" as const;

export const PRIVACY_SECTION_BODY = "font-body text-input text-body" as const;
