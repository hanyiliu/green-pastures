import { getLocale, getTranslations } from "next-intl/server";

import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { Chip } from "@/components/ui/Chip";
import { Emoji } from "@/components/ui/Emoji";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { getTeachers, type TeacherEntry } from "@/content/collections";

import {
  TEAM_ASSISTANT_CARD,
  TEAM_ASSISTANT_DOT,
  TEAM_ASSISTANT_GRID,
  TEAM_ASSISTANT_NAME,
  TEAM_BLURB,
  TEAM_FOOTNOTE,
  TEAM_HEAD_BODY,
  TEAM_HEAD_CARD,
  TEAM_HEAD_NAME,
  TEAM_HEAD_NAME_ROW,
  TEAM_HEAD_PHOTO,
  TEAM_HEAD_RING,
  TEAM_TAG,
  TEAM_TAG_WIDE_ONLY,
  TEAM_TAGS,
} from "./layout";

/**
 * The whole of the Team page below its header (04 §3.6; D L558–L572,
 * M L450–L466): the head teacher's block, the two assistants, the closing line.
 *
 * ── One DOM order here, another on the home page ─────────────────────────
 *
 * The home section's DOM is `site.teachers[]` order — assistant, head,
 * assistant — because that is its desktop reading order. This page puts the
 * head teacher first in the DOM, which 04 §3.6's row calls out as "a different
 * composition from home", and there is no CSS `order` involved: both references
 * draw her block above the pair on both views.
 *
 * Which teacher that is stays data. `site.teachers[].head` picks her, her
 * photograph is `site.teachers[].photo`, the assistants' glyphs are their
 * `icon`s, and every word is collection text — so replacing the three
 * provisional names (02 `D-02.20`) moves nothing here (`D-04.18`).
 *
 * ── What only the head teacher has ───────────────────────────────────────
 *
 * A photograph (02's photo-slot rule gives one teacher a `photo`, INV-02.3), a
 * HEAD TEACHER badge, tags, and a `bioShort` for the narrow view. The
 * assistants have an icon circle, a role line and one `bio` on both views —
 * which is the drawing, not an omission.
 *
 * `bioShort` is 02 `D-02.13`'s mobile variant: both strings render and `md:`
 * picks one, so the view is never a branch in code (`D-04.5`, INV-04.4). The
 * third tag is the same idea in CSS — `tags[2]` is drawn on the wide view only.
 *
 * ── Uppercase, and where it comes from ───────────────────────────────────
 *
 * `team.roles.head` and `team.roles.assistant` are authored sentence-case and
 * drawn "HEAD TEACHER" / "ASSISTANT TEACHER". `Eyebrow` is the only recipe that
 * applies `uppercase` (04 §5.5, 03 §3.3) and it is what both role labels come
 * through; nothing in this file adds the utility. Inside the solid sage badge
 * the recipe's `--section-accent` is the wrong colour, so that one label
 * overrides it — the same single exception `HeadTeacherCard` makes.
 *
 * ── Motion ───────────────────────────────────────────────────────────────
 *
 * The head block is one `rise`; the two assistant cards are a stagger of
 * `riseChild`s, 110 ms apart (04 §3.6, 05 §5.3). The registry ids are under
 * `team.*` and the home section's are under `teachers.*`, so `D-05.6`'s
 * reveal-once promise never crosses between the two surfaces.
 */

/** The one teacher `site.teachers[].head` marks (`D-04.18`). */
function headTeacher(teachers: readonly TeacherEntry[]): TeacherEntry {
  const head = teachers.find((teacher) => teacher.head);

  if (head === undefined) {
    throw new Error(
      "content/site.json marks no teacher with head: true, so the Team page has no head " +
        "teacher to lead with (02 D-02.11, 04 D-04.18). Exactly one entry carries the flag.",
    );
  }

  return head;
}

export async function TeamBio() {
  const locale = await getLocale();
  const [t, teachers] = await Promise.all([getTranslations("team"), getTeachers(locale)]);

  const head = headTeacher(teachers);
  const assistants = teachers.filter((teacher) => !teacher.head);
  const { name, bio, bioShort, tags, photoAlt } = head.text;

  return (
    <>
      <Reveal id="team.head" variant="rise" className={TEAM_HEAD_CARD}>
        <div className={TEAM_HEAD_RING}>
          <PhotoSlot slotId={head.id} alt={photoAlt} shape="circle" className={TEAM_HEAD_PHOTO} />
        </div>

        <div className={TEAM_HEAD_BODY}>
          <div className={TEAM_HEAD_NAME_ROW}>
            <h2 className={TEAM_HEAD_NAME}>{name}</h2>
            <Chip tone="sage" size="head-teacher">
              <Eyebrow size="sm" className="text-white!">
                {t("roles.head")}
              </Eyebrow>
            </Chip>
          </div>

          {bioShort === undefined ? (
            <p className={TEAM_BLURB}>{bio}</p>
          ) : (
            <>
              <p className={`${TEAM_BLURB} md:hidden`}>{bioShort}</p>
              <p className={`${TEAM_BLURB} hidden md:block`}>{bio}</p>
            </>
          )}

          {tags.length === 0 ? null : (
            <ul className={TEAM_TAGS}>
              {tags.map((tag, index) => (
                <li key={tag}>
                  <Chip
                    tone="lavender"
                    size="pill"
                    className={index < 2 ? TEAM_TAG : `${TEAM_TAG} ${TEAM_TAG_WIDE_ONLY}`}
                  >
                    {tag}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Reveal>

      <Reveal id="team.assistants" stagger as="ul" className={TEAM_ASSISTANT_GRID}>
        {assistants.map((teacher) => (
          <RevealItem key={teacher.id} variant="riseChild" as="li" className={TEAM_ASSISTANT_CARD}>
            {teacher.icon === undefined ? null : (
              <Emoji symbol={teacher.icon} size="dot" className={TEAM_ASSISTANT_DOT} />
            )}

            <div>
              <h2 className={TEAM_ASSISTANT_NAME}>{teacher.text.name}</h2>
              <Eyebrow size="sm" as="p">
                {t("roles.assistant")}
              </Eyebrow>
            </div>

            <p className={TEAM_BLURB}>{teacher.text.bio}</p>
          </RevealItem>
        ))}
      </Reveal>

      <Reveal id="team.footnote" variant="rise" as="p" className={TEAM_FOOTNOTE}>
        {t("footnote")}
      </Reveal>
    </>
  );
}
