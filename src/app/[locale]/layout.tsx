import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import "../globals.css";

import { BackFocus } from "@/components/layout/BackFocus";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/layout/SkipLink";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { fredoka, nunito } from "@/design/fonts";
import { clientMessages } from "@/i18n/messages";
import { notFound } from "@/i18n/navigation";
import { LOCALE_META, routing } from "@/i18n/routing";
import { buildRootMetadata } from "@/lib/seo/metadata";

/**
 * The root layout (06 §6.2, 02 `D-02.16`, 04 §1).
 *
 * It sits *inside* `[locale]` because `<html lang>` must be the locale's and
 * Next allows exactly one `<html>` — there is no `src/app/layout.tsx`.
 *
 * PR-3.1 owned the locale plumbing (`<html lang>`, `generateStaticParams`, the
 * unknown-locale guard, the client provider) and PR-4.1 the font classes;
 * PR-4.5 attaches the rest of 04 §1's stack — `MotionProvider`, `SkipLink`,
 * `SiteHeader`, `{children}`, `SiteFooter`; PR-6.8 added `generateMetadata`,
 * which is the whole of this file's SEO surface (06 `D-06.10`).
 *
 * **`MotionProvider` is mounted here and nowhere else** (05 `D-05.5`). It has
 * to sit above `SiteHeader`, not merely above `{children}`: the nav links are
 * `Reveal variant="none"` and are the *first* entries in the locale cascade
 * (05 §5.6), so they need `LazyMotion`'s features as much as any section does.
 * It stays inside `NextIntlClientProvider` because nothing in it reads a
 * message and the order costs nothing either way.
 *
 * **`<main>` is deliberately absent.** Each `page.tsx` renders its own, so the
 * home page can carry `data-snap-root` and the detail pages cannot (04 §1,
 * 05 §5.8). The skip link targets that landmark by id.
 *
 * **`BackFocus` is here for the one reason a component can need a layout: it
 * has to survive the navigation it acts on** (05 §5.7). It renders nothing. A
 * Back — typed or from the browser's own button — has to leave focus on the
 * origin section's heading, and the page that knows which heading that is has
 * been unmounted by the time the heading exists; a component in the layout is
 * mounted on both sides of the swap and its effect runs after React has
 * committed the arriving page. See `components/layout/heading-focus.ts`.
 */

/**
 * Prerender one tree per **enabled** locale (06 `D-06.4`). Derived from
 * `routing.locales`, so PR-3.9's `zh-Hant` needed no edit here — and neither
 * would removing it again.
 */
export function generateStaticParams(): Array<{ locale: string }> {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * The list above is the whole list (`gp-dln.266`).
 *
 * A `[locale]` value that is not in `generateStaticParams` is refused by the
 * router, before `generateMetadata` or this layout runs. That is not a second
 * spelling of the guard below — it is what makes `/nope.txt` a *real* 404
 * rather than a `notFound()` throw. Dotted paths are excluded from the proxy's
 * matcher (`D-06.5`), so one used to arrive here with `locale = "nope.txt"`,
 * reach the guard, and throw from the layout itself — a throw no boundary in
 * this segment can catch, which Next answers with its recovery shell
 * (`<html id="__next_error__">`, no `lang`, empty body). With no match there is
 * no render, and `src/app/global-not-found.tsx` answers instead.
 *
 * It costs nothing that `D-06.4` was not already paying: every locale is
 * prerendered, so there was never a dynamic `[locale]` to serve. The one price
 * is a log line: Next writes a bare `Error: Internal: NoFallbackError` to
 * stderr for each refused match (measured — one per dotted 404, none for
 * `/{locale}/nope`, which matches no route rather than a refused one). The
 * response is a correct 404 either way; the line is Next's own bookkeeping and
 * carries no request in it, so treat it as noise rather than as an incident.
 */
export const dynamicParams = false;

/**
 * The metadata every page inherits (06 `D-06.10`, `D-06.11`) — `metadataBase`,
 * the `"%s · {brandName}"` title template, the shared social card, the robots
 * and format defaults. Each `page.tsx` adds its own title, description,
 * canonical and `hreflang` set through the same helper.
 *
 * `metadataBase` has to be set here and nowhere else: it is what lets every
 * page return a *relative* canonical and still emit an absolute URL, and a
 * relative canonical without it is a build error rather than a warning.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // Same guard as the layout body: `generateMetadata` runs first, so an unknown
  // prefix that reached here would index `LOCALE_META` with a key it has not
  // got before `notFound()` ever ran.
  if (!hasLocale(routing.locales, locale)) notFound();

  return buildRootMetadata(locale);
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // The proxy redirects unknown prefixes before they reach this layout; the
  // guard catches a locale that arrives another way — a direct RSC request, a
  // stale prefetch — so nothing ever renders with an unknown `lang`.
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = await getMessages();

  return (
    // The two `variable` classes are what makes `src/design/fonts.ts` reach the
    // page: next/font declares `--font-fredoka` / `--font-nunito` *only* on the
    // element carrying them, and `src/styles/tokens.css` §3.1 reads both from
    // `:root` — so `<html>` is the one element they can sit on (03 §3.1, 06
    // §6.2). Drop them and `--font-display` / `--font-body` fall straight
    // through to `--font-cjk`, the system stack: legible, and not the brand.
    //
    // `data-scroll-behavior="smooth"` is Next's opt-in for smooth scrolling on
    // its own route transitions (05 owns the motion that depends on it).
    <html
      lang={LOCALE_META[locale].htmlLang}
      className={`${fredoka.variable} ${nunito.variable}`}
      data-scroll-behavior="smooth"
    >
      {/*
        The page column, and the only reason `<body>` carries layout at all.

        `min-h-dvh` + `flex flex-col` is the sticky-footer pattern: the page
        element between `SiteHeader` and `SiteFooter` is the flex item that
        grows, so a document shorter than the viewport puts the footer on the
        window's bottom edge instead of leaving `--color-cream` — a near-white
        — under it. It showed on the detail pages, whose panel is a colour of
        its own: a *wide* window is what makes them short, because the content
        column stops wrapping, and the band below the footer read as a hole in
        a page that had painted its own ground. Measured at 2560×1200 before
        this, `/en/menu` ended 258px above the bottom of the window.
        `SubpageBar` writes the `grow` half; see its `PANEL`.

        **It is unconditional, and that was measured rather than assumed.** The
        home page is 6681px tall and never reaches `min-height`, but
        `display: flex` re-lays its sections out as flex items, and a subpixel
        shift there would move `@visual` baselines this change has no business
        touching. So it was run alone in the pinned Playwright image — this
        class list, the hero otherwise untouched — against the Visit section's
        six success-panel baselines, which are the ones that turned out most
        sensitive to anything moving above them on this page. All six pass. A
        `body:has([data-subpage])` guard would buy nothing, and the classes
        stay where every other class name in this repository lives.

        `dvh` rather than `vh` for the reason `gallery/layout.ts` gives about
        the lightbox: `100vh` is a mobile browser's *tall* viewport, so it
        would put a scrollbar on every short page while the URL bar is showing.
      */}
      <body className="flex min-h-dvh flex-col bg-cream font-body text-body">
        {/*
          02 `D-02.16`: a client subtree receives only the namespaces it needs,
          never the whole tree and never `collections.*` wholesale. Everything
          else is rendered by Server Components and reaches the browser as HTML.
        */}
        <NextIntlClientProvider locale={locale} messages={clientMessages(messages)}>
          <MotionProvider>
            <BackFocus />
            <SkipLink />
            <SiteHeader />
            {children}
            <SiteFooter />
          </MotionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
