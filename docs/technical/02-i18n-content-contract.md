# 02 · i18n & content contract

## Purpose

This document is the contract for every user-visible string on the Green Pastures site: where it lives, how it
is named, how it is typed, loaded, validated and rendered, and how the two launch locales (English, 中文) share
one codebase and one URL scheme. It is the binding answer to the human's requirement that *every user-visible
string maps to an easy-to-edit JSON lang file*. Docs 04 (components), 06 (routing/SEO), 07 (forms), 08 (quality
gates) and 09 (operations/editing workflow) build on the identifiers declared here (`D-02.n`, `INV-02.n`) and
must cite them rather than restate them.

Status: draft · seat writer-contracts · 2026-08-22

## Decisions

- **D-02.1 Locales.** Launch locales are `en` (default and *reference* locale) and `zh` (Simplified Chinese,
  Mandarin — assumed per the memo; Traditional is OQ-02.1). URL codes are the short tags `en` / `zh`; the
  BCP 47 tags used for `<html lang>` and `hreflang` are `en` and `zh-Hans`, mapped in one place
  (`src/i18n/routing.ts`, `LOCALE_META`). `en` is the reference locale: types, namespace list and parity
  checks derive from the `en` tree.
- **D-02.2 Content tree.** All per-locale text lives under `content/<locale>/` in two kinds of JSON files —
  `messages/` (UI copy, one file per page/area) and `collections/` (repeatable entries) — and all
  locale-agnostic data lives in ONE file, `content/site.json`. The exact tree is in *Design → Directory layout*.
- **D-02.3 Text vs data boundary.** Human-readable text is per-locale JSON; every value the code computes with
  or prints as a value — URLs, image paths and dimensions, ratios, age *bounds*, hours, counts, the license
  number, our own brand names, standalone icon emoji, ids and ordering — is locale-agnostic data in
  `content/site.json`. Locale files MUST NOT contain these values; messages that display them take ICU
  arguments (`{adults}`, `{children}`, `{count}`, `{year}`, `{license}`, `{brandName}`). The boundary runs
  *through* numerals, not around them: a numeral the code uses for logic or renders as a value is data, a
  numeral inside editorial prose is part of the sentence and stays per-locale text — age *labels*
  ("6 – 18 months"), `credentials` ("AMS certified · 15 years with little ones") and `relation` ("parent of a
  3-year-old") are text. One carve-out on brand names: the third-party name Yelp is the message
  `common.brand.yelp` (key-naming rule 13); our own brand names never appear in a locale file.
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
- **D-02.9 Routing.** `localePrefix: 'always'` → every page is `/en/...` or `/zh/...`; the unprefixed root
  redirects to the detected locale (locale prefix → `NEXT_LOCALE` cookie set by an explicit switch →
  Accept-Language → `en`); prefixed URLs are authoritative. `<html lang>` is `LOCALE_META[locale].htmlLang`; `hreflang`
  alternates (`en`, `zh-Hans`, `x-default` → the `en` URL) and the canonical are emitted from route metadata,
  next-intl's `alternateLinks` header is disabled; the sitemap lists every route × locale with alternates.
  06 implements.
- **D-02.10 Language switcher.** The switcher navigates to the *same pathname* under the other locale — a
  next-intl `Link` (`href={pathname}` + `locale`, the no-JavaScript path) whose `onClick` calls
  `event.preventDefault()` and then `router.replace(pathname, { locale, scroll: false })` with the
  `transitionTypes` 05 defines — one navigation, not two (path, query and `#hash` preserved).
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
- **D-02.12 Shared config.** `content/site.json` is the ONE locale-agnostic config (brand, contact, hours,
  license, Yelp, social, nav structure, images, per-collection ids/order/media/numbers, day and meal ids).
  It is parsed once with Zod (`src/content/site.ts`) and never duplicated into locale files.
- **D-02.13 Per-view copy variants.** Where the design ships shorter mobile copy (the R1 inventory counts about
  two dozen desktop ↔ mobile pairs), the JSON carries a sibling key with the `Short` suffix (`subtitle` /
  `subtitleShort`); both exist in every locale; the component renders per breakpoint with CSS. This is the one
  mechanism — no per-view files, no props. Count differences (3 vs 2 chips, 5 vs 4 filters, 3 vs 2
  testimonials, 7 vs 5 polaroids) are layout slicing over the same collection driven by per-surface flags in
  `site.json` (`onHome`, `onMobile`, `featured`), never duplicated content. The footer license number renders on **both**
  views (the mobile prototype omits it; the root README's "bilingual copyright + license #" wins because the
  license is a trust/legal element) — so `common.footer.copyright` has no `Short` variant and wraps on mobile.
- **D-02.14 Editing workflow.** JSON in git is the source of truth at launch; there is no CMS. Changing copy is
  editing one JSON file; adding a locale is one directory plus one config entry (checklists in *Design →
  Checklists*); the non-developer PR/preview workflow is specified in 09.
- **D-02.15 CJK requirements on 03.** Fredoka and Nunito have no CJK glyphs; 03 must provide a locale-aware
  font stack with a CJK fallback face, scoped by `<html lang>` / `:lang(zh)`, and zh-specific line-height and
  wrapping rules; the CJK typeface itself is a human decision that 03 surfaces (memo ADJ-6). Stated in
  *Design → CJK*.
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
- **D-02.17 Subpage set.** The contract plans namespaces and collections for the six subpages that both
  prototypes and the Interactions section define (Philosophy, Programs, Menu, Gallery, Reviews, Team; "Staff" in
  `docs/design/README.md` line 17 is read as Team). FAQ is an **optional** namespace reserved in the tree
  (`faq.json`) until OQ-02.7 is answered. `visit.json` ships at launch — it holds the inquiry form the home
  Visit section renders; **optional** inside it are only the Enrollment *page*'s own keys
  (`visit.kicker|heading|meta.*`), which stay unused until that page is in scope.

## Design

### Definitions

| Term | Meaning here |
|---|---|
| locale | A launch language identified by its URL code (`en`, `zh`) with a BCP 47 tag for `lang`/`hreflang` |
| message | One ICU string addressed by a dotted key, read with `useTranslations` / `getTranslations` |
| namespace | The first key segment; equal to the message file basename (`home`, `common`, `visit`, …) |
| key | The full dotted path of a message (`home.hero.title`); stable, semantic, camelCase |
| collection | A set of repeatable entries (teachers, programs, …) whose text is per-locale and whose ids, order and media are shared |
| shared config | `content/site.json`: the single locale-agnostic data file |
| rich text | A message containing allowlisted tags (`<em>…</em>`) rendered with `t.rich` into React elements |
| reference locale | `en`: the locale whose files define the key set, the namespace list and the TypeScript types |

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
│   │   ├── faq.json           FAQ page chrome + meta (OPTIONAL — D-02.17 / OQ-02.7)
│   │   ├── visit.json         inquiry form (labels, options, errors, status) + OPTIONAL Enrollment page
│   │   ├── errors.json        404 / 500 copy
│   │   └── email.json         inquiry notification + auto-reply
│   └── collections/           repeatable entries keyed by the ids in site.json (D-02.11)
│       ├── programs.json      name, ageLabel, summary(+Short), description, highlights[], photoAlt
│       ├── menu.json          week.<day>.<meal> dishes, dietary chip labels(+Short)
│       ├── gallery.json       per-photo alt + caption, category labels
│       ├── testimonials.json  quote, author, relation
│       ├── teachers.json      name, credentials, summary(+Short), bio(+Short), tags[], photoAlt
│       └── faq.json           question, answer (OPTIONAL — D-02.17 / OQ-02.7)
└── zh/                        identical tree to en/ — key parity enforced (INV-02.2)
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
└── validate-content.ts    pnpm validate:content — parity · ICU args · schemas · id cross-refs · assets · report
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
11. Language switcher: `common.localeSwitcher.label` is the template "{current} · {other}", filled with
    `LOCALE_META[code].shortLabel` ("EN", "中文"), so `en` renders "EN · 中文" and `zh` renders "中文 · EN" (the
    prototype's flipped `langbtn` pair) while a locale keeps the freedom to change the separator or the order;
    `common.localeSwitcher.ariaLabel` is "Switch language to {locale}". The names themselves — `shortLabel`
    ("EN", "中文") and `nativeName` ("English", "中文") in `LOCALE_META`, `src/i18n/routing.ts` — are
    locale-invariant data feeding `{current}`, `{other}` and `{locale}` here and the e-mail "preferred language"
    line; they are never message keys, so adding a locale writes them once (D-02.14).
12. Subpage chrome: `<page>.kicker` (Philosophy / Programs / Sample menu / Gallery / Reviews / Our team),
    `<page>.eyebrow`, `<page>.heading`, `<page>.intro`, `<page>.footnote`; the back control is `common.back.*`.
13. Our own brand names are data (`{brandName}`, `{brandNameZh}`, `{brandShortName}` arguments). The single
    carve-out D-02.3 grants: the third-party name Yelp is the message `common.brand.yelp`, because a locale may
    transliterate or annotate a foreign product name and the badge renders it as a standalone label — so the
    word is content like every other word on screen, and `zh` decides its own spelling of it.

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
`common.punctuation.quoteOpen` / `quoteClose` (“ ” in `en`; `zh` chooses “ ” or 「 」 in its own file), so
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

(The excerpt is limited to keys whose `zh` exists in the prototype so both samples carry the same key set; the
remaining hero keys — `trust.yelp` "{rating, number, rating} on Yelp", `trust.ages` / `trust.agesShort`,
`mealsCard.*`, `scrollCue` "scroll to come inside ⌄", `photo.alt` — follow the same shape and await
translation.) The same keys in `content/zh/messages/home.json` (values from the prototype's `I18N` table):

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

**Plurals and counts.** `zh` has a single plural category, so its messages carry only `other`; `en` carries
`one`/`other`. The review count is data (`site.yelp.reviewCount`) and the number is wrapped in `<count>` so
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

`zh` (syntax illustration — wording to be confirmed by the translator): `"title": "来自家庭的暖心话"`,
`"countLine": "<count>{count, number}</count> 条评价 · 弗里蒙特家长"`, `"link": "在 Yelp 阅读全部评价 →"`.
Other templated strings: `programs.ratioLabel` "{adults}:{children} ratio" (data `[1, 3]`, `[1, 4]`,
`[1, 6]`); `reviews.countLine` "{count, plural, one {# review} other {# reviews}} and counting";
`common.footer.copyright` "© {year} {brandName} · {brandNameZh} · Fremont, CA · License # {license}"
(rendered on both views, D-02.13); `year` is computed at build time, not stored.

**Numbers, dates, times.** Named formats live in `src/i18n/formats.ts` and are referenced by name in ICU
(`{rating, number, rating}` → `minimumFractionDigits: 1`, rendering "5.0") or by `useFormatter()`:
`weekdayShort` / `weekdayLong` (`{ weekday: 'short' | 'long' }`) for the menu day chips ("Mon" / "周一") and the
sample line ("Wednesday" / "星期三"); `timeShort` (`{ hour: 'numeric', minute: '2-digit' }`) for opening hours
("7:30 am – 6:00 pm" in `en` via CSS lowercase of the day period; `zh` renders what `Intl` yields for
`zh-Hans`) and the daily-rhythm times; `dateMonth` for the form's "Desired start" value. Ranges use message
templates `common.format.dayRange` "{from} – {to}" and `common.format.timeRange` "{from} – {to}" so `zh`
can choose "{from}至{to}". The request config sets `timeZone: 'America/Los_Angeles'` so "today" (the default
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

`pnpm validate:content` (`scripts/validate-content.ts`, no Next.js needed, runs in CI per 08) performs, per
locale: key-set parity with `en` (messages and collections), ICU-argument and rich-tag parity per key, equal
array lengths, key shape (camelCase segments, depth ≤ 6 — *Key naming* rule 2), no empty strings, no `'{`, no
HTML tags, no locale-agnostic values (URL, `/images/`, phone, license patterns) in locale files; Zod validation of `site.json` and every collection; id cross-references
(every `site.json` entry has text in every locale and vice versa); every `photo`/`image` in `site.json` exists
under `public/` and has an `alt` in every locale; and it writes `reports/content-coverage.md` (keys per
locale, missing/extra, percentage) that CI attaches to the PR (INV-02.6).

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
| CI | `pnpm validate:content` fails the pipeline on any parity/schema/empty-string/missing-file/asset problem; `next build` fails on invalid collections; Playwright smoke renders every route per locale (INV-02.5). Translators therefore commit complete files; partial translation is an explicit human decision (OQ-02.2). |
| prod | Defence in depth only: the locale tree is deep-merged over `en`, so a key that slipped through renders English, and `onError` logs `MISSING_MESSAGE` once per key to the platform logs (09). A key absent from `en` as well renders the `⟦namespace.key⟧` marker — `getMessageFallback` never returns an empty string (INV-02.8). |

Empty string `""` is invalid in every file and environment (an element with no text is a component decision,
not content). If `zh` were ever allowed to lag (OQ-02.2), the zh check flips from fail to warn and the coverage
report becomes the editor's to-do list; the en→zh fallback remains.

### Routing

- `localePrefix: 'always'`: `/en`, `/en/programs`, `/zh`, `/zh/programs`. Justification: every page has exactly one
  URL per locale, `hreflang` pairs are symmetric, no URL's meaning depends on a cookie (CDN-cacheable, shareable),
  and adding a locale changes no existing URL. The cost is one redirect on the bare root.
- Root and unprefixed paths redirect (next-intl proxy) to the detected locale: locale prefix → `NEXT_LOCALE`
  cookie (next-intl default settings; written by an explicit switch) → Accept-Language best fit → `en`.
  Prefixed URLs never redirect. Detection on the bare root is on (decided here; the next-intl default).
- The proxy (`src/proxy.ts`, `createMiddleware(routing)`) runs as a Vercel Function; its matcher excludes
  `/api`, `/_next`, `/_vercel` and files with extensions. The site is therefore **not** a static export
  (`output: 'export'` is never promised — the proxy does not run there and locale negotiation would be lost,
  memo ADJ-2). The inquiry Route Handler receives the locale as a form field (07), not from the path.
- `<html lang>` = `LOCALE_META[locale].htmlLang` (`en`, `zh-Hans`) — Simplified glyph forms and CJK font
  fallback hang off this attribute (D-02.15). Unknown-locale 404 renders the root `not-found` in `en`.
- `hreflang`: each page's metadata emits `alternates.languages` for every locale plus `x-default` → the `en`
  URL, and `alternates.canonical` = its own URL; next-intl `alternateLinks: false` so the header and the tags
  cannot disagree (the header would say `zh`, the tags say `zh-Hans`). The sitemap lists every route × locale
  with the same alternates. 06 owns the route list and implementation.
- All pages are statically generated per locale (`generateStaticParams` over `routing.locales`); the static
  rendering hook is whichever next-intl recommends for the pinned Next.js major (06 decides).
- Detail page ↔ home section ids are data, not code: `site.json.routes[] {id, path, homeAnchor}` (D-02.12) is
  the single mapping the "learn more →" links, the Back control and 05's slide transition rely on, so a
  renamed route or anchor is one edit and cannot desynchronise locales.

### Language switcher and the crossfade

The switcher is `Link` from `src/i18n/navigation.ts` with `href={pathname}` and `locale={other}` (search and
hash appended by the component), so it works without JavaScript, sets `hreflang` on the anchor and is a real
navigation: locale lives in the URL, never only in client state (INV-02.7). On desktop it is the "EN · 中文" nav
item; on mobile it is an item of the hamburger menu (`docs/design/mobile/README.md`).

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
| `faq` | `question`, `answer` (rich allowed) | `id`, order, optional `topic` | content TBD — wireframe only |

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
  slices by breakpoint count. Whether zh shows translated quotes or the original English is OQ-02.6.
- **teachers.** Role labels "Head teacher" / "Assistant teacher" are `team.roles.head|assistant`
  (rendered uppercase by CSS); the HEAD TEACHER badge and the photo-slot rule come from `site.json` (`head`,
  `photo`). Display names are per-locale text so `zh` may show "陈老师" alone.
- **faq.** Home is reserved now (`faq.json` + `site.json.faq[]`) so 06 can ship the route when content exists.

Fixed, non-repeating structured content stays in messages as keyed objects: philosophy principles
(`philosophy.principles.environment|followTheChild|handsOn.title|body`, icons in `site.json
.principles[]`), the daily rhythm (`philosophy.day.arrival|outdoor|lunch|rest.title|body`; times `08:00`,
`10:30`, `12:00`, `13:30` in `site.json.dailyRhythm[]`, formatted with `timeShort`), the info panel labels
(`home.visit.info.visitLabel|hoursLabel|languagesLabel`, `home.visit.info.city` "Fremont, California",
`home.visit.info.languages` "English · 中文 (Mandarin)") and the form select options
(`visit.form.fields.childAge.options.infant|toddler|preschool|expecting|other` — the canonical set).

### Shared config — `content/site.json`

| Section | Fields (all locale-agnostic) |
|---|---|
| `brand` | `name` "Green Pastures Montessori Daycare", `shortName` "Green Pastures", `nameZh` "优朵幼儿园" (OQ-02.4), `url` (site origin, `metadataBase`) |
| `contact` | `phone` (placeholder — not in the design), `email`, `address {street?, city "Fremont", region "CA", postalCode?, country "US"}` (only city/state exist in the design), `mapsUrl` |
| `license` | the license number — placeholder `000000000` from the design footer |
| `hours` | `{ days: ["mon","tue","wed","thu","fri"], open: "07:30", close: "18:00" }` — rendered, never typed by editors |
| `timeZone` | `America/Los_Angeles` |
| `yelp` | `rating` (design placeholder 5.0), `reviewCount` (design placeholder 47), `url` (absent from the design — placeholder) |
| `social` | optional `{ instagram?, facebook?, wechat? }` URLs |
| `ages` | `{ minMonths: 6, maxMonths: 54 }` — logic only; labels are text (D-02.3) |
| `routes[]` | `{id, path, homeAnchor}` for the six detail pages — `philosophy → /philosophy → #philosophy`, `programs`, `menu`, `gallery`, `reviews`, `team → /team → #teachers` — the **stable** mapping the Back control and the section "learn more →" links use (05's slide, 06's routes); ids never change |
| `nav` | `primary[] {id, routeId}` (philosophy, programs, menu, gallery, reviews, team), `footer[]` (the six + contact), `cta {href: "/#visit"}`; labels are `common.nav.<id>` |
| `images` | `hero`, `philosophy`, `map`, `og` — `{src, width, height}`; alt text is per-locale |
| `programs[]` · `teachers[]` · `gallery.photos[]` · `gallery.categories[]` · `testimonials[]` · `faq[]` | per-collection shared fields as in the table above |
| `menu` | `days`, `meals`, `dietary[] {id, onHome}` (chip emoji lives in the label text) |
| `principles[]` · `dailyRhythm[]` | `{id, icon}` · `{id, time}` |

Excerpt (valid JSON, no secrets — the file is shipped to the client where needed):

```json
{
  "brand": { "name": "Green Pastures Montessori Daycare", "shortName": "Green Pastures", "nameZh": "优朵幼儿园" },
  "timeZone": "America/Los_Angeles",
  "hours": { "days": ["mon", "tue", "wed", "thu", "fri"], "open": "07:30", "close": "18:00" },
  "menu": {
    "days": ["mon", "tue", "wed", "thu", "fri"],
    "meals": ["breakfast", "lunch", "snack"],
    "dietary": [{ "id": "vegetarian", "onHome": true }, { "id": "allergy", "onHome": true }, { "id": "familiar", "onHome": false }]
  },
  "teachers": [
    { "id": "reyes", "icon": "🧸" },
    { "id": "ping", "head": true, "photo": { "src": "/images/team/ping.jpg", "width": 800, "height": 800 } },
    { "id": "chen", "icon": "🎨" }
  ]
}
```

The order of `teachers[]` is the design's desktop order (Reyes · Ping · Chen); mobile reorders by layout
(`head` first), not by content.

Owner-supplied values the design does not show — `contact.phone`, `contact.email` (the inquiry inbox),
`contact.address`, `yelp.url`, `brand.url` — are **required** fields in the site schema; the repository ships
them as `"TODO"` so previews work, and `pnpm validate:content --release` (the pre-launch gate in 09) fails while
any `TODO` remains. The select options for "Child's age" are message keys, not shared data.

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

**Add a locale (one JSON directory + one config entry)**

1. `src/i18n/routing.ts`: add the code to `locales` and its `LOCALE_META` entry (`htmlLang`, `hreflang`,
   `nativeName`, `shortLabel`).
2. Copy `content/en/` to `content/<code>/` and translate every file (messages and collections).
   Routing, `hreflang`, sitemap, proxy, CI parity and the Playwright matrix pick the locale up from
   `routing.locales` automatically; endonyms come from `LOCALE_META`; no component changes. Only if the new
   script has no glyphs in the current stack does 03 add a fallback face to the per-`lang` stack. (With three or
   more locales the two-name toggle label becomes a menu built from `LOCALE_META` — a 04 change, not a content
   change.)

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

### CJK requirements (placed on 03)

- Fredoka and Nunito (`docs/design/README.md`) carry no CJK glyphs. 03 must define a locale-aware font stack
  per token (`--font-display`, `--font-body`) whose fallback includes a CJK face (candidate: Noto Sans SC,
  loaded with `preload: false`; or the system `PingFang SC` / `Microsoft YaHei` stack) selected via
  `:lang(zh)`, so Latin pages pay nothing and zh pages render Simplified forms. The design names no CJK
  typeface: the choice is the human's, surfaced by 03 as its OQ (memo ADJ-6); `next/font/google` has no
  `unicode-range` / CJK-subset option, so the stack relies on per-glyph browser fallback.
- `<html lang>` is exactly `LOCALE_META[locale].htmlLang` (D-02.9); components never branch on locale for
  typography — they use `:lang()` or tokens.
- zh typography: line-height ≥ 1.6 for body and ≥ 1.3 for display; `letter-spacing` on uppercase eyebrows is
  a no-op on CJK (no case) and may stay; `text-wrap: balance` on headings; no `word-break: break-all`; mixed
  Latin tokens ("Yelp", "AMS") keep `word-break: normal`. Layouts must not assume English lengths: buttons and
  nav items size to content; zh strings are shorter in characters but wider per glyph.
- Punctuation in zh copy is full-width (`，。：`) as in the prototype; separators `·` and `—` are shared.

### Enforcement invariants

- **INV-02.1 No literal user-visible text in JSX/TSX.** ESLint `react/jsx-no-literals` (`noStrings: true`,
  `noAttributeStrings: true` for `alt`, `aria-label`, `title`, `placeholder`) with an allowlist limited to
  punctuation, separators (`·`, `—`, `→`), digits and emoji. Runs in `pnpm lint` and CI (08).
- **INV-02.2 Key parity and key shape.** For every locale, the key set, the ICU argument set per key, the
  rich-tag set per key and array lengths equal `en`'s; extra keys are orphans. Every key is also camelCase and
  at most 6 segments deep (*Key naming* rule 2). `pnpm validate:content` (CI gate, 08).
- **INV-02.3 Schema validity and cross-references.** `content/site.json` and every collection parse with their
  Zod schema; every shared id has text in every locale and every text id exists in `site.json`; every image
  path exists under `public/` and has an `alt` key in every locale. Loader (build) + `pnpm validate:content`.
- **INV-02.4 No locale-agnostic data in locale files.** The validator rejects values matching URL, `/images/`,
  phone, e-mail and license patterns inside `content/<locale>/**`; review rule for the rest (D-02.3).
- **INV-02.5 Every route renders in every locale.** Playwright smoke (08) visits every route × locale, asserts
  no `⟦` marker, correct `<html lang>`, the `hreflang` set and a 200.
- **INV-02.6 Coverage report.** `pnpm validate:content --report` writes `reports/content-coverage.md` and CI
  attaches it to the PR so editors see missing `zh` keys (09).
- **INV-02.7 Locale lives in the URL.** Internal navigation uses `Link`/`redirect`/`useRouter` from
  `src/i18n/navigation.ts`; an ESLint `no-restricted-imports` rule bans `next/link` and `next/navigation`
  outside `src/i18n/`. Language is never only client state.
- **INV-02.8 No empty strings, no HTML in values.** Validator rule (D-02.5, D-02.8).
- **INV-02.9 No locale branching in components.** `locale === 'zh'` conditions are forbidden outside
  `src/i18n/` (ESLint `no-restricted-syntax`); locale differences are expressed in content, `LOCALE_META`,
  formats or `:lang()` CSS.

## Open questions

- **OQ-02.1** · answerer: human (Hanyi) — Simplified (`zh-Hans`) vs Traditional (`zh-Hant`) Chinese, or both?
  Assumed Simplified/Mandarin per the memo; if both, a third locale `zh-Hant` follows the add-a-locale checklist.
- **OQ-02.2** · decided — human (Hanyi) may overrule — D-02.8 stands: CI fails on missing keys, production falls
  back to `en` and logs. Overrule only if the human wants a missing `zh` key to fail the build with no fallback.
- **OQ-02.3** · answerer: human (Hanyi); 09 implements — Do editors need a preview tool (Vercel preview per PR
  is the default; a git-backed CMS UI is the candidate upgrade)?
- **OQ-02.4** · answerer: human (Hanyi) — The prototype uses two Chinese brand renderings: "优朵幼儿园" (footer)
  and "绿茵园" (gallery title "绿茵园的生活"). Which is the real name, and does the English copyright line keep
  both names?
- **OQ-02.5** · answerer: human (Hanyi); 07 implements — Language of the staff notification e-mail (`en`, `zh`,
  or both) and whether parents receive an auto-reply. Default: staff in `en`, auto-reply in the submitter's
  locale.
- **OQ-02.6** · answerer: human (Hanyi) — Testimonials in `zh`: translated quotes, or original English quotes
  with a zh attribution line?
- **OQ-02.7** · answerer: human (Hanyi), bead gp-dln.6; affects 04, 06, 10 — Subpage set: `docs/design/README.md`
  line 17 lists eight inner pages (incl. Staff, FAQ, Enrollment) while the Interactions section and both
  prototypes define six. This contract plans for six with FAQ and Enrollment as optional namespaces (D-02.17).
  Is "Staff" = Team, and are FAQ / Enrollment in scope for launch?

Retired (answered by this contract's own decisions): root-path language detection → on (D-02.9); "Child's age"
options → the canonical five-value set (D-02.4 rule 8).

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
- `docs/technical/08-testing-quality.md` — the gates behind INV-02.1 … INV-02.9.
- `docs/technical/09-deployment-operations.md` — editor workflow, coverage report, logs.
