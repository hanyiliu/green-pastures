"use client";

import { NavLink, type NavLinkItem } from "./PrimaryNav";

/**
 * The footer link list — the six routes plus Contact, on both views
 * (04 §3.1, OQ-04.6's default: the prototype's mobile footer omits Contact and
 * `site.nav.footer[]` carries it, so it renders in both columns).
 *
 * Client for the same reason `PrimaryNav` is, and no other: it needs
 * `usePathname()` to choose between the same-document and cross-page forms of
 * each link (06 `D-06.7`). It reads no messages — `SiteFooter` resolves every
 * label on the server and passes them down (04 `D-04.2`).
 *
 * Colour is `--color-link-visit`, the Visit section's link role, because the
 * footer sits on forest. 03 §10 records the contrast caveat: 5.38:1, AA but not
 * AAA, and OQ-03.2(e) may yet lighten the copyright line to the same value.
 */

export type FooterLinksProps = {
  readonly items: readonly NavLinkItem[];
};

export function FooterLinks({ items }: FooterLinksProps) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 lg:justify-start">
      {items.map((item) => (
        <li key={item.id}>
          <NavLink
            href={item.href}
            className="inline-flex min-h-(--tap-min) items-center font-body text-footer-link font-bold text-link-visit transition-colors duration-(--dur-word-swap) ease-soft hover:text-white"
          >
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
