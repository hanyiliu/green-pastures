import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import "../globals.css";

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
      <body className="bg-cream font-body text-body">
        {/*
          02 `D-02.16`: a client subtree receives only the namespaces it needs,
          never the whole tree and never `collections.*` wholesale. Everything
          else is rendered by Server Components and reaches the browser as HTML.
        */}
        <NextIntlClientProvider locale={locale} messages={clientMessages(messages)}>
          <MotionProvider>
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
