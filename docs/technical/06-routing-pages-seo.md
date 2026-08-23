# 06 · Routing, pages, navigation & SEO

## Purpose

This document fixes the URL space of the Green Pastures site and everything that hangs off it: the route set per
locale and the `app/` file tree that produces it, the rendering mode of every route, the locale proxy
(`src/proxy.ts`) and the single routing source (`src/i18n/routing.ts`), in-page navigation (sticky nav anchors,
hamburger, "learn more →" / "← Back" between the home page and the detail pages, the EN ↔ 中文 switcher), the
per-route per-locale metadata (`<title>`, description, canonical, `hreflang`, Open Graph), sitemap, robots,
structured data, 404/500 handling, the routing-level performance and caching rules, and what 08 must test. It
implements `D-02.9` / `D-02.10` (02 owns the locale mechanism and the strings), consumes 05's View-Transition
decision (`D-05.10`) and 07's endpoint requirements, and invents no copy: every visible string named here is a 02
key. Claims about Next.js 16.3 / next-intl 4.13 are `[verified: docs, 2026-08-22]` unless labelled
`[assumed — spike]`.

Status: draft · seat writer-routing · 2026-08-22

## Decisions

- **D-06.1 Route set.** Launch routes per locale: `/` (home, eight sections), `/philosophy`, `/programs`,
  `/menu`, `/gallery`, `/reviews`, `/team` (the six detail pages of `D-02.17`). Reserved, not built until the
  human answers: `/enroll` (Enrollment page — name decided in OQ-06.1), `/faq` (OQ-02.7 / gp-dln.6), `/privacy`
  (OQ-07.5). Locale-agnostic routes: `/` (redirect only), `/api/inquiry`, `/sitemap.xml`, `/robots.txt`,
  `/manifest.webmanifest`, file-based icons. Nothing else exists; unknown paths are real 404s (§6.7).
- **D-06.2 English slugs in every locale — no localised pathnames.** `/zh/philosophy`, not `/zh/教学理念` or
  `/zh/jiaoxue-linian`. next-intl's `pathnames` option is not used at launch (justification §6.3); the slug set
  lives once in `content/site.json.routes[].path` (`D-02.12`) and `src/i18n/routing.ts` stays locale-list-only.
  Reversible: adding `pathnames` later changes only `zh` URLs and needs a redirect map.
- **D-06.3 Explicit folders, no `[slug]` page.** Each detail page is its own folder under `app/[locale]/`
  (`philosophy/page.tsx`, …) because each has a distinct composition (04) and metadata; a `[slug]` page would
  move the route set into runtime data and lose per-page typing. One catch-all `app/[locale]/[...rest]/page.tsx`
  exists only to turn unknown paths into a localised 404.
- **D-06.4 Rendering mode.** Every page is prerendered at build time per locale: `generateStaticParams` over
  `routing.locales` in `app/[locale]/layout.tsx` and locale resolution via `next/root-params` in
  `src/i18n/request.ts` (next-intl's Next 16.3 recipe; `setRequestLocale` is the legacy API) `[verified]`.
  No ISR, no `dynamic` overrides, no request-time APIs in pages/layouts. The only Functions are the proxy and
  `POST /api/inquiry`; `sitemap.ts`, `robots.ts` and `manifest.ts` are cached Route Handlers. **One exception
  to "static":** `app/[locale]/[...rest]/page.tsx` is a catch-all with no enumerable params, so `next build`
  marks it `ƒ Dynamic` and renders it on demand. That is by construction (it exists only to 404) and it is the
  only dynamic page; every gate that asserts "all static" exempts it by name (INV-06.7, §6.10).
  `output: 'export'` is never set (ADR-007, memo ADJ-2).
- **D-06.5 Proxy.** `src/proxy.ts` = `createMiddleware(routing)` from `next-intl/middleware`, default export,
  matcher `'/((?!api|_next|_vercel|.*\\..*).*)'`. It negotiates the locale for unprefixed paths (prefix →
  `NEXT_LOCALE` cookie → `Accept-Language` → `en`, next-intl's order `[verified]`), 307-redirects them to the
  prefixed URL, and never touches prefixed URLs. Detection stays **on**: `localeDetection` is left at its
  default `true`, matching 02's Routing section ("Detection on the bare root is on (decided here; the
  next-intl default)"). `localeDetection: false` is the single named knob if the owner ever wants `/` → `/en`
  for every visitor regardless of header or cookie — it restricts negotiation to prefix and domain, and it is
  the only supported way to get that behaviour `[verified]`. The cookie is **not** refreshed on every request:
  next-intl's `syncCookie` writes `NEXT_LOCALE` only when the resolved locale differs from the
  `Accept-Language` best fit (i.e. after an explicit switch) `[verified: middleware source]`.
  `alternateLinks: false` (02). Node runtime (Next 16 default; `runtime` config is not allowed in proxy files
  `[verified]`).
- **D-06.6 Anchors are data.** Home section ids are `site.json.routes[].homeAnchor` plus `nav.cta.href`
  (`#visit`): `#philosophy #programs #menu #gallery #reviews #teachers #visit`; `#main` is the skip-link target.
  Nav links, footer links, hero CTAs, the scroll cue, "← Back" and 05's slide all read this mapping; no component
  spells an anchor or a path. Cross-page hash targets have exactly one form, built by one helper
  `homeHref(anchor) = { pathname: '/', hash: anchor }` handed to next-intl's `Link` / `useRouter`, which
  prefixes the pathname and re-appends the hash → `/en#philosophy`. There is no slash before the `#`:
  `/en/#philosophy` would 308 to `/en#philosophy` first (`trailingSlash: false`, §6.1), costing a hop on every
  hard load and on 07's 303 fallback. Whether the string form `'/#id'` already normalises to the same result is
  `[assumed — spike: next-intl href normalisation]`; the object form is the default because it does not depend
  on that.
- **D-06.7 Home navigation is hash-first.** On the home page the sticky nav, hero CTAs and footer links are
  plain `<a href="#id">` anchors (same document, smooth CSS scroll, `scroll-margin-top: var(--nav-h)`,
  `D-05.11`). From a detail page the same links are next-intl `Link href={homeHref(id)}` (a router navigation;
  Next lands on the id instantly because `data-scroll-behavior="smooth"` disables smooth scroll during router
  navigations). **How the surface is detected:** on the client, per link list, not by a prop threaded down from
  the page. `PrimaryNav`, `FooterLinks` and the mobile sheet's link list are `'use client'` and call
  `usePathname()` from `src/i18n/navigation` — it returns the prefix-less internal pathname, so the home page is
  exactly `'/'` — and pick the form per item. `SiteHeader` and `SiteFooter` stay server components (04 §5) and
  pass the resolved `{ id, anchor, label, href }[]` down as serialisable props, so no translation or content
  read moves to the client. This contradicts 04's current `S` kind for `PrimaryNav` / `FooterLinks`;
  requirement to 04 in §6.12.
- **D-06.8 Detail ↔ home.** "learn more →" = `Link href={route.path} transitionTypes={['subpage-enter']}` (push,
  scroll to top). "← Back" = `router.replace(homeHref(route.homeAnchor), { transitionTypes: ['subpage-exit'] })`
  (`D-05.10`, `homeHref` per `D-06.6`). Browser back/forward are untyped (instant swap, scroll restored by
  Next). next-intl's `Link` spreads unknown props onto `next/link`, so `transitionTypes` passes through
  `[verified: BaseLink source]`; the spike in 10 (OQ-05.2 f) still exercises it end to end.
  **This closes `OQ-05.5`** (05 addresses it to "02 · 06" and 05 §5.7 says "06 confirms"): 06 confirms the
  detail ↔ home-section id mapping of `D-06.6` and accepts typed `replace` **with 05's stated trade-off** —
  `replace` leaves history as `[home, home#section]` (the detail entry is overwritten, so browser Back from
  there goes to the original home entry, never back into the detail page) and lands the user on the section's
  **snap point**, not the exact scroll offset they left from. `router.back()` would restore the offset but
  cannot carry `transitionTypes`, which loses the slide-out; the design's slide-out wins.
- **D-06.9 Language switcher.** A next-intl `Link` to the same internal pathname with `locale={other}` whose
  click handler runs `router.replace(pathname + search + hash, { locale, scroll: false, transitionTypes:
  ['locale-swap'] })` (`D-02.10`, §5.6). Path, query and hash are preserved; the `NEXT_LOCALE` cookie is written
  client-side by next-intl on click `[verified: BaseLink]`; on a 404 page it targets the same unknown path in the
  other locale (also 404). `<html lang>` = `LOCALE_META[locale].htmlLang`, `dir` = `LOCALE_META[locale].dir`.
- **D-06.10 Metadata.** `app/[locale]/layout.tsx` sets `metadataBase`, `title.default`/`title.template`
  (`common.meta.siteName`, `common.meta.titleTemplate`), `openGraph.siteName/locale/alternateLocale`, `robots`
  defaults and the shared OG image; every `page.tsx` exports `generateMetadata` returning `title`,
  `description`, `alternates.canonical`, `alternates.languages` (every locale's `hreflang` + `x-default` → the
  `en` URL) and the OG/Twitter copy — all from `<page>.meta.*` (`D-02.4` rule 7) via one helper
  `src/i18n/metadata.ts`. The home title is absolute; detail titles use the template.
- **D-06.11 One origin, with a fallback chain.** The production origin is `NEXT_PUBLIC_SITE_URL` (07 §5),
  parsed once in `src/config/site-url.ts`; it feeds `metadataBase`, the sitemap, robots, JSON-LD and 07's
  origin check. Because a relative `canonical`/`languages` value with an undefined `metadataBase` is a **build
  error** (Next docs `[verified]`), the variable is never simply "required": `src/config/site-url.ts` resolves
  `NEXT_PUBLIC_SITE_URL` → `https://${VERCEL_PROJECT_PRODUCTION_URL}` → `https://${VERCEL_URL}` →
  `http://localhost:3000`, parses the winner with `new URL()` and exports a frozen `URL`. 09 therefore only
  sets it in the Production scope (09 §2 already does); Development and Preview resolve from the chain, and a
  preview's canonicals pointing at the preview host is harmless because previews are `noindex` (`D-06.12`).
  `site.json.brand.url` (02) is redundant and should be dropped (requirement to 02, §6.12). www vs apex and the
  real domain are OQ-06.2; default: apex canonical, `www` → apex at the Vercel domain level — 09 `D-09.5`
  records the same default and implements it.
- **D-06.12 Sitemap and robots.** One `app/sitemap.ts` lists every launch route × locale (14 URLs at launch)
  with `alternates.languages` (`en`, `zh-Hans`, `x-default`) built from `site.json.routes[]` +
  `routing.locales` + `getPathname`; no `lastModified`/`priority`/`changeFrequency` (a build timestamp is not a
  content date). `app/robots.ts`: allow `/`, `Disallow: /api/`, `sitemap` URL. Preview deployments are
  `noindex` by Vercel's automatic `X-Robots-Tag` header (custom preview domains excepted — 09) `[verified]`.
- **D-06.13 Structured data.** The home page emits one `ChildCare` JSON-LD object (schema.org subtype of
  `LocalBusiness`) per locale from `site.json` + `home.meta.description`; no `aggregateRating`/`review` (Google
  forbids self-serving review markup); Yelp and social URLs go in `sameAs`. Owner facts are required
  (gp-dln.13, **OQ-06.9**) — the release gate fails while any is `TODO`.
- **D-06.14 Errors.** `app/[locale]/not-found.tsx` (localised, `errors.notFound.*`), `app/[locale]/error.tsx`
  (client, `errors.serverError.*` via `NextIntlClientProvider`), `app/[locale]/global-error.tsx` (own
  `<html lang="en">`, statically imported `en` messages). Unknown locale prefixes are not locales: the proxy
  treats `/fr/x` as an unprefixed path and redirects to `/{detected}/fr/x`, which the catch-all turns into a
  localised 404 (status 404). `experimental.globalNotFound` is not enabled; paths with a dot that bypass the proxy
  and match nothing (asset typos) get Next's built-in 404. No `loading.tsx` anywhere (keeps 404 status real).

## Design

### 6.1 Route inventory

`{l}` ranges over `routing.locales` (`en`, `zh` at launch); "static" = prerendered HTML + RSC payload at build.

| URL | Kind · mode | Source file | Notes |
|---|---|---|---|
| `/` | proxy redirect 307 | `src/proxy.ts` | → `/{detected}` (prefix → cookie → `Accept-Language` → `en`); detection on, per 02 Routing (`localeDetection` default; `D-06.5`) |
| `/{l}` | page · static | `app/[locale]/page.tsx` | home; ids from `site.json.routes[].homeAnchor` + `#visit`; JSON-LD |
| `/{l}/philosophy` | page · static | `app/[locale]/philosophy/page.tsx` | `homeAnchor` `#philosophy` |
| `/{l}/programs` | page · static | `app/[locale]/programs/page.tsx` | `#programs` |
| `/{l}/menu` | page · static | `app/[locale]/menu/page.tsx` | `#menu` |
| `/{l}/gallery` | page · static | `app/[locale]/gallery/page.tsx` | `#gallery` |
| `/{l}/reviews` | page · static | `app/[locale]/reviews/page.tsx` | `#reviews` |
| `/{l}/team` | page · static | `app/[locale]/team/page.tsx` | `#teachers` (`D-02.12`) |
| `/{l}/enroll` | page · static · **reserved** | `app/[locale]/enroll/page.tsx` | Enrollment page, `visit.*` namespace; name per OQ-06.1 |
| `/{l}/faq` | page · static · **reserved** | `app/[locale]/faq/page.tsx` | no reference content (R1); OQ-02.7 |
| `/{l}/privacy` | page · static · **conditional** | `app/[locale]/privacy/page.tsx` | only if OQ-07.5 says yes |
| `/{l}/<anything else>` | 404 · on demand (`ƒ Dynamic` — the one non-static page, `D-06.4`) | `app/[locale]/[...rest]/page.tsx` → `not-found.tsx` | localised, `noindex` (Next injects it on 404) |
| `/<unprefixed path>` | proxy redirect 307 | `src/proxy.ts` | → `/{detected}/<path>`; legacy CRA paths are redirected first (§6.9) |
| `/api/inquiry` | route handler · Node function | `app/api/inquiry/route.ts` | `POST` only; `GET` → 405 (07 §2); excluded from proxy + sitemap; it sits outside `[locale]` and **receives the locale as a form field (07), never from the path** (02 Routing) |
| `/sitemap.xml` | metadata route · static | `app/sitemap.ts` | 7 routes × locales, alternates (§6.5) |
| `/robots.txt` | metadata route · static | `app/robots.ts` | `Disallow: /api/` |
| `/manifest.webmanifest` | metadata route · static | `app/manifest.ts` | brand name, icons, colours (§6.5) |
| `/icon.png`, `/apple-icon.png` | file-based icons | `app/icon.png`, `app/apple-icon.png` | square marks derived from the logo (03/04; OQ-03.6) |
| `/og/cover.png` | static asset | `public/og/cover.png` | shared OG image (`site.json.images.og`), 1200×630 |

Count at launch: 7 page routes × 2 locales = 14 indexable URLs (+ 2 per reserved/conditional page if enabled);
3 metadata routes; 1 API route; 2 redirect classes; 1 catch-all. Trailing slashes: Next's default
(`trailingSlash: false`) — `/en/menu/` 308-redirects to `/en/menu`; canonical and sitemap URLs carry no slash.

### 6.2 `app/` tree and rendering

```text
src/app/
├── [locale]/
│   ├── layout.tsx          ROOT layout: <html lang dir>, fonts (03), MotionProvider (05), NextIntlClientProvider
│   │                       (client namespaces per 04 + `errors`), sticky Nav, Footer, skip link → #main,
│   │                       generateStaticParams, metadataBase/title template/OG defaults
│   ├── page.tsx            home — PageTransition (05) → 8 sections, <JsonLd>
│   ├── philosophy/ programs/ menu/ gallery/ reviews/ team/   (each: page.tsx — PageTransition → SubpageShell)
│   ├── enroll/ faq/ privacy/                                  (reserved / conditional, D-06.1)
│   ├── [...rest]/page.tsx  notFound()
│   ├── not-found.tsx       localised 404 (server component)
│   ├── error.tsx           'use client' — errors.serverError.* + reset()
│   └── global-error.tsx    'use client' — own <html lang="en"><body>, en messages by static import
├── api/inquiry/route.ts    07
├── sitemap.ts · robots.ts · manifest.ts
└── icon.png · apple-icon.png
```

Why the root layout sits inside `[locale]`: `<html lang>` must be the locale's (`D-02.9`, 03 `:root:lang(zh)`),
and Next allows exactly one `<html>` — the next-intl layout `[verified]`. There is no `app/layout.tsx`; the
metadata routes and icons need none. There is no `template.tsx` (05 uses React `ViewTransition`, not per-
navigation remounts), no route groups (the "← Back" pill belongs to the sliding page, so a `(detail)` group
layout would wrongly pin it), no `loading.tsx` and no `Suspense` above `not-found` (a streamed 404 is served
with status 200 `[verified: not-found docs]`). `PageTransition` wraps each page's content (`D-05.10`); the Nav and
Footer live in the layout so they do not slide (OQ-05.4).

Rendering: with `generateStaticParams` returning `[{locale:'en'},{locale:'zh'}]` and no request-time API in any
layout/page, `next build` marks every route `○ Static` — except `[...rest]`, which has no enumerable params and
is `ƒ Dynamic` by construction (`D-06.4`). `dynamicParams` is left at its default; unknown locales
never reach the layout because the proxy redirects them (§6.7), and the layout keeps next-intl's own guard —
`if (!hasLocale(routing.locales, locale)) notFound()` before anything renders `[verified: next-intl
getting-started]` — so a locale that arrives another way (a direct RSC request, a stale prefetch) 404s instead
of rendering with an unknown `lang`. `src/i18n/request.ts` resolves the locale from `next/root-params` when
`requestLocale` is empty (`generateMetadata` and other Server-Component reads) and calls `notFound()`
for a value outside `routing.locales` `[verified: next-intl getting-started, 16.3]`. `next/root-params` is
Server-Components-only — not available in Route Handlers `[verified]` — so `sitemap.ts`, `robots.ts` and
`manifest.ts` never call it: they are cached Route Handlers outside `[locale]` (§6.2 tree), where no locale
root param exists, and they iterate `routing.locales` themselves over locale-agnostic `site.json` data.

### 6.3 `src/i18n/routing.ts` and `src/proxy.ts`

```ts
// src/i18n/routing.ts — the only place locales and their metadata are declared (D-02.1)
import { defineRouting } from 'next-intl/routing';
export const routing = defineRouting({
  locales: ['en', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'always',      // D-02.9 / ADR-008
  alternateLinks: false,       // 02: "the header would say `zh`, the tags say `zh-Hans`" (D-02.9)
  localeCookie: { maxAge: 60 * 60 * 24 * 365 }   // NEXT_LOCALE, sameSite lax; 1 year (OQ-06.5)
});
export const LOCALE_META = {
  en: { htmlLang: 'en',      hreflang: 'en',      ogLocale: 'en_US', dir: 'ltr', nativeName: 'English', shortLabel: 'EN' },
  zh: { htmlLang: 'zh-Hans', hreflang: 'zh-Hans', ogLocale: 'zh_CN', dir: 'ltr', nativeName: '中文',    shortLabel: '中文' }
} as const satisfies Record<(typeof routing.locales)[number], LocaleMeta>;
```

```ts
// src/proxy.ts — Next 16 file name; default export is accepted [verified: proxy docs]
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
export default createMiddleware(routing);
export const config = { matcher: '/((?!api|_next|_vercel|.*\\..*).*)' };
```

What the proxy does and does not do: it runs for every page request (prefixed or not), so Vercel invokes a Node
function before serving the cached static HTML — cheap, but the reason we keep it minimal (no logging, no
geo, no rewrites). It redirects unprefixed paths with 307 (temporary — detection may change) and never
redirects a prefixed URL. It writes the `NEXT_LOCALE` cookie only when the resolved locale differs from the
`Accept-Language` best fit (`syncCookie`, `D-06.5`): a visitor with an `en` header loading `/en` gets no
`Set-Cookie` at all, and the cookie is in practice written by the switcher's client navigation. Excluded by the
matcher: `/api/*` (07: the form must never be locale-redirected), `/_next/*`, `/_vercel/*` and any path with a
dot (`/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, icons, `public/` files). Static export would skip
it entirely — hence ADR-007.

**Localised slugs — why not.** (1) SEO: the audience is Fremont families searching Google in English or Chinese;
language targeting comes from `hreflang` + `<html lang>` + on-page text, not from the slug — Google states URL
words are a minor signal and ASCII slugs are safest for sharing/copying; transliterated pinyin slugs help no one,
and percent-encoded CJK slugs break in chat apps and print. (2) One mapping: `site.json.routes[].path` is already
the single source for links, Back and the sitemap; `pathnames` would add a second per-locale table,
change `usePathname` to return templates and force `getPathname` everywhere. (3) Cost of reversal is low: add
`pathnames` + 301s. Decision: English slugs for all locales.

**Cookie lifetime.** next-intl's default is a session cookie; we set one year so a returning `zh` visitor who
types the bare domain lands on `/zh` (OQ-06.5 lets the human shorten it — it is a functional, not tracking,
cookie; 07 §4's no-consent stance is unaffected).

### 6.4 Navigation

**Sticky nav (desktop) / hamburger (mobile).** Link set from `site.json.nav.primary[]` → labels `common.nav.<id>`
(02); the CTA `common.nav.bookTour` → `#visit`; the switcher `common.localeSwitcher.*`. The footer link set is
`site.json.nav.footer[]` (six + `contact` → `#visit`). Targets resolve per surface:

| Surface | Target form | Mechanism |
|---|---|---|
| Home page, nav/footer/hero/scroll cue | `#philosophy` … `#visit` | native anchor; CSS `scroll-behavior: smooth` + `data-scroll-behavior="smooth"` on `<html>` (ADJ-1); sections `scroll-snap-align: start; scroll-margin-top: var(--nav-h)` (`D-05.11`, 03 `--nav-h` 58/86 px); reduced motion → `auto` |
| Detail page, nav/footer | `/en#philosophy` … `/en#visit` (the `homeHref` form, `D-06.6` — no slash before the `#`) | next-intl `Link href={homeHref(id)}`; router navigation, untyped → instant swap; Next scrolls the id into view (`scroll-margin-top` applies) `[verified: Link docs]` |
| Section "learn more →" | `/philosophy` … `/team` | `Link href={route.path} transitionTypes={['subpage-enter']}`; scroll to top; focus → `h1` (05 §5.7) |
| Detail "← Back home" (`common.back.label`) | `homeHref(<homeAnchor>)` | `router.replace(..., { transitionTypes: ['subpage-exit'] })`; lands on the origin section's snap point (not the prior scroll offset); history becomes `[home, home#section]` — the detail entry is overwritten, not pushed (`D-06.8`, OQ-05.5) |
| Browser Back/Forward | — | untyped; instant; Next restores scroll position |
| Yelp, Maps | external | `target="_blank" rel="noopener noreferrer"` + `common.links.newTab` (07) |

Hash handling: the `id` attributes are rendered by the section components from the data mapping (INV-06.5);
`:target` is not styled; a hash survives the locale switch (D-06.9) and a reload. Active-section highlight in the
nav is not in the design and not built at launch (OQ-06.6) — it would need a second observer or CSS scroll-driven
animations; if requested, reuse the `Reveal` registry, not a scroll listener (INV-05.9).

Hamburger (mobile, `docs/design/mobile/README.md`): the sheet is a modal dialog (`role="dialog"`,
`aria-modal`, `aria-labelledby` → visually hidden `common.nav.menuOpen`), opened by a button with
`aria-expanded` and `common.nav.menuOpen|menuClose`; focus moves into the sheet, is trapped there (the page
behind gets `inert`), `Escape` and a route change close it, focus returns to the button. Its links are the same
hash anchors / `Link`s as the desktop nav plus `contact` → `#visit` and the switcher. Clicking an anchor closes
the sheet first, then the native scroll runs; a locale switch closes the sheet, then navigates (05 §5.6 cascade).
The sheet's own motion is OQ-05.3; 04 owns the component.

**Language switcher** (D-06.9; copy `common.localeSwitcher.label|ariaLabel`). Implementation sketch:

```tsx
'use client';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
export function LocaleSwitcher({ to }: { to: Locale }) {          // `to` from routing.locales, not a literal
  const pathname = usePathname(); const router = useRouter();
  return (
    <Link href={pathname} locale={to} hrefLang={LOCALE_META[to].hreflang}
      onClick={(e) => { e.preventDefault(); markLocaleSwap();          // 05 registry
        const { search, hash } = window.location;
        router.replace(`${pathname}${search}${hash}`, { locale: to, scroll: false,
          transitionTypes: ['locale-swap'] }); }}>
      {t('localeSwitcher.label')}
    </Link>
  );
}
```

Elided in the sketch: `t` is `useTranslations('common')` and `LOCALE_META` is imported from
`src/i18n/routing.ts` (`D-06.5` snippet) — neither is redeclared here. This component is the **only** place in
the app that reads `window.location`: `usePathname()` returns the prefix-less pathname and nothing else, so the
query and hash can only come from the live URL, and preserving them is INV-06.8. Every other read of the
current URL goes through `src/i18n/navigation` (INV-06.5 / INV-02.7), and 08 lints for stray `window.location`
outside this file.

Without JavaScript the anchor is a plain link to `/{to}{pathname}` (hash lost — acceptable). `usePathname`
returns the internal pathname without prefix `[verified]`; `useRouter().replace` accepts the `locale` option
and passes the remaining options to `next/navigation` `[assumed — spike: `scroll`/`transitionTypes`
passthrough in next-intl's `useRouter`]`. On the 404 page the same component works (pathname = the unknown path).
Per 03 §3.3 the switch must not shift layout; per 02 `D-02.10` the motion is 05's.

### 6.5 Metadata and SEO

One helper builds the per-route metadata so no page repeats it:

```ts
// src/i18n/metadata.ts
export async function pageMetadata(locale: Locale, href: Href, ns: MetaNamespace, abs = false): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: ns });
  const languages = Object.fromEntries(routing.locales.map((l) => [LOCALE_META[l].hreflang, getPathname({ locale: l, href })]));
  languages['x-default'] = getPathname({ locale: routing.defaultLocale, href });   // D-02.9: x-default → en
  return {
    title: abs ? { absolute: t('meta.title') } : t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: getPathname({ locale, href }), languages },
    openGraph: { title: t('meta.title'), description: t('meta.description'), url: getPathname({ locale, href }),
      locale: LOCALE_META[locale].ogLocale, alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => LOCALE_META[l].ogLocale) },
  };
}
```

- **Layout defaults** (`app/[locale]/layout.tsx`, `generateMetadata`): `metadataBase` = `siteUrl` (D-06.11);
  `title: { default: t('common.meta.siteName'), template: t('common.meta.titleTemplate', { brandName }) }` —
  the template is the message `"%s · {brandName}"` with the ICU argument filled, leaving `%s` for Next
  `[verified: title.template]`; `openGraph: { type: 'website', siteName, images: [{ url: site.images.og.src,
  width, height, alt: t('common.meta.ogImageAlt') }] }`; `twitter: { card: 'summary_large_image' }`; `robots:
  { index: true, follow: true }`; `formatDetection: { telephone: false }`. Relative URLs compose with
  `metadataBase`, so all paths above are relative `[verified]`.
- **Per page**: `generateMetadata({ params })` → `pageMetadata(locale, '/philosophy', 'philosophy')`; the home
  passes `abs = true` (its `home.meta.title` already names the brand). Eight title/description pairs at launch:
  home + the six detail pages + the 404 (`seo.*` → 02's `<page>.meta.*`). R1's route table also lists eight,
  but its eighth row is the `/contact`-or-`/enroll` page and its 404 row is separate; the substitution is
  **deliberate** — the enrollment page is reserved (`D-06.1`, OQ-06.1) while the 404 is built and needs its own
  pair. Reserved pages add theirs when enabled.
- **hreflang/canonical**: tags only (no `Link` header — `alternateLinks: false`, because "the header would say
  `zh`, the tags say `zh-Hans`" and they must not disagree, 02 Routing), values `en`, `zh-Hans`,
  `x-default` → the `en` URL, canonical = own URL; the `'x-default'` key in `alternates.languages` is emitted
  as `hreflang="x-default"` `[assumed — Next types accept it; 08 asserts the rendered tag]`. Canonicals never
  point across locales; the 404 page emits neither canonical nor `hreflang`.
- **Open Graph / Twitter**: one shared image (`public/og/cover.png`, `site.json.images.og`, 1200×630 — the design
  ships no social artwork; 04 renders a placeholder of the logo on cream until the owner supplies one, OQ-06.7);
  `og:image:alt` per locale; `og:locale` / `og:locale:alternate` from `LOCALE_META`. Per-locale generated images
  (`app/[locale]/opengraph-image.tsx`, static at build `[verified]`) are the upgrade path if titles should appear
  on the card; not at launch (needs font files outside `next/font`).
- **Sitemap** (`app/sitemap.ts`): `site.json.routes` (+ `/`) × `routing.locales` → `{ url: siteUrl +
  getPathname({locale, href}), alternates: { languages: {...hreflang → absolute URL, 'x-default': en URL} } }`
  `[verified: sitemap localisation]`. Reserved pages enter automatically when their `routes[]` entry exists.
  Nothing else: no `/api`, no 404, no query/hash variants.
- **Robots** (`app/robots.ts`): `rules: { userAgent: '*', allow: '/', disallow: ['/api/'] }`, `sitemap:
  siteUrl + '/sitemap.xml'`. No environment branching in code: previews are `noindex` by Vercel's header; a
  custom preview domain would need a manual header (09). Next adds `<meta name="robots" content="noindex">` on
  404 responses by itself `[verified]`.
- **Manifest** (`app/manifest.ts`): `name`/`short_name` = `site.brand.name`/`shortName` (locale-agnostic data —
  Next's manifest is a single file, so it is not localised; acceptable for a marketing site), `start_url: '/'`,
  `display: 'browser'`, `background_color`/`theme_color` from 03's token source (request §6.12 — no raw hex here,
  INV-03.1), icons = the file-based icons.
- **Favicons**: `app/icon.png` (512²) and `app/apple-icon.png` (180²) derived from the logo mark; the 373×161
  wordmark PNG is not square (03 `D-03.9`, OQ-03.6 asks for a vector master). Next emits the `<link>` tags.
- **Google Business Profile / Yelp**: external profiles link to the canonical `en` home (`/en`) to skip the root
  redirect hop; both URLs are `site.json` data (`yelp.url`, `social.*`) and appear in JSON-LD `sameAs`. Search
  Console verification and sitemap submission are 09's launch checklist items.

### 6.6 Structured data

`<JsonLd>` (server component, 04) serialises one object on the home page per locale into
`<script type="application/ld+json">`. `JSON.stringify` does **not** escape `<`, so the component does it
itself: every `<` in the serialised string is replaced with the `\u003c` escape before injection, which is
valid JSON, renders identically to consumers, and makes a `</script>` sequence in any content value
impossible. Fields and sources (all `site.json` unless noted):

| JSON-LD field | Source |
|---|---|
| `@type` `ChildCare`; `@id` = `siteUrl + '/' + locale + '#business'` | constant |
| `name`, `alternateName` | `brand.name`, `brand.nameZh` (OQ-02.4 / gp-dln.12) |
| `url`, `inLanguage` | locale home URL; `LOCALE_META[locale].htmlLang` |
| `description` | `home.meta.description` (02) |
| `telephone`, `email` | `contact.phone`, `contact.email` — owner facts (gp-dln.13) |
| `address` (`PostalAddress`: street, locality Fremont, region CA, postalCode, country US) | `contact.address` (OQ-07.8 — street may be withheld; then `addressLocality`/`addressRegion` only) |
| `openingHoursSpecification` | `hours` (Mon–Fri 07:30–18:00 → `dayOfWeek` list + `opens`/`closes`) |
| `image`, `logo` | `images.hero`, the logo asset (03) |
| `sameAs` | `yelp.url`, `social.*` |
| `knowsLanguage` | `['en', 'zh']` from `routing.locales` (BCP 47 via `LOCALE_META`) |

Deliberately absent: `aggregateRating`/`review` (self-serving review markup is against Google's guidelines; the
Yelp figures stay visible text), `priceRange` (not in the design), `geo` (until the address exists). Detail pages
carry no JSON-LD at launch (`BreadcrumbList` is a cheap later addition). 08 validates the object against
schema.org types in CI (what, not how).

### 6.7 Error handling

| Case | Result |
|---|---|
| `/{l}/nonexistent` | `[...rest]` → `notFound()` → `app/[locale]/not-found.tsx` inside the locale layout: correct `lang`, nav/footer, `errors.notFound.title|body|cta` (cta → `/` via `Link`), status **404**, `noindex` meta, no canonical/hreflang |
| `/fr/anything`, `/about` | not a locale → proxy treats as unprefixed → 307 `/{detected}/fr/anything` → 404 as above (no redirect to a "best" locale page — a 404 is honest and keeps crawlers from indexing junk). Note the 404 renders in the **detected** locale, not always `en`: 02's Routing sentence "Unknown-locale 404 renders the root `not-found` in `en`" describes only the matcher-excluded case in the row below, where the proxy never runs — requirement to 02, §6.12 |
| `/api/inquiry` with `GET` | 405 from the handler (07 §2) — never a page |
| `/favicon.ico` typo or other dotted path | bypasses the proxy; Next's built-in 404 (no app chrome; `experimental.globalNotFound` stays off until stable) |
| Render error inside a page | `app/[locale]/error.tsx` (client): `errors.serverError.title|body|retry` with `reset()`; wrapped by the layout's `NextIntlClientProvider`, so `errors` must be a client namespace — 02 lines 97-98 (`D-02.16`) already list it; 04 adopts 02's list (memo ADJ-12) |
| Error in the root layout itself | `app/[locale]/global-error.tsx`: renders its own `<html lang="en"><body>` with `errors.serverError.*` from `content/en/messages/errors.json` imported statically (no provider exists here; INV-02.1 still holds — no literal text in JSX) |
| Form request paths | 07 owns status codes; the 303 fallback lands on `/{locale}#visit` — the `homeHref` form with no slash before the `#` (`D-06.6`), so it does not take a `trailingSlash` 308 first — a valid anchor in every locale. The handler itself is outside `[locale]` and reads the locale from a form field, never from the path (02 Routing, 07) |

### 6.8 Performance and caching at the routing level

- Every page is static HTML + a static RSC payload behind Vercel's cache; the proxy adds one light Node
  invocation per HTML/RSC request (Fluid compute). No ISR, no `revalidate`, no `use cache` needed — content is
  build-time JSON; a copy change is a deploy (09).
- `/_next/static/*` is immutable (framework default); `public/` assets use Vercel's default caching; content
  images go through `next/image` with `images.remotePatterns: []` (no remote hosts — everything is in `public/`
  per `D-02.12`) and AVIF/WebP formats; fonts are self-hosted by `next/font` (03, 07 §6).
- Prefetching: `Link`s prefetch static routes on viewport entry in production (default); the locale-changing
  `Link` has prefetch disabled by next-intl (cookie safety) `[verified]`; the catch-all is on demand and is never
  linked.
- The proxy runs on Node (Next 16 default) — Edge is not an option for proxy files; nothing in it needs Node
  APIs, so it stays portable.

### 6.9 `next.config.ts` items owned by this document

`trailingSlash` default (false); `poweredByHeader: false`; `images: { remotePatterns: [], formats:
['image/avif', 'image/webp'] }`; **no** `output`; `redirects()` for (a) legacy CRA paths — the previous site
(git `647da4c`) served `/`, `/about`, `/culinary`, `/documents`, `/philosophy`, `/contact`; if it was ever
public (OQ-06.3) map `/culinary → /en/menu`, `/contact → /en/#visit`, `/about → /en/team`, `/documents → /en`
as 308s (config redirects run **before** the proxy `[verified: execution order]`; `/philosophy` needs nothing —
the proxy prefixes it); (b) nothing for `www` — handled at the Vercel domain level (09).
`experimental.createMessagesDeclaration` is 02's. Security headers are 09's.

### 6.10 Testing requirements (what; 08 owns how)

- Every route × locale (from `site.json.routes` × `routing.locales`, never a hand-written list) answers 200 with
  the right `<html lang>`/`dir`, a `<title>` matching `<page>.meta.title` (+ template), one canonical = own
  URL, the full `hreflang` set incl. `x-default`, `og:locale`, and no `⟦` marker (INV-02.5).
- Redirect matrix: `/` → 307 `/en` (no cookie, no header), → `/zh` with `Accept-Language: zh-CN` or cookie
  `NEXT_LOCALE=zh`; `/menu` → `/{detected}/menu`; `/en/menu/` → 308 `/en/menu`; `/en/menu` → 200 (never
  redirects); `/fr/menu` → 307 → 404; legacy paths → configured targets.
- 404: `/en/nope` and `/zh/nope` return status 404, localised copy, `noindex`, working switcher; `/api/inquiry`
  `GET` → 405.
- Sitemap: valid XML, exactly the expected URL set, every URL has alternates for every locale + `x-default`,
  every URL returns 200; robots contains `Disallow: /api/` and the sitemap URL; `next build` output lists every
  page as `○ Static` **except `/[locale]/[...rest]`, which is expected to be `ƒ Dynamic`** (`D-06.4`), and
  lists only the proxy + `/api/inquiry` as functions. Both halves are allowlists — one dynamic page, two
  functions — so a second dynamic page or a third function fails the gate. A third Function was proposed and
  settled against: 08's `src/app/api/vercel-dispatch/route.ts` relay is dropped because Lighthouse CI triggers
  on GitHub's native `deployment_status` event instead, so this allowlist, `D-06.1` and INV-06.7 stand
  unchanged and no exemption is needed (memo ADJ-14) — do not re-open it.
- Proxy matcher unit test: `unstable_doesProxyMatch` (`next/experimental/testing/server`) asserts the matcher
  runs for `/`, `/menu`, `/en/menu` and does **not** run for `/api/inquiry`, `/_next/static/x.js`,
  `/sitemap.xml`, `/robots.txt` and `/og/cover.png` `[verified: Next testing helper]` — exact and cheap, where
  the redirect matrix above can only observe the exclusions indirectly.
- Lint gates run in CI, not review: INV-02.7's `no-restricted-imports` (no `next/link` / `next/navigation`
  outside `src/i18n/`) and INV-06.1's literal-`href` rule both fail the pipeline.
- Switcher: from `/en/menu?x=1#menu` lands on `/zh/menu?x=1#menu`, scroll unchanged, cookie set; from a 404
  page lands on the same path; `hreflang` attribute present on the anchor.
- Navigation: "learn more →" pushes the detail route and scrolls to top; "← Back" replaces with `/#anchor` and the
  section is at the snap point with the nav offset; hash links from a detail page land correctly; hamburger
  focus trap/return/`Escape`/close-on-route-change; skip link → `#main`.
- JSON-LD present on both home pages, parses, type `ChildCare`, no `aggregateRating`; with `TODO` values the
  release validation fails (02 gate).

### 6.11 Invariants

- **INV-06.1 Routes are defined once.** Route ids/paths/anchors live in `site.json.routes[]` + `nav`; locales
  in `src/i18n/routing.ts`. Nav, footer, Back, sitemap, tests iterate them; a string literal starting with `/`
  or `#` in `href` of a component is a lint error (allowlist: `/`, `#main`) — 08 implements.
- **INV-06.2 No locale literals outside `src/i18n/`** (`'en'`/`'zh'`, `zh-Hans`, `en_US`): everything reads
  `routing.locales` / `LOCALE_META` (extends INV-02.9).
- **INV-06.3 Every page exports `generateMetadata` via `pageMetadata`** (title, description, canonical, full
  `hreflang` set, OG); a page without it fails the static metadata test.
- **INV-06.4 Sitemap completeness and exclusivity.** Every page route × locale is in the sitemap with
  alternates; nothing else is; `/api/` is disallowed in robots.
- **INV-06.5 All navigation goes through `src/i18n/navigation`** (INV-02.7) or a same-document `#id` anchor
  whose id comes from the data mapping (D-06.6).
- **INV-06.6 Prefixed URLs never redirect; unprefixed always do; unknown paths are real 404s** (status 404,
  correct `lang`, `noindex`). No `loading.tsx` / `Suspense` above a `not-found`.
- **INV-06.7 Static by construction.** No `output: 'export'`, no `dynamic`/`revalidate` overrides, no
  `headers()`/`cookies()`/`searchParams` in layouts or pages; `next build` shows every page static **except the
  catch-all `/[locale]/[...rest]`, which is `ƒ Dynamic` by construction** (`D-06.4`) and is the only permitted
  exception; the only functions are the proxy and `/api/inquiry`.
- **INV-06.8 The switcher preserves path, query and hash**, writes the cookie, and never scrolls.
- **INV-06.9 Section ids are stable, unique, present on every home render** and carry
  `scroll-margin-top: var(--nav-h)`; the `#visit` anchor exists because 07's 303 fallback targets it.

### 6.12 Requirements this document places on other docs

- **02** — drop `site.json.brand.url` (origin = `NEXT_PUBLIC_SITE_URL`, D-06.11; this is the first half of 09's
  `OQ-09.10`, which 09 addresses to 02's seat "on 06's requirement") or redefine it as not used
  for metadata; extend `LOCALE_META` with `ogLocale` and `dir`; add `common.meta.ogImageAlt` to the client
  namespace list (`D-02.16`) — the `errors` half of that request is **satisfied**, 02 lines 97-98 (`D-02.16`)
  already list `errors` for `error.tsx`, so 06 asks nothing there; scope the Routing sentence
  "Unknown-locale 404 renders the root `not-found` in `en`" to matcher-excluded (dotted) paths — an unknown
  *prefix* like `/fr/x` goes through the proxy and 404s in the **detected** locale (§6.7). 02's negotiation
  wording needs no change: `D-02.9` already reads "locale prefix → `NEXT_LOCALE` cookie set by an explicit
  switch → Accept-Language → `en`".
  **03** — export the manifest colours (`theme_color`, `background_color`) from the
  token source; square icon assets. **04** — `SubpageShell` (kicker, heading, back pill), `JsonLd`, `Nav`,
  `Hamburger`, `LocaleSwitcher`, `SkipLink`; section `id`s from data; and flip `PrimaryNav` / `FooterLinks` /
  the sheet's link list from `S` to `C` — they need `usePathname()` to choose `#id` vs `homeHref(id)`
  (`D-06.7`), while `SiteHeader` / `SiteFooter` stay server components. **05** — none beyond `D-05.10`; `OQ-05.5`
  is answered in `D-06.8` (the `transitionTypes` passthrough is confirmed at source level; spike keeps
  OQ-05.2 f). **07 · 09** — `NEXT_PUBLIC_SITE_URL` stays 06's variable (`D-06.11`): 09 sets it in the
  **Production scope only**, which 09 §2 already does; Development and Preview need no value because
  `src/config/site-url.ts` falls back to `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → `http://localhost:3000`,
  so `metadataBase` is never undefined and no environment can fail the build on a relative metadata field.
  That chain is also 06's answer to the second half of `OQ-09.10` ("what `metadataBase`, the sitemap and robots
  use on a **Preview** deployment"): the preview's own `VERCEL_URL` host, which is harmless because previews are
  `noindex` (`D-06.12`). `.env.example` ships `NEXT_PUBLIC_SITE_URL=http://localhost:3000` as documentation, not
  as a requirement. **08** — §6.10 as gates; lint for INV-06.1/2. **09** — domain/`www`
  redirect, Search Console + sitemap submission, GBP/Yelp URLs, custom-preview-domain `noindex`, env scopes.
  No conflict remains: 09 `D-09.5` records 06's default (apex canonical, `www` 308 → apex) and 09 §1/§2 carry it
  (`https://<domain>`, "`www` redirects to the apex"). If OQ-06.2 is ever answered "`www`", both docs flip
  together — every canonical, `hreflang` and sitemap URL 06 emits follows the host form.
  **10** — keep the View-Transition spike before subpage work; reserved routes are a later phase.

## Open questions

- **OQ-06.1** · answerer: human (Hanyi), bead gp-dln.6 (= OQ-02.7) — Enrollment page: in scope at launch? If
  yes, route name `/enroll` (recommended; the wireframe H1 is "Book a tour", the nav word is "Contact") vs
  `/contact`. Default: not at launch; the home `#visit` section is the contact surface.
- **OQ-06.2** · answerer: human (Hanyi); 09 implements — Production domain and host form: apex (recommended,
  canonical) vs `www`; the design mock shows `greenpasturesmontessori.com` as a placeholder. Default: apex,
  `www` → apex 308 at Vercel.
- **OQ-06.3** · answerer: human (Hanyi) — Was the previous CRA site ever live at this domain (routes `/about`,
  `/culinary`, `/documents`, `/contact`)? If yes, the redirect map in §6.9 ships; if no, no legacy redirects.
- **OQ-06.4** · answerer: human with counsel (= OQ-07.5); 06 + 02 implement — Privacy page → `/{locale}/privacy`
  with a footer link (`common.nav.privacy`, 02) if required.
- **OQ-06.5** · answerer: human (Hanyi) — `NEXT_LOCALE` cookie lifetime: one year (default here) vs session
  (next-intl default). Lifetime only: whether to detect on the bare root is already settled (02 Routing decided
  detection **on** and lists it as retired; `localeDetection: false` is the knob if that is ever revisited,
  `D-06.5`).
- **OQ-06.6** · answerer: design owner — Active-section highlight in the sticky nav? Not in the design; off at
  launch.
- **OQ-06.7** · answerer: design owner / human — Social share image artwork (1200×630); until supplied a logo-on-
  cream placeholder is generated once and committed.
- **OQ-06.8** · answerer: 02 (writer-contracts) — accept the §6.12 requests (`brand.url`, `LOCALE_META` fields,
  and scoping the "unknown-locale 404 in `en`" sentence to matcher-excluded paths). The `errors` client
  namespace is no longer asked for: 02 lines 97-98 (`D-02.16`) already list it.
- **OQ-06.9** · answerer: human (owner), bead gp-dln.13; 06 implements — JSON-LD owner facts for the `ChildCare`
  object (`D-06.13`, §6.6): telephone, e-mail, the street address or an explicit decision to publish locality +
  region only (= OQ-07.8), the real Yelp URL and any other `sameAs` profiles (= OQ-07.7), and confirmation that
  Mon–Fri 07:30–18:00 is current. Until every one is real the object ships with `TODO` values and 02's release
  gate fails; `geo`, `priceRange`, `aggregateRating` and `review` stay absent regardless of the answer.

## Cross-references

- `docs/design/README.md` — section inventory, Interactions (scroll-snap, in-page nav, detail subpages, toggle),
  Fidelity (8 inner pages listed vs 6 designed). `docs/design/desktop/README.md` — sticky nav link set, "Our
  Team", EN · 中文, hover. `docs/design/mobile/README.md` — hamburger contents, footer link set.
  `docs/design/Wireframes.dc.html` — Enrollment / contact page.
- `docs/technical/01-stack-decisions.md` — ADR-001, ADR-002 (next-intl), ADR-007 (never static export),
  ADR-008 (prefix always; toggle = navigation).
- `docs/technical/02-i18n-content-contract.md` — `D-02.1`, `D-02.9`, `D-02.10`, `D-02.12` (`routes[]`, `nav`,
  `images.og`), `D-02.16`, `D-02.17`, INV-02.5, INV-02.7, INV-02.9, OQ-02.7 (subpage set).
- `docs/technical/03-design-system-tokens.md` — `--nav-h`, fonts, `:root:lang(zh)`, icons/logo, INV-03.1.
- `docs/technical/04-components-sections.md` — Nav, Hamburger, LocaleSwitcher, SubpageShell, JsonLd, section ids.
- `docs/technical/05-animation-system.md` — `D-05.10`/§5.7 (View Transitions, Back), `D-05.11`/§5.8 (scroll),
  §5.6 (switch cascade), OQ-05.2, OQ-05.4, OQ-05.5 (answered in `D-06.8`).
- `docs/technical/07-forms-integrations.md` — `/api/inquiry`, `#visit`, 303 fallback, `NEXT_PUBLIC_SITE_URL`,
  OQ-07.5, A-07.1 (no consent banner).
- `docs/technical/08-testing-quality.md` — §6.10 gates. `docs/technical/09-deployment-operations.md` — domain,
  Search Console, preview `noindex`, env. `docs/technical/10-work-breakdown.md` — spike, reserved routes.
  `docs/technical/12-open-questions.md` — OQ-06.n roll-up.
