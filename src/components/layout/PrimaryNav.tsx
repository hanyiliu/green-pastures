"use client";

import type { ReactNode } from "react";

import { Reveal } from "@/components/motion/Reveal";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * The desktop nav link row, and the one place 06 `D-06.7`'s hash-first rule is
 * written down (04 §3.1).
 *
 * **Why this is a client component.** Every nav, footer and sheet link points
 * at a home-page section, and the right markup for that depends on which page
 * the reader is on: a plain `<a href="#philosophy">`, so the browser's own
 * smooth scroll runs, on the home page — and a next-intl `Link` to
 * `{ pathname: '/', hash }` anywhere else, so Next routes first and lands on
 * the anchor. 06 `D-06.7` settles *how* that is detected: on the client, per
 * link list, with `usePathname()`, rather than by threading a prop down from
 * the page. `SiteHeader` and `SiteFooter` stay server components and pass the
 * resolved, serialisable items down (04 `D-04.2`).
 *
 * **{@link NavLink} lives here, and the other two lists import it.** 04 §2
 * gives `components/layout/` a closed list of files and 06 `D-06.7` names three
 * link lists — this one, `FooterLinks`, and the sheet's inside `MobileMenu` —
 * that share exactly one rule. Rather than add a fourth file the component tree
 * does not declare, or copy the rule three times so the third copy can drift,
 * it is exported from the list 06 anchors it to.
 */

/** The internal pathname of the home page — what `usePathname()` returns there. */
const HOME_PATHNAME = "/";

/**
 * The prefix of a home-section href as `content/site.json` spells it and 06
 * `D-06.6` requires — `/#visit`, with no slash before the `#`, because
 * `/#visit` would take a `trailingSlash` 308 first.
 */
const HOME_HASH_PREFIX = "/#";

/**
 * One resolved nav entry. Every field is a string, so the whole array crosses
 * the server/client boundary as plain data (04 `D-04.2`).
 *
 * 04 §3.1 sketches this as `{ id, anchor, label, href }`. The `anchor` field is
 * dropped rather than kept beside `href`: it is the same value spelled twice,
 * and `href` is the spelling `content/site.json` already uses for the entry
 * (`contact` carries `"/#visit"` verbatim), so keeping it is what makes the
 * server side a lookup instead of a translation.
 */
export type NavLinkItem = {
  /** The `site.nav.*[]` id; also the message key segment `common.nav.<id>`. */
  readonly id: string;
  /** The internal href — `/#philosophy` for every entry at launch. */
  readonly href: string;
  /** The label, already read from `common.nav.<id>` on the server. */
  readonly label: string;
};

export type NavLinkProps = {
  /** An internal href. A `/#anchor` form gets 06 `D-06.7`'s two-way treatment. */
  readonly href: string;
  readonly children: ReactNode;
  readonly className?: string;
  /**
   * Fired on click, whatever form the link took. The hamburger sheet uses it to
   * close itself before the browser's scroll or the router navigation runs
   * (06 §6.4).
   */
  readonly onNavigate?: () => void;
};

/**
 * An internal link in whichever of `D-06.7`'s two forms this page calls for.
 *
 * Both forms are real links with a real `href`, so the whole navigation works
 * with JavaScript switched off — the same-document form natively, and the
 * cross-page form as an ordinary `/en#philosophy` request. An href that is not
 * a home anchor (none at launch) falls through to a plain locale-aware `Link`.
 */
export function NavLink({ href, children, className, onNavigate }: NavLinkProps) {
  const pathname = usePathname();
  const anchor = href.startsWith(HOME_HASH_PREFIX) ? href.slice(HOME_HASH_PREFIX.length) : null;

  if (anchor === null) {
    return (
      <Link href={href} className={className} onClick={onNavigate}>
        {children}
      </Link>
    );
  }

  if (pathname === HOME_PATHNAME) {
    return (
      <a href={`#${anchor}`} className={className} onClick={onNavigate}>
        {children}
      </a>
    );
  }

  return (
    <Link
      href={{ pathname: HOME_PATHNAME, hash: anchor }}
      className={className}
      onClick={onNavigate}
    >
      {children}
    </Link>
  );
}

/** The nav link recipe, shared with the sheet's copy of the same list. */
export const NAV_LINK_CLASS =
  "inline-flex min-h-(--tap-min) items-center font-body text-nav font-bold text-nav-link transition-colors duration-(--dur-word-swap) ease-soft hover:text-forest";

export type PrimaryNavProps = {
  readonly items: readonly NavLinkItem[];
};

/**
 * The six primary links, `≥ lg` only (04 `D-04.9` — `SiteHeader` owns the
 * `<nav>` landmark and the breakpoint; this owns the list).
 *
 * Each item is a `Reveal variant="none"`: it has no entrance of its own, which
 * is exactly what registers it as *already revealed* at mount and therefore
 * makes the nav the first thing the locale cascade replays (05 §5.6 — "nav
 * items first … then hero, then the rest in DOM order").
 */
export function PrimaryNav({ items }: PrimaryNavProps) {
  return (
    <ul className="flex items-center gap-6.5">
      {items.map((item) => (
        <Reveal key={item.id} as="li" variant="none" id={`nav.${item.id}`}>
          <NavLink href={item.href} className={NAV_LINK_CLASS}>
            {item.label}
          </NavLink>
        </Reveal>
      ))}
    </ul>
  );
}
