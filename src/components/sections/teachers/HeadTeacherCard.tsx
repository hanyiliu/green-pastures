import type { TeacherEntry } from "@/content/collections";

import { Chip } from "@/components/ui/Chip";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PhotoSlot } from "@/components/ui/PhotoSlot";

import {
  TEACHERS_BLURB,
  TEACHERS_HEAD_BADGE,
  TEACHERS_HEAD_CARD,
  TEACHERS_HEAD_PHOTO,
  TEACHERS_HEAD_PHOTO_WRAP,
  TEACHERS_HEAD_RING,
  TEACHERS_NAME_BLOCK,
  TEACHERS_NAME_LG,
  TEACHERS_ROLE,
} from "./layout";

/**
 * The head teacher's card (04 §3.2, §3.5; `docs/design/desktop/README.md` §7
 * and `docs/design/mobile/README.md` §7; D L288–L297, M L196–L201).
 *
 * The one teacher the references draw with a photograph, ringed in white and
 * badged HEAD TEACHER. Everything that makes it *this* card is data, never a
 * name (`D-04.18`): the section picks it by `site.teachers[].head`, the
 * photograph is `site.teachers[].photo`, and the words are collection text.
 *
 * ── Two things that look like decisions and are invariants ───────────────
 *
 * **`uppercase` reaches the page through `Eyebrow` and nowhere else** (04 §5.5,
 * 03 §3.3). `team.roles.head` is authored sentence-case — "Head teacher" — and
 * the reference draws it "HEAD TEACHER", so the badge's label is an `Eyebrow`
 * inside the `Chip` rather than a `Chip` with a `uppercase` class on it, and
 * the credential line beside it is the same recipe at the same size. Nothing in
 * this section adds `uppercase` of its own. The `Eyebrow` recipe colours itself
 * `--section-accent`, which is right for the credential line on the section
 * ground and wrong inside a solid sage pill, so the badge's copy is the one
 * place here that overrides a recipe colour (`text-white!`, D L292).
 *
 * **The photograph is a `PhotoSlot`, not a `Picture`.** No client photograph
 * has arrived (HD-12, INV-04.6), so the slot reserves the box and fills it with
 * 03 §9's tint. `alt` is the collection's `photoAlt`; when a locale has not
 * supplied one the slot is `aria-hidden` instead of carrying an empty name,
 * which is the right answer for a placeholder — `pnpm validate:content` is what
 * reports the gap (INV-02.3).
 *
 * The credential line is optional in the schema and rendered only when the
 * locale supplies one, so a teacher without credentials loses a line rather
 * than rendering a hole.
 */

export type HeadTeacherCardProps = {
  /** The joined `site.teachers[]` entry and its per-locale text. */
  readonly teacher: TeacherEntry;
  /** `team.roles.head`, resolved by the section. */
  readonly role: string;
};

export function HeadTeacherCard({ teacher, role }: HeadTeacherCardProps) {
  const { name, credentials, summary, summaryShort, photoAlt } = teacher.text;

  return (
    <div className={TEACHERS_HEAD_CARD}>
      <div className={TEACHERS_HEAD_PHOTO_WRAP}>
        <div className={TEACHERS_HEAD_RING}>
          <PhotoSlot
            slotId={teacher.id}
            alt={photoAlt}
            shape="circle"
            className={TEACHERS_HEAD_PHOTO}
          />
        </div>
        <Chip tone="sage" className={TEACHERS_HEAD_BADGE}>
          <Eyebrow size="sm" className="text-white!">
            {role}
          </Eyebrow>
        </Chip>
      </div>

      <div className={TEACHERS_NAME_BLOCK}>
        <h3 className={TEACHERS_NAME_LG}>{name}</h3>
        {credentials === undefined ? null : (
          <Eyebrow size="sm" as="p" className={TEACHERS_ROLE}>
            {credentials}
          </Eyebrow>
        )}
      </div>

      {summaryShort === undefined ? (
        <p className={`${TEACHERS_BLURB} text-center`}>{summary}</p>
      ) : (
        <>
          <p className={`${TEACHERS_BLURB} text-center md:hidden`}>{summaryShort}</p>
          <p className={`${TEACHERS_BLURB} hidden text-center md:block`}>{summary}</p>
        </>
      )}
    </div>
  );
}
