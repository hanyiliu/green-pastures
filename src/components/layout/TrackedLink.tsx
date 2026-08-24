"use client";

import type { ReactNode } from "react";

import { NavLink } from "./PrimaryNav";

/**
 * The one analytics `onClick` wrapper (04 `D-04.1`, 07 §4).
 *
 * It exists so that no server component ever grows a handler: `BookTourButton`
 * and `YelpButton` stay server-rendered recipes and hand their label down as
 * `children`, while the single client leaf underneath fires the event. The
 * `yelp_click` caller is `YelpButton` alone — the home testimonials link is an
 * ordinary `LearnMoreLink` to the reviews subpage, and the outbound hop is that
 * page's button. The two names below are 07 §4's whole list for links; the other
 * two events belong to `LangSwitcher` and `InquiryForm`, and the Maps link
 * fires nothing.
 *
 * **Internal links go through {@link NavLink}**, so the "Book a tour" pill
 * obeys 06 `D-06.7` exactly like the nav and footer lists do — the hero and nav
 * CTAs are two of the three surfaces that rule names. External links render a
 * plain `<a target="_blank" rel="noopener noreferrer">`.
 *
 * Keyboard and focus behaviour are the underlying link's; this component adds
 * no accessibility surface of its own (04 §3.1).
 */

/**
 * 07 §4's whole event list. Adding one is a change to that list, not to this
 * file. Two of the five are *link* events and belong to this wrapper
 * ({@link TrackedEvent}); the other three are fired by the component that owns
 * the interaction — `locale_toggle` by `LangSwitcher`, the two inquiry events
 * by `InquiryForm` (04 `D-04.1`).
 */
export type AnalyticsEvent =
  "cta_book_tour" | "yelp_click" | "locale_toggle" | "inquiry_submitted" | "inquiry_failed";

/** The two events a link fires. */
export type TrackedEvent = Extract<AnalyticsEvent, "cta_book_tour" | "yelp_click">;

/**
 * The queue `@vercel/analytics` installs on the page (07 §6, `D-07.13`) — the
 * same call its own `track()` helper makes. It is reached through the global
 * rather than imported because the package is mounted by `<Analytics />`, which
 * is 07's row: until that lands, and on any page where analytics is blocked or
 * disabled, `window.va` is simply absent and this is a no-op. When 07 adds
 * `src/lib/analytics.ts` this function becomes an import from it and nothing
 * else in this file changes.
 */
type AnalyticsQueue = (
  kind: "event",
  properties: { readonly name: string; readonly data?: Readonly<Record<string, string>> },
) => void;

export function track(event: AnalyticsEvent, params?: Readonly<Record<string, string>>): void {
  if (typeof window === "undefined") return;
  const queue = (window as unknown as { va?: AnalyticsQueue }).va;
  queue?.("event", { name: event, data: params });
}

type TrackedLinkBaseProps = {
  readonly event: TrackedEvent;
  /** Event dimensions. Never anything personal (07 §6). */
  readonly params?: Readonly<Record<string, string>>;
  readonly href: string;
  readonly children: ReactNode;
  readonly className?: string;
};

export type TrackedLinkProps = TrackedLinkBaseProps & {
  /** Renders `<a target="_blank" rel="noopener noreferrer">` instead of a `Link`. */
  readonly external?: boolean;
};

export function TrackedLink({
  event,
  params,
  href,
  external = false,
  children,
  className,
}: TrackedLinkProps) {
  const fire = () => {
    track(event, params);
  };

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={fire}>
        {children}
      </a>
    );
  }

  return (
    <NavLink href={href} className={className} onNavigate={fire}>
      {children}
    </NavLink>
  );
}
