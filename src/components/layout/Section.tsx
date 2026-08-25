import type { CSSProperties, ReactNode } from "react";

import { withOverrides } from "@/components/ui/class-names";
import { getSite } from "@/content/site";

/**
 * The one homepage section shell (04 `D-04.3`, INV-04.8).
 *
 * `<section id aria-labelledby data-section>` with the background, padding,
 * scroll snapping and `scroll-margin-top` every section shares, plus the five
 * **role variables** that let the primitives colour themselves without naming a
 * section: `--section-bg`, `--section-accent`, `--section-link`,
 * `--section-link-underline` and `--section-sub`, each pointing at 03 §2.2/§2.3's
 * canonical `--color-<role>-<id>` token. `PhotoSlot` mixes its fill from
 * `--section-bg`; `Eyebrow`, `LearnMoreLink` and `SectionHeader`'s intro read
 * the other three (04 §3.2). No component below this one names a per-section
 * colour.
 *
 * The section ids are **not typed into call sites**: {@link SECTION_IDS} is
 * built from `site.routes[].homeAnchor` (02 `D-02.12`) in scroll order, with
 * the two sections that have no subpage — the hero and the visit block — as its
 * bookends (INV-04.8: "`id` = `site.routes[].homeAnchor` (or `hero`/`visit`)").
 * If an owner renames an anchor in `content/site.json`, {@link toSectionId}
 * throws at import time and the build fails with the offending value, rather
 * than a section silently losing its colours.
 *
 * **`snap-start` names a snap point; it does not create a scroller.** The other
 * half is `html:has([data-snap-root]) { scroll-snap-type: y proximity }` in
 * `src/app/globals.css`, and it is what decides that these sections snap on the
 * home page and nowhere else — the detail pages render the same shell and carry
 * no `data-snap-root`, so `snap-start` there is inert by design (05 §5.8). The
 * two shipped a wave apart and every snap attribute on the site did nothing in
 * between, which is the argument for naming the other half here.
 */

/* -------------------------------------------------------------------------- *
 * Role variables
 * -------------------------------------------------------------------------- */

/** The five role variables `D-04.3` exposes on every section wrapper. */
const ROLE_VARIABLES = {
  "--section-bg": "bg",
  "--section-accent": "accent",
  "--section-link": "link",
  "--section-link-underline": "link-underline",
  "--section-sub": "sub",
} as const;

type RoleVariable = keyof typeof ROLE_VARIABLES;

/**
 * The roles 03 §2.3 prints as "—" for a section, so there is no
 * `--color-<role>-<id>` token to point at. Pointing a role variable at a token
 * that does not exist would make the declaration invalid at computed-value
 * time; leaving it unset lets the property inherit, which is what the design
 * does (the hero badge uses the chip tokens, the testimonial stars use
 * `--color-amber`, and the Visit link carries no underline).
 *
 * The keys of this record are the canonical section-id list of `D-04.3`; the
 * unit test asserts they equal {@link SECTION_IDS}, which is derived from
 * `content/site.json`.
 */
const ROLES_WITHOUT_TOKEN = {
  hero: ["--section-accent"],
  philosophy: [],
  programs: [],
  menu: [],
  gallery: [],
  testimonials: ["--section-accent"],
  teachers: [],
  visit: ["--section-link-underline"],
} as const satisfies Readonly<Record<string, readonly RoleVariable[]>>;

/** A homepage section id — the `id` attribute and the nav/CTA anchor target. */
export type SectionId = keyof typeof ROLES_WITHOUT_TOKEN;

/**
 * The first and last sections, which are the two `D-04.3` names that are not a
 * `site.routes[]` entry: neither has a subpage, so neither can carry a
 * `homeAnchor`. The visit id is also the target of `site.nav.cta.href`.
 *
 * The hero id is exported because it is also the site's **base ground**: its
 * `--color-bg-hero` is the cream 03 §2.2 opens the scroll order with, and it is
 * the palette `SubpageBar` gives a standalone page, which by definition has no
 * origin section to take colours from.
 */
export const HERO_SECTION_ID = "hero" satisfies SectionId;
const VISIT_SECTION_ID = "visit" satisfies SectionId;

function toSectionId(anchor: string): SectionId {
  if (!Object.hasOwn(ROLES_WITHOUT_TOKEN, anchor)) {
    throw new Error(
      `content/site.json names the home anchor "${anchor}", which is not one of ` +
        `04 D-04.3's section ids (${Object.keys(ROLES_WITHOUT_TOKEN).join(", ")}). ` +
        `Adding a section is a change to docs/technical/04-components-sections.md first.`,
    );
  }
  return anchor as SectionId;
}

/**
 * Every section id in scroll order, sourced from `site.routes[].homeAnchor`
 * (02 `D-02.12`) between the two bookends. `page.tsx` and the nav read this;
 * nothing types a section id by hand.
 *
 * A route with **no** `homeAnchor` is a standalone page — `/privacy` — and
 * contributes nothing here: it expands no section, so there is no section for
 * it to name. That is why this is a `flatMap` and not a `map`, and it is what
 * keeps the home page's section list the length of the home page rather than
 * the length of `routes[]`.
 */
export const SECTION_IDS: readonly SectionId[] = [
  HERO_SECTION_ID,
  ...getSite().routes.flatMap((route) =>
    route.homeAnchor === undefined ? [] : [toSectionId(route.homeAnchor)],
  ),
  VISIT_SECTION_ID,
];

/** `style` that also carries CSS custom properties (React writes them through). */
type StyleWithCustomProperties = CSSProperties & Partial<Record<`--${string}`, string>>;

/**
 * The role variables for one section, plus 03 `D-03.11`'s focus-ring
 * re-pointing on the Visit section: forest-on-forest is invisible, so the ring
 * there is `--color-sun`, which 03 §2.4 hands to 04 to scope.
 */
export function sectionRoleVariables(id: SectionId): StyleWithCustomProperties {
  const style: StyleWithCustomProperties = {};
  const missing: readonly RoleVariable[] = ROLES_WITHOUT_TOKEN[id];

  for (const variable of Object.keys(ROLE_VARIABLES) as RoleVariable[]) {
    if (missing.includes(variable)) continue;
    style[variable] = `var(--color-${ROLE_VARIABLES[variable]}-${id})`;
  }

  if (id === VISIT_SECTION_ID) style["--color-focus"] = "var(--color-sun)";

  return style;
}

/* -------------------------------------------------------------------------- *
 * The component
 * -------------------------------------------------------------------------- */

export type SectionProps = {
  /** One of {@link SECTION_IDS}; becomes the `id` and the `data-section` value. */
  readonly id: SectionId;
  /** The `id` of the heading that names this section (INV-04.8). */
  readonly labelledBy: string;
  readonly children: ReactNode;
  /**
   * Decorations (`Sun`, `Leaf`, `ScrollCue`, …). They position themselves
   * against the section box, which is why the shell is `relative`; they render
   * before the content so they cannot take the content's place in the DOM
   * order.
   */
  readonly decor?: ReactNode;
  /**
   * Extra classes on the `<section>` — the gallery's `px` bleed, the hero's own
   * padding. Both of those *replace* a property this recipe sets, so both are
   * written important (`px-0!`); anything the recipe leaves alone is a plain
   * class. See `withOverrides`.
   */
  readonly className?: string;
  /** Extra classes on the centred content container, under the same contract. */
  readonly contentClassName?: string;
};

export function Section({
  id,
  labelledBy,
  children,
  decor,
  className,
  contentClassName,
}: SectionProps) {
  return (
    <section
      id={id}
      data-section={id}
      aria-labelledby={labelledBy}
      style={sectionRoleVariables(id)}
      className={withOverrides(
        "Section",
        `relative snap-start scroll-mt-(--nav-h) bg-(color:--section-bg) px-(--section-px) py-(--section-py)`,
        className,
      )}
    >
      {decor}
      <div
        className={withOverrides(
          "Section's content container",
          `mx-auto w-full max-w-content`,
          contentClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
