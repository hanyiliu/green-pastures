import type { Metadata } from "next";
import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { fredoka, nunito } from "@/design/fonts";
import { getPathname } from "@/i18n/navigation";
import { LOCALE_COOKIE_NAME, LOCALE_META, routing, type Locale } from "@/i18n/routing";

import "./globals.css";

/**
 * The 404 — the whole document, rendered on the server (06 `D-06.14`, §6.7,
 * INV-06.6).
 *
 * ── What this file replaces, and the measurement that forced it ──────────
 *
 * Until `gp-dln.266` the 404 was `app/[locale]/[...rest]/page.tsx` calling
 * `notFound()` and `app/[locale]/not-found.tsx` catching it. That renders
 * correctly in a browser and **not at all** in the response: React cannot run an
 * error boundary in the SSR shell, so Next abandons the shell and emits its
 * recovery document — `<html id="__next_error__">`, no `lang`, an empty
 * `<body>` — with the real tree left in the inlined Flight payload for the
 * client to mount. Measured against `next start`, Next 16.3.2:
 *
 *   `/en/no-such-page` → 22 604 bytes, `<html id="__next_error__">`,
 *   body `<div hidden></div>` and nothing else, two `<meta name="robots">`
 *   (Next's `noindex` plus the layout's `index, follow`).
 *
 * It is not this repository's doing and no configuration turns it off: a
 * pristine Next 16.3.2 app with a root layout and a root `not-found.tsx` emits
 * the same shell for a `notFound()` thrown from any segment, static or dynamic,
 * with `cacheComponents` on or off. Wrapping the throw in a `Suspense` does
 * change it — into a **200** with the fallback, which is worse and is what
 * INV-06.6's "no `loading.tsx` above a `not-found`" already forbids. The one
 * 404 Next renders as real HTML is the route it serves when a URL matches
 * *nothing*, and this file is that route's document.
 *
 * ── How every unknown path reaches here ─────────────────────────────────
 *
 * Two changes put every 404 on the no-match path, so none of them is a throw:
 *
 *  - the `[...rest]` catch-all is gone, so `/{locale}/nope` matches no route;
 *  - `app/[locale]/layout.tsx` sets `dynamicParams = false`, so `/nope.txt` —
 *    a dotted path the proxy's matcher excludes, which used to enter `[locale]`
 *    with `locale = "nope.txt"` and hit the layout's own guard — is now refused
 *    by the router before any component runs.
 *
 * `experimental.globalNotFound` in `next.config.ts` is what lets this file own
 * the document. It is experimental in 16.3.2 and it is the only thing that
 * makes INV-06.6's "correct `lang`" true, which is why `D-06.14` now turns it
 * on. **`app/not-found.tsx` must not exist beside it**: measured, Turbopack
 * prefers a root `not-found.tsx` and this file is never bundled while one is
 * there — the flag goes on, the build says `✓ globalNotFound`, and nothing
 * changes.
 *
 * ── Why it is a whole document, and what it deliberately leaves out ──────
 *
 * `global-not-found` renders outside every layout, so the `<html>`, the `lang`,
 * the font variables and `globals.css` are this file's to emit — 06 §6.2's "one
 * root layout" is unaffected, because this route has no layout at all rather
 * than a second one. What it does not get is the chrome: `SiteHeader` and
 * `SiteFooter` read messages through the provider the locale layout mounts, and
 * dragging that plus `MotionProvider` onto the 404 would ship the whole client
 * runtime to the one page nobody should reach. A reader who lands here gets the
 * panel and a link home, in their own locale, with JavaScript off.
 *
 * ── Where the locale comes from ─────────────────────────────────────────
 *
 * There is no `[locale]` segment above this file and no root param to read, so
 * the reader's locale comes from the cookie next-intl's proxy has already
 * written for this very request (`D-06.5`; measured: `/zh-Hans/no-such-page`
 * answers with `set-cookie: NEXT_LOCALE=zh-Hans`, and Next feeds a
 * proxy-written cookie back into `cookies()` for the same render). A cookie
 * naming anything that is not an enabled locale — a dotted path the proxy never
 * saw, a stale id from before `D-10.12`, a hand-edited value — falls back to
 * the reference locale, which is 02's "unknown-locale 404 renders in `en`".
 *
 * That `cookies()` call is what makes `/_not-found` the build's one `ƒ Dynamic`
 * route. INV-06.7 permitted exactly one such route before this change and still
 * does; it is this one now instead of the catch-all, for the same reason — it
 * exists only to 404.
 *
 * No canonical and no `hreflang` (06 §6.7): a 404 is not a page and has no
 * locale variants worth advertising. `noindex` is Next's own, injected for any
 * response over 400, and this file adds no `robots` of its own — which is why
 * the two conflicting `robots` metas are down to the one that is true.
 */

/** The reader's locale, or the reference locale when the cookie says nothing. */
async function readerLocale(): Promise<Locale> {
  const cookie = (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
  return hasLocale(routing.locales, cookie) ? cookie : routing.defaultLocale;
}

/**
 * `errors.meta.*`, and nothing else.
 *
 * No `metadataBase` (nothing here is a relative URL), no title template (the
 * layout that owns it is not above this route), no `robots` — see the header.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await readerLocale();
  const t = await getTranslations({ locale, namespace: "errors" });

  return { title: t("meta.title"), description: t("meta.description") };
}

export default async function GlobalNotFound() {
  const locale = await readerLocale();
  const t = await getTranslations({ locale, namespace: "errors" });
  // A plain `<a>`, not next-intl's `Link`: that is a client component calling
  // `useLocale()`, and with no `NextIntlClientProvider` above it here it throws
  // `No intl context found` — a 500 where a 404 belongs. The href still comes
  // from the navigation module, so INV-02.7 holds and the prefix follows the
  // routing config.
  const homeHref = getPathname({ locale, href: "/" });

  return (
    <html lang={LOCALE_META[locale].htmlLang} className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="bg-cream font-body text-body">
        <main id="main">
          <h1>{t("notFound.title")}</h1>
          <p>{t("notFound.body")}</p>
          <a href={homeHref}>{t("notFound.cta")}</a>
        </main>
      </body>
    </html>
  );
}
