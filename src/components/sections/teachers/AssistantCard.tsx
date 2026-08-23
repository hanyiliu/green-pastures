import type { TeacherEntry } from "@/content/collections";

import { Emoji } from "@/components/ui/Emoji";
import { Eyebrow } from "@/components/ui/Eyebrow";

import {
  TEACHERS_ASSISTANT_CARD,
  TEACHERS_ASSISTANT_DOT,
  TEACHERS_BLURB,
  TEACHERS_NAME,
  TEACHERS_NAME_BLOCK,
  TEACHERS_ROLE,
} from "./layout";

/**
 * An assistant teacher's card (04 §3.2, §3.5; D L285–L287, M L204–L207).
 *
 * The two teachers the references draw without a photograph. **There is no
 * assistant photo slot** — that is the design, not an omission: only the head
 * teacher carries a `photo` in `site.json` (02's photo-slot rule, INV-02.3),
 * and where the head teacher has a ringed headshot an assistant has a white
 * icon circle holding `site.teachers[].icon` (🧸 / 🎨).
 *
 * Which assistant gets which glyph is therefore data, not a name test
 * (`D-04.18`): the emoji rides the `site.json` entry beside the id. It is
 * decorative — the name and the role line beside it already say everything the
 * pictogram says — so it renders through `Emoji` with no `label` and is
 * `aria-hidden` (03 `D-03.8`, 04 §3.2).
 *
 * `team.roles.assistant` is authored sentence-case and drawn upper-case, so it
 * comes through the `Eyebrow` recipe — the only place `uppercase` is applied
 * (04 §5.5). `Eyebrow`'s `sm` size is exactly 03 §3.2's `--text-eyebrow-sm`,
 * whose row records the assistants' 11px as the one desktop value it rounds.
 *
 * An assistant with no icon in `site.json` renders the card without the circle
 * rather than an empty box.
 */

export type AssistantCardProps = {
  /** The joined `site.teachers[]` entry and its per-locale text. */
  readonly teacher: TeacherEntry;
  /** `team.roles.assistant`, resolved by the section. */
  readonly role: string;
};

export function AssistantCard({ teacher, role }: AssistantCardProps) {
  const { name, summary, summaryShort } = teacher.text;

  return (
    <div className={TEACHERS_ASSISTANT_CARD}>
      {teacher.icon === undefined ? null : (
        <Emoji symbol={teacher.icon} size="dot" className={TEACHERS_ASSISTANT_DOT} />
      )}

      <div className={TEACHERS_NAME_BLOCK}>
        <h3 className={TEACHERS_NAME}>{name}</h3>
        <Eyebrow size="sm" as="p" className={TEACHERS_ROLE}>
          {role}
        </Eyebrow>
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
