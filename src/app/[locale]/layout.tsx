import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import "../globals.css";

import { clientMessages } from "@/i18n/messages";
import { notFound } from "@/i18n/navigation";
import { LOCALE_META, routing } from "@/i18n/routing";

/**
 * The root layout (06 §6.2, 02 `D-02.16`).
 *
 * It sits *inside* `[locale]` because `<html lang>` must be the locale's and
 * Next allows exactly one `<html>` — there is no `src/app/layout.tsx`.
 *
 * PR-3.1 owns only the locale plumbing: `<html lang>`, `generateStaticParams`,
 * the unknown-locale guard and the client provider. Fonts (PR-4.1),
 * `MotionProvider` (PR-4.x), the sticky nav and footer (PR-4.x) and the
 * metadata block (PR-6.8) attach here later.
 */

/**
 * Prerender one tree per **enabled** locale (06 `D-06.4`). Derived from
 * `routing.locales`, so PR-3.9's `zh-Hant` needs no edit here — and neither
 * would removing it again.
 */
export function generateStaticParams(): Array<{ locale: string }> {
  return routing.locales.map((locale) => ({ locale }));
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
  const t = await getTranslations("common");

  return (
    // `data-scroll-behavior="smooth"` is Next's opt-in for smooth scrolling on
    // its own route transitions (05 owns the motion that depends on it).
    <html lang={LOCALE_META[locale].htmlLang} data-scroll-behavior="smooth">
      <body>
        {/* 06 §6.2: the skip link targets the `#main` landmark each page renders. */}
        <a href="#main" className="sr-only focus:not-sr-only">
          {t("a11y.skipToContent")}
        </a>
        {/*
          02 `D-02.16`: a client subtree receives only the namespaces it needs,
          never the whole tree and never `collections.*` wholesale. Everything
          else is rendered by Server Components and reaches the browser as HTML.
        */}
        <NextIntlClientProvider locale={locale} messages={clientMessages(messages)}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
