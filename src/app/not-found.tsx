import { getTranslations } from "next-intl/server";

import { getPathname } from "@/i18n/navigation";
import { LOCALE_META, routing } from "@/i18n/routing";

import "./globals.css";

/**
 * The root 404 — the one page that renders outside every locale (02 *Design →
 * Routing*: "Unknown-locale 404 renders the root `not-found` in `en`").
 *
 * It answers the requests that resolve to no route inside `[locale]` at all: a
 * path with a dot that the proxy's matcher excludes (`/nope.txt`, an asset
 * typo), and any URL whose first segment reaches the layout guard, which calls
 * `notFound()` from the layout itself — a throw its own segment cannot catch,
 * so the boundary above it, this file, renders. Those requests have no locale:
 * no `[locale]` segment above this file, and therefore no layout, no
 * `NextIntlClientProvider` and no root param. Every line below follows from
 * that.
 *
 * - **The reference locale is named explicitly.** `getTranslations({ locale })`
 *   takes `request.ts`'s first branch, so `next/root-params` is never consulted
 *   from a render that has no root param to consult. `en` here is the reference
 *   locale, not a branch on the reader's (INV-02.9 holds), and it is read from
 *   `routing.defaultLocale` rather than written out.
 * - **No `<html>`/`<body>` of its own.** 06 §6.2 puts the only root layout
 *   inside `[locale]`, so this route has none — and Next 16 supplies its own
 *   `DefaultLayout` (`<html><body>{children}</body></html>`) for exactly that
 *   case. Rendering a second pair here nests `<html>` inside `<body>`
 *   (measured: two `<html>` tags in the response). The document's `lang` is
 *   therefore Next's to emit and it emits none; `lang` on the `<main>` is the
 *   honest declaration this file can make, and it goes away when
 *   `experimental.globalNotFound` stabilises and D-06.14 turns it on.
 * - **The CTA is an `<a>`, not next-intl's `Link`.** `Link` renders a client
 *   component that calls `useLocale()`; with no provider above it that throws
 *   `No intl context found` — a 500 where a 404 belongs (measured: with `Link`
 *   here, `/en/nope` returned 500). The href still comes from the navigation
 *   module rather than from a hand-built string, so INV-02.7 holds and the
 *   prefix follows the routing config.
 *
 * A `/{locale}/nope` URL stops reaching this file once PR-6.1's `[...rest]`
 * catch-all exists: that route calls `notFound()` inside the segment, which
 * `[locale]/not-found.tsx` catches and renders in the reader's own locale
 * (06 §6.7). Until then every unmatched path lands here, in `en`.
 */
export default async function RootNotFound() {
  const t = await getTranslations({
    locale: routing.defaultLocale,
    namespace: "errors",
  });
  const homeHref = getPathname({ locale: routing.defaultLocale, href: "/" });

  return (
    <main id="main" lang={LOCALE_META[routing.defaultLocale].htmlLang}>
      <h1>{t("notFound.title")}</h1>
      <p>{t("notFound.body")}</p>
      <a href={homeHref}>{t("notFound.cta")}</a>
    </main>
  );
}
