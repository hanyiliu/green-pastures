import { getLocale, getTranslations } from "next-intl/server";

import { Leaf } from "@/components/decor/Leaf";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Reveal } from "@/components/motion/Reveal";
import { LearnMoreLink } from "@/components/ui/LearnMoreLink";
import { getTeachers } from "@/content/collections";

import { AssistantCard } from "./AssistantCard";
import { HeadTeacherCard } from "./HeadTeacherCard";
import {
  TEACHERS_ASSISTANT_FRAME,
  TEACHERS_HEAD_FRAME,
  TEACHERS_LEAF_1,
  TEACHERS_LEAF_2,
  TEACHERS_LINK_ROW,
  TEACHERS_ROW,
} from "./layout";
import { TeacherFrame } from "./TeacherFrame";

/**
 * The Teachers section (04 §3.5, §4, §6; 05 §5.3; `docs/design/desktop/README.md`
 * §7 and `docs/design/mobile/README.md` §7).
 *
 * Header, three frames, one link — the shape most home sections share. What is
 * particular to this one is that the *same three cards* are drawn in two
 * different orders, and that only one of the three has a photograph.
 *
 * ── One DOM order, two drawings (04 §4, §6) ──────────────────────────────
 *
 * The DOM is `site.teachers[]` order, which is the desktop reading order —
 * assistant, head teacher, assistant. The mobile reference puts the head
 * teacher first and stands the two assistants side by side under her, and that
 * is reached with CSS `order` and a wrapping flex row rather than a second
 * markup path (`layout.ts` holds both). Two consequences worth stating:
 *
 * - The reorder is **visual only**. The cards hold no interactive content — no
 *   link, no button — so there is no tab order for `order` to desynchronise
 *   from the reading order, which is the condition that makes the technique
 *   safe here and would not make it safe in a nav.
 * - The **stagger runs in DOM order** (05 §5.3): the frames enter left, centre,
 *   right on the triptych, and centre-then-pair as drawn on mobile is the one
 *   place the two disagree. 05 fixes the sequence to DOM order, so this is the
 *   sequence, not a choice made here.
 *
 * ── Which card, and why it is never a name (`D-04.18`) ────────────────────
 *
 * `site.teachers[].head` picks the head teacher's card; everything else is an
 * assistant. The photograph, the icon and the credential line all ride the same
 * data, so replacing the three provisional names (02 `D-02.20`) is a content
 * edit that moves nothing. Nothing in this file, its cards or its geometry
 * names a teacher.
 *
 * ── Why this section is `async` ──────────────────────────────────────────
 *
 * It is the first home section to read a **collection** rather than only
 * messages. `getTeachers()` joins `content/site.json`'s ids with the locale's
 * text and is server-only (02 `D-02.16`), so the section awaits it and takes
 * its messages from `getTranslations` rather than the `useTranslations` hook
 * the hero uses. Nothing crosses to the client but strings: `TeacherFrame` is
 * the only client component below and receives server-rendered children
 * (04 `D-04.2`).
 */

/** The `h2`'s id, which the `Section` points `aria-labelledby` at (INV-04.8). */
const TEACHERS_TITLE_ID = "teachers-title";

/** The `site.routes[]` id the closing link resolves through (02 `D-02.12`). */
const TEAM_ROUTE_ID = "team";

/** `deco-` + section + kind + position (04 `D-04.15`) — never the teacher's id. */
function frameId(index: number): string {
  return `deco-teachers-frame-${String(index + 1)}`;
}

export default async function TeachersSection() {
  const locale = await getLocale();
  const [t, roles, teachers] = await Promise.all([
    getTranslations("home.teachers"),
    getTranslations("team.roles"),
    getTeachers(locale),
  ]);

  return (
    <Section
      id="teachers"
      labelledBy={TEACHERS_TITLE_ID}
      decor={
        <>
          <Leaf
            id="deco-teachers-leaf-1"
            size={22}
            tint="teachers"
            loop={false}
            className={TEACHERS_LEAF_1}
          />
          <Leaf
            id="deco-teachers-leaf-2"
            size={30}
            tint="teachers"
            loop={false}
            className={TEACHERS_LEAF_2}
          />
        </>
      }
    >
      <Reveal id="teachers.header" variant="rise">
        <SectionHeader
          titleId={TEACHERS_TITLE_ID}
          eyebrow={t("eyebrow")}
          title={t("title")}
          intro={t("intro")}
          introShort={t("introShort")}
        />
      </Reveal>

      <Reveal id="teachers.frames" stagger className={TEACHERS_ROW}>
        {teachers.map((teacher, index) => (
          <TeacherFrame
            key={teacher.id}
            id={frameId(index)}
            className={teacher.head ? TEACHERS_HEAD_FRAME : TEACHERS_ASSISTANT_FRAME}
          >
            {teacher.head ? (
              <HeadTeacherCard teacher={teacher} role={roles("head")} />
            ) : (
              <AssistantCard teacher={teacher} role={roles("assistant")} />
            )}
          </TeacherFrame>
        ))}
      </Reveal>

      <Reveal id="teachers.link" variant="rise" className={TEACHERS_LINK_ROW}>
        <LearnMoreLink routeId={TEAM_ROUTE_ID}>{t("link")}</LearnMoreLink>
      </Reveal>
    </Section>
  );
}
