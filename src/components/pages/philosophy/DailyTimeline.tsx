import { useFormatter, useLocale, useMessages, useTranslations } from "next-intl";

import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { openingTimeDate } from "@/components/sections/visit/hours";
import { getSite } from "@/content/site";
import type { Messages } from "@/i18n/messages";

import { DAY_CARD, DAY_LIST, DAY_TITLE } from "./layout";
import { TimelineRow } from "./TimelineRow";

/**
 * "A day at Green Pastures" — the four-step rhythm (04 §3.6; D L374–L380,
 * M L282–L288).
 *
 * The steps and their clock times are `content/site.json`'s `dailyRhythm[]`;
 * the words are `philosophy.day.<id>.*`. Nothing here names a step or types a
 * time, so an owner who moves lunch to 11:45 or adds a fifth step edits content
 * (INV-04.4).
 *
 * ── Not one digit of the times is typed ──────────────────────────────────
 *
 * `site.json` stores `"08:00"` — a wall clock in `site.timeZone`, not an
 * instant — and 02 `D-02.6` formats it with the named `timeShort` format, which
 * is what the format's own comment in `src/i18n/formats.ts` says it is for
 * ("opening hours **and the daily-rhythm times**"). `openingTimeDate` mints the
 * `Date` that stands for a wall clock; it is `VisitSection`'s helper and this
 * is its second caller, which is the point at which it wants to live in
 * `src/lib/` rather than under `components/sections/visit/` — filed in this
 * row's report.
 *
 * The one place this departs from the drawing: `timeShort` is
 * `{hour: 'numeric', minute: '2-digit'}`, so `en` renders "8:00 AM" where the
 * reference draws "8:00" and `zh` renders "上午8:00". Dropping the meridiem
 * would need a format 02 has not minted and would leave 13:30 reading "1:30"
 * with nothing to disambiguate it; three documents and this row's own
 * acceptance name `timeShort`, so the format wins and the gap is reported.
 *
 * ── The heading and the rows are one stagger ─────────────────────────────
 *
 * The card is the container and its five children — the heading, then the four
 * rows — enter 110 ms apart (05 §5.3). The id is `philosophy.rhythm`; see
 * `PrinciplesList` for why the home section's ids are off limits.
 */

/** Every step id the `en` tree carries, derived rather than listed. */
type StepId = keyof Messages["philosophy"]["day"];

/** One step's copy, as the message tree stores it. */
type Steps = Messages["philosophy"]["day"];

/**
 * The step ids whose copy carries `key`.
 *
 * next-intl's key type is the set of keys the **`en`** tree actually has, so
 * `t(`day.${id}.titleShort`)` over the whole of {@link StepId} does not
 * type-check — `rest` has no short form, because its one clause already fits
 * the narrow view. This narrows the union to the ids where the key exists, and
 * {@link stepHas} is the runtime check that gets the call site from one to the
 * other. It is `SubpageHeader`'s `NamespaceWith` / `pageHas` pair, scoped to
 * one namespace's rows.
 */
type StepWith<K extends string> = Extract<
  StepId,
  { [S in StepId]: K extends keyof Steps[S] ? S : never }[StepId]
>;

/** Does this step carry `key`? A type predicate, so `t()` sees a valid key. */
function stepHas<K extends string>(steps: Steps, id: StepId, key: K): id is StepWith<K> {
  return key in steps[id];
}

/**
 * `site.dailyRhythm[].id` as a message key. The two lists are joined by id
 * (02 `D-02.5`); a step in one and not the other is a build failure that names
 * both files rather than a `⟦philosophy.day.x.title⟧` in the card.
 */
function toStepId(id: string, known: readonly string[]): StepId {
  if (!known.includes(id)) {
    throw new Error(
      `content/site.json declares the daily-rhythm step "${id}", which ` +
        `content/<locale>/messages/philosophy.json has no copy for (${known.join(", ")}). ` +
        `The two are joined by id (02 D-02.5); adding a step is an edit to both.`,
    );
  }

  return id as StepId;
}

export function DailyTimeline() {
  const t = useTranslations("philosophy");
  const format = useFormatter();
  const locale = useLocale();
  const messages = useMessages();
  const site = getSite();

  const brandShortName = site.brand.shortName[locale];
  const steps = messages.philosophy.day;
  const known = Object.keys(steps);

  return (
    <Reveal id="philosophy.rhythm" stagger className={DAY_CARD}>
      <RevealItem variant="riseChild" as="h2" className={DAY_TITLE}>
        {t("dayTitle", { brandShortName })}
      </RevealItem>

      <ol className={DAY_LIST}>
        {site.dailyRhythm.map((step) => {
          const id = toStepId(step.id, known);

          return (
            <TimelineRow
              key={step.id}
              dateTime={step.time}
              time={format.dateTime(openingTimeDate(step.time, site.timeZone), "timeShort")}
              title={t(`day.${id}.title`)}
              titleShort={stepHas(steps, id, "titleShort") ? t(`day.${id}.titleShort`) : undefined}
              body={t(`day.${id}.body`)}
              bodyShort={stepHas(steps, id, "bodyShort") ? t(`day.${id}.bodyShort`) : undefined}
            />
          );
        })}
      </ol>
    </Reveal>
  );
}
