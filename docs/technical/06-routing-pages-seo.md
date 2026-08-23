# 06 · Routing, pages, navigation & SEO

## Purpose

This document fixes the URL space of the Green Pastures site and everything that hangs off it: the route set per
locale and the `app/` file tree that produces it, the rendering mode of every route, the locale proxy
(`src/proxy.ts`) and the single routing source (`src/i18n/routing.ts`), in-page navigation (sticky nav anchors,
hamburger, "learn more →" / "← Back" between the home page and the detail pages, the language switcher), the
per-route per-locale metadata (`<title>`, description, canonical, `hreflang`, Open Graph), sitemap, robots,
structured data, 404/500 handling, the routing-level performance and caching rules, and what 08 must test.
Every route exists in **three** locales — `en`, `zh-Hans`, `zh-Hant` (`D-02.1`, HD-10) — the locale id is the URL
segment, the `<html lang>` value and the `hreflang` value, so the switcher is a three-option menu and not the
two-name toggle the design draws. It implements `D-02.9` / `D-02.10` (02 owns the locale mechanism and the
strings), consumes 05's View-Transition decision (`D-05.10`) and 07's endpoint requirements, and invents no copy:
every visible string named here is a 02 key. Claims about Next.js 16.3 / next-intl 4.13 are
`[verified: docs, 2026-08-22]` unless labelled `[assumed — spike]`.

Status: draft · seat writer-routing · 2026-08-22 · revised 2026-08-22 (HD-3, HD-5, HD-10, HD-13, ADJ-20)

## Decisions

- **D-06.1 Route set — six detail pages, settled (HD-5, 2026-08-22).** Launch routes per locale: `/` (home,
  eight sections), `/philosophy`, `/programs`, `/menu`, `/gallery`, `/reviews`, `/team` — the six detail pages
  of `D-02.17`, where **"Staff" is Team**: one page, the `team` namespace, no `staff` route or namespace ever.
  Reserved, not built: `/enroll` (Enrollment — **not at launch**, OQ-06.1 answered below; the home `#visit`
  section is the contact surface) and `/faq` (`D-02.17`: the namespace and `site.json.faq[]` stay in the tree,
  the route ships the day content exists). Conditional: `/privacy` (OQ-07.5). Locale-agnostic routes: `/`
  (redirect only), `/api/inquiry`, `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, file-based icons.
  Nothing else exists; unknown paths are real 404s (§6.7).
- **D-06.2 English slugs in every locale — no localised pathnames.** `/zh-Hans/philosophy` and
  `/zh-Hant/philosophy`, not `/zh-Hans/教学理念` or `/zh-Hans/jiaoxue-linian`. next-intl's `pathnames` option is
  not used at launch (justification §6.3); the slug set lives once in `content/site.json.routes[].path`
  (`D-02.12`) and `src/i18n/routing.ts` stays locale-list-only. Reversible: adding `pathnames` later changes
  only the Chinese locales' URLs and needs a redirect map.
- **D-06.3 Explicit folders, no `[slug]` page.** Each detail page is its own folder under `app/[locale]/`
  (`philosophy/page.tsx`, …) because each has a distinct composition (04) and metadata; a `[slug]` page would
  move the route set into runtime data and lose per-page typing. One catch-all `app/[locale]/[...rest]/page.tsx`
  exists only to turn unknown paths into a localised 404.
- **D-06.4 Rendering mode.** Every page is prerendered at build time per locale — with three locales that is
  three prerenders of every page: `generateStaticParams` over
  `routing.locales` in `app/[locale]/layout.tsx` and locale resolution via `next/root-params` in
  `src/i18n/request.ts` (next-intl's Next 16.3 recipe; `setRequestLocale` is the legacy API) `[verified]`.
  No ISR, no `dynamic` overrides, no request-time APIs in pages/layouts. The only Functions are the proxy and
  `POST /api/inquiry`; `sitemap.ts`, `robots.ts` and `manifest.ts` are cached Route Handlers. **One exception
  to "static":** `app/[locale]/[...rest]/page.tsx` is a catch-all with no enumerable params, so `next build`
  marks it `ƒ Dynamic` and renders it on demand. That is by construction (it exists only to 404) and it is the
  only dynamic page; every gate that asserts "all static" exempts it by name (INV-06.7, §6.10).
  `output: 'export'` is never set (ADR-007, memo ADJ-2).
- **D-06.5 Proxy.** `src/proxy.ts` is a thin wrapper around `createMiddleware(routing)` from
  `next-intl/middleware` (default export, matcher `'/((?!api|_next|_vercel|.*\\..*).*)'`) that adds exactly two
  things next-intl cannot do for three locales: the Chinese Accept-Language mapping and the canonical-casing
  redirect, both `D-06.15`. The wrapped handler negotiates the locale for unprefixed paths (prefix →
  `NEXT_LOCALE` cookie → `Accept-Language` → `en`, next-intl's order `[verified]`), 307-redirects them to the
  prefixed URL, and never touches a prefixed URL in canonical casing. Detection stays **on**: `localeDetection` is left at its
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
- **D-06.9 Language switcher — a three-option menu (HD-10).** The control is a menu, not a toggle (`D-02.10`):
  a trigger labelled `LOCALE_META[current].shortLabel` (`EN` / `简` / `繁`) opens a list of **every** locale in
  `routing.locales`, in that order, labelled by `nativeName` (English · 简体中文 · 繁體中文), the current one
  carrying `aria-current="true"`; on mobile the three items sit directly in the hamburger sheet with no nested
  disclosure. Each option is a next-intl `Link` to the same internal pathname with `locale={target}` (the
  no-JavaScript path) whose click handler runs `router.replace(pathname + search + hash, { locale, scroll:
  false, transitionTypes: ['locale-swap'] })` (§5.6) — one navigation, not two. Path, query and hash are
  preserved; the `NEXT_LOCALE` cookie is written client-side by next-intl on click `[verified: BaseLink]`; on a
  404 page each option targets the same unknown path in its locale (also 404). Copy is
  `common.localeSwitcher.ariaLabel` (trigger) + `optionAriaLabel` (`{locale}` = the target's `nativeName`);
  **`common.localeSwitcher.label` is retired** (02 key-naming rule 11) and no component may reconstruct a
  two-name label from it. `<html lang>` = `LOCALE_META[locale].htmlLang`; `dir` is the constant `"ltr"` —
  all three locales are left-to-right, so a `LOCALE_META.dir` field would be dead configuration (§6.3).
  **The trigger carries no chevron — adjudicated, not proposed (ADJ-20, 2026-08-22).** 06 checked the handoff:
  its only `⌄` belongs to the hero scroll cue, and `[data-langtoggle]` is a bare nav item with no disclosure
  glyph. 02 `D-02.10`'s "plus the design's `⌄` chevron" was an unverified reading and 04 `D-04.16` followed it;
  ADJ-20 ruled 06's evidence wins, so chevron-less is the **default of record for every document**, not this
  one's preference (corrections to 02 and 04 in §6.12). What remains unspecified is the rest of the menu's
  **visual** treatment — the open state and the surface it sits on: OQ-06.10.
- **D-06.10 Metadata.** `app/[locale]/layout.tsx` sets `metadataBase`, `title.default`/`title.template`
  (`common.meta.siteName`, `common.meta.titleTemplate` — its `{brandName}` argument is
  `site.brand.name[locale]`, a localized value, `D-02.19`), `openGraph.siteName/locale/alternateLocale`, `robots`
  defaults and the shared OG image; every `page.tsx` exports `generateMetadata` returning `title`,
  `description`, `alternates.canonical`, `alternates.languages` (every locale's `hreflang` + `x-default` → the
  `en` URL) and the OG/Twitter copy — all from `<page>.meta.*` (`D-02.4` rule 7) via one helper
  `src/i18n/metadata.ts`. The home title is absolute; detail titles use the template.
- **D-06.11 One origin, with a fallback chain — and, since HD-13, a known production value.**
  The production origin is `NEXT_PUBLIC_SITE_URL` (07 §5),
  parsed once in `src/config/site-url.ts`; it feeds `metadataBase`, the sitemap, robots, JSON-LD and 07's
  origin check. Because a relative `canonical`/`languages` value with an undefined `metadataBase` is a **build
  error** (Next docs `[verified]`), the variable is never simply "required": `src/config/site-url.ts` resolves
  `NEXT_PUBLIC_SITE_URL` → `https://${VERCEL_PROJECT_PRODUCTION_URL}` → `https://${VERCEL_URL}` →
  `http://localhost:3000`, parses the winner with `new URL()` and exports a frozen `URL`. 09 therefore only
  sets it in the Production scope (09 §2 already does); Development and Preview resolve from the chain, and a
  preview's canonicals pointing at the preview host is harmless because previews are `noindex` (`D-06.12`).
  **The production value is `https://greenpasturesdaycare.com` (HD-13, 2026-08-22).** The domain name is
  settled, so the variable is no longer an unknown: the Vercel Production scope is set to that one string, and
  the **host form is settled with it** — apex canonical, `www` → apex 308 at the Vercel domain level, which 09
  `D-09.5` records as 06's default and implements. Knowing the value does not turn it into a literal: the
  **variable stays the source** and no absolute origin is written anywhere in `src/` (INV-06.10), because
  Preview and Development must not claim the production host, and because flipping to `www` has to stay one
  Vercel setting plus one environment value (09 `D-09.5`). What the name buys this document is **concrete
  examples**: every canonical, `hreflang`, sitemap URL, robots `sitemap:` line and JSON-LD `@id` below is now
  written out in full against the real host instead of as `siteUrl + …` (§6.5, §6.6). OQ-06.2's domain half is
  answered; only who holds the registrar login is still open.
  **`site.json.brand.url` is still not that origin.** 02 ships the field as a provisional sample
  (`https://greenpastures.example`, registered in `site.json.provisional`, `D-02.20`); 06 never reads it —
  no metadata, sitemap, robots or JSON-LD code path imports it (INV-06.10). The reason has narrowed, not
  changed: it is no longer "the real host does not exist yet" (it does) but that one origin per environment can
  only come from the environment. 02 may now replace the sample with the real domain — that is 02's call and it
  changes nothing here. Request to 02 in §6.12; OQ-06.8 tracks it.
- **D-06.12 Sitemap and robots.** One `app/sitemap.ts` lists every launch route × locale — **7 page routes ×
  3 locales = 21 URLs** (`D-02.9`, was 14 with two locales) — with `alternates.languages` (`en`, `zh-Hans`,
  `zh-Hant`, `x-default`) built from `site.json.routes[]` + `routing.locales` + `getPathname`; no
  `lastModified`/`priority`/`changeFrequency` (a build timestamp is not a content date). The count is
  **derived, never written down**: if `zh-Hant` is held out of `routing.locales` until its review lands
  (INV-02.11) the same code emits 14 and the same tests pass — that is the point of iterating the list.
  `app/robots.ts`: allow `/`, `Disallow: /api/`, `sitemap` URL. Preview deployments are
  `noindex` by Vercel's automatic `X-Robots-Tag` header (custom preview domains excepted — 09) `[verified]`.
- **D-06.13 Structured data.** The home page emits one `ChildCare` JSON-LD object (schema.org subtype of
  `LocalBusiness`) per locale from `site.json` + `home.meta.description`; no `aggregateRating`/`review` (Google
  forbids self-serving review markup); Yelp and social URLs go in `sameAs`. Owner facts ship as **provisional
  sample defaults**, not `TODO` (HD-7 / `D-02.20`): the object always renders, and `validate:content --release`
  fails while their paths remain in `site.json.provisional` (INV-02.10). Real values are still a launch-gate
  requirement (gp-dln.13, **OQ-06.9**).
- **D-06.14 Errors.** `app/[locale]/not-found.tsx` (localised, `errors.notFound.*`), `app/[locale]/error.tsx`
  (client, `errors.serverError.*` via `NextIntlClientProvider`), `app/[locale]/global-error.tsx` (own
  `<html lang="en">`, statically imported `en` messages). Unknown locale prefixes are not locales: the proxy
  treats `/fr/x` as an unprefixed path and redirects to `/{detected}/fr/x`, which the catch-all turns into a
  localised 404 (status 404). `experimental.globalNotFound` is not enabled; paths with a dot that bypass the proxy
  and match nothing (asset typos) get Next's built-in 404. No `loading.tsx` anywhere (keeps 404 status real).
- **D-06.15 Chinese negotiation and canonical casing (HD-10).** Two things three locales need that
  `createMiddleware(routing)` cannot do alone, both implemented in `src/proxy.ts` around it (§6.3).
  (a) **Accept-Language.** Browsers send `zh-CN`, `zh-TW` and rarely a script subtag, and best-fit lookup
  truncates `zh-CN` to `zh` — which matches neither `zh-Hans` nor `zh-Hant`, so unaided negotiation would send
  every Chinese reader to English. 02's table is therefore implemented literally: `zh`, `zh-CN`, `zh-SG`,
  `zh-MY`, `zh-Hans-*` → `zh-Hans`; `zh-TW`, `zh-HK`, `zh-MO`, `zh-Hant-*` → `zh-Hant`; anything else → `en`.
  Each row is an ordered **preference chain** filtered by `routing.locales`, first survivor wins, so while
  `zh-Hant` is held back (INV-02.11) a `zh-TW` reader gets `zh-Hans` — the same language in the other script —
  and never English. The mapping is applied by rewriting the request's `Accept-Language` to the single resolved
  tag before delegating, so next-intl still owns the redirect, the cookie and the ordering (§6.3).
  (b) **Canonical casing.** Locale ids are case-sensitive path segments; `/zh-hans/menu` is not a route.
  A path whose first segment case-insensitively equals a locale id but is not that id 308-redirects to the
  canonical form (`/zh-hans/menu` → `/zh-Hans/menu`, `/EN` → `/en`), once, before anything else runs — so a
  hand-typed or lower-cased URL lands instead of 404ing, and only one casing is ever indexed (`D-02.9`).
  Canonicals, `hreflang`, the sitemap and every emitted link use the canonical form only.

## Design

### 6.1 Route inventory

`{l}` ranges over `routing.locales` (`en`, `zh-Hans`, `zh-Hant` — `D-02.1`); "static" = prerendered HTML + RSC
payload at build. No row is per-locale: every page below exists three times.

| URL | Kind · mode | Source file | Notes |
|---|---|---|---|
| `/` | proxy redirect 307 | `src/proxy.ts` | → `/{detected}` (prefix → cookie → `Accept-Language` → `en`; Chinese tags per `D-06.15`(a)); detection on, per 02 Routing (`localeDetection` default; `D-06.5`) |
| `/{l}` | page · static | `app/[locale]/page.tsx` | home; ids from `site.json.routes[].homeAnchor` + `#visit`; JSON-LD |
| `/{l}/philosophy` | page · static | `app/[locale]/philosophy/page.tsx` | `homeAnchor` `#philosophy` |
| `/{l}/programs` | page · static | `app/[locale]/programs/page.tsx` | `#programs` |
| `/{l}/menu` | page · static | `app/[locale]/menu/page.tsx` | `#menu` |
| `/{l}/gallery` | page · static | `app/[locale]/gallery/page.tsx` | `#gallery` |
| `/{l}/reviews` | page · static | `app/[locale]/reviews/page.tsx` | `#reviews` |
| `/{l}/team` | page · static | `app/[locale]/team/page.tsx` | `#teachers` (`D-02.12`) |
| `/{l}/enroll` | page · static · **reserved** | `app/[locale]/enroll/page.tsx` | Enrollment page, the optional `visit.kicker\|heading\|meta.*` keys (`D-02.17`); not at launch (OQ-06.1, HD-5) |
| `/{l}/faq` | page · static · **reserved** | `app/[locale]/faq/page.tsx` | no reference content (R1); reserved by `D-02.17` — ships when `site.json.faq[]` is non-empty |
| `/{l}/privacy` | page · static · **conditional** | `app/[locale]/privacy/page.tsx` | only if OQ-07.5 says yes |
| `/{l}/<anything else>` | 404 · on demand (`ƒ Dynamic` — the one non-static page, `D-06.4`) | `app/[locale]/[...rest]/page.tsx` → `not-found.tsx` | localised, `noindex` (Next injects it on 404) |
| `/<unprefixed path>` | proxy redirect 307 | `src/proxy.ts` | → `/{detected}/<path>`; Chinese negotiation per `D-06.15`(a); legacy CRA paths are redirected first (§6.9) |
| `/zh-hans/...`, `/ZH-HANT/...`, `/EN/...` | proxy redirect 308 | `src/proxy.ts` | wrong-cased locale segment → canonical casing (`D-06.15`(b)); one hop, then the prefixed URL is served |
| `/api/inquiry` | route handler · Node function | `app/api/inquiry/route.ts` | `POST` only; `GET` → 405 (07 §2); excluded from proxy + sitemap; it sits outside `[locale]` and **receives the locale as a form field (07), never from the path** (02 Routing) |
| `/sitemap.xml` | metadata route · static | `app/sitemap.ts` | 7 page routes × 3 locales = 21 URLs, alternates (§6.5) |
| `/robots.txt` | metadata route · static | `app/robots.ts` | `Disallow: /api/` |
| `/manifest.webmanifest` | metadata route · static | `app/manifest.ts` | default-locale brand name, icons, colours (§6.5) |
| `/icon.png`, `/apple-icon.png` | file-based icons | `app/icon.png`, `app/apple-icon.png` | square marks derived from the logo (03/04; OQ-03.6) |
| `/og/cover.png` | static asset | `public/og/cover.png` | shared OG image (`site.json.images.og`), 1200×630 |

Count at launch: 7 page routes × 3 locales = **21** indexable URLs (+ 3 per reserved/conditional page if
enabled); 3 metadata routes; 1 API route; 3 redirect classes (root/unprefixed 307, wrong-case 308, trailing
slash 308); 1 catch-all. Nothing multiplies by hand: the number falls out of `routing.locales`, so holding
`zh-Hant` back under INV-02.11 yields 14 with no edit here (`D-06.12`). Trailing slashes: Next's default
(`trailingSlash: false`) — `/en/menu/` 308-redirects to `/en/menu`; canonical and sitemap URLs carry no slash.

### 6.2 `app/` tree and rendering

```text
src/app/
├── [locale]/
│   ├── layout.tsx          ROOT layout: <html lang dir>, fonts (03), MotionProvider (05), NextIntlClientProvider
│   │                       (client namespaces per 04 + `errors`), SiteHeader, SiteFooter, SkipLink → #main,
│   │                       generateStaticParams, metadataBase/title template/OG defaults
│   ├── page.tsx            home — PageTransition (05) → 8 sections, <JsonLd>
│   ├── philosophy/ programs/ menu/ gallery/ reviews/ team/   (each: page.tsx — PageTransition → SubpageBar → main → SubpageHeader)
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
with status 200 `[verified: not-found docs]`). `PageTransition` wraps each page's content (`D-05.10`); `SiteHeader` and
`SiteFooter` (04 §3.1's names for the sticky nav and the footer) live in the layout so they do not slide
(OQ-05.4).

Rendering: with `generateStaticParams` returning `routing.locales.map((locale) => ({ locale }))` —
`[{locale:'en'},{locale:'zh-Hans'},{locale:'zh-Hant'}]` at launch — and no request-time API in any
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
  locales: ['en', 'zh-Hans', 'zh-Hant'],          // D-02.1; a locale not yet reviewed is absent (INV-02.11)
  defaultLocale: 'en',
  localePrefix: 'always',      // D-02.9 / ADR-008
  alternateLinks: false,       // one source for hreflang — the metadata tags (D-02.9, D-06.10)
  localeCookie: { maxAge: 60 * 60 * 24 * 365 }   // NEXT_LOCALE, sameSite lax; 1 year (OQ-06.5)
});
export const LOCALE_META = {                      // 02's five fields + ogLocale (06's, OQ-06.8)
  'en':      { htmlLang: 'en',      hreflang: 'en',      ogLocale: 'en_US', nativeName: 'English',  shortLabel: 'EN', brandPairLocale: 'zh-Hans' },
  'zh-Hans': { htmlLang: 'zh-Hans', hreflang: 'zh-Hans', ogLocale: 'zh_CN', nativeName: '简体中文', shortLabel: '简', brandPairLocale: 'en' },
  'zh-Hant': { htmlLang: 'zh-Hant', hreflang: 'zh-Hant', ogLocale: 'zh_TW', nativeName: '繁體中文', shortLabel: '繁', brandPairLocale: 'en' }
} as const satisfies Record<Locale, LocaleMeta>;
export const ACCEPT_LANGUAGE: ReadonlyArray<readonly [RegExp, readonly Locale[]]> = [   // D-06.15(a)
  [/^zh(-(CN|SG|MY|Hans(-.*)?))?$/i, ['zh-Hans', 'zh-Hant']],   // ordered preference, filtered by
  [/^zh-(TW|HK|MO|Hant(-.*)?)$/i,    ['zh-Hant', 'zh-Hans']]    // routing.locales; else defaultLocale
];
```

`LOCALE_META` carries no `dir`: all three locales are left-to-right, so `<html dir="ltr">` is a constant and a
field that is always `"ltr"` would be configuration nobody maintains. The day a right-to-left locale is
proposed, the field is added here with it (`D-06.9`). `ogLocale` has no equivalent in 02's table and is 06's
addition — Open Graph wants `xx_YY`, not a BCP 47 tag (OQ-06.8).

```ts
// src/proxy.ts — Next 16 file name; default export is accepted [verified: proxy docs]
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { canonicalCasing, withResolvedLanguage } from './i18n/negotiate';
const handle = createMiddleware(routing);
export default function proxy(request: NextRequest) {
  const fixed = canonicalCasing(request.nextUrl.pathname);        // D-06.15(b); null when already canonical
  if (fixed) {
    const url = request.nextUrl.clone(); url.pathname = fixed;
    return NextResponse.redirect(url, 308);
  }
  return handle(withResolvedLanguage(request));                   // D-06.15(a)
}
export const config = { matcher: '/((?!api|_next|_vercel|.*\\..*).*)' };
```

`src/i18n/negotiate.ts` holds both pure helpers (the tables stay in `routing.ts` beside `LOCALE_META`, as 02's
Routing section requires). `canonicalCasing(pathname)` returns the corrected path when the first segment
case-insensitively equals a locale id but is not it, else `null`. `withResolvedLanguage(request)` returns the
request untouched when the path is already prefixed or a valid `NEXT_LOCALE` cookie is present — next-intl's
order is preserved. Otherwise it walks the header's tags in q-order; the first that matches an `ACCEPT_LANGUAGE`
row yields a copy of the request whose `Accept-Language` is that row's first surviving locale id and nothing
else, so next-intl's own matcher, redirect and `syncCookie` produce that locale with no second code path. A
header no row matches passes through untouched and next-intl handles it (`en-*` and everything else → `en`).
Rebuilding a `NextRequest` with edited headers is `[assumed — spike: NextRequest header clone in a proxy]`; if it
does not hold, the fallback is one extra branch in `proxy.ts` that issues the 307 itself for the unprefixed,
cookie-less, Chinese-header case and delegates everything else unchanged.

What the proxy does and does not do: it runs for every page request (prefixed or not), so Vercel invokes a Node
function before serving the cached static HTML — cheap, but the reason we keep it minimal (no logging, no
geo, no rewrites). It redirects unprefixed paths with 307 (temporary — detection may change), redirects a
wrong-cased locale segment with 308 (permanent — casing is not a matter of taste, `D-06.15`(b)), and never
redirects a prefixed URL in canonical casing. It writes the `NEXT_LOCALE` cookie only when the resolved locale differs from the
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

**Cookie lifetime.** next-intl's default is a session cookie; we set one year so a returning `zh-Hans` visitor
who types the bare domain lands on `/zh-Hans` (OQ-06.5 lets the human shorten it — it is a functional, not
tracking, cookie; 07 §4's no-consent stance is unaffected). The cookie now matters more than it did with two
locales: it is the only thing that keeps a `zh-TW` reader who chose 简体中文, or a `zh-CN` reader who chose
繁體中文, on their choice instead of the header's best fit.

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
hash anchors / `Link`s as the desktop nav plus `contact` → `#visit` and the **three locale rows directly in the
sheet** — no nested disclosure on mobile (02, *Language switcher*). Clicking an anchor closes
the sheet first, then the native scroll runs; a locale switch closes the sheet, then navigates (05 §5.6 cascade).
The sheet's own motion is OQ-05.3; 04 owns the component.

**Language switcher — three options** (`D-06.9`; copy `common.localeSwitcher.ariaLabel|optionAriaLabel`, the
`label` key retired). One trigger, one option per locale in `routing.locales`; nothing about the control knows
how many locales there are. Implementation sketch. **There is no `Menu` component**: the sketch below used to
wrap the option list in one and assign the primitive to 04, and 04 `D-04.16` answered that a generic `Menu`
with a single consumer is speculation — the trigger semantics, focus handling and dismissal are a native
`<details>`/`<summary>` disclosure inlined in `LangSwitcher` itself, which is also what gives the control its
no-JavaScript open/close. `LangSwitcher` is 04's name for this component and the only one either document uses.
The sketch is the `variant="nav"` half of 04's two-variant prop contract; `variant="sheet"` renders the same
`<ul>` of `Link`s as flat rows inside `MobileMenu`, with no `<details>` around them (04 `D-04.16`):

```tsx
'use client';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
export function LangSwitcher({ current }: { current: Locale }) {   // variant="nav"; sheet drops the disclosure
  const pathname = usePathname(); const router = useRouter(); const t = useTranslations('common');
  return (
    <details>                                        {/* D-04.16: inlined — there is no Menu component */}
      <summary aria-label={t('localeSwitcher.ariaLabel')}>
        {LOCALE_META[current].shortLabel}            {/* and nothing else — no chevron, ADJ-20 */}
      </summary>
      <ul>
        {routing.locales.map((l) => (                                // never a literal locale (INV-06.2)
          <li key={l}><Link href={pathname} locale={l} hrefLang={LOCALE_META[l].hreflang}
            aria-current={l === current ? 'true' : undefined}
            aria-label={t('localeSwitcher.optionAriaLabel', { locale: LOCALE_META[l].nativeName })}
            onClick={(e) => { e.preventDefault(); markLocaleSwap();   // 05 registry
              const { search, hash } = window.location;
              router.replace(`${pathname}${search}${hash}`, { locale: l, scroll: false,
                transitionTypes: ['locale-swap'] }); }}>
            {LOCALE_META[l].nativeName}
          </Link></li>
        ))}
      </ul>
    </details>
  );
}
```

Elided in the sketch: `t` is `useTranslations('common')` and `routing` / `LOCALE_META` are imported from
`src/i18n/routing.ts` (`D-06.5` snippet) — none is redeclared here. The current locale stays a real option
(selecting it replaces the same URL, which is harmless and keeps the list rectangular); what matters is
`aria-current` and the endonym. This component is the **only** place in
the app that reads `window.location`: `usePathname()` returns the prefix-less pathname and nothing else, so the
query and hash can only come from the live URL, and preserving them is INV-06.8. Every other read of the
current URL goes through `src/i18n/navigation` (INV-06.5 / INV-02.7), and 08 lints for stray `window.location`
outside this file.

Without JavaScript each option is a plain link to `/{l}{pathname}` (hash lost — acceptable) and the panel still
opens and closes, because the disclosure is the browser's own `<details>` (04 `D-04.16`) rather than a
`useState` dropdown — it is never a button-only control. `usePathname`
returns the internal pathname without prefix `[verified]`; `useRouter().replace` accepts the `locale` option
and passes the remaining options to `next/navigation` `[assumed — spike: `scroll`/`transitionTypes`
passthrough in next-intl's `useRouter`]`. On the 404 page the same component works (pathname = the unknown path).
Per 03 §3.3 the switch must not shift layout — with three endonyms of differing widths that now means the
**trigger** must not shift, which is why it shows the fixed-width `shortLabel` and not the endonym. The
trigger's visible content is that label and **nothing else**: no `⌄`, per ADJ-20 (`D-06.9`) — the handoff's
`[data-langtoggle]` is a bare nav item and its only `⌄` is the hero scroll cue's. Per 02 `D-02.10` the motion
is 05's (`locale-swap`, one navigation).

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

Every absolute URL in this section is `siteUrl` (`D-06.11`) + a relative path, and in Production `siteUrl` is
`https://greenpasturesdaycare.com` (HD-13). The examples below are written against that host so they read as
the real site; the code still reads the variable, never the string (INV-06.10).

- **Layout defaults** (`app/[locale]/layout.tsx`, `generateMetadata`): `metadataBase` = `siteUrl` (D-06.11 —
  `https://greenpasturesdaycare.com` in Production);
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
  **deliberate** — the enrollment page is reserved (`D-06.1`; OQ-06.1 answered: not at launch) while the 404 is
  built and needs its own pair. Reserved pages add theirs when enabled. Three locales do not change the count:
  it is pairs of *strings*, one per page, translated three times.
- **hreflang/canonical**: tags only (no `Link` header — `alternateLinks: false`: `hreflang` has exactly one
  source, the metadata tags, and a header that can disagree with them is a defect with no upside, 02 Routing),
  **four alternates per page** — `en`, `zh-Hans`, `zh-Hant` and
  `x-default` → the `en` URL — canonical = own URL; the `'x-default'` key in `alternates.languages` is emitted
  as `hreflang="x-default"` `[assumed — Next types accept it; 08 asserts the rendered tag]`. Canonicals never
  point across locales; the 404 page emits neither canonical nor `hreflang`. What `/zh-Hant/menu` renders in
  Production:

  ```html
  <link rel="canonical" href="https://greenpasturesdaycare.com/zh-Hant/menu">
  <link rel="alternate" hreflang="en" href="https://greenpasturesdaycare.com/en/menu">
  <link rel="alternate" hreflang="zh-Hans" href="https://greenpasturesdaycare.com/zh-Hans/menu">
  <link rel="alternate" hreflang="zh-Hant" href="https://greenpasturesdaycare.com/zh-Hant/menu">
  <link rel="alternate" hreflang="x-default" href="https://greenpasturesdaycare.com/en/menu">
  ```

  The same five lines with `/en/menu` canonical are what the `en` page emits: the set is identical per locale,
  only `canonical` moves. On a Preview the host is that deployment's `VERCEL_URL` and the shape is unchanged.

- **Open Graph / Twitter**: one shared image (`public/og/cover.png`, `site.json.images.og`, 1200×630 — the design
  ships no social artwork; 04 renders a placeholder of the logo on cream until the owner supplies one, OQ-06.7);
  `og:image:alt` per locale; `og:locale` / `og:locale:alternate` from `LOCALE_META`. Per-locale generated images
  (`app/[locale]/opengraph-image.tsx`, static at build `[verified]`) are the upgrade path if titles should appear
  on the card; not at launch (needs font files outside `next/font`).
- **Sitemap** (`app/sitemap.ts`): `site.json.routes` (+ `/`) × `routing.locales` → `{ url: siteUrl +
  getPathname({locale, href}), alternates: { languages: {...hreflang → absolute URL, 'x-default': en URL} } }`
  `[verified: sitemap localisation]` — 21 entries at launch, each with three `languages` plus `x-default`.
  Reserved pages enter automatically when their `routes[]` entry exists.
  Nothing else: no `/api`, no 404, no query/hash variants. One Production entry in full:

  ```xml
  <url>
    <loc>https://greenpasturesdaycare.com/zh-Hant/menu</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://greenpasturesdaycare.com/en/menu"/>
    <xhtml:link rel="alternate" hreflang="zh-Hans" href="https://greenpasturesdaycare.com/zh-Hans/menu"/>
    <xhtml:link rel="alternate" hreflang="zh-Hant" href="https://greenpasturesdaycare.com/zh-Hant/menu"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://greenpasturesdaycare.com/en/menu"/>
  </url>
  ```

  No `<lastmod>`, `<priority>` or `<changefreq>` on any entry, per `D-06.12`. All 21 have this shape; the apex
  host appears because `www` never serves a page (it 308s — `D-09.5`), so no sitemap URL carries `www.`.
- **Robots** (`app/robots.ts`): `rules: { userAgent: '*', allow: '/', disallow: ['/api/'] }`, `sitemap:
  siteUrl + '/sitemap.xml'` → `Sitemap: https://greenpasturesdaycare.com/sitemap.xml` in Production, and the
  preview host's own `/sitemap.xml` elsewhere. No environment branching in code: previews are `noindex` by Vercel's header; a
  custom preview domain would need a manual header (09). Next adds `<meta name="robots" content="noindex">` on
  404 responses by itself `[verified]`.
- **Manifest** (`app/manifest.ts`): `name`/`short_name` = `site.brand.name[routing.defaultLocale]` /
  `shortName[routing.defaultLocale]` — brand names are **localized values** (`D-02.19`) while Next's manifest is
  a single unlocalised file, so it takes the default locale's spelling explicitly rather than by accident;
  acceptable for a marketing site (the install prompt is not a translated surface), `start_url: '/'`,
  `display: 'browser'`, `background_color`/`theme_color` from 03's token source (request §6.12 — no raw hex here,
  INV-03.1), icons = the file-based icons.
- **Favicons**: `app/icon.png` (512²) and `app/apple-icon.png` (180²) derived from the logo mark; the 373×161
  wordmark PNG is not square (03 `D-03.9`, OQ-03.6 asks for a vector master). Next emits the `<link>` tags.
- **Google Business Profile / Yelp**: external profiles link to the canonical `en` home —
  `https://greenpasturesdaycare.com/en`, the apex and the prefixed path, so the click takes neither the `www`
  308 nor the root 307; both profile URLs are `site.json` data (`yelp.url`, `social.*`) and appear in JSON-LD
  `sameAs`. Search Console verification (the property is the apex) and sitemap submission are 09's launch
  checklist items.

### 6.6 Structured data

`<JsonLd>` is a server component **06 owns, not 04**: it is absent from 04's inventory by design — the same
carve-out 04 §2 makes for `src/app/sitemap.ts` and `src/app/robots.ts` — and it ships with the rest of the SEO
plumbing (10 PR-6.8, `src/lib/seo/`), not under `src/components/`. It serialises one object on the home page per locale into
`<script type="application/ld+json">`. `JSON.stringify` does **not** escape `<`, so the component does it
itself: every `<` in the serialised string is replaced with the `\u003c` escape before injection, which is
valid JSON, renders identically to consumers, and makes a `</script>` sequence in any content value
impossible. Fields and sources (all `site.json` unless noted):

| JSON-LD field | Source |
|---|---|
| `@type` `ChildCare`; `@id` = `siteUrl + '/' + locale + '#business'` → `https://greenpasturesdaycare.com/en#business` | constant + `siteUrl` (`D-06.11`, HD-13) |
| `name`, `alternateName` | `brand.name[locale]` and `brand.name[LOCALE_META[locale].brandPairLocale]` — the same pairing the bilingual footer prints (`D-02.19`); `brand.nameZh` no longer exists |
| `url`, `inLanguage` | locale home URL (`https://greenpasturesdaycare.com/zh-Hant` on the `zh-Hant` home); `LOCALE_META[locale].htmlLang` |
| `description` | `home.meta.description` (02) |
| `telephone`, `email` | `contact.phone` (E.164 — `phoneDisplay` is for the page, not the graph), `contact.email` — provisional sample defaults until the owner edits them (`D-02.20`, gp-dln.13) |
| `address` (`PostalAddress`: street, locality Fremont, region CA, postalCode, country US) | `contact.address` (OQ-07.8 — street may be withheld; then `addressLocality`/`addressRegion` only) |
| `openingHoursSpecification` | `hours` (Mon–Fri 07:30–18:00 → `dayOfWeek` list + `opens`/`closes`) |
| `image`, `logo` | `images.hero`, the logo asset (03) |
| `sameAs` | `yelp.url`, `social.*` |
| `knowsLanguage` | `routing.locales` verbatim — `['en', 'zh-Hans', 'zh-Hant']` — the ids **are** BCP 47 tags (`D-02.1`), so nothing maps |

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
public (OQ-06.3) map `/culinary → /menu`, `/contact → /#visit`, `/about → /team`, `/documents → /`
as 308s (config redirects run **before** the proxy `[verified: execution order]`; `/philosophy` needs nothing —
the proxy prefixes it). The targets are deliberately **unprefixed**: a legacy link followed by a Chinese reader
must not be pinned to `/en/...` by a config file that predates their locale, so the 308 lands on the
locale-less path and the proxy's 307 negotiates it (two hops on a dead link, correct language). A fragment
survives that chain — the second `Location` carries none, so the browser keeps `#visit` (RFC 7231) — and the
target has no slash before the `#`, per `D-06.6`. (b) nothing for `www` — handled at the Vercel domain level (09).
`experimental.createMessagesDeclaration` is 02's. Security headers are 09's.

### 6.10 Testing requirements (what; 08 owns how)

- Every route × locale (from `site.json.routes` × `routing.locales`, never a hand-written list — 21 pairs at
  launch) answers 200 with the right `<html lang>` and `dir="ltr"`, a `<title>` matching `<page>.meta.title`
  (+ template), one canonical = own URL, the full `hreflang` set incl. `x-default`, `og:locale`, and no `⟦`
  marker (INV-02.5).
- Redirect matrix: `/` → 307 `/en` (no cookie, no header); with `Accept-Language: zh-CN` → `/zh-Hans`, with
  `zh-TW` → `/zh-Hant`, with a bare `zh` → `/zh-Hans`, with `zh-HK` → `/zh-Hant`, with `fr-FR` → `/en`
  (`D-06.15`(a) — the table is the test's expectation, not a re-derivation); cookie `NEXT_LOCALE=zh-Hant` beats
  an `en` header; `/menu` → `/{detected}/menu`; `/zh-hans/menu` → **308** `/zh-Hans/menu` (then 200);
  `/en/menu/` → 308 `/en/menu`; `/en/menu` → 200 (never redirects); `/fr/menu` → 307 → 404; legacy paths →
  configured targets.
- 404: `/en/nope`, `/zh-Hans/nope` and `/zh-Hant/nope` return status 404, localised copy, `noindex`, a working
  switcher; `/api/inquiry` `GET` → 405.
- Sitemap: valid XML, exactly the expected URL set (21 while three locales are enabled — asserted as
  `routes.length × routing.locales.length`, so the gate follows INV-02.11 instead of breaking on it), every
  URL has alternates for every locale + `x-default`,
  every URL returns 200; robots contains `Disallow: /api/` and the sitemap URL; `next build` output lists every
  page as `○ Static` **except `/[locale]/[...rest]`, which is expected to be `ƒ Dynamic`** (`D-06.4`), and
  lists only the proxy + `/api/inquiry` as functions. Both halves are allowlists — one dynamic page, two
  functions — so a second dynamic page or a third function fails the gate. A third Function was proposed and
  settled against: 08's `src/app/api/vercel-dispatch/route.ts` relay is dropped because Lighthouse CI triggers
  on GitHub's native `deployment_status` event instead, so this allowlist, `D-06.1` and INV-06.7 stand
  unchanged and no exemption is needed (memo ADJ-14) — do not re-open it.
- Negotiation and casing unit tests (pure, no server): every row of `D-06.15`(a) resolves as written, including
  the held-back case — with `routing.locales` = `['en','zh-Hans']` a `zh-TW` header must resolve to `zh-Hans`,
  not `en`; `canonicalCasing` returns `null` for `/zh-Hans/menu` and `/about`, and the corrected path for
  `/zh-hans/menu`, `/ZH-HANT`, `/EN/menu`.
- Proxy matcher unit test: `unstable_doesProxyMatch` (`next/experimental/testing/server`) asserts the matcher
  runs for `/`, `/menu`, `/en/menu` and does **not** run for `/api/inquiry`, `/_next/static/x.js`,
  `/sitemap.xml`, `/robots.txt` and `/og/cover.png` `[verified: Next testing helper]` — exact and cheap, where
  the redirect matrix above can only observe the exclusions indirectly.
- Origin: canonical, `hreflang`, sitemap and JSON-LD URLs all start with the *same* origin in one run, and it
  is the run's own — asserted by comparing them to `siteUrl`, never to a literal, so the gate passes on
  localhost, on a preview and on the apex alike. The counterpart is a grep: `greenpasturesdaycare.com` (and any
  `https://` origin) appears **nowhere in `src/`** — the known production value lives in the Vercel Production
  environment and in this document's examples, not in the tree (INV-06.10, `D-06.11`). Whether the live apex
  actually answers, and whether `www.greenpasturesdaycare.com` 308s to it, is a post-cutover smoke check and
  is 09's (`D-09.5`), not a build gate.
- Lint gates run in CI, not review: INV-02.7's `no-restricted-imports` (no `next/link` / `next/navigation`
  outside `src/i18n/`) and INV-06.1's literal-`href` rule both fail the pipeline.
- Switcher: it offers exactly `routing.locales.length` options, labelled with the endonyms, the current one
  carrying `aria-current`; the trigger's accessible name is `common.localeSwitcher.ariaLabel` and its visible
  text is exactly `shortLabel` — **no `⌄`** and no other glyph, per ADJ-20 (`D-06.9`), which is a rendered-text
  assertion, not a review note; from `/en/menu?x=1#menu` each option lands on `/{l}/menu?x=1#menu` with scroll
  unchanged and the cookie set (`zh-Hans` and `zh-Hant` both exercised, so a two-way assumption fails); from a
  404 page it lands on the same unknown path; `hreflang` is present on every option anchor; the retired key
  `common.localeSwitcher.label` appears nowhere in the tree (a grep gate, cheap and exact).
- Navigation: "learn more →" pushes the detail route and scrolls to top; "← Back" replaces with `/#anchor` and the
  section is at the snap point with the nav offset; hash links from a detail page land correctly; hamburger
  focus trap/return/`Escape`/close-on-route-change; skip link → `#main`.
- JSON-LD present on **every** locale's home page (three at launch), parses, type `ChildCare`, no
  `aggregateRating`, `name`/`alternateName` the locale's pair (`D-02.19`), `knowsLanguage` = `routing.locales`;
  while any of its owner facts is still listed in `site.json.provisional`, `validate:content --release` fails
  (INV-02.10 — the gate is the registry now, not a `TODO` scan).

### 6.11 Invariants

- **INV-06.1 Routes are defined once.** Route ids/paths/anchors live in `site.json.routes[]` + `nav`; locales
  in `src/i18n/routing.ts`. Nav, footer, Back, sitemap, tests iterate them; a string literal starting with `/`
  or `#` in `href` of a component is a lint error (allowlist: `/`, `#main`) — 08 implements.
- **INV-06.2 No locale literals outside `src/i18n/`** (`'en'`, `'zh-Hans'`, `'zh-Hant'`, `en_US`, `zh_TW`):
  everything reads `routing.locales` / `LOCALE_META` (extends INV-02.9). Nothing may assume how many locales
  there are either — no pair, no "the other locale", no two-element array.
- **INV-06.3 Every page exports `generateMetadata` via `pageMetadata`** (title, description, canonical, full
  `hreflang` set, OG); a page without it fails the static metadata test.
- **INV-06.4 Sitemap completeness and exclusivity.** Every page route × locale is in the sitemap with
  alternates; nothing else is; `/api/` is disallowed in robots.
- **INV-06.5 All navigation goes through `src/i18n/navigation`** (INV-02.7) or a same-document `#id` anchor
  whose id comes from the data mapping (D-06.6).
- **INV-06.6 Prefixed URLs never redirect; unprefixed always do; unknown paths are real 404s** (status 404,
  correct `lang`, `noindex`). One named exception: a locale segment in non-canonical casing 308s once to the
  canonical form (`D-06.15`(b)) — after that hop the URL is prefixed and never redirects again. No
  `loading.tsx` / `Suspense` above a `not-found`.
- **INV-06.7 Static by construction.** No `output: 'export'`, no `dynamic`/`revalidate` overrides, no
  `headers()`/`cookies()`/`searchParams` in layouts or pages; `next build` shows every page static **except the
  catch-all `/[locale]/[...rest]`, which is `ƒ Dynamic` by construction** (`D-06.4`) and is the only permitted
  exception; the only functions are the proxy and `/api/inquiry`.
- **INV-06.8 The switcher preserves path, query and hash**, writes the cookie, never scrolls, and offers one
  option per entry of `routing.locales` — adding or holding back a locale changes the control's contents and
  nothing else.
- **INV-06.9 Section ids are stable, unique, present on every home render** and carry
  `scroll-margin-top: var(--nav-h)`; the `#visit` anchor exists because 07's 303 fallback targets it.
- **INV-06.10 One origin, and it is the environment's.** `metadataBase`, the sitemap, robots, JSON-LD `@id`/
  `url` and 07's origin check all read the frozen `URL` from `src/config/site-url.ts` (`D-06.11`). No metadata
  code path imports `site.json.brand.url`, and no absolute origin is written as a literal anywhere in `src/`.

### 6.12 Requirements this document places on other docs

- **02** (restated 2026-08-22 against the HD-10 rewrite) — four live asks. (1) **`site.json.brand.url`**:
  02 now keeps it as "site origin, `metadataBase`" with the provisional sample `https://greenpastures.example`,
  which 06 cannot use — `metadataBase` stays on `NEXT_PUBLIC_SITE_URL` (`D-06.11`). HD-13 changes the sample
  but not the ask: the real domain is `greenpasturesdaycare.com`, so 02 can now retire the `.example` value and
  clear that `provisional` entry, but the field still must not be labelled `metadataBase`, because one origin
  per environment can only come from the environment. Relabel it as the owner's record of the intended public
  origin, *not read by metadata* (INV-06.10), or drop it; either way it stays out of the sitemap, robots and
  JSON-LD. This is the first half of 09's `OQ-09.10`. (2) **`ogLocale`**:
  06 declares it in `LOCALE_META` beside 02's five fields (`en_US` / `zh_CN` / `zh_TW`) because Open Graph
  wants `xx_YY`, not a BCP 47 tag; 02 either adopts the sixth column or blesses 06's extension. The `dir`
  request is **withdrawn** — three ltr locales make it a constant (`D-06.9`). (3) Scope the Routing sentence
  "Unknown-locale 404 renders the root `not-found` in `en`" to matcher-excluded (dotted) paths — an unknown
  *prefix* like `/fr/x` goes through the proxy and 404s in the **detected** locale (§6.7). (4) **The chevron.**
  `D-02.10` specifies the trigger as `shortLabel` "plus the design's `⌄` chevron"; the handoff has no such
  glyph on `[data-langtoggle]` (its only `⌄` is the hero scroll cue's), and ADJ-20 adjudicated 06's evidence as
  the default of record. Strike the chevron from `D-02.10` — this is not a request to reconsider, it is a
  correction to a settled point. Satisfied and no
  longer asked: the `errors` client namespace (`D-02.16` lists it), `common.meta.ogImageAlt` (covered by
  `common.meta.*`, key-naming rule 7, in the client namespace `common`), and the negotiation wording —
  `D-02.9`'s table is what `D-06.15`(a) implements, verbatim. New, small: `src/i18n/negotiate.ts` joins the
  `src/i18n/` tree 02 lists (pure helpers; the tables stay in `routing.ts`).
  **03** — one live ask: export the manifest colours (`theme_color`, `background_color`) from the
  token source, so `app/manifest.ts` writes no raw hex (§6.5, INV-03.1); plus square icon assets (OQ-03.6).
  **Satisfied and no longer asked — the Traditional CJK face.** 03 `D-03.14` ships it: two script stacks,
  `--font-cjk-sc` and `--font-cjk-tc` (`"PingFang TC", "Hiragino Sans CNS", "Microsoft JhengHei", "Noto Sans
  CJK TC", …`), selected by exactly two rules, `:root:lang(zh-Hans)` and `:root:lang(zh-Hant)`, while the
  shared `:root:lang(zh)` typography stays unsplit and matches both. That is precisely what 06 and 02 asked
  for, so `zh-Hant` no longer renders Simplified glyph forms and this ask is closed (HD-14 confirms the system
  stack; no webfont at launch).
  **04** — **naming satisfied and no longer asked:** 04 owns the component inventory and 06 now uses its names
  throughout. The subpage shell 06 asked for as `SubpageShell` is **two** components in 04 §3.1, not one, and
  the split is a scope decision 06 accepts: `SubpageBar` carries the kicker and the sticky bar with `BackLink`'s
  back pill, `SubpageHeader` carries the eyebrow/heading/intro. `Nav` is `PrimaryNav` inside `SiteHeader`, and
  `Menu` is not a component at all — `D-04.16` inlines the disclosure in `LangSwitcher` (§6.4). `JsonLd` is
  06's own (§6.6), not an ask of 04. The switcher 06 called `LocaleSwitcher` is `LangSwitcher`, 04's name and
  the only one used here now. **Nothing else is outstanding either**, and 04 §10 says so item by item:
  `Hamburger` and `SkipLink` exist (04 §2, §3.1); section `id`s come from `site.routes[].homeAnchor`
  (`D-04.3`); `PrimaryNav`, `FooterLinks` and the sheet's link list are client because they need
  `usePathname()` to choose `#id` vs `homeHref(id)` (`D-06.7`, 04 `D-04.1`), while `SiteHeader` / `SiteFooter`
  stay server components; the three-option menu is `D-04.16`, with trigger, `aria-current`, focus handling, a
  no-JavaScript fallback and a `routing.locales` iteration; `common.localeSwitcher.label` is gone from 04's
  lists, and so is the "differs per locale by content" description. **The chevron is settled and closed:**
  `D-04.16` now ships the trigger as a bare `EN` with no chevron and no disclosure glyph (ADJ-20), so `⌄` stays
  on 08's `allowedStrings` list for the hero scroll cue alone. Not a re-litigation: the adjudication is the
  decision. **05** — none beyond `D-05.10`; `OQ-05.5`
  is answered in `D-06.8` (the `transitionTypes` passthrough is confirmed at source level; spike keeps
  OQ-05.2 f). **07 · 09** — `NEXT_PUBLIC_SITE_URL` stays 06's variable (`D-06.11`): 09 sets it in the
  **Production scope only**, which 09 §2 already does; Development and Preview need no value because
  `src/config/site-url.ts` falls back to `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → `http://localhost:3000`,
  so `metadataBase` is never undefined and no environment can fail the build on a relative metadata field.
  That chain is also 06's answer to the second half of `OQ-09.10` ("what `metadataBase`, the sitemap and robots
  use on a **Preview** deployment"): the preview's own `VERCEL_URL` host, which is harmless because previews are
  `noindex` (`D-06.12`). `.env.example` ships `NEXT_PUBLIC_SITE_URL=http://localhost:3000` as documentation, not
  as a requirement. **08** — §6.10 as gates; lint for INV-06.1/2; every route × locale matrix is **three** rows
  now, and two gates are new: the negotiation/casing unit tests (§6.10) and the grep for the retired
  `common.localeSwitcher.label`; and the origin gate + host grep of §6.10, which are cheap and exact. **09** —
  domain/`www` redirect, Search Console + sitemap submission, GBP/Yelp URLs, custom-preview-domain `noindex`,
  env scopes. No conflict remains: 09 `D-09.5` records 06's default (apex canonical, `www` 308 → apex) and 09
  §1/§2 carry it (`https://<domain>`, "`www` redirects to the apex"). **HD-13 fills in `<domain>`:** the value
  is `greenpasturesdaycare.com`, so 09 sets `NEXT_PUBLIC_SITE_URL=https://greenpasturesdaycare.com` in the
  Production scope, attaches apex + `www` with the apex primary, and takes the apex as the Search Console
  property — 09's tables can stop writing `<domain>`. 09 `OQ-09.2`'s domain half closes with OQ-06.2's; the
  registrar and DNS-host questions inside `OQ-09.2` do not. If the host form is ever flipped to `www`, both
  docs flip together — every canonical, `hreflang` and sitemap URL 06 emits follows the variable.
  **10** — keep the View-Transition spike before subpage work; reserved routes are a later phase; the routing
  work items are now three-locale (21 URLs, a menu switcher, the negotiation helper), and `zh-Hant` may be
  enabled after launch by adding one entry to `routing.locales` — no route, sitemap or metadata work follows.

## Open questions

- **OQ-06.1** · **ANSWERED 2026-08-22 (human, HD-5)**, bead gp-dln.6 (= OQ-02.7, answered the same day in 02)
  — Enrollment page: **not at
  launch.** The six detail pages are Philosophy, Programs, Menu, Gallery, Reviews, Team ("Staff" *is* Team);
  FAQ and Enrollment stay reserved, not built (`D-06.1`, `D-02.17`), and the home `#visit` section is the
  contact surface. If Enrollment is ever built the route is `/enroll` (the wireframe H1 is "Book a tour", the
  nav word is "Contact"; `/contact` would collide with the anchor the whole site already points at).
- **OQ-06.2** · **ANSWERED 2026-08-22 (human, HD-13) for the domain**; one sliver left · answerer: human
  (Hanyi); 09 implements — **the domain is `greenpasturesdaycare.com`.** With HD-3's host form (apex canonical,
  `www` → apex 308 at Vercel, 09 `D-09.5`) this question's substance is closed: the Production value of
  `NEXT_PUBLIC_SITE_URL` is `https://greenpasturesdaycare.com` (`D-06.11`), and every canonical, `hreflang`,
  sitemap URL, robots `Sitemap:` line and JSON-LD `@id` follows it — written out in full in §6.5 and §6.6.
  The design mock's `greenpasturesmontessori.com` was a placeholder and is now positively **not** the domain;
  nothing in 06 ever read it. **Still open — the registrar sliver:** who holds the registrar login (and
  therefore who can edit the zone). That is not a build input and never was; it gates the DNS cutover
  (Phase 8, OPS-8.1), Search Console verification, the Turnstile hostname list and 07's Resend records, each
  of which needs a human able to add records. Answerer: the human (owner); 09 tracks the same sliver in
  `OQ-09.2`.
- **OQ-06.3** · answerer: human (Hanyi) — Was the previous CRA site ever live at this domain (routes `/about`,
  `/culinary`, `/documents`, `/contact`)? If yes, the redirect map in §6.9 ships; if no, no legacy redirects.
- **OQ-06.4** · answerer: human with counsel (= OQ-07.5); 06 + 02 implement — Privacy page → `/{locale}/privacy`
  with a footer link (`common.nav.privacy`, 02) if required.
- **OQ-06.5** · answerer: human (Hanyi) — `NEXT_LOCALE` cookie lifetime: one year (default here) vs session
  (next-intl default). Lifetime only: whether to detect on the bare root is already settled (02 Routing decided
  detection **on** and lists it as retired; `localeDetection: false` is the knob if that is ever revisited,
  `D-06.5`). Three locales raise the stakes slightly — the cookie is what keeps a `zh-TW` reader who picked
  简体中文 (or the reverse) on their choice, so a session cookie means re-choosing every visit (§6.3).
- **OQ-06.6** · answerer: design owner — Active-section highlight in the sticky nav? Not in the design; off at
  launch.
- **OQ-06.7** · answerer: design owner / human — Social share image artwork (1200×630); until supplied a logo-on-
  cream placeholder is generated once and committed.
- **OQ-06.8** · answerer: 02 (writer-contracts) — accept the three live §6.12 requests: `brand.url` is not the
  metadata origin (relabel or drop), `ogLocale` is a sixth `LOCALE_META` field (or 06 keeps declaring it), and
  the "unknown-locale 404 in `en`" sentence is scoped to matcher-excluded paths. Withdrawn: `dir` (a constant
  with three ltr locales), the `errors` client namespace and `common.meta.ogImageAlt` (both already satisfied).
  Default if 02 does not act: 06 ships as written — `NEXT_PUBLIC_SITE_URL` is the origin, `ogLocale` lives in
  `LOCALE_META`, and INV-06.10 keeps `brand.url` out of every metadata path.
- **OQ-06.9** · **PARTLY ANSWERED 2026-08-22 (human, HD-7 + HD-9)** · answerer: human (owner), bead gp-dln.13;
  06 implements — the JSON-LD owner facts no longer block the build: telephone, e-mail, address, Yelp URL and
  the rest ship as **provisional sample defaults** registered in `site.json.provisional` (`D-02.20`), so the
  `ChildCare` object always renders and `validate:content --release` fails while any entry remains (INV-02.10).
  Still open, for launch: the **real** values — telephone, e-mail, the street address or an explicit decision
  to publish locality + region only (= OQ-07.8), the real Yelp URL and any other `sameAs` profiles (=
  OQ-07.7), and confirmation that Mon–Fri 07:30–18:00 is current. `geo`, `priceRange`, `aggregateRating` and
  `review` stay absent regardless of the answer.
- **OQ-06.10** · **CHEVRON HALF ADJUDICATED 2026-08-22 (ADJ-20)**; the open state stays open · answerer: design
  owner (via Hanyi); 04 builds, 06 wired it — **what the three-option switcher looks like.** HD-10 makes the
  control a menu (`D-02.10`, `D-06.9`), and the handoff has no drawing of one: the desktop prototype has a
  single nav item reading "EN · 中文" (`docs/design/desktop/Green Pastures - Homepage.dc.html`,
  `[data-langtoggle]`, Nunito 700 14 px, `#8a8170`) and the mobile sheet a row "EN·中文"
  (`docs/design/mobile/README.md`) — no trigger, no open state, no selected state, no popover surface.
  **Settled: the trigger carries no chevron.** The handoff's only `⌄` belongs to the hero scroll cue ("scroll
  to come inside ⌄") and `[data-langtoggle]` is a bare nav item, so there is no disclosure glyph to inherit.
  02 `D-02.10` said "plus the design's `⌄` chevron" and 04 `D-04.16` followed it; ADJ-20 (2026-08-22) weighed
  the two readings against the handoff and ruled 06's correct. That makes chevron-less the **adjudicated
  default of record across all three documents** — not 06's proposal awaiting the design owner, and not a
  default that lapses if OQ-06.10 goes unanswered. Reopening it needs the design owner to *add* a chevron as a
  new instruction, with the same weight any other design answer carries; the scroll cue is not evidence and
  cannot be cited again.
  **Still open — the open state and its surface**, which no adjudication touched: the trigger's
  resting/hover/open appearance beyond "nav-item type and colour showing `shortLabel`", and what the open list
  sits on. Default until answered — reuse, not invention: a plain popover on 03's existing card surface
  (radius, shadow, cream) with the endonyms in nav-item type and the current row marked; mobile shows the three
  rows inline in the sheet, no popover. Whatever the answer, the semantics of `D-06.9` do not move.

## Cross-references

- `docs/design/README.md` — section inventory, Interactions (scroll-snap, in-page nav, detail subpages, toggle),
  Fidelity (8 inner pages listed vs 6 designed — six is the answer, `D-06.1`). `docs/design/desktop/README.md` —
  sticky nav link set, "Our Team", the two-name "EN · 中文" toggle the three-option menu replaces (OQ-06.10) —
  a bare nav item, which is the evidence behind ADJ-20's chevron-less trigger —
  hover. `docs/design/mobile/README.md` — hamburger contents (incl. the switcher row), footer link set.
  `docs/design/Wireframes.dc.html` — Enrollment / contact page (reserved, not built).
- `docs/technical/01-stack-decisions.md` — ADR-001, ADR-002 (next-intl), ADR-007 (never static export),
  ADR-008 (prefix always; toggle = navigation).
- `docs/technical/02-i18n-content-contract.md` — `D-02.1` + *Design → Locales* (`LOCALE_META`, the three ids),
  `D-02.9` + *Routing* (prefixes, the Accept-Language table, canonical casing, 21 URLs), `D-02.10` + *Language
  switcher* (three options, retired `label` key), `D-02.12` (`routes[]`, `nav`, `images.og`, `brand.url`),
  `D-02.16`, `D-02.17` (six subpages, FAQ/Enrollment reserved), `D-02.19` (brand names, `brandPairLocale`),
  `D-02.20` (provisional values), INV-02.5, INV-02.7, INV-02.9, INV-02.10, INV-02.11 (a locale may be held out
  of `routing.locales` until reviewed).
- `docs/technical/03-design-system-tokens.md` — `--nav-h`, fonts, `:root:lang(zh)` (matches both Chinese
  locales), `D-03.14` (`--font-cjk-sc` / `--font-cjk-tc` switched by `:root:lang(zh-Hans|zh-Hant)` — 06's
  Traditional-face ask, satisfied), icons/logo, INV-03.1 (manifest colours, still asked).
- `docs/technical/04-components-sections.md` — the component inventory of record, and the source of every
  component name used here: `SiteHeader` / `PrimaryNav`, `Hamburger`, `LangSwitcher` (`D-04.16`, whose
  disclosure is inlined — there is no `Menu` component), `SubpageBar` (with `BackLink`) + `SubpageHeader` —
  the two components that replace what 06 once called `SubpageShell` — `SiteFooter`, section ids from
  `D-04.3`. `JsonLd` is 06's own
  (§6.6) and is deliberately not in 04's inventory.
- `docs/technical/05-animation-system.md` — `D-05.10`/§5.7 (View Transitions, Back), `D-05.11`/§5.8 (scroll),
  §5.6 (switch cascade), OQ-05.2, OQ-05.4, OQ-05.5 (answered in `D-06.8`).
- `docs/technical/07-forms-integrations.md` — `/api/inquiry`, `#visit`, 303 fallback, `NEXT_PUBLIC_SITE_URL`,
  OQ-07.5, A-07.1 (no consent banner).
- `docs/technical/08-testing-quality.md` — §6.10 gates. `docs/technical/09-deployment-operations.md` — `D-09.5`
  (apex canonical, `www` → apex 308; the `greenpasturesdaycare.com` attachment and Production env value),
  Search Console, preview `noindex`, env. `docs/technical/10-work-breakdown.md` — spike, reserved routes.
  `docs/technical/12-open-questions.md` — OQ-06.n roll-up.
