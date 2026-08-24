import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";

import { withOverrides } from "@/components/ui/class-names";
import { getSite } from "@/content/site";

import { BackLink } from "./BackLink";
import { HERO_SECTION_ID, SECTION_IDS, sectionRoleVariables, type SectionId } from "./Section";
import { subpageTitleId, type SubpageNamespace } from "./SubpageHeader";

/**
 * The detail-page shell: the tinted panel, the sticky bar that carries the
 * "← Back" pill and the page's kicker, and the `<main>` landmark the page's
 * content goes in (04 §1, §3.1; desktop reference L349–353, mobile L257–260).
 *
 * ── Why this component wraps the whole page ──────────────────────────────
 *
 * 04 §1 spells the six detail pages as one nesting chain — `PageTransition` →
 * `SubpageBar` → `<main id="main">` → `SubpageHeader` + the composites — read
 * exactly as the home page's chain beside it. So `SubpageBar` is the element
 * between the transition and the landmark, and it has to be: `PageTransition`
 * snapshots a **single** element (a fragment of siblings gives the browser
 * several boxes to name and the slide stops meaning anything), and the panel's
 * background and 04 `D-04.3` role variables have to sit on a box that contains
 * both the bar and the content, or the six pages each repeat them. 06 §6.2
 * calls the same thing `SubpageShell`; 04 §2 owns the file tree and names it
 * `SubpageBar`, which is the name kept here.
 *
 * **It renders `<main id="main">` rather than leaving it to the page.** 04 §1
 * keeps `<main>` out of `app/[locale]/layout.tsx` for one stated reason — the
 * home page carries `data-snap-root` and the detail pages must not — and that
 * reason is about the *layout*, which is shared with the home page. A shell
 * only detail pages use reintroduces nothing, and it makes the skip link's
 * target impossible for six separate pull requests to forget.
 *
 * ── The bar ─────────────────────────────────────────────────────────────
 *
 * Sticky at `--nav-h`, not at 0: the prototype's panel is an overlay under
 * fixed chrome, while in production `SiteHeader` is a `sticky top-0` element
 * `--nav-h` tall, so the second sticky bar has to start where the first ends
 * (04 §3.1, "sticky under the header"). It sits at `z-40`, below the header's
 * `z-50`.
 *
 * The tint is the page's own section background at 94 %, with `blur(6px)`
 * behind it — 03 §2.4's `--color-nav-bg` recipe applied to a colour that
 * changes per page. It rides an `absolute` sibling of the row rather than the
 * row itself, which is `SiteHeader`'s pattern and for its reason:
 * `backdrop-filter` makes an element the containing block for every `fixed`
 * descendant, and keeping it off the bar keeps the bar out of anything's
 * positioning chain.
 *
 * ── The back label ──────────────────────────────────────────────────────
 *
 * "← Back home" `≥ md` and "← Back" below it, from `common.back.label` and
 * `common.back.labelShort`. Both strings render and `md:` picks one
 * (`D-04.5`) — the view is never a branch in code. The `←` lives inside the
 * translated string (02 §5.4); nothing here appends a glyph.
 */

/** `style` that also carries CSS custom properties (React writes them through). */
type StyleWithCustomProperties = CSSProperties & Partial<Record<`--${string}`, string>>;

/**
 * The kicker's type size — Fredoka 600 at 16px `< md` and 17px `≥ md` (mobile
 * L260, desktop L352).
 *
 * It has no token: 03 §3.2 has no row for the subpage bar at all. The two sizes
 * are two custom properties rather than one value because the views differ and
 * a `md:` toggle cannot read an inline style (`D-04.5`: the view is never a
 * branch in code). They are declared on the bar row and inherit down to the
 * kicker. See `BackLink.tsx` for the same note about the pill's 12/13px, and
 * this row's report for the request back to 03.
 */
const BAR_TYPE: StyleWithCustomProperties = {
  "--subnav-kicker": "16px",
  "--subnav-kicker-md": "17px",
};

/**
 * The bar's blur, which 03 §2.4 leaves to 04 explicitly ("the `blur(6px)`
 * beside it is a component style"). `SiteHeader` writes the same value the same
 * way and for the same stated reason: there is no blur token to bind and
 * Tailwind's scale has no 6px step.
 */
const BAR_BLUR: CSSProperties = {
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
};

/**
 * Bar geometry. The design's own numbers on Tailwind's `--spacing` scale
 * (18px = `4.5`, 28px = `7`, 10px = `2.5`, 14px = `3.5`), which is how 03 §4
 * geometry reaches a component — those values are comments in
 * `src/styles/tokens.css`, not tokens (INV-03.5).
 *
 * The vertical padding is the one number that is not the drawing's. The design
 * pads 11px / 13px around a 34px pill, for a 56px / 60px bar; INV-04.7 makes
 * the pill's *hit area* 44px, so the padding is set against that box instead
 * and the bar keeps the height it is drawn at. The drawn pill is unchanged —
 * `BackLink` puts it on an inner span.
 */
const BAR =
  "sticky top-(--nav-h) z-40 flex items-center gap-2.5 px-4.5 py-1.5 shadow-subnav md:gap-3.5 md:px-7 md:py-2";

/**
 * The content column: 24px/22px/48px of padding and an 18px gap below `md`,
 * 36px/44px/60px and 28px above it (mobile L261, desktop L353).
 *
 * `max-w-content` is the shared 1080px cap. The references draw a narrower
 * column per page — 940px on Philosophy, 880px on Programs — which is that
 * page's config, not the shell's: a page passes `contentClassName="max-w-235!"`
 * (235 × 4px = 940px, so no arbitrary value is needed) exactly as a home
 * `Section` overrides its own container.
 */
const CONTENT =
  "mx-auto flex w-full max-w-content flex-col gap-4.5 px-5.5 pt-6 pb-12 md:gap-7 md:px-11 md:pt-9 md:pb-15";

/** The bar's kicker — Fredoka 600 on `--color-ink`. */
const KICKER =
  "font-display text-(length:--subnav-kicker) font-semibold text-ink md:text-(length:--subnav-kicker-md)";

/**
 * The palette of the page's origin section — or, for a **standalone** route,
 * the site's base ground.
 *
 * Six of the seven routes expand a home section and wear its colours. A route
 * with no `homeAnchor` expands nothing (`/privacy`), so there is no section to
 * borrow from and the panel takes `hero`: 03 §2.2's first row, the cream the
 * site opens on, with a full set of link and subhead tokens behind it. It is
 * the only choice here that invents no colour — every other section id is
 * already spoken for by the page that expands it.
 */
function toSectionId(homeAnchor: string | undefined): SectionId {
  if (homeAnchor === undefined) return HERO_SECTION_ID;

  const sectionId = SECTION_IDS.find((id) => id === homeAnchor);

  if (sectionId === undefined) {
    throw new Error(
      `SubpageBar resolved the home anchor "${homeAnchor}", which is not one of 04 D-04.3's ` +
        `section ids (${SECTION_IDS.join(", ")}). The anchor comes from ` +
        `content/site.json routes[].homeAnchor (02 D-02.12).`,
    );
  }

  return sectionId;
}

export type SubpageBarProps = {
  /**
   * The page's `site.routes[]` id, which is also its message namespace —
   * `philosophy`, `programs`, `menu`, `gallery`, `reviews`, `team`.
   */
  readonly routeId: SubpageNamespace;
  /** The page's content: `SubpageHeader` and the composites of 04 §3.6. */
  readonly children: ReactNode;
  /** Extra classes on the panel, under `withOverrides`' contract. */
  readonly className?: string;
  /** Extra classes on the centred content column, under the same contract. */
  readonly contentClassName?: string;
  /**
   * Custom properties for the centred content column.
   *
   * A page whose blocks are sized by properties 03 mints no token for — the
   * Menu page's table, cards and note — declares them once here and lets them
   * inherit, rather than repeating a `style` on every block that reads them
   * (and, for a list, on every item). It is the column and not the panel
   * because these are the *content's* numbers; the panel's own two pairs are
   * this file's.
   */
  readonly contentStyle?: StyleWithCustomProperties;
};

export function SubpageBar({
  routeId,
  children,
  className,
  contentClassName,
  contentStyle,
}: SubpageBarProps) {
  const t = useTranslations();
  const common = useTranslations("common");

  const route = getSite().routes.find((entry) => entry.id === routeId);

  if (route === undefined) {
    throw new Error(
      `SubpageBar was given the route id "${routeId}", which content/site.json does not ` +
        `declare in routes[] (02 D-02.12). The reserved namespaces — faq, visit — carry a ` +
        `kicker but no route until their page ships (D-02.17).`,
    );
  }

  const sectionId = toSectionId(route.homeAnchor);

  return (
    <div
      data-subpage={routeId}
      style={sectionRoleVariables(sectionId)}
      className={withOverrides("SubpageBar", `bg-(color:--section-bg)`, className)}
    >
      <div className={BAR} style={BAR_TYPE}>
        {/*
          The tint and the blur, on their own layer — see the note above. It is
          `aria-hidden` and empty: it paints, and nothing else. `opacity-94` on
          a solid fill is the design's `rgba(…, .94)`, written without naming a
          colour (INV-03.1) so the page's own `--section-bg` carries through.
        */}
        <div
          aria-hidden="true"
          style={BAR_BLUR}
          className="absolute inset-0 -z-10 bg-(color:--section-bg) opacity-94"
        />

        <BackLink homeAnchor={route.homeAnchor} titleId={subpageTitleId(routeId)}>
          <span className="md:hidden">{common("back.labelShort")}</span>
          <span className="hidden md:inline">{common("back.label")}</span>
        </BackLink>

        <span className={KICKER}>{t(`${routeId}.kicker`)}</span>
      </div>

      <main
        id="main"
        style={contentStyle}
        className={withOverrides("SubpageBar's content column", CONTENT, contentClassName)}
      >
        {children}
      </main>
    </div>
  );
}
