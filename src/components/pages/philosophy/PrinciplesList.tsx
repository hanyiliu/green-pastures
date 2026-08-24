import { useMessages, useTranslations } from "next-intl";

import { Reveal } from "@/components/motion/Reveal";
import { getSite } from "@/content/site";
import type { Messages } from "@/i18n/messages";

import { PRINCIPLES_GRID } from "./layout";
import { PrincipleCard } from "./PrincipleCard";

/**
 * The three core principles (04 §3.6; D L359–L372, M L267–L281).
 *
 * Membership, order and glyphs are `content/site.json`'s `principles[]`; the
 * words are `philosophy.principles.<id>.title|body`. Nothing here names a
 * principle, so a fourth one is a content edit in two files and no edit here
 * (INV-04.4).
 *
 * ── The heading nobody sees ──────────────────────────────────────────────
 *
 * Neither reference draws a heading over the three cards, and 02 ships
 * `philosophy.principlesHeading` ("Core principles") for them anyway. Both
 * facts are honoured: the heading renders `sr-only`, which names the list for a
 * screen reader and gives the cards' `h3`s the `h2` they need — 04 §3.6 asks
 * for `h3` cards under the page's `h1`, and a jump from `h1` to `h3` is the
 * heading-order failure that asking implies. `PhilosophySection` on the home
 * page already does exactly this with `home.philosophy.eyebrow`.
 *
 * Tailwind's own `sr-only` is the recipe; 04 §3.2's `VisuallyHidden` primitive
 * is named there and not built, and three components in `src/` already reach
 * for the utility directly rather than each minting a wrapper.
 *
 * ── One `Reveal`, three staggered children ───────────────────────────────
 *
 * The block is a stagger container and each card is a `riseChild` 110 ms behind
 * the last (05 §5.3, 04 §3.6). The container is the `Reveal`; the `<ul>` inside
 * it is a plain element, because Motion sequences its children through React
 * context rather than through the DOM tree, so a list element between the two
 * costs nothing and keeps the semantics 04 §3.6 asks for.
 *
 * The registry id is `philosophy.principles`, not one of the home section's
 * three. `PhilosophySection` already owns `philosophy.quote`,
 * `philosophy.photo` and `philosophy.badges`, and an id is what `D-05.6`'s
 * reveal-once promise is keyed on: sharing one would make this page's block
 * render final-state for a reader who had scrolled past the home section's.
 */

/** The `sr-only` `h2` the list is labelled by (see above). */
const PRINCIPLES_TITLE_ID = "philosophy-principles-title";

/** A key of `philosophy.principles` — the ids the `en` tree actually carries. */
type PrincipleId = keyof Messages["philosophy"]["principles"];

/**
 * `site.principles[].id` as a message key.
 *
 * The two lists are joined by id (02 `D-02.5`), and the join is the one place
 * that can fail: a principle added to `site.json` and not to the message tree
 * would otherwise render `⟦philosophy.principles.x.title⟧` in a card. This
 * turns it into a build failure that names both files.
 */
function toPrincipleId(id: string, known: readonly string[]): PrincipleId {
  if (!known.includes(id)) {
    throw new Error(
      `content/site.json declares the principle "${id}", which content/<locale>/messages/` +
        `philosophy.json has no title and body for (${known.join(", ")}). The two are joined ` +
        `by id (02 D-02.5); adding a principle is an edit to both.`,
    );
  }

  return id as PrincipleId;
}

export function PrinciplesList() {
  const t = useTranslations("philosophy");
  const messages = useMessages();
  const principles = getSite().principles;

  // The message tree's own ids, so the check below compares content against
  // content rather than against a list typed out here (INV-04.4).
  const known = Object.keys(messages.philosophy.principles);

  return (
    <Reveal id="philosophy.principles" stagger>
      <h2 id={PRINCIPLES_TITLE_ID} className="sr-only">
        {t("principlesHeading")}
      </h2>

      <ul aria-labelledby={PRINCIPLES_TITLE_ID} className={PRINCIPLES_GRID}>
        {principles.map((principle) => {
          const id = toPrincipleId(principle.id, known);

          return (
            <PrincipleCard
              key={principle.id}
              icon={principle.icon}
              title={t(`principles.${id}.title`)}
              body={t(`principles.${id}.body`)}
            />
          );
        })}
      </ul>
    </Reveal>
  );
}
