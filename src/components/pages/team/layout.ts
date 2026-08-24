/**
 * The Team page's geometry (04 `D-04.6`, §3.6).
 *
 * Every number the two references draw for this page, on Tailwind's
 * `--spacing` scale and never as a raw px — `p-4.5` is 18px, `w-40` is 160px,
 * `max-w-220` is 880px. 03 §4 quotes these values without minting a token for
 * any of them, which `src/styles/tokens.css` records: "Values 03 quotes without
 * giving a token name at all (§4 geometry) are comments, not tokens".
 *
 * Line numbers are `docs/design/desktop/Green Pastures - Homepage.dc.html` (D)
 * and `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html` (M).
 *
 * **One colour is the page's own tint and it is already a variable.** The ring
 * behind the head teacher's photograph, the assistants' icon circles and the
 * tag pills are all `#f0edf4` (D L559, L566, L568), which is
 * `--color-bg-teachers` — the section background `SubpageBar` has already put
 * on `--section-bg` for this route. Nothing below names a colour (`D-04.3`).
 */

/* -------------------------------------------------------------------------- *
 * The page column
 * -------------------------------------------------------------------------- */

/**
 * The content column: 880px, with the reference's 16/24px block rhythm rather
 * than the shell's 18/28 (D L553, M L446).
 *
 * All three are important, one property each, because `SubpageBar`'s own
 * recipe sets `max-w-content`, `gap-4.5` and `md:gap-7`. Both halves of the gap
 * are overridden rather than only the base — see `SubpageHeader`'s released
 * bottom margin for why an important base class is not left to settle a `md:`
 * twin on its own.
 */
export const TEAM_COLUMN = "max-w-220! gap-4! md:gap-6!" as const;

/* -------------------------------------------------------------------------- *
 * The head teacher (D L558–L565, M L450–L455)
 * -------------------------------------------------------------------------- */

/**
 * The head teacher's card: a centred column below `md` — photo, name, bio,
 * tags — and a photo-beside-text row above it (M L450, D L558).
 *
 * White on `--radius-card` (20px, the desktop drawing; mobile draws 16 and 03
 * §5 mints no step for it) with 20px of padding below `md` and 28px above.
 * `--shadow-card-lavender` is 03 §6's teacher-card shadow; the reference draws
 * this one a shade deeper (`0 14px 34px` at 12 % against the token's
 * `0 12px 30px` at 10 %) and 03 names nothing for the difference.
 */
export const TEAM_HEAD_CARD =
  "flex flex-col items-center gap-2.75 rounded-card bg-white p-5 text-center shadow-card-lavender md:flex-row md:gap-6.5 md:p-7 md:text-start" as const;

/**
 * The ring around the photograph: the page's own tint, 6px of padding below
 * `md` and 7px above (D L559, M L451). `flex-none` keeps the circle from
 * squeezing when the bio runs long on the desktop row.
 */
export const TEAM_HEAD_RING =
  "flex-none rounded-full bg-(color:--section-bg) p-1.5 md:p-1.75" as const;

/**
 * The photograph: 120px across below `md`, 160px above (D L559, M L451). The
 * width is important because `PhotoSlot`'s recipe is `w-full`; the height comes
 * from the `aspect-square` that `shape="circle"` already sets.
 */
export const TEAM_HEAD_PHOTO = "w-30! md:w-40!" as const;

/**
 * The text beside the photograph — name row, bio, tags. Centred below `md` at
 * the card's own 11px rhythm, left-aligned above it at the reference's 10px
 * (D L560, M L452).
 */
export const TEAM_HEAD_BODY =
  "flex flex-col items-center gap-2.75 md:items-start md:gap-2.5" as const;

/** The name and the HEAD TEACHER badge, 9px apart below `md` and 12px above. */
export const TEAM_HEAD_NAME_ROW =
  "flex flex-wrap items-center justify-center gap-2.25 md:justify-start md:gap-3" as const;

/**
 * The name: Fredoka 600 on ink. `--text-name-lg` is 22/26px against the
 * reference's 23/28 — this page draws the head teacher one step larger than the
 * home section's card does (D L293 vs D L563) and 03 §3.2 mints one token for
 * the pair.
 */
export const TEAM_HEAD_NAME = "font-display text-name-lg font-semibold text-ink" as const;

/** The tag row: 6px apart below `md`, 7px above (D L565, M L454). */
export const TEAM_TAGS =
  "flex flex-wrap justify-center gap-1.5 md:justify-start md:gap-1.75" as const;

/**
 * The tag the narrow view drops — `tags[2]`, third of three (D L565 draws
 * three, M L454 draws two; 04 §3.6's row says the same).
 *
 * Both halves are important: `hidden` collides with `Chip`'s own `inline-flex`
 * and so must be marked, and the `md:` twin has to outrank it at the wide view
 * without depending on how importance-across-a-media-query is read.
 */
export const TEAM_TAG_WIDE_ONLY = "hidden! md:inline-flex!" as const;

/**
 * A tag pill's colour. `Chip`'s `lavender` tone is `--section-bg` on
 * `--section-accent`; this page's reference draws the label in
 * `--section-link` (`#6d5f92`, D L565) rather than the accent (`#8677a3`), so
 * the one property moves and the fill stays the tone's. Both spellings are
 * role variables, so no colour is named here (`D-04.3`).
 */
export const TEAM_TAG = "text-(color:--section-link)!" as const;

/* -------------------------------------------------------------------------- *
 * The assistants (D L566–L571, M L456–L465)
 * -------------------------------------------------------------------------- */

/**
 * The two assistant cards: one per line below `md` at the column's own 16px
 * rhythm, side by side at 20px above (D L566, M L456/L461).
 */
export const TEAM_ASSISTANT_GRID = "grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5" as const;

/**
 * One assistant card: white, `--radius-card-md` (18px), centred, 18px of
 * padding and a 9px column below `md`; 24px and 10px above (D L567, M L457).
 * `--shadow-card-lavender` is the desktop drawing exactly.
 */
export const TEAM_ASSISTANT_CARD =
  "flex flex-col items-center gap-2.25 rounded-card-md bg-white p-4.5 text-center shadow-card-lavender md:gap-2.5 md:p-6" as const;

/**
 * The icon circle behind an assistant's emoji: 48px below `md`, 52px above
 * (D L567, M L457), filled with the page's tint rather than the white the home
 * section's dots use.
 *
 * `Emoji size="dot"` is 03 §9's 48/56px pair, so only the wide half moves; both
 * overrides are important because each collides with the recipe's own `md:`
 * class.
 */
export const TEAM_ASSISTANT_DOT =
  "shrink-0 rounded-full bg-(color:--section-bg) md:size-13! md:text-2xl!" as const;

/** An assistant's name: Fredoka 600 on ink, `--text-name` (17/21px) (D L568). */
export const TEAM_ASSISTANT_NAME = "font-display text-name font-semibold text-ink" as const;

/* -------------------------------------------------------------------------- *
 * Shared copy (both cards, and the footnote)
 * -------------------------------------------------------------------------- */

/**
 * A teacher's paragraph: Nunito 600 on `--section-sub`, which is
 * `--color-sub-teachers` (`#757080`) — the reference's own colour for both the
 * head teacher's bio and the assistants' lines (D L564, L570).
 *
 * `--text-blurb` is 13/15px; the assistants are drawn one step down (12/14),
 * which 03 §3.2 records on the token's own row rather than minting a second
 * name, exactly as the home section's cards do.
 */
export const TEAM_BLURB = "font-body text-blurb font-semibold text-(color:--section-sub)" as const;

/**
 * The closing line under the cards, centred (D L572, M L466). The reference
 * greys it a step further than the bios (`#9a90ab`), for which 03 names
 * nothing; `--section-sub` is the near one and is a role variable rather than a
 * literal.
 */
export const TEAM_FOOTNOTE =
  "text-center font-body text-blurb font-semibold text-(color:--section-sub)" as const;
