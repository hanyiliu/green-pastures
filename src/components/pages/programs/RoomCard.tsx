import { Chip } from "@/components/ui/Chip";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import type { ProgramEntry } from "@/content/collections";

import {
  chipToneFor,
  ROOM_CARD,
  ROOM_CARD_FEATURED,
  ROOM_CHIP_WIDE_ONLY,
  ROOM_CHIPS,
  ROOM_DESCRIPTION,
  ROOM_HEAD,
  ROOM_NAME,
  ROOM_NAMES,
  ROOM_PHOTO,
  ROOM_RING,
} from "./layout";

/**
 * One room on the Programs page (04 §3.6's `RoomCards` / `RoomCard` row; D
 * L398–427, M L303–318).
 *
 * A photograph in a ring, the room's name and age band, the long description
 * the home section does not draw, and a chip row that opens with the adult:child
 * ratio.
 *
 * ── The ratio and the highlights are this page's, not the home section's ──
 *
 * 02 puts `programs.ratioLabel` in the Subpages namespace and 04 §3.6 assigns
 * both the ratio chip and the highlight chips to `RoomCards`, so the home
 * section deliberately draws neither: its stones carry a name, an age and a
 * one-line summary and stop there. This is where `site.programs[].ratio` and
 * `collections.programs.<id>.highlights[]` are read.
 *
 * **The ratio is data formatted by a message, not a stored string.** `ratio` is
 * `[1, 3]` in `content/site.json` and `programs.ratioLabel` is
 * `"{adults}:{children} ratio"`, so the colon, the word and the order are the
 * locale's to change and the two numbers never appear in a JSON string
 * (02 `D-02.3`).
 *
 * ── The heading level ───────────────────────────────────────────────────
 *
 * `h2`, per 04 §3.6. The page's `h1` is `SubpageHeader`'s, so the three rooms
 * are its siblings in the outline — the same relationship the home section's
 * `h3` stones have to their section `h2`, one level up because a detail page's
 * heading is the `h1`.
 *
 * ── What is per-view, and how ───────────────────────────────────────────
 *
 * The card's shape, the photo's diameter, the type sizes and the number of
 * highlight chips all change at `md`, and every one of them is a class rather
 * than a branch (`D-04.5`, INV-04.4). Nothing here reads a viewport and nothing
 * reads a locale.
 */

export type RoomCardProps = {
  /** One `site.programs[]` entry joined with this locale's text. */
  readonly program: ProgramEntry;
  /**
   * The room's position in `site.programs[]`. Picks the chip palette — position
   * rather than identity, see `chipToneFor`.
   */
  readonly index: number;
  /** `programs.ratioLabel` already formatted with this room's two numbers. */
  readonly ratioLabel: string;
};

export function RoomCard({ program, index, ratioLabel }: RoomCardProps) {
  const tone = chipToneFor(index);
  const { name, ageLabel, description, highlights, photoAlt } = program.text;

  return (
    <div className={program.featured ? `${ROOM_CARD} ${ROOM_CARD_FEATURED}` : ROOM_CARD}>
      <div className={ROOM_HEAD}>
        <div className={ROOM_RING}>
          <PhotoSlot
            slotId={`programs-room-${program.id}`}
            alt={photoAlt}
            shape="circle"
            className={ROOM_PHOTO}
          />
        </div>

        <div className={ROOM_NAMES}>
          <h2 className={ROOM_NAME}>{name}</h2>
          {/*
            `Eyebrow size="sm"` needs no override here: its recipe is already
            Nunito 700 on `--section-accent` at `--text-eyebrow-sm` with
            `--tracking-label`, which is `#c08552`, 10px and 0.5px — the
            reference's own values (M L304, D L400). 03 §3.2's row for that
            token reads "programs ages", so the wide view's 12px against the
            drawing's 11px is 03's rounding and not this component's.
          */}
          <Eyebrow size="sm">{ageLabel}</Eyebrow>
        </div>
      </div>

      <p className={ROOM_DESCRIPTION}>{description}</p>

      <ul className={ROOM_CHIPS}>
        {/*
          The ratio chip always leads, on both views (D L409, M L306): 04 §3.6
          reads the row as "ratio + 2 `≥ md`, ratio + 1 `< md`", so it is the
          highlights that thin out, never this one.
        */}
        <li>
          <Chip tone={tone} size="pill">
            {ratioLabel}
          </Chip>
        </li>

        {highlights.map((highlight, position) => (
          <li key={highlight} className={position >= 1 ? ROOM_CHIP_WIDE_ONLY : undefined}>
            <Chip tone={tone} size="pill">
              {highlight}
            </Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}
