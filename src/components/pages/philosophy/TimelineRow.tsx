import { RevealItem } from "@/components/motion/Reveal";

import { DAY_ROW, DAY_TERM, DAY_TEXT, DAY_TIME } from "./layout";

/**
 * One step of the daily rhythm (04 §3.6; D L377, M L285).
 *
 * A time pill and a sentence — "**Arrival & morning work cycle** — children
 * choose their own Montessori work." It is one `<li>` of
 * {@link DailyTimeline}'s ordered list and one staggered `riseChild`.
 *
 * ── The em dash ──────────────────────────────────────────────────────────
 *
 * 02 keys the step's name and its clause separately, and the reference joins
 * them with " — ". The dash is therefore the component's, which is what 04
 * §3.6's row says in as many words ("`—` separator is punctuation in the
 * component") and what 08 `D-08.2`'s allowlist admits — it is a separator, not
 * copy, and translating it would let a locale lose it.
 *
 * ── Two sentences, and `md:` picks one (`D-04.5`) ────────────────────────
 *
 * Three of the four steps carry a shorter title, body or both for the narrow
 * view; the fourth carries neither. Where a short form exists both sentences
 * render and CSS chooses, so no view is a branch in code (INV-04.4) and there
 * is no hydration mismatch to have. Where neither exists there is one sentence
 * on both views rather than a duplicate of itself.
 *
 * ── The time ─────────────────────────────────────────────────────────────
 *
 * `dateTime` is `site.dailyRhythm[].time` unchanged — the 24-hour `HH:MM` the
 * owner typed, which is exactly what `<time>` wants — while the visible text is
 * that value put through 02's `timeShort` format by the list above. A machine
 * reads the data and a parent reads their own locale's clock, and neither
 * string is typed anywhere.
 */

export type TimelineRowProps = {
  /** `site.dailyRhythm[].time`, `HH:MM` — the `datetime` attribute. */
  readonly dateTime: string;
  /** The same value through the `timeShort` format, resolved by the list. */
  readonly time: string;
  /** `philosophy.day.<id>.title`. */
  readonly title: string;
  /** `philosophy.day.<id>.titleShort`, when the locale supplies one. */
  readonly titleShort?: string;
  /** `philosophy.day.<id>.body`. */
  readonly body: string;
  /** `philosophy.day.<id>.bodyShort`, when the locale supplies one. */
  readonly bodyShort?: string;
};

/** The step's name in bold, the dash, and the clause after it. */
function Sentence({
  title,
  body,
  className,
}: {
  readonly title: string;
  readonly body: string;
  readonly className: string;
}) {
  return (
    <p className={className}>
      <strong className={DAY_TERM}>{title}</strong> {"—"} {body}
    </p>
  );
}

export function TimelineRow({
  dateTime,
  time,
  title,
  titleShort,
  body,
  bodyShort,
}: TimelineRowProps) {
  const hasShortForm = titleShort !== undefined || bodyShort !== undefined;

  return (
    <RevealItem variant="riseChild" as="li" className={DAY_ROW}>
      <time dateTime={dateTime} className={DAY_TIME}>
        {time}
      </time>

      {hasShortForm ? (
        <>
          <Sentence
            title={titleShort ?? title}
            body={bodyShort ?? body}
            className={`${DAY_TEXT} md:hidden`}
          />
          <Sentence title={title} body={body} className={`${DAY_TEXT} hidden md:block`} />
        </>
      ) : (
        <Sentence title={title} body={body} className={DAY_TEXT} />
      )}
    </RevealItem>
  );
}
