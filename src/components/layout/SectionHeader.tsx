import type { ReactNode } from "react";

import { withOverrides } from "@/components/ui/class-names";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { SectionTitle } from "@/components/ui/SectionTitle";

/**
 * The eyebrow → title → intro stack every section and subpage opens with
 * (04 §3.2).
 *
 * The gaps are the design's: 9–10px between the three lines with 26–30px below
 * the stack on mobile, 12px and 40–44px on desktop (03 §4 "header stack"). They
 * are written on Tailwind's `--spacing` scale — `gap-2.5` is 10px, `gap-3` 12px,
 * `mb-7` 28px, `mb-11` 44px — because 03 §4 quotes those numbers without minting
 * a token for them, and a raw px would break INV-03.2.
 *
 * **Per-view copy never branches in code** (`D-04.5`). Passing `introShort`
 * renders *both* strings and lets `md:` choose; an intro the design shows only
 * on the wide view is `introDesktopOnly`. Neither reads the viewport in JS, so
 * there is no hydration mismatch and no layout shift.
 *
 * The two are alternatives, never a pair: with an `introShort` the intro is
 * already the wide half of a toggle, so `introDesktopOnly` beside it would say
 * nothing and used to be accepted and ignored. {@link SectionHeaderIntro} makes
 * the combination a type error instead, which is why `intro` is declared twice
 * below rather than once as an optional.
 *
 * **The intro is `--text-subhead-section`, not `--text-subhead`.** The two are
 * different lines: `--text-subhead` carries the *hero's* own subhead (15px `< md`,
 * 19px `≥ md`), and the intro under a section title is a step smaller — 13px and
 * 17px (03 §3.2, "Sub-tokens of `--text-subhead`, `--text-button` and
 * `--text-chip`"). Visit's mobile 14px is the one value the token deliberately
 * does not carry: a 1px per-section deviation belongs to that section's recipe,
 * the way Reviews' 36px title already does.
 */

const ALIGN = {
  center: "items-center text-center",
  start: "items-start text-start",
} as const;

export type SectionHeaderAlign = keyof typeof ALIGN;

/** The intro recipe: Nunito 600 on `--section-sub`, capped at the design's 560px. */
const INTRO = "font-body text-subhead-section max-w-140 font-semibold text-(color:--section-sub)";

/**
 * The intro half of the props, as the two shapes `D-04.5` actually allows: one
 * intro that may be hidden `< md`, or a pair the `md:` toggle picks between.
 * The `never`s are what reject the third shape at the call site.
 *
 * **Why the pair's `intro` is `NonNullable` and the lone one is not.**
 * `ReactNode` includes `undefined`, and a *required* property whose type admits
 * `undefined` is satisfied by writing it — so `intro={maybeMissing}` beside an
 * `introShort` type-checked as a well-formed pair and rendered a header whose
 * only intro is the one `md:hidden` removes: nothing at all on the wide view.
 * Excluding nullish here is what makes "a pair is two intros" true rather than
 * merely stated. The lone `intro` needs no such guard, because an absent one
 * renders an intro-less header, which is a shape the design does ask for.
 *
 * The `never`s themselves are untouched by any of this: they reject their
 * combination with `ReactNode`-typed fields exactly as they would with
 * `string`-typed ones, in JSX, through a spread, and through a variable alike.
 */
export type SectionHeaderIntro =
  | {
      readonly intro?: ReactNode;
      readonly introShort?: never;
      /** `true` when the design shows the intro only `≥ md` (e.g. `home.programs.intro`). */
      readonly introDesktopOnly?: boolean;
    }
  | {
      /** Nullish is excluded so the pair cannot lose its wide half — see above. */
      readonly intro: NonNullable<ReactNode>;
      /** The `< md` twin of `intro` (`D-04.5`); both render, `md:` picks one. */
      readonly introShort: ReactNode;
      readonly introDesktopOnly?: never;
    };

export type SectionHeaderProps = SectionHeaderIntro & {
  /** The heading's `id`, which the enclosing `Section` points `aria-labelledby` at. */
  readonly titleId: string;
  readonly title: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly align?: SectionHeaderAlign;
  /** One `h1` per page (INV-04.8): subpage headers pass `h1`, home sections `h2`. */
  readonly as?: "h1" | "h2";
  /** Extra classes; an override of a property the recipe sets must be important (`mb-0!`). */
  readonly className?: string;
};

export function SectionHeader({
  titleId,
  title,
  eyebrow,
  intro,
  introShort,
  introDesktopOnly = false,
  align = "center",
  as = "h2",
  className,
}: SectionHeaderProps) {
  // Two ways to earn the same pair of classes, and only one can be in play:
  // the intro has a `< md` twin to make room for, or the design draws it
  // `≥ md` only. Without either it is one intro on both views.
  const introIsWideOnly = introShort !== undefined || introDesktopOnly;

  return (
    <div
      className={withOverrides(
        "SectionHeader",
        `mb-7 flex flex-col gap-2.5 md:mb-11 md:gap-3 ${ALIGN[align]}`,
        className,
      )}
    >
      {eyebrow === undefined ? null : <Eyebrow>{eyebrow}</Eyebrow>}

      <SectionTitle as={as} id={titleId} size="section">
        {title}
      </SectionTitle>

      {introShort === undefined ? null : <p className={`${INTRO} md:hidden`}>{introShort}</p>}

      {intro === undefined ? null : (
        <p className={`${INTRO} ${introIsWideOnly ? "hidden md:block" : ""}`}>{intro}</p>
      )}
    </div>
  );
}
