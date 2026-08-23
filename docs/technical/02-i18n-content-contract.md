# 02 · i18n & content contract

## Purpose

This document is the contract for every user-visible string on the Green Pastures site: where it lives, how it
is named, how it is typed, loaded, validated and rendered, and how the three locales (English, 简体中文,
繁體中文) share one codebase and one URL scheme. It is the binding answer to the human's requirement that *every
user-visible string maps to an easy-to-edit JSON lang file*. It also fixes the one thing the owner must be able
to do without a developer: edit facts and copy in `content/`, including the values that ship as **provisional**
sample defaults until the real ones arrive. Docs 04 (components), 06 (routing/SEO), 07 (forms), 08 (quality
gates) and 09 (operations/editing workflow) build on the identifiers declared here (`D-02.n`, `INV-02.n`) and
must cite them rather than restate them.

Status: draft · seat writer-contracts · 2026-08-22 · revised 2026-08-22 (HD-4, HD-5, HD-6, HD-7, HD-8, HD-9, HD-10)

## Decisions

- **D-02.1 Locales — three (HD-10, 2026-08-22).** The site has exactly three locales: `en` (default and
  *reference* locale), `zh-Hans` (Simplified Chinese — the Chinese that ships at launch and the language of the
  33 prototype translations) and `zh-Hant` (Traditional Chinese — offered as an additional language). **The
  locale id, the URL segment, the `<html lang>` value and the `hreflang` value are the same string** for each
  locale — `en`, `zh-Hans`, `zh-Hant` — so there is no short-code ↔ tag mapping to drift; `LOCALE_META` in
  `src/i18n/routing.ts` carries the per-locale metadata (*Design → Locales*). The plain identifier `zh` no
  longer exists anywhere in the codebase, the content tree, the URLs or the docs (*Design → Retiring the `zh`
  identifier*). `en` is the reference locale: types, the namespace list and parity checks derive from the `en`
  tree.
- **D-02.2 Content tree.** All per-locale text lives under `content/<locale>/` — `content/en/`,
  `content/zh-Hans/`, `content/zh-Hant/` — in two kinds of JSON files: `messages/` (UI copy, one file per
  page/area) and `collections/` (repeatable entries). All locale-agnostic data lives in ONE file,
  `content/site.json`. The exact tree is in *Design → Directory layout*.
- **D-02.3 Text vs data boundary.** Human-readable text is per-locale JSON; every value the code computes with
  or prints as a value — URLs, image paths and dimensions, ratios, age *bounds*, hours, counts, the license
  number, our own brand names, standalone icon emoji, ids and ordering — is locale-agnostic data in
  `content/site.json`. Locale files MUST NOT contain these values; messages that display them take ICU
  arguments (`{adults}`, `{children}`, `{count}`, `{year}`, `{license}`, `{brandName}`). The boundary runs
  *through* numerals, not around them: a numeral the code uses for logic or renders as a value is data, a
  numeral inside editorial prose is part of the sentence and stays per-locale text — age *labels*
  ("6 – 18 months"), `credentials` ("AMS certified · 15 years with little ones") and `relation` ("parent of a
  3-year-old") are text. Our own brand names are data even though they read differently per language: they are
  **localized values** in `site.json` (D-02.19) and never appear in a locale file. One carve-out: the
  third-party name Yelp is the message `common.brand.yelp` (key-naming rule 13).
- **D-02.4 Namespace = file; semantic dotted keys.** The top-level namespace of every message key is the file
  basename (`home.hero.title` lives in `content/<locale>/messages/home.json` at `hero.title`). Keys are
  camelCase, nested `page.section.element`, semantic (never the English text), and stable across redesigns.
  Full rules in *Design → Key naming*.
- **D-02.5 Message syntax.** Messages are ICU MessageFormat strings rendered by next-intl. Rich text uses the
  tag allowlist `em`, `strong`, `link`, `count`, `day`, rendered with `t.rich`; line breaks are `\n` rendered with
  `white-space: pre-line`; HTML is never stored in JSON values. Emoji inline with text (badges, chips, titles)
  stays in the string; emoji that is a standalone element (icon dots) is data. Files are UTF-8 with typographic
  characters stored literally.
- **D-02.6 Numbers, dates, times, plurals.** Counts use ICU `plural`; numbers/dates/times use next-intl
  formatters with named formats from `src/i18n/formats.ts`; weekday names, opening hours and time-of-day
  values are derived from data with `Intl`, not translated; `timeZone` is `America/Los_Angeles`.
- **D-02.7 Loading and typing.** `src/i18n/messages.ts` statically imports every `en` file (this is the single
  source of the namespace list and of the `Messages` type via the next-intl `AppConfig` augmentation) and loads
  other locales by dynamic import. Collections are loaded into the same messages tree under the `collections`
  namespace and are additionally validated with Zod (`src/content/schemas/*`), as is `content/site.json`.
  Validation runs in the loader (so `next build` fails on invalid content) and in `pnpm validate:content`.
- **D-02.8 Missing-key policy.** dev: visible marker `⟦namespace.key⟧` + console error, no fallback. CI:
  `pnpm validate:content` fails on any parity, schema, empty-string or missing-file problem. prod: the locale's
  messages are deep-merged over `en` so a gap renders English and is logged once; empty strings are invalid
  everywhere. Details in *Design → Fallback*.
- **D-02.9 Routing.** `localePrefix: 'always'` → every page is `/en/...`, `/zh-Hans/...` or `/zh-Hant/...`; the
  unprefixed root redirects to the detected locale (locale prefix → `NEXT_LOCALE` cookie set by an explicit
  switch → Accept-Language → `en`); prefixed URLs are authoritative. Accept-Language negotiation maps a bare
  `zh` and any `zh-CN|zh-SG|zh-Hans-*` to **`zh-Hans`**, and `zh-TW|zh-HK|zh-MO|zh-Hant-*` to **`zh-Hant`**
  (*Design → Routing*). `<html lang>` is `LOCALE_META[locale].htmlLang`; `hreflang` alternates (`en`, `zh-Hans`,
  `zh-Hant`, `x-default` → the `en` URL) and the canonical are emitted from route metadata, next-intl's
  `alternateLinks` header is disabled; the sitemap lists every route × locale — with three locales that is
  7 page routes × 3 = **21** indexable URLs, not 14 (06 D-06.12 restates its count). 06 implements.
- **D-02.10 Language switcher — three options.** With three locales the design's two-name toggle
  ("EN · 中文") becomes a **menu**: the nav trigger shows `LOCALE_META[current].shortLabel` (`EN` / `简` /
  `繁`) and opens a list of all three locales by endonym (English · 简体中文 · 繁體中文), current one marked
  `aria-current="true"`. Each option navigates to the *same pathname* under that locale — a next-intl `Link`
  (`href={pathname}` + `locale`, the no-JavaScript path) whose `onClick` calls `event.preventDefault()` and then
  `router.replace(pathname, { locale, scroll: false })` with the `transitionTypes` 05 defines — one navigation,
  not two (path, query and `#hash` preserved). The endonyms and short labels are `LOCALE_META` data, never
  message keys (memo ADJ-13); the retired `common.localeSwitcher.label` template is replaced by
  `common.localeSwitcher.ariaLabel` + `optionAriaLabel` (key-naming rule 11).
  Language is never held only in client state; a dual-bundle client-state toggle is rejected (memo ADJ-4).
  Because the navigation remounts the `[locale]` subtree, the design's per-string crossfade becomes an
  **enter-only staggered cascade per text block** on the new tree: every mounted `Reveal` plays 05's `swap`
  variant (D-05.9) with the design's values as an entrance (200 ms fade + 6 px rise, 14 ms per block, capped at
  300 ms), optionally inside a `<ViewTransition>` crossfade; under `prefers-reduced-motion` the cascade is
  opacity-only with the delays kept. (`WordSwap` is 05's separate keyed swap for the menu sample line / day
  chips, not the locale cascade.) On mobile the switcher lives in the hamburger menu.
- **D-02.11 Collections.** Six collections — `programs`, `menu`, `gallery`, `testimonials`, `teachers`, `faq` —
  each with per-locale text in `content/<locale>/collections/<name>.json`, keyed by the ids declared in
  `content/site.json`, validated by a Zod schema. Inventory and field sketches in *Design → Collections*.
- **D-02.12 Shared config.** `content/site.json` is the ONE locale-agnostic config (brand, contact, e-mail
  sending identity, hours, license, Yelp, social, nav structure, images, per-collection
  ids/order/media/numbers, day and meal ids, plus the `provisional` registry of D-02.20). It is parsed once
  with Zod (`src/content/site.ts`) and never duplicated into locale files. The two fields that genuinely read
  differently per language — `brand.name` and `brand.shortName` — are **localized values** (D-02.19), objects
  keyed by locale id, not translations in a locale file.
- **D-02.13 Per-view copy variants.** Where the design ships shorter mobile copy (the R1 inventory counts about
  two dozen desktop ↔ mobile pairs), the JSON carries a sibling key with the `Short` suffix (`subtitle` /
  `subtitleShort`); both exist in every locale; the component renders per breakpoint with CSS. This is the one
  mechanism — no per-view files, no props. Count differences (3 vs 2 chips, 5 vs 4 filters, 3 vs 2
  testimonials, 7 vs 5 polaroids) are layout slicing over the same collection driven by per-surface flags in
  `site.json` (`onHome`, `onMobile`, `featured`), never duplicated content. The footer license number renders on **both**
  views (the mobile prototype omits it; the root README's "bilingual copyright + license #" wins because the
  license is a trust/legal element) — so `common.footer.copyright` has no `Short` variant and wraps on mobile.
- **D-02.14 Editing workflow.** JSON in git is the source of truth at launch; there is no CMS. Changing copy is
  editing one JSON file; changing a fact is editing `content/site.json` (D-02.18); adding a locale is one
  directory plus one config entry (checklists in *Design → Checklists*); the non-developer PR/preview workflow
  is specified in 09.
- **D-02.15 CJK requirements on 03.** Fredoka and Nunito have no CJK glyphs; 03 must provide a locale-aware
  font stack with a CJK fallback face, scoped by `<html lang>` / `:lang(zh)` — which matches **both**
  `zh-Hans` and `zh-Hant` per CSS language-range matching, so one rule covers both Chinese locales, with
  `:lang(zh-Hant)` available if a Traditional-specific face is ever named — plus Chinese line-height and
  wrapping rules. The design names no CJK typeface, so the system stack stays until the human names one
  (HD-11, memo ADJ-6). Stated in *Design → CJK*.
- **D-02.16 Client exposure of messages.** `NextIntlClientProvider` is mandatory for client components
  (next-intl 4) and must wrap every client component that reads messages or formats — at launch: `Reveal`
  (swap variant), `CountUp`, the inquiry form, the locale switcher, the gallery filters/lightbox, the hamburger
  and the route error boundary (`app/[locale]/error.tsx`, which Next.js requires to be a client component).
  Server components render by default; a client subtree receives only the namespaces it needs (`common`,
  `visit`, `gallery` at launch, plus `errors` for `error.tsx` — 04 keeps the list), never `collections.*`
  wholesale. The menu day chips + `WordSwap` sample line receive **props**, not messages: the server
  component pre-renders the five
  `home.menu.sampleLine` strings and the five `weekdayShort` chip labels and passes
  `{ lines: Record<DayId, ReactNode>, chips: Record<DayId, string>, defaultDay }`.
- **D-02.17 Subpage set — settled (HD-5, 2026-08-22).** Six subpage routes, no more: Philosophy, Programs,
  Menu, Gallery, Reviews, **Team**. "Staff" in `docs/design/README.md` line 17 **is** Team — one page, one
  namespace (`team`), no `staff` namespace ever. **FAQ and Enrollment are reserved, not built:** `faq.json`
  (messages) and `faq.json` (collection) plus `site.json.faq[]` stay in the tree as **optional** namespaces so
  06 can ship the route the day content exists, and they are excluded from parity, the sitemap, the nav and the
  Playwright matrix while `site.json.faq[]` is empty. `visit.json` ships at launch — it holds the inquiry form
  the home Visit section renders; **optional** inside it are only the Enrollment *page*'s own keys
  (`visit.kicker|heading|meta.*`), which stay unused until that page is in scope. This answers OQ-02.7.
- **D-02.18 The owner's entry point is `content/` (HD-8, 2026-08-22).** Everything the owner edits lives in the
  versioned `content/` tree and nowhere else: **words** in `content/<locale>/` (one file per page, plus
  `collections/`), **facts** once in the single shared `content/site.json`. The human's phrasing was "it should
  all be in the lang file"; the contract's reading is *one folder, and one file for the facts* — because a
  phone number, an inbox or a licence number duplicated into three language files is a value that will drift
  the first time one copy is edited and the others are not. A fact whose *rendering* genuinely differs by
  language is not duplicated either: it becomes a localized value keyed by locale in the same one place
  (D-02.19). Nothing user-editable lives in `src/`, in environment variables (secrets only — API keys) or in a
  CMS. The map of "where does X live" is *Design → Where the owner edits*; 09's editor guide names
  `content/` as the single entry point and links that map.
- **D-02.19 Brand names — one string, one place (HD-6, 2026-08-22).** The Chinese brand name is **优朵幼儿园**,
  provisional and not finalised; the prototype's other candidate 绿茵园 (gallery title "绿茵园的生活") is
  **rejected** and must not survive anywhere in copy. Brand names are a **localized value** in `site.json`:
  `brand.name` and `brand.shortName` are objects keyed by locale id with an entry for every locale in
  `routing.locales` — `zh-Hant` carries its own value (優朵幼兒園 / 優朵), it is not derived at runtime from
  `zh-Hans`. Copy never contains a brand name: messages take the ICU arguments `{brandName}`,
  `{brandShortName}` (current locale) and `{brandNameOther}` (the paired locale's name, for the bilingual
  footer — *Design → Brand names*). **Change procedure (one line):** edit `brand.name["zh-Hans"]` (and
  `shortName`) in `content/site.json`, drop the matching `provisional` entries, commit — nothing else in the
  repository mentions the name.
- **D-02.20 Provisional values replace `TODO` (HD-4 · HD-7 · HD-9, 2026-08-22).** The sending domain, the
  inquiry inbox and every owner fact (address, phone, Yelp rating/count/URL, licence #, teacher names and
  credentials) ship **now** as editable sample defaults, not `"TODO"` sentinels, so previews look real and the
  owner edits a value rather than inventing one. Because a plausible fake is indistinguishable from real data,
  every such value is registered in **one `provisional` array of dotted paths in `content/site.json`**.
  `pnpm validate:content` resolves and reports them (and fails if a path does not resolve);
  `pnpm validate:content --release` **fails while the array is non-empty**, and still fails on any literal
  `TODO`/`TBD`/`FIXME` value anywhere in `content/`. Mechanism, the concrete sample defaults and the launch set
  are in *Design → Provisional values*; INV-02.10 is the machine rule; 08 wires the gate, 09 owns the launch
  checklist.
- **D-02.21 `zh-Hant` is machine-seeded, then human-reviewed.** `content/zh-Hant/` MAY be created by converting
  `content/zh-Hans/` with OpenCC (`s2t`, script-only) as a **one-off seeding step run by hand** and committed as
  ordinary content; a named human reviewer then reads every file before the locale is enabled (OQ-02.8).
  Conversion is never a build step, a script in `package.json`, or a runtime transform: that would make
  `zh-Hant` a derived artifact and silently overwrite the reviewer's edits. `s2twp` (Taiwan phrase conversion)
  is **rejected** as the seed — it swaps vocabulary as well as glyphs, which hides real translation choices
  inside a mechanical diff. Recommended and adopted: seed with `s2t`, review by hand, treat every subsequent
  edit as normal content work.

## Design

### Definitions

| Term | Meaning here |
|---|---|
| locale | One of the three languages, identified by a single BCP 47 id used as the URL segment, `lang` and `hreflang`: `en`, `zh-Hans`, `zh-Hant` |
| message | One ICU string addressed by a dotted key, read with `useTranslations` / `getTranslations` |
| namespace | The first key segment; equal to the message file basename (`home`, `common`, `visit`, …) |
| key | The full dotted path of a message (`home.hero.title`); stable, semantic, camelCase |
| collection | A set of repeatable entries (teachers, programs, …) whose text is per-locale and whose ids, order and media are shared |
| shared config | `content/site.json`: the single locale-agnostic data file |
| localized value | A field in `site.json` stored as an object keyed by locale id (`{"en": …, "zh-Hans": …, "zh-Hant": …}`) — data that reads differently per language, still in one place (D-02.19) |
| provisional value | A shipped sample default that is not yet the owner's real value; listed by dotted path in `site.json.provisional` and blocked by `--release` (D-02.20) |
| rich text | A message containing allowlisted tags (`<em>…</em>`) rendered with `t.rich` into React elements |
| reference locale | `en`: the locale whose files define the key set, the namespace list and the TypeScript types |

### Locales

Three locales, one identifier each (D-02.1). `LOCALE_META` in `src/i18n/routing.ts` is the only place these
facts are written; every doc, component and test reads them from it.

| Locale id (= URL segment) | `htmlLang` | `hreflang` | `nativeName` (endonym) | `shortLabel` | `brandPairLocale` | Role |
|---|---|---|---|---|---|---|
| `en` | `en` | `en` | English | `EN` | `zh-Hans` | default · reference locale · `x-default` target |
| `zh-Hans` | `zh-Hans` | `zh-Hans` | 简体中文 | `简` | `en` | Simplified — ships at launch; the 33 prototype translations |
| `zh-Hant` | `zh-Hant` | `zh-Hant` | 繁體中文 | `繁` | `en` | Traditional — additional language, seeded per D-02.21 |

```ts
// src/i18n/routing.ts  (shape only — 06 owns defineRouting's other options)
export const LOCALE_META = {
  'en':      { htmlLang: 'en',      hreflang: 'en',      nativeName: 'English',  shortLabel: 'EN', brandPairLocale: 'zh-Hans' },
  'zh-Hans': { htmlLang: 'zh-Hans', hreflang: 'zh-Hans', nativeName: '简体中文', shortLabel: '简', brandPairLocale: 'en' },
  'zh-Hant': { htmlLang: 'zh-Hant', hreflang: 'zh-Hant', nativeName: '繁體中文', shortLabel: '繁', brandPairLocale: 'en' }
} as const satisfies Record<Locale, LocaleMeta>;
```

Notes. (a) `nativeName` must distinguish the two Chinese locales — "中文" alone is ambiguous once both ship, so
the endonyms are 简体中文 and 繁體中文 (each written in its own script). (b) `shortLabel` is the compact nav
trigger label; the design's single "EN · 中文" toggle no longer fits three options (D-02.10). (c)
`brandPairLocale` is the locale whose brand name the bilingual footer shows beside the current one
(*Brand names*); it is configuration, not a locale branch, so INV-02.9 still holds. (d) Locale ids are
case-sensitive path segments in their BCP 47 canonical casing; the proxy 308-redirects a lower-cased variant
(`/zh-hans/...`) to the canonical form so a hand-typed URL still lands (06 implements).

### Directory layout

Optimised for a non-developer finding "the text for this screen": one file per page, named after the route;
repeatable lists in `collections/`; everything that is not words in `site.json`.

```text
content/
├── site.json                  ONE shared, locale-agnostic config (D-02.12)
├── en/                        reference locale
│   ├── messages/              UI copy — one file per page/area; namespace = file name (D-02.4)
│   │   ├── common.json        nav, footer, language switcher, a11y labels, back control, meta template
│   │   ├── home.json          the 8 home sections (hero … visit) + home meta
│   │   ├── philosophy.json    Philosophy page: chrome, principles, daily rhythm, badges, meta
│   │   ├── programs.json      Programs page chrome, ratio label, footnote, meta
│   │   ├── menu.json          Menu page chrome, meal labels, sample-line template, note, meta
│   │   ├── gallery.json       Gallery page chrome, "All" filter, lightbox hint, meta
│   │   ├── reviews.json       Reviews page chrome, count line, Yelp CTA, meta
│   │   ├── team.json          Team page chrome, role labels, footnote, meta
│   │   ├── faq.json           FAQ page chrome + meta (RESERVED, not built — D-02.17)
│   │   ├── visit.json         inquiry form (labels, options, errors, status) + OPTIONAL Enrollment page
│   │   ├── errors.json        404 / 500 copy
│   │   └── email.json         inquiry notification + auto-reply
│   └── collections/           repeatable entries keyed by the ids in site.json (D-02.11)
│       ├── programs.json      name, ageLabel, summary(+Short), description, highlights[], photoAlt
│       ├── menu.json          week.<day>.<meal> dishes, dietary chip labels(+Short)
│       ├── gallery.json       per-photo alt + caption, category labels
│       ├── testimonials.json  quote, author, relation
│       ├── teachers.json      name, credentials, summary(+Short), bio(+Short), tags[], photoAlt
│       └── faq.json           question, answer (RESERVED, not built — D-02.17)
├── zh-Hans/                   Simplified — identical tree to en/ (three-way parity, INV-02.2)
└── zh-Hant/                   Traditional — identical tree to en/; seeded from zh-Hans (D-02.21)
```

```text
src/
├── i18n/
│   ├── routing.ts         defineRouting({locales, defaultLocale, localePrefix:'always', …}) + LOCALE_META
│   ├── navigation.ts      createNavigation(routing) → Link, redirect, usePathname, useRouter, getPathname
│   ├── request.ts         getRequestConfig: locale resolution, loadMessages, timeZone, formats, onError
│   ├── messages.ts        static imports of every content/en file (types + namespace list) + loadMessages
│   ├── formats.ts         named formats: rating, timeShort, weekdayShort, weekdayLong, dateMonth
│   └── global.d.ts        declare module 'next-intl' { interface AppConfig { Locale; Messages; Formats } }
├── content/
│   ├── schemas/           Zod: site.ts, programs.ts, menu.ts, gallery.ts, testimonials.ts, teachers.ts, faq.ts
│   ├── site.ts            export const site = SiteSchema.parse(siteJson)
│   └── collections.ts     typed accessors joining site.json entries with per-locale text
├── proxy.ts               createMiddleware(routing) — Next.js 16 file name (was middleware.ts before 16)
└── app/[locale]/…         routes (06)
scripts/
└── validate-content.ts    validate:content — parity · ICU args · schemas · ids · assets · provisional · report
```

JSON style: 2-space indent, keys in reading order of the screen (top to bottom), one object per section,
no comments (JSON has none — a `_comment` key is forbidden; explanations go in 09's editor guide), UTF-8, `\n`
for forced line breaks. A Prettier check keeps formatting stable so diffs show only copy changes.

### Key naming

1. Namespaced `page.section.element`; the namespace is the file basename. Sections follow the design's section
   inventory (`docs/design/README.md`): `home.hero`, `home.philosophy`, `home.programs`, `home.menu`,
   `home.gallery`, `home.testimonials`, `home.teachers`, `home.visit`.
2. camelCase segments; no spaces, hyphens or underscores; depth ≤ 6 segments including the namespace
   (`visit.form.fields.childAge.options.infant` is the deepest allowed shape); anything deeper belongs in a
   collection. Both the casing and the depth limit are machine-checked by `pnpm validate:content` (INV-02.2).
3. Keys are never the English text (`"Book a tour": "Book a tour"` is forbidden) and never describe styling
   (`greenSpan`); they name the role: `title`, `eyebrow`, `subtitle`, `intro`, `link`, `ctaPrimary`, `badge`.
   The prototype ids (`hero_title`, `link_gal`, `langbtn` in `docs/design/desktop/Green Pastures - Homepage.dc.html`)
   are inputs only; the contract's keys follow this rule.
4. Lists: a fixed, semantically distinct set is an object keyed by stable ids (`philosophy.principles
   .environment.title`, `visit.form.fields.childAge.options.infant`); a variable-length or
   editor-managed list is a collection (D-02.11); string arrays are allowed only inside collection entries
   (`highlights`, `tags`) and must have the same length in every locale. `line1`/`line2` sprawl is forbidden.
5. Per-view variants: sibling key with suffix `Short` (D-02.13). Examples from the design:
   `home.hero.trust.ages` "Ages 6 months – 4½ years" / `agesShort` "6 mo – 4½ yrs"; `home.hero.mealsCard
   .subtitle` "cooked fresh, on-site daily" / `subtitleShort` "cooked fresh daily"; `common.back.label`
   "← Back home" / `labelShort` "← Back"; `collections.menu.dietary.vegetarian.label` "🥦 Vegetarian options
   daily" / `labelShort` "🥦 Vegetarian daily"; `home.teachers.intro` / `introShort`. The footer copyright has
   no `Short` variant (D-02.13).
6. Accessibility strings: `alt` for images (`home.hero.photo.alt`, `collections.gallery.<id>.alt`,
   `collections.teachers.ping.photoAlt`, `common.logo.alt`), `ariaLabel` for controls
   (`common.nav.menuOpen`, `common.nav.menuClose`, `common.localeSwitcher.ariaLabel`,
   `common.rating.ariaLabel` "Rated {rating, number, rating} out of 5 on Yelp", `common.links.newTab`
   "opens in a new tab", `common.lightbox.close|prev|next`, `common.a11y.skipToContent`).
7. SEO: every page file has `meta.title` and `meta.description` (OG title/description default to them; the OG
   image is shared data); `common.meta.titleTemplate` "%s · {brandName}" and `common.meta.siteName`.
8. Form copy (home Visit section and the Enrollment page share it): `visit.form.fields.<field>.label`,
   `…placeholder`, `…help`, `…errors.<code>` (field-specific override); option sets —
   `visit.form.fields.childAge.options.infant|toddler|preschool|expecting|other` (canonical) and
   `visit.form.fields.desiredStart.options.asap|flexible` plus month options whose ids are `YYYY-MM` for the
   next 12 months, labelled by the `dateMonth` format (no message keys for months); `visit.form.errors.<code>`
   (the canonical code list is in *Design → Forms and email*); `visit.form.requiredLegend` ("* required" —
   the marker itself is punctuation); `visit.form.privacy` (line under the submit button);
   `visit.form.directContact` ("Or email us at {email} / call {phone}" — arguments from `site.json`; appended
   to the `emailFailed`, `network`, `turnstileUnavailable` and `unknown` banners and to the 502/503 path);
   `visit.form.noscript` (the no-JavaScript block, followed by `directContact`); `visit.form.submit`;
   `visit.form.status.submitting`; `visit.form.status.success.title|body|reset` ("Send another");
   `visit.form.status.error.title|body|retry`.
9. Email templates: `email.inquiry.subject|heading|intro|fields.parentName|fields.email|fields.childAge|
   fields.desiredStart|fields.message|fields.preferredLanguage|fields.submittedAt|footer` and
   `email.autoReply.subject|greeting|body|signature` — these two sub-namespaces are canonical; 07 adds none.
10. Error pages: `errors.notFound.title|body|cta`, `errors.serverError.title|body|retry`.
11. Language switcher (three options, D-02.10): `common.localeSwitcher.ariaLabel` "Change language" (the
    trigger, no arguments — its visible label is `LOCALE_META[current].shortLabel`, data) and
    `common.localeSwitcher.optionAriaLabel` "Switch to {locale}" (one per menu option, `{locale}` filled with
    the target's `nativeName`). **Retired:** `common.localeSwitcher.label`, the "{current} · {other}" template
    of the two-locale toggle — a three-way menu has no two-name label; 04 and 10 drop it. The names themselves
    — `shortLabel` (`EN`, `简`, `繁`) and `nativeName` (English, 简体中文, 繁體中文) in `LOCALE_META`,
    `src/i18n/routing.ts` — stay locale-invariant data feeding `{locale}` here and the e-mail "preferred
    language" line; they are never message keys, so adding a locale writes them once (memo ADJ-13, D-02.14).
12. Subpage chrome: `<page>.kicker` (Philosophy / Programs / Sample menu / Gallery / Reviews / Our team),
    `<page>.eyebrow`, `<page>.heading`, `<page>.intro`, `<page>.footnote`; the back control is `common.back.*`.
13. Our own brand names are data, passed as the ICU arguments `{brandName}`, `{brandShortName}` (the current
    locale's localized value) and `{brandNameOther}` (the `brandPairLocale`'s, for the bilingual footer) —
    D-02.19. No locale file may contain 优朵幼儿园, 優朵幼兒園, "Green Pastures" or any other rendering of our
    name; the validator rejects them (INV-02.4), which is what makes the provisional name a one-line change.
    The single carve-out D-02.3 grants: the third-party name Yelp is the message `common.brand.yelp`, because a
    locale may transliterate or annotate a foreign product name and the badge renders it as a standalone label
    — so the word is content like every other word on screen, and each Chinese locale decides its own spelling
    of it.

### Message syntax and formatting

**Rich text.** Allowed tags: `em` (the sage emphasis in headlines and the pull-quote), `strong`, `link` (href
supplied by the component), `count` (wraps an animated number), `day` (bold weekday in the menu sample line).
Tags name a role; the emphasis *colour* (`#6f8a5f` sage in the prototype's inline spans) is a design token owned
by 03, never copy. The design needs rich text in five keys — `home.hero.title`, `home.philosophy.quote`,
`home.visit.title`, `collections.testimonials.meiL.quote` (`truly <em>see</em> her`), `home.menu.sampleLine` —
and production adds two more, the `<count>` wrapper in `home.testimonials.countLine` and `reviews.countLine`;
those seven are the whole set. The hours panel is not one of them: its two lines are two formatted values, not
a tag. A message that needs another tag is a design question for 04, not a new tag. `t.rich` maps tags to
elements; `t.markup` is used only in email templates (07). The prototype's `html: true` / `innerHTML` shape is
rejected: no HTML markup is stored in JSON values, ever.

**Line breaks.** The prototype's `<br>` in the hero and visit titles becomes `\n` in the string, rendered with
`white-space: pre-line`; the component decides per breakpoint whether to honour it. No `<br>` tag exists.

**Quotation marks.** Testimonial quotes are stored bare; the component wraps them with
`common.punctuation.quoteOpen` / `quoteClose` (“ ” in `en`; each Chinese locale picks “ ” or 「 」 in its own
file — 「 」 is the usual Traditional choice), so
quote style is content, not code.

**Escaping.** ICU treats `{ }` as arguments and `'` as the quote character: a literal brace is written `'{'`;
a straight apostrophe is safe except immediately before `{` or `}`; the validator rejects `'{`. Design copy
keeps its straight apostrophes ("Child's age", "we'll"). Typographic characters used by the design — `·`, `—`,
`–`, `→`, `↗`, `⌄`, `½`, `“ ”`, `…` — are stored as UTF-8 characters, never as entities.

**Emoji.** One objective rule: emoji that sits **inline with text** in the same element stays in the string
and is translated with it — `home.hero.badge` "🌿 Montessori daycare · Fremont, CA" / "🌿 蒙特梭利日托 ·
加州弗里蒙特", `home.menu.title` "Fresh breakfast, lunch & snack 🍎", `home.visit.title`,
`home.philosophy.badgeCertified` "🌱 Certified Montessori credentials", and the dietary chips
`collections.menu.dietary.vegetarian.label` "🥦 Vegetarian options daily" / `labelShort` "🥦 Vegetarian daily".
Emoji that is a **standalone element** with no text beside it (the 56/48 px icon dots 🧸 🎨 for the assistant
teachers, the 🏡 🌟 ✋ principle-card icons) is an `icon` field in `content/site.json`.

Example — the hero headline and the programs section, `content/en/messages/home.json` (excerpt):

```json
{
  "hero": {
    "badge": "🌿 Montessori daycare · Fremont, CA",
    "title": "Where small hands\nlearn <em>big things</em>",
    "subtitle": "A warm, bilingual home where children ages 6 months to 4½ grow at their own pace — guided by certified Montessori teachers and nourished by fresh, home-cooked meals.",
    "ctaPrimary": "Book a tour →",
    "ctaSecondary": "See our philosophy"
  },
  "programs": {
    "eyebrow": "Programs & ages",
    "title": "Growing with us, step by step",
    "link": "See all programs →"
  }
}
```

(The excerpt is limited to keys the prototype translates so both samples carry the same key set; the
remaining hero keys — `trust.yelp` "{rating, number, rating} on Yelp", `trust.ages` / `trust.agesShort`,
`mealsCard.*`, `scrollCue` "scroll to come inside ⌄", `photo.alt` — follow the same shape and await
translation.) The same keys in `content/zh-Hans/messages/home.json` (values from the prototype's `I18N` table —
all 33 prototype translations are Simplified, so they seed `zh-Hans` and, through D-02.21, `zh-Hant`):

```json
{
  "hero": {
    "badge": "🌿 蒙特梭利日托 · 加州弗里蒙特",
    "title": "小小的手\n学<em>大大的本领</em>",
    "subtitle": "一个温暖的双语之家：6个月到4岁半的孩子在认证蒙特梭利老师的引导下，按自己的节奏成长，每天享用新鲜的家常餐点。",
    "ctaPrimary": "预约参观 →",
    "ctaSecondary": "了解我们的理念"
  },
  "programs": {
    "eyebrow": "课程与年龄",
    "title": "一步一步，与我们一起成长",
    "link": "查看全部课程 →"
  }
}
```

Component side (04 owns the real component; the tag mapping is the contract):

```tsx
import { useTranslations } from 'next-intl';

export function HeroTitle() {
  const t = useTranslations('home.hero');
  return (
    <h1 className="whitespace-pre-line">
      {t.rich('title', { em: (chunks) => <span className="text-sage">{chunks}</span> })}
    </h1>
  );
}
```

**Plurals and counts.** Both Chinese locales have a single plural category, so their messages carry only
`other`; `en` carries `one`/`other`. The review count is data (`site.yelp.reviewCount`) and the number is wrapped in `<count>` so
05's count-up component can animate it:

```json
{
  "testimonials": {
    "title": "Kind words from our families",
    "countLine": "<count>{count, number}</count> {count, plural, one {review} other {reviews}} · Fremont parents",
    "link": "Read all reviews on Yelp →"
  }
}
```

`zh-Hans` (syntax illustration — wording to be confirmed by the translator): `"title": "来自家庭的暖心话"`,
`"countLine": "<count>{count, number}</count> 条评价 · 弗里蒙特家长"`, `"link": "在 Yelp 阅读全部评价 →"`;
`zh-Hant` carries the same shape in Traditional glyphs.
Other templated strings: `programs.ratioLabel` "{adults}:{children} ratio" (data `[1, 3]`, `[1, 4]`,
`[1, 6]`); `reviews.countLine` "{count, plural, one {# review} other {# reviews}} and counting";
`common.footer.copyright` "© {year} {brandName} · {brandNameOther} · Fremont, CA · License # {license}"
(rendered on both views, D-02.13; `{brandNameOther}` is the `brandPairLocale`'s name — *Brand names*);
`year` is computed at build time, not stored.

**Numbers, dates, times.** Named formats live in `src/i18n/formats.ts` and are referenced by name in ICU
(`{rating, number, rating}` → `minimumFractionDigits: 1`, rendering "5.0") or by `useFormatter()`:
`weekdayShort` / `weekdayLong` (`{ weekday: 'short' | 'long' }`) for the menu day chips ("Mon" / "周一") and the
sample line ("Wednesday" / "星期三"); `timeShort` (`{ hour: 'numeric', minute: '2-digit' }`) for opening hours
("7:30 am – 6:00 pm" in `en` via CSS lowercase of the day period; the Chinese locales render what `Intl`
yields for `zh-Hans` / `zh-Hant`) and the daily-rhythm times; `dateMonth` for the form's "Desired start" value. Ranges use message
templates `common.format.dayRange` "{from} – {to}" and `common.format.timeRange` "{from} – {to}" so a
Chinese locale can choose "{from}至{to}". The request config sets `timeZone: 'America/Los_Angeles'` so "today" (the default
selected menu day) is identical on server and client. Age labels ("6 – 18 months", "1.5 – 3 years",
"3 – 4½ years", "Ages 6 months – 4½ years") are **text per locale** because the `½` typography and unit words
are editorial; the numeric bounds still live in `site.json` (`ageMonths`) for logic and ordering.

### Loading, typing, validation

`src/i18n/messages.ts` imports every `content/en/messages/*.json` and `content/en/collections/*.json`
statically; the resulting object is both the namespace list and the `Messages` type. Other locales are loaded
per namespace by dynamic import. In production the locale's tree is deep-merged over `en` (D-02.8).

```ts
// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { hasLocale, IntlErrorCode } from 'next-intl';
import { routing } from './routing';
import { loadMessages } from './messages';
import { formats } from './formats';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: 'America/Los_Angeles',
    formats,
    onError: (error) => { if (error.code === IntlErrorCode.MISSING_MESSAGE) reportMissing(error); else throw error; },
    // reached only when the key is missing from en as well (prod merges the locale over en): never ''
    getMessageFallback: ({ namespace, key }) => `⟦${[namespace, key].filter(Boolean).join('.')}⟧`
  };
});
```

Typing: `src/i18n/global.d.ts` declares `AppConfig { Locale: (typeof routing.locales)[number]; Messages: typeof
en; Formats: typeof formats }`, so `t('home.hero.title')` is checked at compile time and a misspelt key is a
type error. Strictly typed ICU arguments use the next-intl plugin option `experimental.createMessagesDeclaration`
(it accepts an array of paths — verified against the plugin source 2026-08-22), pointed at every
`content/en/**/*.json`, which generates `.d.json.ts` companions (git-ignored). Collections get a Zod schema
each; `z.infer` is the TypeScript type; the loader parses on first use, so an invalid file fails `next build`
and shows a readable Zod issue in the dev overlay.

```ts
// src/content/schemas/teachers.ts
import { z } from 'zod';
const Text = z.string().trim().min(1);
export const TeacherText = z.object({
  name: Text, credentials: Text.optional(),
  summary: Text, summaryShort: Text.optional(),
  bio: Text, bioShort: Text.optional(),
  tags: z.array(Text).max(3), photoAlt: Text.optional()
});
export const TeachersCollection = z.record(z.string(), TeacherText);   // keyed by id from site.json
export const TeacherShared = z.object({
  id: z.string(), head: z.boolean().default(false), icon: z.string().emoji().optional(),
  photo: z.object({ src: z.string(), width: z.number().int(), height: z.number().int() }).optional()
});
export type TeacherText = z.infer<typeof TeacherText>;
```

`pnpm validate:content` (`scripts/validate-content.ts`, no Next.js needed, runs in CI per 08) performs, for
each of the two non-reference locales: key-set parity with `en` (messages and collections), ICU-argument and
rich-tag parity per key, equal array lengths, key shape (camelCase segments, depth ≤ 6 — *Key naming* rule 2),
no empty strings, no `'{`, no HTML tags, no locale-agnostic values (URL, `/images/`, phone, license, brand-name
patterns) in locale files; Zod validation of `site.json` and every collection, including completeness of every
localized value across `routing.locales`; id cross-references (every `site.json` entry has text in every locale
and vice versa); every `photo`/`image` in `site.json` exists under `public/` and has an `alt` in every locale;
resolution and reporting of the `provisional` registry (D-02.20); and it writes `reports/content-coverage.md`
(keys per locale, missing/extra, percentage, provisional list) that CI attaches to the PR (INV-02.6).

Flags: `--report` writes the coverage report; `--warn-locale <id>` demotes that locale's parity failures to
warnings (the phased-translation mechanism 08 and 10 use while `zh-Hans` / `zh-Hant` are being filled in);
`--release` is the launch gate — it ignores `--warn-locale`, requires every locale in `routing.locales` to be
complete (INV-02.11) and fails while any provisional value remains (INV-02.10). Parity is now **three-way**:
`en` is compared against `zh-Hans` and `zh-Hant` independently, and a key missing from both is two failures,
not one.

Client exposure (D-02.16): `NextIntlClientProvider` is mandatory for client components in next-intl 4; layouts
pass only the namespaces a client subtree needs (`common`, `visit`, `gallery`, plus `errors` on the route error
boundary), never `collections.*`
wholesale — 04 lists the client components and their namespaces; the remaining text is rendered by server
components and reaches the browser as HTML only. The menu's five sample lines and chip labels are rendered on
the server and handed to the client `WordSwap` as props (D-02.16), so the `menu` collection never ships.

### Fallback and missing keys

| Environment | Behaviour |
|---|---|
| dev (`next dev`) | A missing key renders the visible marker `⟦home.hero.title⟧` and logs a console error with namespace and key; no fallback to `en` so gaps are seen while editing. A missing namespace file throws at load with the path to copy from `en`. |
| CI | `pnpm validate:content` fails the pipeline on any parity/schema/empty-string/missing-file/asset/provisional-registry problem; `next build` fails on invalid collections; Playwright smoke renders every route × locale (INV-02.5). Translators therefore commit complete files; partial translation is an explicit human decision (OQ-02.2) expressed as `--warn-locale <id>`, never as a silent gap. |
| prod | Defence in depth only: the locale tree is deep-merged over `en`, so a key that slipped through renders English, and `onError` logs `MISSING_MESSAGE` once per key to the platform logs (09). A key absent from `en` as well renders the `⟦namespace.key⟧` marker — `getMessageFallback` never returns an empty string (INV-02.8). |

Empty string `""` is invalid in every file and environment (an element with no text is a component decision,
not content). While a Chinese locale is allowed to lag (OQ-02.2; the phase policy in 10), its parity failures
are demoted with `--warn-locale zh-Hans` / `--warn-locale zh-Hant` and the coverage report becomes the editor's
to-do list; the fallback to `en` remains, and `--release` refuses the demotion (INV-02.11).

### Routing

- `localePrefix: 'always'`: `/en`, `/en/programs`, `/zh-Hans`, `/zh-Hans/programs`, `/zh-Hant`,
  `/zh-Hant/programs`. Justification: every page has exactly one URL per locale, `hreflang` pairs are
  symmetric, no URL's meaning depends on a cookie (CDN-cacheable, shareable), and adding a locale changes no
  existing URL. The cost is one redirect on the bare root.
- Root and unprefixed paths redirect (next-intl proxy) to the detected locale: locale prefix → `NEXT_LOCALE`
  cookie (next-intl default settings; written by an explicit switch) → Accept-Language best fit → `en`.
  Prefixed URLs never redirect. Detection on the bare root is on (decided here; the next-intl default).
- **Chinese negotiation (decided here, 06 implements).** Accept-Language rarely carries a script subtag, so the
  best-fit mapping is explicit (table below) and lives beside `LOCALE_META`. A lower-cased path variant
  (`/zh-hans/...`, `/ZH-HANT/...`) 308-redirects to the canonical casing; the canonical, `hreflang` and the
  sitemap only ever emit `zh-Hans` / `zh-Hant`.
- The proxy (`src/proxy.ts`, `createMiddleware(routing)`) runs as a Vercel Function; its matcher excludes
  `/api`, `/_next`, `/_vercel` and files with extensions. The site is therefore **not** a static export
  (`output: 'export'` is never promised — the proxy does not run there and locale negotiation would be lost,
  memo ADJ-2). The inquiry Route Handler receives the locale as a form field (07), not from the path.
- `<html lang>` = `LOCALE_META[locale].htmlLang` (`en`, `zh-Hans`, `zh-Hant`) — glyph forms (Simplified vs
  Traditional) and CJK font fallback hang off this attribute (D-02.15). Unknown-locale 404 renders the root
  `not-found` in `en`.
- `hreflang`: each page's metadata emits `alternates.languages` for every locale plus `x-default` → the `en`
  URL, and `alternates.canonical` = its own URL; next-intl `alternateLinks: false` so the header and the tags
  cannot disagree. The sitemap lists every route × locale (21 URLs at launch) with the same alternates.
  06 owns the route list and implementation.
- All pages are statically generated per locale (`generateStaticParams` over `routing.locales`); the static
  rendering hook is whichever next-intl recommends for the pinned Next.js major (06 decides).
- Detail page ↔ home section ids are data, not code: `site.json.routes[] {id, path, homeAnchor}` (D-02.12) is
  the single mapping the "learn more →" links, the Back control and 05's slide transition rely on, so a
  renamed route or anchor is one edit and cannot desynchronise locales.

Accept-Language → locale (the negotiation table 06 implements):

| Accept-Language tag | Resolves to | Why |
|---|---|---|
| `zh`, `zh-CN`, `zh-SG`, `zh-MY`, `zh-Hans-*` | `zh-Hans` | Simplified regions; a bare `zh` gets the launch Chinese |
| `zh-TW`, `zh-HK`, `zh-MO`, `zh-Hant-*` | `zh-Hant` | Traditional regions |
| `en-*` or anything unmatched | `en` | default locale |

### Language switcher and the crossfade

The switcher lists all three locales (D-02.10). Each option is a `Link` from `src/i18n/navigation.ts` with
`href={pathname}` and `locale={target}` (search and hash appended by the component), so it works without
JavaScript, sets `hreflang` on the anchor and is a real navigation: locale lives in the URL, never only in
client state (INV-02.7). On desktop the design's single "EN · 中文" nav item becomes a trigger showing the
current `shortLabel` (`EN` / `简` / `繁`) and nothing else — **no chevron, no disclosure glyph** (ADJ-20;
the trigger's remaining visual treatment is 06's OQ-06.10) — opening a three-item menu of endonyms;
on mobile the three items sit directly in the hamburger menu, no nested disclosure
(`docs/design/mobile/README.md`). 04 owns the markup (menu semantics, focus handling, `aria-current`); the
option order is `routing.locales` order — English, 简体中文, 繁體中文.

Because switching is a navigation that remounts the `[locale]` subtree, the prototype's in-place per-string
crossfade (`docs/design/desktop/Green Pastures - Homepage.dc.html`, `toggleLang`: fade to `opacity 0` /
`translateY(6px)` over `.2s`, swap text at `210 ms + min(i × 14, 300) ms`, fade back) cannot be a literal
port (memo ADJ-4). The contract is:

- The switch **is** the navigation: the anchor is a next-intl `Link` (plain link without JavaScript); with
  JavaScript its `onClick` calls `preventDefault()` and `router.replace(pathname, { locale, scroll: false })`
  from `src/i18n/navigation.ts`, passing 05's `transitionTypes` — exactly one navigation. Scroll position is
  preserved.
- 05's `Reveal` primitive wraps every message-rendered text **block** (a title, an eyebrow, a paragraph, a
  link, a button label — not individual words) and registers an index in document order.
- **Enter-only, per block.** When the new locale's tree mounts, every mounted `Reveal` plays the `swap` variant
  (05 D-05.9): from `opacity 0` / `translateY(6px)` to rest over 200 ms, delayed 14 ms per block index and
  capped at 300 ms — the design's values used as an entrance. There is no exit phase on the old tree (it is
  unmounted by the navigation); 05 may wrap the region in a `<ViewTransition>` crossfade so the old text fades
  rather than cuts. `WordSwap` (05's keyed `AnimatePresence` swap) is used for the menu sample line and day
  chips only, not for the locale cascade.
- `prefers-reduced-motion: reduce` → the cascade becomes opacity-only (no rise) with the same delays.
- 05 owns the implementation (Motion variants, index registry, easing tokens from 03); 04 wraps text in
  `Reveal`; this document fixes the timings and the rule that the swap *is* the navigation.

### Collections

Principle: human-readable text per locale; ids, order, numbers, URLs, paths, flags and icons shared. Every
collection is an object keyed by id in `content/<locale>/collections/<name>.json`; `content/site.json` lists
the ids in display order with the shared fields. The validator enforces id parity both ways (INV-02.3).

| Collection | Per-locale text fields (`content/<locale>/collections/…`) | Shared fields in `site.json` | Example id |
|---|---|---|---|
| `programs` | `name` "Infant", `ageLabel` "6 – 18 months", `summary` "Nurturing care, sensory play & gentle daily rhythms." / `summaryShort`, `description`, `highlights[]` ("Daily photo updates", "Gentle rhythms"), `photoAlt` | `id`, `ageMonths` `[6, 18]`, `ratio` `[1, 3]`, `photo {src,width,height}`, `featured` (Toddler raised) | `infant`, `toddler`, `preschool` |
| `menu` | `week.<day>.<meal>` dish text (5 × 3 = 15: "Oatmeal & banana" … "Banana muffin"), `dietary.<id>.label` / `labelShort` ("🥦 Vegetarian options daily" / "🥦 Vegetarian daily" — emoji inline, so in the string) | `days` `["mon","tue","wed","thu","fri"]`, `meals` `["breakfast","lunch","snack"]`, `dietary[] {id, onHome}` | `wed`, `vegetarian` |
| `gallery` | `photos.<id>.alt`, `photos.<id>.caption` (optional), `categories.<id>` ("Classroom", "Outdoors", "Meals", "Celebrations") | `photos[] {id, src, width, height, category, wide, rotation, onHome, onMobile}`, `categories[] {id, onMobile}` | `g01`, `classroom` |
| `testimonials` | `quote` (rich: `<em>see</em>`), `author` "Mei L.", `relation` "parent of a 3-year-old" | `id`, `rating`, `sourceUrl`, `onHome`, `onMobile`, order | `meiL`, `davidPriya`, `karenT`, `alanW` |
| `teachers` | `name` "Ms. Ping" / "Ms. Chen 陈老师", `credentials` "AMS certified · 15 years with little ones", `summary` / `summaryShort`, `bio` / `bioShort`, `tags[]` ("AMS certified", "English · 中文", "Parent partnership"), `photoAlt` | `id`, `head` (only `ping`), `photo` (only `ping` — the design's photo-slot rule), `icon` 🧸 / 🎨, order | `ping`, `reyes`, `chen` |
| `faq` | `question`, `answer` (rich allowed) | `id`, order, optional `topic` | reserved, not built (D-02.17) |

Notes per collection:

- **menu.** Day and meal identifiers are locale-agnostic ids (`mon`…`fri`, `breakfast|lunch|snack`); the
  chip labels ("Mon" / "周一") and long names ("Wednesday" / "星期三") are *derived* with the `weekdayShort` /
  `weekdayLong` formats, never stored. The default selected day is the current weekday in
  `America/Los_Angeles` (logic, not content; weekend → `mon`). The home sample line is the message
  `home.menu.sampleLine` = `"<day>{weekday}</day> — {breakfast} · {lunch} · {snack}"` filled from the collection,
  so the prototype's hand-written variant ("tofu & veggie stir-fry with brown rice") becomes the table cell text
  ("Tofu & veggie stir-fry, brown rice") — one source. **Flag for 04:** this is a deliberate deviation from the
  prototype (cells are capitalised and comma-joined); 04 decides whether CSS lowercases them. The five lines
  are rendered on the server and passed to the client `WordSwap` as props (D-02.16). Meal labels "Breakfast /
  Lunch / Snack" are `menu.meals.<id>`; the note "Sample menu — the live menu is posted each Monday." is
  `menu.note`.
- **programs.** "1:3 ratio" renders through `programs.ratioLabel` with `{adults}`/`{children}` from `ratio`.
  Mobile shows two of the three highlights (slicing, D-02.13). The footnote "All programs include breakfast,
  lunch & snack, daily outdoor time, and bilingual circle time." is `programs.footnote`.
- **gallery.** Filter chip "All" is `gallery.filters.all`; category names are collection text. Home shows
  `onHome` photos (7 desktop / 5 mobile by layout). Lightbox labels are `common.lightbox.*`.
- **testimonials.** Quote marks come from `common.punctuation.*` (locale-aware); the Yelp URL and rating are
  shared. Surface membership is data: the design shows Mei L. and David & Priya everywhere, Karen T. on desktop
  only (`onMobile: false`), Alan W. on the Reviews page only (`onHome: false`) — 04 filters by these flags and
  slices by breakpoint count. Whether the Chinese locales show translated quotes or the original English is
  OQ-02.6.
- **teachers.** Role labels "Head teacher" / "Assistant teacher" are `team.roles.head|assistant`
  (rendered uppercase by CSS); the HEAD TEACHER badge and the photo-slot rule come from `site.json` (`head`,
  `photo`). Display names are per-locale text so a Chinese locale may show "陈老师" / "陳老師" alone. The three
  shipped names and their `credentials` are the design's samples and are **provisional** in every locale
  (D-02.20) — the only provisional values that live outside `site.json`, because they are text, not facts.
- **faq.** Reserved, not built (D-02.17 / HD-5): `faq.json` and an empty `site.json.faq[]` stay in the tree so
  06 can ship the route the day content exists; while the array is empty the namespace is exempt from parity,
  the sitemap, the nav and the smoke matrix.

Fixed, non-repeating structured content stays in messages as keyed objects: philosophy principles
(`philosophy.principles.environment|followTheChild|handsOn.title|body`, icons in `site.json
.principles[]`), the daily rhythm (`philosophy.day.arrival|outdoor|lunch|rest.title|body`; times `08:00`,
`10:30`, `12:00`, `13:30` in `site.json.dailyRhythm[]`, formatted with `timeShort`), the info panel labels
(`home.visit.info.visitLabel|hoursLabel|languagesLabel`, `home.visit.info.city` "Fremont, California",
`home.visit.info.languages` "English · 中文 (Mandarin)") and the form select options
(`visit.form.fields.childAge.options.infant|toddler|preschool|expecting|other` — the canonical set).

### Shared config — `content/site.json`

| Section | Fields (locale-agnostic unless marked *localized value*) |
|---|---|
| `brand` | `name` and `shortName` — **localized values** keyed by locale id (D-02.19) — plus `url` (site origin, `metadataBase`) |
| `contact` | `phone` (E.164, for `tel:`), `phoneDisplay` (what the page prints), `email` (the public inquiry inbox and the notification recipient), `address {street, city "Fremont", region "CA", postalCode, country "US"}`, `mapsUrl` |
| `email` | the sending identity 07 uses: `sendingDomain` (the domain verified with Resend), `fromAddress` (envelope/from address on that domain; the display name is `brand.name[locale]`, never duplicated here), optional `notifyTo` (defaults to `contact.email`) |
| `provisional` | the registry of D-02.20 — an array of dotted paths whose values are sample defaults, read only by the validator |
| `license` | the license number — sample default `000000000` from the design footer |
| `hours` | `{ days: ["mon","tue","wed","thu","fri"], open: "07:30", close: "18:00" }` — rendered, never typed by editors |
| `timeZone` | `America/Los_Angeles` |
| `yelp` | optional block: `rating` (design sample 5.0), `reviewCount` (design sample 47), `url` (absent from the design — sample); the whole block may be deleted if the daycare has no Yelp page |
| `social` | optional `{ instagram?, facebook?, wechat? }` URLs |
| `ages` | `{ minMonths: 6, maxMonths: 54 }` — logic only; labels are text (D-02.3) |
| `routes[]` | `{id, path, homeAnchor}` for the six detail pages — `philosophy → /philosophy → #philosophy`, `programs`, `menu`, `gallery`, `reviews`, `team → /team → #teachers` — the **stable** mapping the Back control and the section "learn more →" links use (05's slide, 06's routes); ids never change |
| `nav` | `primary[] {id, routeId}` (philosophy, programs, menu, gallery, reviews, team), `footer[]` (the six + contact), `cta {href: "/#visit"}`; labels are `common.nav.<id>` |
| `images` | `hero`, `philosophy`, `map`, `og` — `{src, width, height}`; alt text is per-locale |
| `programs[]` · `teachers[]` · `gallery.photos[]` · `gallery.categories[]` · `testimonials[]` · `faq[]` | per-collection shared fields as in the table above |
| `menu` | `days`, `meals`, `dietary[] {id, onHome}` (chip emoji lives in the label text) |
| `principles[]` · `dailyRhythm[]` | `{id, icon}` · `{id, time}` |

Excerpt (valid JSON, no secrets — the file is shipped to the client where needed; the `provisional` array is
stripped by `src/content/site.ts` before any client import, so it never reaches the browser):

```json
{
  "brand": {
    "name": { "en": "Green Pastures Montessori Daycare", "zh-Hans": "优朵幼儿园", "zh-Hant": "優朵幼兒園" },
    "shortName": { "en": "Green Pastures", "zh-Hans": "优朵", "zh-Hant": "優朵" },
    "url": "https://greenpastures.example"
  },
  "contact": {
    "phone": "+15105550142", "phoneDisplay": "(510) 555-0142",
    "email": "hello@greenpasturesdaycare.com",
    "address": { "street": "1234 Sample Way", "city": "Fremont", "region": "CA", "postalCode": "94538", "country": "US" }
  },
  "email": { "sendingDomain": "mail.greenpasturesdaycare.com", "fromAddress": "no-reply@mail.greenpasturesdaycare.com" },
  "license": "000000000",
  "yelp": { "rating": 5.0, "reviewCount": 47, "url": "https://www.yelp.com/biz/green-pastures-montessori-daycare-fremont" },
  "provisional": ["brand.url", "brand.name.zh-Hans", "contact.email", "email.sendingDomain", "license", "yelp.rating"]
}
```

The `provisional` array above is abbreviated for the fence; the full Phase 3 set is the table in *Provisional
values*. Unchanged sections (`hours`, `timeZone`, `menu`, `teachers[]`, `routes[]`, …) keep the shapes the
table lists, e.g. `"teachers": [{ "id": "reyes", "icon": "🧸" }, { "id": "ping", "head": true, "photo":
{ "src": "/images/team/ping.jpg", "width": 800, "height": 800 } }, { "id": "chen", "icon": "🎨" }]`.

The order of `teachers[]` is the design's desktop order (Reyes · Ping · Chen); mobile reorders by layout
(`head` first), not by content.

Owner-supplied values the design does not show — `contact.*`, `email.*`, `yelp.*`, `brand.url`, `license` —
are **required** fields in the site schema and ship as editable sample defaults, not `"TODO"` (D-02.20 /
*Provisional values*). The select options for "Child's age" are message keys, not shared data.

### Brand names

One string, one place (D-02.19). `brand.name` and `brand.shortName` are localized values; components read
`site.brand.name[locale]` and pass it into ICU as `{brandName}` / `{brandShortName}`. Three consequences worth
stating, because they are what makes 优朵幼儿园 changeable in one edit:

- **No locale file contains the name.** The prototype's `zh` gallery title "绿茵园的生活" is re-authored as
  `home.gallery.title` = "{brandShortName}的日常" (and the `zh-Hant` equivalent). 绿茵园 is rejected (HD-6) and
  the validator's brand-name pattern (INV-02.4) keeps it from coming back through a translation.
- **The bilingual footer takes a second argument.** `common.footer.copyright` receives `{brandName}` (current
  locale) and `{brandNameOther}` = `brand.name[LOCALE_META[locale].brandPairLocale]`. With the pairs in the
  *Locales* table the `en` footer prints "Green Pastures Montessori Daycare · 优朵幼儿园", the `zh-Hans` footer
  prints "优朵幼儿园 · Green Pastures Montessori Daycare", the `zh-Hant` footer "優朵幼兒園 · Green Pastures
  Montessori Daycare". The Traditional name never appears on the English page. Nothing branches on the locale
  — the pairing is `LOCALE_META` configuration, so INV-02.9 holds.
- **`zh-Hant` has its own value.** 優朵幼兒園 is stored, not converted at runtime; a name that later differs by
  more than glyphs (a different Traditional rendering entirely) needs no code change.

Change procedure: edit `brand.name["zh-Hans"]` (and `shortName`), remove the matching `provisional` entries,
commit. `pnpm validate:content` proves nothing else references the old string.

### Provisional values

The problem HD-4/HD-7 create and HD-9 names: the repository must ship a phone number, an inbox, an address, a
licence number, Yelp figures and teacher names that *look* real so previews and layout are honest, and a
plausible fake is exactly what a `TODO` scan cannot see. (09 §4.11 already flagged the licence number
`000000000` as invisible to the old gate.)

**Mechanism (chosen: a registry, not a value prefix).** `content/site.json` carries
`provisional: string[]` — dotted paths naming every value that is a sample default. Why this over a
`PROVISIONAL:` value prefix: a prefix cannot mark a non-string (`yelp.rating` is a number, `yelp.reviewCount`
is an integer) without changing its type and breaking both the Zod schema and the ICU number formats, and it
leaks into rendered output the moment one call site forgets to strip it. The registry marks any value of any
type, is one list the owner can read top-to-bottom and shorten as they replace things, and costs the renderer
nothing.

Path grammar — three forms, all of them the addressing style this document already uses:

| Form | Means | Example |
|---|---|---|
| `<path>` | a field in `content/site.json` | `contact.email`, `brand.name.zh-Hans`, `yelp.rating` |
| `collections.<name>.<id>.<field>` | one collection text field, **in every locale** | `collections.teachers.ping.name` |
| `messages.<namespace>.<key>` | one message key, in every locale (rare; last resort) | `messages.home.hero.subtitle` |

Rules: entries are unique; every path must resolve (an unresolvable path fails `validate:content` in every
mode, so a deleted value cannot leave a stale marker); a locale-suffixed path (`brand.name.zh-Hans`) marks that
one locale's value; removing an entry is the owner's assertion that the value is real — nothing can verify
that for them, which is why the list is short, readable and reviewed at the launch gate.

**Gate behaviour.** `pnpm validate:content`: resolves the registry, prints a "provisional values" block
(path · current value · file) and includes it in `reports/content-coverage.md`; exit 0 — provisional values are
normal during development. `pnpm validate:content --release`: **fails** while `provisional` is non-empty,
listing every remaining path, and additionally fails on any literal `TODO`/`TBD`/`FIXME`/`XXX` value anywhere
in `content/`. There is no runtime marker in the UI: the validator output and the coverage report are the whole
surface, so 04 and 06 need no provisional-aware components. 08 wires the gate into CI; 09 owns the launch
checklist that reads the report.

**The Phase 3 set** — what ships the day the content tree is created, and what the launch gate must see gone:

| Provisional path | Sample default shipped at Phase 3 | Launch action |
|---|---|---|
| `brand.url` | `https://greenpastures.example` | replace with the real origin (HD-3 domain) |
| `brand.name.zh-Hans` · `brand.shortName.zh-Hans` | 优朵幼儿园 · 优朵 | confirm or replace (HD-6, not finalised) |
| `brand.name.zh-Hant` · `brand.shortName.zh-Hant` | 優朵幼兒園 · 優朵 | confirm or replace |
| `contact.email` | `hello@greenpasturesdaycare.com` | replace with the real inquiry inbox |
| `contact.phone` · `contact.phoneDisplay` | `+15105550142` · `(510) 555-0142` | replace (555-01xx is the reserved fictional range) |
| `contact.address.street` · `contact.address.postalCode` | `1234 Sample Way` · `94538` | replace |
| `contact.mapsUrl` | `https://maps.google.com/?q=1234+Sample+Way+Fremont+CA` | replace with the real place link |
| `email.sendingDomain` | `mail.greenpasturesdaycare.com` | replace — must be a domain verified in Resend (07/09) |
| `email.fromAddress` | `no-reply@mail.greenpasturesdaycare.com` | replace, on the verified sending domain |
| `license` | `000000000` (the design footer's) | replace with the real licence number |
| `yelp.rating` · `yelp.reviewCount` · `yelp.url` | `5.0` · `47` · a plausible Yelp biz URL | replace with the real figures **or delete the `yelp` block** |
| `collections.teachers.{ping,reyes,chen}.name` | the design's names (Ms. Ping, Ms. Reyes, Ms. Chen) | replace with the real teachers |
| `collections.teachers.{ping,reyes,chen}.credentials` | the design's credential lines | replace |

A row naming two paths is two entries, and `{ping,reyes,chen}` is shorthand for three — 23 entries in total,
verbatim, so 08 and 10 can seed the file without re-deriving them. The fence wraps the one `site.json` key in
an object so it is a parseable JSON document; the key merges into the file shown above, it is not the file:

```json
{
  "provisional": [
    "brand.url", "brand.name.zh-Hans", "brand.name.zh-Hant", "brand.shortName.zh-Hans", "brand.shortName.zh-Hant",
    "contact.email", "contact.phone", "contact.phoneDisplay", "contact.address.street", "contact.address.postalCode",
    "contact.mapsUrl", "email.sendingDomain", "email.fromAddress", "license",
    "yelp.rating", "yelp.reviewCount", "yelp.url",
    "collections.teachers.ping.name", "collections.teachers.reyes.name", "collections.teachers.chen.name",
    "collections.teachers.ping.credentials", "collections.teachers.reyes.credentials",
    "collections.teachers.chen.credentials"
  ]
}
```

Not provisional, and deliberately so: `contact.address.city` "Fremont", `contact.address.region` "CA",
`contact.address.country` "US", `hours`, `timeZone`, `ages` — the design and the human state these, so marking
them would train the owner to skim the list. An entry is cleared either by replacing the value or by deleting
an optional field (the `yelp` block, `social`) together with its markers.

**Why the mail samples read `greenpasturesdaycare.com` and `brand.url` does not (ADJ-24, 2026-08-22).** The
three sending-identity samples — `email.sendingDomain`, `email.fromAddress`, `contact.email` — are spelled
against the domain the owner actually holds (HD-13), matching 07 D-07.10, so the owner can paste them into
Resend instead of first inventing a hostname. Only the spelling changed; two facts about them did not:

- **The sending domain is a separate value from the site domain.** `email.sendingDomain` is its own field.
  Nothing derives it from `brand.url` or from `NEXT_PUBLIC_SITE_URL` at runtime, and nothing derives those
  from it; the two happening to share a registrable domain today is a coincidence of the sample, not a rule.
  An owner who sends from a wholly unrelated host edits that one field and breaks nothing; no code may
  reconstruct either value from the other, and none does.
- **It stays provisional until Resend verifies it.** A recognisable address is not a sending one — the DKIM/SPF
  records and the Resend verification are 09's DNS work — so all three paths remain in `provisional` and
  `pnpm validate:content --release` still blocks launch on them (INV-02.10; 07's OQ-07.6 stays open).

`brand.url` keeps `https://greenpastures.example` until OQ-09.10 decides whether the field survives at all.
`.example` is the reserved placeholder TLD (RFC 2606): that sample can never resolve, cannot be mistaken for
the real site, and is still a syntactically valid URL, so Zod's `url()` check and every preview render behave
exactly as they will in production. The mail samples are ordinary valid addresses and pass `email()` the same
way — a real TLD costs the validator nothing; what keeps them from shipping silently is the registry, not
their spelling.

### Where the owner edits

The single entry point is the `content/` folder (D-02.18). 09's editor guide expands this map; nothing outside
the files named here is owner-editable.

| The owner wants to change | File | Note |
|---|---|---|
| Any sentence on a page | `content/<locale>/messages/<page>.json` | one file per page; the same key exists in all three locales |
| A teacher, programme, photo caption, review, menu dish | `content/<locale>/collections/<name>.json` | text only; ids, order and photos are in `site.json` |
| Phone, inbox, address, hours, licence #, Yelp figures, sending domain | `content/site.json` | once, for all languages — never per locale (that is how facts drift) |
| The brand name in any language | `content/site.json` → `brand.name` | a localized value: one object, one entry per locale (D-02.19) |
| Which photos/reviews appear on the home page | `content/site.json` (`onHome`, `onMobile`, `featured`) | layout flags, not copy |
| A value that is still a placeholder | `content/site.json` → `provisional` | replace the value, then delete its line here (D-02.20) |
| Anything else (routes, components, secrets) | not owner-editable | API keys are environment variables (09); the rest is code |

### Retiring the `zh` identifier

`zh` was a locale id in the merged plan and is now nothing at all. Every doc that carries one of these shapes
must correct it; the substitution is mechanical except where noted.

| Old shape | New shape | Where it appears |
|---|---|---|
| locale id `'zh'`, `` `zh` `` in prose | `zh-Hans` (the launch Chinese) — or "the Chinese locales" when the sentence means both | all 13 docs; 10 and 09 carry the most |
| URL `/zh`, `/zh/...`, `/zh/programs` | `/zh-Hans/...` (+ the new `/zh-Hant/...` row where a matrix lists locales) | 06, 08, 10, 12 |
| `content/zh/**`, `content/zh/messages/…` | `content/zh-Hans/**` (+ `content/zh-Hant/**`) | 02, 08, 09, 10 |
| `[{locale:'en'},{locale:'zh'}]`, 2-row locale matrices, "× 2 locales", 14 URLs | three rows, "× 3 locales", 21 URLs | 06, 08, 10 |
| `:lang(zh)`, `:root:lang(zh)` | unchanged — the selector already matches `zh-Hans` and `zh-Hant` (D-02.15) | 03 |
| `locale === 'zh'` | forbidden outright (INV-02.9); use `LOCALE_META`, content or `:lang()` | 03, 04 |
| `hreflang="zh"`, `NEXT_LOCALE=zh` | `zh-Hans` / `zh-Hant`; negotiation table in *Routing* | 06 |
| `brand.nameZh`, `{brandNameZh}` | `brand.name` localized value; `{brandName}` / `{brandNameOther}` (D-02.19) | 02, 06, 09, 12 |
| `--warn-locale zh` | `--warn-locale zh-Hans` and/or `--warn-locale zh-Hant` | 08, 10 |
| "EN · 中文" toggle, `common.localeSwitcher.label` | three-option menu; `ariaLabel` + `optionAriaLabel` (D-02.10) | 04, 06, 10 |
| "two locales", "both locales", "en and zh" | three locales; `en`, `zh-Hans`, `zh-Hant` | 00, 01, 04, 05, 07, 08, 09, 10, 12 |

### Per-locale string homes (coverage map)

| Design area (`docs/design/README.md` section inventory) | Namespace / keys |
|---|---|
| Sticky nav, hamburger, footer links | `common.nav.<id>` (philosophy "Philosophy" / "教学理念", programs "Programs" / "课程班级", menu "Menu" / "餐点", gallery "Gallery" / "相册", reviews "Reviews" / "家长评价", team "Our Team" / "我们的团队", contact "Contact"), `common.nav.bookTour` "Book a tour" / "预约参观", `common.nav.menuOpen|menuClose`, `common.localeSwitcher.*`, `common.logo.alt` |
| Hero | `home.hero.badge|title|subtitle|subtitleShort|ctaPrimary|ctaSecondary|trust.yelp|trust.ages|trust.agesShort|mealsCard.title|mealsCard.subtitle|mealsCard.subtitleShort|scrollCue|photo.alt` |
| Philosophy section | `home.philosophy.eyebrow|quote|attribution|badgeCertified|badgeBilingual|link|photo.alt` |
| Programs section | `home.programs.eyebrow|title|intro|link` + `collections.programs.*` |
| Menu section | `home.menu.eyebrow|title|intro|sampleLine|link`, `menu.meals.*`, `collections.menu.*` |
| Gallery section | `home.gallery.eyebrow|title|intro|link` + `collections.gallery.*` |
| Testimonials section | `home.testimonials.title|countLine|link`, `common.brand.yelp`, `common.rating.ariaLabel`, `common.links.newTab` + `collections.testimonials.*` |
| Teachers section | `home.teachers.eyebrow|title|intro|introShort|link`, `team.roles.head|assistant` + `collections.teachers.*` |
| Cross-cutting punctuation/format | `common.punctuation.quoteOpen|quoteClose`, `common.format.dayRange|timeRange`, `common.brand.yelp` |
| Visit section + footer | `home.visit.title|subtitle|subtitleShort|info.*|map.alt`, `visit.form.*`, `common.footer.copyright` (both views) |
| Subpages | `philosophy.kicker|eyebrow|heading|intro|introShort|dayTitle|principles.*|day.*|badges.*|meta.*`; `programs.kicker|eyebrow|heading|ratioLabel|footnote|meta.*`; `menu.kicker|eyebrow|heading|intro|note|meta.*`; `gallery.kicker|heading|hint|filters.all|meta.*`; `reviews.kicker|heading|countLine|yelpCta|meta.*`; `team.kicker|heading|footnote|meta.*`; `faq.*`; `visit.kicker|heading|meta.*`; `common.back.label|labelShort` |
| Not in the design, needed in production | `*.meta.title|description`, `common.meta.*`, `errors.*`, `email.*` (incl. `email.inquiry.fields.preferredLanguage`), `common.a11y.skipToContent`, `common.lightbox.*`, `visit.form.fields.childAge.options.*`, `visit.form.errors.*` (per-code banners), `visit.form.fields.<field>.errors.*`, `visit.form.status.*` (incl. `success.reset`), `visit.form.requiredLegend|privacy|noscript`, `home.visit.info.mapsLink`, all `alt` keys |

Every Chinese gloss in this table comes from the prototype's `I18N` table and is therefore **`zh-Hans`**;
`zh-Hant` carries the same key set with Traditional values (D-02.21). The key inventory itself is identical in
all three locales — that is INV-02.2.

### Forms and email

Labels ("Parent name", "Email", "Child's age", "Desired start", "Anything you'd like us to know?"), the select
placeholder "Select…", options, validation, pending, success and error copy all live under `visit.form.*` and
are used by the home Visit section and the Enrollment page alike. The "Child's age" options are the canonical
five-value set `infant`, `toddler`, `preschool`, `expecting`, `other` (07 aligns). The Route Handler validates with the same Zod schema as the client and answers with machine codes
(`{ field: 'email', code: 'invalid' }` or a form-level `{ code: 'rate_limited' }`); the client — or a
server-rendered response for the no-JavaScript path — resolves codes in the submitter's locale through a typed
record: field-scoped codes try `visit.form.fields.<field>.errors.<code>` first and fall back to
`visit.form.errors.<code>`; form-scoped codes render as banners from `visit.form.errors.<code>`; an unlisted
code renders `unknown`. No English is hard-coded in the API.

| Wire code (07 §9) | Message key segment | Scope | Meaning |
|---|---|---|---|
| `required` | `required` | field | value missing (name, email, child's age) |
| `too_short` | `tooShort` | field | below minimum length |
| `too_long` | `tooLong` | field | above maximum length |
| `invalid` | `invalid` | field | format invalid (generic) |
| `invalid_email` | `invalid` on field `email` → `visit.form.fields.email.errors.invalid` | field (email) | e-mail address malformed |
| `invalid_option` | `invalidOption` | field | select value not in the option list |
| `out_of_range` | `outOfRange` | field | desired start outside the accepted window |
| `turnstile_failed` | `turnstileFailed` | form | Turnstile `siteverify` rejected |
| `turnstile_unavailable` | `turnstileUnavailable` | form | Turnstile could not load/verify |
| `rate_limited` | `rateLimited` | form | too many submissions |
| `forbidden` | `forbidden` | form | honeypot/origin check failed |
| `payload_too_large` | `payloadTooLarge` | form | request body too large |
| `email_failed` | `emailFailed` | form | Resend delivery failed (submission not stored) |
| `network` | `network` | form (client only) | fetch failed / offline |
| *(any other)* | `unknown` | form | fallback banner |

Wire codes are 07's snake_case spellings (all fourteen in 07 §9 resolve through this table); key segments are
their camelCase forms (D-02.4); the typed record in the form component is the only place the two meet, and a
missing key is a TypeScript error. Retired aliases from earlier drafts: `emailInvalid` →
`fields.email.errors.invalid`; `turnstile` → `turnstileFailed`.

Other form keys 07 depends on: `visit.form.requiredLegend`, `visit.form.privacy`, `visit.form.directContact`
(`{email}`, `{phone}`; appended to the `emailFailed` / `network` / `turnstileUnavailable` / `unknown` banners
and shown on the 502/503 path), `visit.form.noscript` (no-JavaScript block, followed by `directContact`),
`visit.form.status.success.reset`, `visit.form.fields.desiredStart.options.asap|flexible` (+ `YYYY-MM` month
ids labelled by the `dateMonth` format), `home.visit.info.mapsLink` ("Open in Maps" — production copy, not in
the design; rendered with `common.links.newTab`). The handler receives `locale`
as a form field and renders emails with `getTranslations({ locale, namespace: 'email' })`: the auto-reply (if
07 adopts one) in the submitter's locale, the staff notification in `en` pending OQ-02.5, with
`email.inquiry.fields.preferredLanguage` showing the submitter's locale endonym (`LOCALE_META[code].nativeName`).
07 owns the endpoint.

### Checklists

**Add a locale (one JSON directory + one config entry)** — this is the checklist `zh-Hant` itself follows.

1. `src/i18n/routing.ts`: add the id (a BCP 47 tag, used verbatim as the URL segment) to `locales` and its
   `LOCALE_META` entry — `htmlLang`, `hreflang`, `nativeName` (endonym, distinct from every other locale's),
   `shortLabel`, `brandPairLocale`.
2. `content/site.json`: add the new id to every localized value (`brand.name`, `brand.shortName`) — the
   validator fails until each is complete (INV-02.3).
3. Copy `content/en/` to `content/<id>/` and translate every file (messages and collections). For `zh-Hant` the
   copy source is `content/zh-Hans/` through OpenCC `s2t`, followed by human review (D-02.21).
4. Until the tree is complete, run CI with `--warn-locale <id>`; the locale may sit in `routing.locales` while
   it is being filled, but `--release` refuses to launch with it incomplete (INV-02.11) — either finish it or
   remove the id from `locales` (the directory stays).
5. Nothing else changes: routing, `hreflang`, sitemap, proxy, parity, the switcher menu and the Playwright
   matrix all read `routing.locales`; endonyms and labels come from `LOCALE_META`; no component edits. Only if
   the new script has no glyphs in the current stack does 03 add a fallback face to the per-`lang` stack.

**Add / rename / remove a string**

1. Add the key to the `en` file of the page it belongs to (namespace = page; section = design section), then
   to every other locale (parity fails CI otherwise).
2. Use it in the component through `useTranslations('<namespace>.<section>')`; wrap the element in `Reveal`.
3. Rename: change the key in every locale and every usage (type errors list the usages); never reuse a key for
   different meaning. Remove: delete from every locale; the validator flags orphans.

**Add a collection entry (e.g. a teacher)**

1. `content/site.json`: append `{ "id": "lopez", "icon": "📚" }` (or a `photo`) to `teachers[]` at its position.
2. Add `lopez` with the required text fields to `content/en/collections/teachers.json` and to every other locale.
3. `pnpm validate:content` — id parity, schema, image and alt checks pass; no code changes.

**Replace a provisional value**

1. Edit the value in `content/site.json` (or the collection file, for teacher names/credentials).
2. Delete its path from `site.json.provisional` — one line.
3. `pnpm validate:content` prints what is still provisional; `pnpm validate:content --release` passes only when
   the array is empty. To drop an optional block instead (`yelp`, `social`), delete the block and its entries.

### CJK requirements (placed on 03)

- Fredoka and Nunito (`docs/design/README.md`) carry no CJK glyphs. 03 must define a locale-aware font stack
  per token (`--font-display`, `--font-body`) whose fallback includes CJK faces, selected via `:lang(zh)` —
  which matches `zh-Hans` **and** `zh-Hant`, so one rule serves both Chinese locales and Latin pages pay
  nothing. The stack must name Traditional faces beside the Simplified ones so `zh-Hant` does not fall back to
  Simplified glyph forms: system `PingFang SC` / `Microsoft YaHei` **and** `PingFang TC` / `Microsoft JhengHei`
  (webfont candidates, if the human ever names one: Noto Sans SC and Noto Sans TC, `preload: false`). The
  design names no CJK typeface, so the system stack stands (HD-11); `next/font/google` has no `unicode-range` /
  CJK-subset option, so the stack relies on per-glyph browser fallback.
- `<html lang>` is exactly `LOCALE_META[locale].htmlLang` (D-02.9); components never branch on locale for
  typography — they use `:lang()` or tokens.
- Chinese typography (both Chinese locales): line-height ≥ 1.6 for body and ≥ 1.3 for display; `letter-spacing` on
  uppercase eyebrows is a no-op on CJK (no case) and may stay; `text-wrap: balance` on headings; no
  `word-break: break-all`; mixed Latin tokens ("Yelp", "AMS") keep `word-break: normal`. Layouts must not
  assume English lengths: buttons and nav items size to content; Chinese strings are shorter in characters but
  wider per glyph, and Traditional glyphs are denser than Simplified at the same size — the visual-regression
  matrix (08) needs a `zh-Hant` row, not just `zh-Hans`.
- Punctuation in Chinese copy is full-width (`，。：`) as in the prototype; separators `·` and `—` are shared.
  Quote marks are per-locale content (`common.punctuation.*`), not a typography rule.

### Enforcement invariants

- **INV-02.1 No literal user-visible text in JSX/TSX.** ESLint `react/jsx-no-literals` (`noStrings: true`,
  `noAttributeStrings: true` for `alt`, `aria-label`, `title`, `placeholder`) with an allowlist limited to
  punctuation, separators (`·`, `—`, `→`), digits and emoji. Runs in `pnpm lint` and CI (08).
- **INV-02.2 Key parity and key shape — three-way.** For **each** of `zh-Hans` and `zh-Hant`, the key set, the
  rich-tag set per key and array lengths equal `en`'s; extra keys are orphans; `en` is compared with each
  locale independently. ICU arguments: a key's argument set in a non-reference locale must be a **subset** of
  `en`'s — an argument `en` never declares is an error, an argument a translation legitimately omits (the
  bilingual footer's `{brandNameOther}`, say) is a warning listed in the coverage report. *(Changed
  2026-08-22: was strict equality for two locales; 08 updates its rule text.)* Every key is also camelCase and
  at most 6 segments deep (*Key naming* rule 2). `pnpm validate:content` (CI gate, 08).
- **INV-02.3 Schema validity and cross-references.** `content/site.json` and every collection parse with their
  Zod schema; every localized value in `site.json` has an entry for every id in `routing.locales` and no
  others; every shared id has text in every locale and every text id exists in `site.json`; every image path
  exists under `public/` and has an `alt` key in every locale. Loader (build) + `pnpm validate:content`.
- **INV-02.4 No locale-agnostic data in locale files.** The validator rejects values matching URL, `/images/`,
  phone, e-mail, license and **brand-name** patterns (any `brand.name` / `brand.shortName` value, plus the
  rejected 绿茵园) inside `content/<locale>/**`; review rule for the rest (D-02.3, D-02.19).
- **INV-02.5 Every route renders in every locale.** Playwright smoke (08) visits every route × locale — three
  locales now, so the matrix grows by half — and asserts no `⟦` marker, correct `<html lang>`
  (`en` / `zh-Hans` / `zh-Hant`), the three-entry `hreflang` set plus `x-default`, and a 200.
- **INV-02.6 Coverage report.** `pnpm validate:content --report` writes `reports/content-coverage.md` — a
  column per locale (`en`, `zh-Hans`, `zh-Hant`) plus the provisional-values block — and CI attaches it to the
  PR so editors see what is missing and what is still a sample default (09).
- **INV-02.7 Locale lives in the URL.** Internal navigation uses `Link`/`redirect`/`useRouter` from
  `src/i18n/navigation.ts`; an ESLint `no-restricted-imports` rule bans `next/link` and `next/navigation`
  outside `src/i18n/`. Language is never only client state.
- **INV-02.8 No empty strings, no HTML in values.** Validator rule (D-02.5, D-02.8).
- **INV-02.9 No locale branching in components.** Comparing a locale id to a literal (`locale === 'zh-Hans'`,
  and the now-meaningless `locale === 'zh'`) is forbidden outside `src/i18n/` (ESLint `no-restricted-syntax`);
  locale differences are expressed in content, `LOCALE_META` (including `brandPairLocale`), formats or
  `:lang()` CSS. Three locales make this stricter, not looser: a two-way `? :` on locale is now a bug.
- **INV-02.10 Provisional values cannot ship silently.** Every path in `site.json.provisional` resolves to an
  existing value (unresolvable → `validate:content` fails in every mode); `validate:content --release` fails
  while the array is non-empty and on any literal `TODO`/`TBD`/`FIXME`/`XXX` value under `content/`. The
  release gate is the only place emptiness is required; PR CI only reports (D-02.20; 08 wires it, 09 runs it).
- **INV-02.11 A locale is complete before it launches.** `--release` ignores `--warn-locale` and fails if any
  id in `routing.locales` has parity gaps; an unfinished locale is removed from `routing.locales` (its
  `content/` directory stays) rather than shipped half-translated. This is what lets `zh-Hant` be developed in
  the open without blocking launch (D-02.21).

## Open questions

- **OQ-02.1** · **ANSWERED 2026-08-22 (human, HD-10)** — Simplified vs Traditional: **both**, as two locales
  beside `en`. `zh-Hans` is the Chinese that ships at launch (and the language of the 33 prototype strings);
  `zh-Hant` is offered as an additional language, seeded per D-02.21 and enabled per INV-02.11. Recorded in
  D-02.1; every `zh` identifier retires (*Design → Retiring the `zh` identifier*). Follow-up: OQ-02.8.
- **OQ-02.2** · decided — human (Hanyi) may overrule — D-02.8 stands: CI fails on missing keys, production falls
  back to `en` and logs. Overrule only if the human wants a missing Chinese key to fail the build with no
  fallback. (Phase policy is now explicit: gaps are demoted with `--warn-locale <id>` while a locale is being
  filled, never left silent, and `--release` refuses the demotion — INV-02.11.)
- **OQ-02.3** · answerer: human (Hanyi); 09 implements — Do editors need a preview tool (Vercel preview per PR
  is the default; a git-backed CMS UI is the candidate upgrade)?
- **OQ-02.4** · **ANSWERED 2026-08-22 (human, HD-6)** — The Chinese brand name is **优朵幼儿园**; 绿茵园 is
  **rejected** and the gallery title is re-authored as "{brandShortName}的日常". The name is **provisional**
  (not finalised), so it is one localized value in `content/site.json` — `brand.name["zh-Hans"]`, with
  `zh-Hant` carrying its own 優朵幼兒園 — marked in `provisional` and blocked by `--release` until confirmed
  (D-02.19, D-02.20). Yes, the English footer keeps both names, via `{brandNameOther}` and `brandPairLocale`.
- **OQ-02.5** · answerer: human (Hanyi); 07 implements — Language of the staff notification e-mail (`en`, a
  Chinese locale, or both) and whether parents receive an auto-reply. Default: staff in `en`, auto-reply in the
  submitter's locale (which is now one of three, named in the e-mail by `LOCALE_META[locale].nativeName`).
- **OQ-02.6** · answerer: human (Hanyi) — Testimonials in the Chinese locales: translated quotes, or original
  English quotes with a Chinese attribution line? (One answer covers `zh-Hans` and `zh-Hant`.)
- **OQ-02.7** · **ANSWERED 2026-08-22 (human, HD-5)** — "Staff" **is** Team: one page, the `team` namespace.
  Six subpage routes at launch (Philosophy, Programs, Menu, Gallery, Reviews, Team); FAQ and Enrollment are
  **reserved, not built** — namespaces stay in the tree, routes are not shipped, nav and sitemap ignore them.
  Recorded in D-02.17; 04, 06 and 10 drop the eight-page reading and bead gp-dln.6 closes.
- **OQ-02.8** · answerer: human (Hanyi); affects 09, 10 — `zh-Hant` review: who reads the OpenCC-seeded
  Traditional tree before the locale is enabled, and which regional conventions govern word choice (Taiwan or
  Hong Kong) where Simplified and Traditional usage genuinely differ, not just glyphs? Default until answered:
  seed with `s2t` (glyphs only, no vocabulary substitution, D-02.21), keep `zh-Hant` out of `routing.locales`
  until a named human has reviewed it (INV-02.11), and treat the review as post-launch work if it is not done
  by the launch gate — `zh-Hans` and `en` launch either way.

Retired (answered by this contract's own decisions): root-path language detection → on (D-02.9); "Child's age"
options → the canonical five-value set (D-02.4 rule 8); Chinese Accept-Language negotiation → the table in
*Design → Routing*; the `TODO` sentinel for owner facts → the `provisional` registry (D-02.20).

## Cross-references

- `docs/design/README.md` — section inventory, EN ↔ 中文 toggle behaviour, motion tokens, "all copy i18n-ready".
- `docs/design/desktop/README.md`, `docs/design/mobile/README.md` — per-view copy variants, hamburger contents.
- `docs/design/desktop/Green Pastures - Homepage.dc.html` — the prototype `I18N` table and `toggleLang` crossfade.
- `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html` — mobile copy variants.
- `docs/design/Wireframes.dc.html` — FAQ and Enrollment page structures.
- `docs/technical/01-stack-decisions.md` — ADR-002 (next-intl), ADR-003 (JSON vs CMS), ADR-008 (locale routing).
- `docs/technical/03-design-system-tokens.md` — font tokens and the CJK fallback (D-02.15).
- `docs/technical/04-components-sections.md` — `Reveal` wrapping, client namespaces, component ↔ key map.
- `docs/technical/05-animation-system.md` — `Reveal` `swap` variant (D-05.9) and `WordSwap` (D-02.10).
- `docs/technical/06-routing-pages-seo.md` — proxy, metadata, `hreflang`, sitemap (D-02.9).
- `docs/technical/07-forms-integrations.md` — Route Handler, error codes, e-mail templates.
- `docs/technical/08-testing-quality.md` — the gates behind INV-02.1 … INV-02.11, incl. `--release`.
- `docs/technical/09-deployment-operations.md` — editor workflow, coverage report, the `--release` launch gate.
- `docs/technical/10-work-breakdown.md` — phase scope for the third locale, translation and the provisional set.
- `docs/technical/12-open-questions.md` — the register that tracks OQ-02.1 · OQ-02.4 · OQ-02.7 (now answered)
  and OQ-02.8 (new).
