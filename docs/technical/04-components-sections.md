# 04 · Components & sections

## Purpose

This document fixes the React component architecture of the Green Pastures site: the App Router layout and
provider stack, the server/client boundary, the `src/` directory layout, the complete component inventory (name,
kind, props, which messages and collections each one consumes, which design section it renders, how desktop and
mobile differ, which 05 motion variant it uses, its accessibility contract), the section → key map against the
R1 string inventory and the 02 contract, the props/data conventions, the responsive switch points, the
accessibility rules, what must be tested, and the invariants other docs may cite (`INV-04.n`). It builds on
`02-i18n-content-contract.md` (the contract of record for every key and collection named here — nothing is
restated, only cited), `03-design-system-tokens.md` (every colour, size, radius, shadow, duration is a token),
`05-animation-system.md` (the `Reveal` primitive, variant names, `PageTransition`, `WordSwap`, `CountUp`) and
`07-forms-integrations.md` (the inquiry form). It does not define routes or metadata (06), test mechanics (08)
or operations (09). Revised 2026-08-22 for the human's Phase 1 gate decisions: **three locales** (`en`,
`zh-Hans`, `zh-Hant` — the language switcher is a three-option menu, not a two-name toggle), **six subpages**
with FAQ and Enrollment reserved rather than built, the brand name as an ICU argument instead of a literal, and
owner facts (teacher names, credentials, phone, licence) as provisional content the components cannot see.

Status: draft · seat writer-components · 2026-08-22 · revised 2026-08-22 for HD-5, HD-6, HD-7, HD-9, HD-10,
HD-12, and again for HD-14 (CJK typeface closed on the system stack) and ADJ-20 (the switcher trigger ships
with no chevron) · revised 2026-08-23 against shipped code (PR-4.2, PR-4.3a): §2's tree and its status note,
and §3.2's `Chip` tone enum · revised 2026-08-24 against `main` at #73: §2's status block is **deleted** for
the convention that replaces it, §3.1/§3.3/§8 carry the reveal-id rule the `subpage.` prefix introduced,
§3.3's `AmbientScope` row states the observer it actually uses, and §10's `--radius-hero` and `AmbientScope`
requests close

## Decisions

- **D-04.1 Sections and pages are server components; interactivity lives in enumerated client leaves.** Every
  `page.tsx`, every `*Section` and every subpage composite except `ErrorPanel` renders on the server with
  `getTranslations` / `useTranslations` and the collection loaders. The client components are exactly those
  listed in §3 with kind "client": the 05 motion set (`MotionProvider`, `Reveal`, `RevealItem`, `WordSwap`, `CountUp`,
  `PageTransition`), the eight addressable decorations (INV-05.5), `LangSwitcher`, `TrackedLink`, `PrimaryNav`,
  `FooterLinks`, `Hamburger` + `MobileMenu` (whose link list is the third of 06 D-06.7's three link lists),
  `BackLink`, `MenuDayChips`, `GalleryExplorer` (filters + grid + lightbox), `InquiryForm` +
  `Turnstile` + `FormField` + `SuccessPanel` + `FormAlert`, `ErrorPanel` and `AmbientScope` — 30 files. On top of
  those, the two route-file boundaries 06 owns are client because Next requires it: `app/[locale]/error.tsx` and
  `app/[locale]/global-error.tsx` (06 §6.2, 02 D-02.16), so the repo holds 32 `'use client'` files in all. A new
  `'use client'` file is a change to this list. `PrimaryNav`, `FooterLinks` and the sheet's link list are client
  because each item's href is chosen from `usePathname()` — `#id` on the home page, `homeHref(id)` elsewhere
  (06 D-06.7) — while `SiteHeader` and `SiteFooter` stay server and pass the resolved
  `{ id, anchor, label, href }[]` down as serialisable props, so no message or collection read crosses with them.
  `ErrorPanel` is client because `error.tsx` imports it (a module imported by a client boundary is client);
  `not-found.tsx` stays server and renders the same component. `SuccessPanel` and `FormAlert` are client
  because the form chooses them at runtime from state the server never saw (D-04.14's code record);
  `NoscriptFallback` stays server and reaches the form as the `noscript` node prop (§3.5). `TrackedLink` is
  the one-line `onClick` wrapper that fires 07 §4's link events — `cta_book_tour` from `BookTourButton`,
  `yelp_click` from `YelpButton` — so no server component ever grows a handler. The
  other two events belong to components already on this list
  (`locale_toggle` → `LangSwitcher`, `inquiry_submitted|failed` → `InquiryForm`); the Maps link fires nothing
  and stays a plain server `<a>`.
- **D-04.2 Client leaves receive plain props or server-rendered children; they never import content.** No
  `'use client'` module imports `src/content/*`, `content/**/*.json` or `src/i18n/messages.ts`. Collections are
  joined on the server (`src/content/collections.ts`) and cross the boundary as serialisable props
  (`{ id, label, href }[]`) or as already-rendered React nodes (`children`, `Record<string, ReactNode>`). The
  `NextIntlClientProvider` carries only 02's client namespaces (D-02.16, verbatim: `common`, `visit`, `gallery`
  at launch, plus `errors` for `error.tsx`); §5 lists which client component needs which, and at launch
  `common`, `visit` and `errors` are the three actually read on the client.
- **D-04.3 One `Section` shell.** Every homepage section is `Section` (`<section id aria-labelledby data-section>`)
  with background from `--color-bg-<id>`, `scroll-snap-align: start`, `scroll-margin-top: var(--nav-h)`, the
  section's role colours exposed as scoped variables (`--section-bg`, `--section-accent`, `--section-link`,
  `--section-link-underline`, `--section-sub`) mapped from 03's canonical `--color-bg-<id>` /
  `--color-accent-<id>` / `--color-link-<id>` / `--color-link-underline-<id>` / `--color-sub-<id>` tokens in one
  CSS rule per section id (`--section-bg` is what `PhotoSlot` mixes its fill from, §3.2).
  Primitives (`Eyebrow`, `LearnMoreLink`, `SectionHeader` intro) consume the role variables only, so no component
  names a per-section colour. Section ids are `site.routes[].homeAnchor` (02 D-02.12): `hero`, `philosophy`,
  `programs`, `menu`, `gallery`, `testimonials`, `teachers`, `visit`.
- **D-04.4 Sections are self-sufficient.** A section reads its own namespace and collections; `page.tsx` composes
  sections and passes nothing. This keeps the section → key map (§4) local to one file per section and makes
  per-section RTL tests trivial. Subpage composites follow the same rule.
- **D-04.5 Per-view copy and per-surface membership are never branched in code.** `*Short` siblings (D-02.13)
  render as two elements toggled by `md:` utilities (`<span class="md:hidden">{short}</span><span class="hidden
  md:inline">{long}</span>`); keys the design shows on one view only (`home.programs.intro`, the third
  teacher tag, the second programme highlight, `philosophy.badges.ams|bilingualDaily`) render with the same
  toggle. Count differences (testimonials 3 → 2, polaroids 7 → 5, filters 5 → 4, dietary chips 3 → 2) come from
  the `site.json` flags `onHome`, `onMobile`, `featured`; an item with `onMobile: false` is rendered and hidden
  below `md`, never filtered by a JS viewport check (no hydration mismatch, no layout shift).
- **D-04.6 Layout geometry is component config, not content.** Polaroid slot positions/sizes/tilts (7 desktop,
  5 mobile, from the reference files), stepping-stone sizes, bubble tail sides and teacher column placement live
  in `src/components/sections/<section>/layout.ts` as percentage/grid values; `site.json` carries only data
  (`photos[].rotation` is an optional per-photo override of the slot tilt). Editors reorder by editing `site.json`
  order; slots fill in order.
- **D-04.7 Gallery lightbox ships at launch** as a native `<dialog>` inside `GalleryExplorer` (the design's hint
  copy promises it: `gallery.hint`), with `common.lightbox.close|prev|next`, arrow-key navigation and focus
  return. Filtering is client-side local state over server-rendered items; without JavaScript every photo shows
  and the filter chips are inert (OQ-04.2 if the owner prefers URL-backed filters).
- **D-04.8 Hamburger menu = full-screen sheet below the nav bar** (the design leaves it undesigned,
  `docs/design/mobile/README.md` "Layout"): cream background, the six primary links, `common.nav.contact`, the
  **three locale rows** (`LangSwitcher variant="sheet"` — flat, no nested disclosure, 02 D-02.10), and the
  "Book a tour" pill; opens/closes with 05's default `fade` + `rise` (OQ-05.3); focus is
  trapped, `Escape` closes, the page behind is `inert`, body scroll is locked. The design's sheet list
  (`docs/design/mobile/README.md` "Mobile-only behaviors") ends "…, Contact, EN·中文" — one language item;
  with three locales that item becomes three rows, so the sheet is one row taller. Design sign-off is OQ-04.1;
  the switcher's own appearance is OQ-04.11.
- **D-04.9 Navigation row at `lg`, not `md`.** The full desktop nav (logo 50px + six links + divider + the
  language switcher + pill, `docs/design/desktop/README.md` "Layout") needs ≈ 955px (116 logo + 505 links/gaps
  + 40 divider + ≈ 32 switcher trigger + 138 pill + 88 padding + gaps), so it cannot fit at 768px; the hamburger
  stays until `lg` (1024px) while 03's `md` token values (logo height, pill size) still switch at `md`. HD-10
  narrows the switcher — the design's 65px "EN · 中文" text becomes a ≈ 32px bare `EN` trigger (D-04.16 ships
  it with no chevron, ADJ-20), a ~33px saving that changes nothing: 955px is still ~185px past `md`. This
  refines 03 §8's "nav" row; 03 keeps the tokens, 04 owns the switch point (D-03.6 delegates switches to 04).
- **D-04.10 Menu day chips swap server-rendered sample lines.** `MenuSection` renders one `SampleLine` node per
  weekday (`home.menu.sampleLine` over `collections.menu.week.<day>`) and passes `Record<DayId, ReactNode>` plus
  `{ id, label }[]` (labels from the `weekdayShort` format) to `MenuDayChips` (client), which owns
  `selectedDay`. The default is **computed on the server** by `src/lib/menu-day.ts` in `site.timeZone`
  (`America/Los_Angeles`, 02 §Collections; weekend → `mon` is 04's rule) and passed as `defaultDay`, so the
  markup is deterministic, there is no hydration mismatch, and the pre-hydration / no-JS page shows that day's
  line with its chip already marked selected (05 §5.6). `MenuDayChips` shows `lines[selectedDay]` inside
  `WordSwap`. No dishes, no `home` namespace, no collection reach the client.
- **D-04.11 Menu subpage renders two structures, toggled by CSS.** `WeeklyMenuTable` (`≥ md`, a real `<table>`
  with `<th scope>`) and `DayCards` (`< md`) are both server-rendered because the mobile design is a transpose of
  the desktop table (cards per day vs columns per day) and a transpose cannot be expressed in CSS from one DOM.
  The hidden structure is `display: none` (out of the accessibility tree). Cost: 15 short strings twice.
- **D-04.12 Photos go through `Picture`** (a `next/image` wrapper): `image` from `site.json` (`src`, `width`,
  `height`), `alt` from the per-locale collection/message key, `sizes` per breakpoint, radius from a 03 radius
  token name, `priority` only for the hero photo, `PhotoSlot` fill as the background (03 §9) so no blur data is
  required; `placeholder="blur"` only when `site.json` carries a `blurDataURL` (optional field, §10). Until
  client photography lands, `Picture` renders `PhotoSlot` when `image` is absent — **settled by HD-12**:
  photography stays a placeholder, no stock imagery is bought or committed, which answers OQ-04.4. Dropping a
  real photo in later is adding an `image` object to `site.json`; no component and no layout changes, because
  the slot already reserves the photo's box.
- **D-04.13 Rich text tag map is one helper.** `richTags()` in `src/components/ui/rich.tsx` maps 02's allowlist:
  `em` → `<em class="not-italic text-(--section-accent)">`, `strong` → `<strong>`, `link` → next-intl `Link`
  (href supplied by the caller), `count` → `CountUp`, `day` → `<strong>`. Every `t.rich` call uses it; a
  message needing another tag is a design question, not a new mapping (02 §Message syntax).
- **D-04.14 Error-code record lives in `InquiryForm`.** The typed record mapping 07's wire codes to 02's key
  segments (`visit.form.fields.<field>.errors.<code>` → `visit.form.errors.<code>` → `unknown`) is
  `src/components/forms/inquiry-codes.ts`; 07's schema code `invalid_email` resolves to the field-scoped
  `invalid` on `email` — `visit.form.fields.email.errors.invalid` — which is exactly the row 02's error table
  already carries, so the record copies 02 rather than deciding anything (the earlier claim that 02 had no
  `invalid_email` row is withdrawn).
- **D-04.15 Decorations are client components from day one.** `Sun`, `Leaf`, `ScrollCue`, `Plate`, `Polaroid`,
  `SteppingStone`, `Bubble`, `TeacherFrame` render an outer `m.div` (stable `id`, forwarded `ref`,
  `data-deco="<id>"`) and an inner layer that carries the CSS loop / resting tilt / hover (INV-05.5). Ids follow
  05's `deco-*` scheme (INV-05.5 names `deco-hero-sun`, `deco-leaf-1`): every id is `deco-` + the section id +
  the kind, numbered when a section holds more than one (`deco-hero-leaf-1`, `deco-philosophy-leaf-2`,
  `deco-visit-sun`), unique on the page, and `data-deco` repeats it so 08 can assert the pair in the DOM. They
  are stateless and receive server-rendered children, so the "sections are server" rule holds around them.
- **D-04.16 The language switcher is one component with three options — a disclosure, not a toggle and not
  three pills (HD-10).** 02 D-02.10 decided the *behaviour* (a trigger showing `LOCALE_META[current].shortLabel`
  opening a list of endonyms); 04 decides the *markup*, and the decision is a **native `<details>` disclosure**:
  `<summary>` is the trigger, a `<ul>` of three next-intl `Link`s is the panel. Reasons, in order of weight.
  (a) It opens and closes with **no JavaScript**, which the two-name toggle got for free and a `useState`
  dropdown would lose — and 02 requires each option to be a real `Link` that works unscripted (INV-02.7).
  (b) `role="menu"` is **rejected**: these are links to URLs, not application commands, so the correct ARIA
  pattern is a disclosure over a list, and `role="menu"` would promise arrow-key/typeahead semantics we do not
  implement. (c) Three pills in the nav bar are **rejected**: the design allots the language control ≈ 65px
  between the divider and the CTA pill (its "EN · 中文" text). Three endonym pills measure ≈ 265px (≈ 88px each
  at the design's 10×16 chip padding, plus gaps) and even three `shortLabel` pills measure ≈ 145px — the first
  pushes D-04.9's row past 1180px, past `lg` itself, and both redraw a nav bar the design fixed. A disclosure
  keeps the control at ≈ 32px (a bare `shortLabel`, ADJ-20) and leaves the row alone. It stays a single file, so
  D-04.1's counts (30 client components, 32 `'use client'` files, 86 named components) are unchanged.
  **Contract.** `variant="nav"`: `<details>` + `<summary>` rendering `shortLabel` (`EN` / `简` / `繁`) and
  nothing else — **no chevron, no disclosure glyph** (ADJ-20); `aria-label` =
  `common.localeSwitcher.ariaLabel`; the panel is a `<ul>` in `routing.locales`
  order (English · 简体中文 · 繁體中文) of `Link href={pathname} locale={target} hrefLang` items labelled with
  `LOCALE_META[target].nativeName`, each carrying `aria-label` = `common.localeSwitcher.optionAriaLabel`
  `{locale}` (the target's `nativeName`) and, for the current locale, `aria-current="true"`. Enhancement layered
  on top by the same client component: `onClick` → `preventDefault()` → `registry.markLocaleSwap()` →
  `router.replace(pathname + search + hash, {locale, scroll:false, transitionTypes:['locale-swap']})`
  (02 D-02.10, 05 §5.6, 06 D-06.9); `Escape` and an outside `pointerdown` close the panel and return focus to
  the `<summary>`; the panel closes on navigation. `variant="sheet"`: **no disclosure** — the same three `Link`s
  render as flat rows inside `MobileMenu` (02: "on mobile the three items sit directly in the hamburger menu"),
  wrapped in a `<ul>` carrying `aria-label` = `common.localeSwitcher.ariaLabel` so the group is still named
  where there is no trigger to name it.
  Nothing here enumerates a locale: the option list is `routing.locales.map(...)`, so a fourth locale is a
  config entry (INV-04.12). **06's `Menu` is this markup, not a new component**: 06 D-06.9's sketch wraps the
  option list in `<Menu triggerLabel ariaLabel>` and assigns the primitive to 04 — that wrapper is
  `LangSwitcher`'s own `<details>`/`<summary>`, inlined, because the site has exactly one such control and a
  generic `Menu` with a single consumer is speculation. Hence no new file and no count change. **The chevron
  question is settled against the chevron (ADJ-20, 2026-08-22):** 02 D-02.10 wrote the trigger as `shortLabel`
  "plus the design's `⌄` chevron", but that premise was never checked against the handoff. 06 checked it — the
  handoff's only `⌄` is the hero scroll cue's ("scroll to come inside ⌄") and `[data-langtoggle]` is a bare nav
  item with no disclosure affordance (06 OQ-06.10) — so the default trigger carries **no chevron** and 02's
  mention is the stale half. The trigger's resting/hover/**open-state** appearance, including any glyph the
  design owner may yet add, is decided in **06 OQ-06.10**, which 04 does not duplicate — see OQ-04.11 for the
  markup half. Tokens are existing ones (§3.1).
- **D-04.17 Brand names are ICU arguments supplied on the server, never literals (HD-6).** `brand.name` and
  `brand.shortName` are localized values in `site.json` (02 D-02.19), so a component that wants a brand name
  calls one helper — `brandArgs(locale)` in `src/content/site.ts`, returning
  `{ brandName, brandShortName, brandNameOther }` where `brandNameOther` is
  `site.brand.name[LOCALE_META[locale].brandPairLocale]` — and spreads it into `t(...)`. Three call sites at
  launch: `Copyright` (`common.footer.copyright` `{year, brandName, brandNameOther, license}`),
  `GallerySection` (`home.gallery.title` now takes `{brandShortName}` — the re-authoring 02 D-02.19 requires
  after 绿茵园 was rejected; the `en` value becomes "Life at {brandShortName}") and 06's metadata
  (`common.meta.titleTemplate`). The helper is the only place the pairing is read, so no component branches on
  a locale (INV-02.9) and changing 优朵幼儿园 touches `site.json` and nothing else. `brandNameZh` and
  `{brandNameZh}` are retired everywhere in this document.
- **D-04.18 Provisional owner facts are invisible to components (HD-7 · HD-9 · HD-12).** Teacher names and
  credentials, the phone number, the address, the licence number and the Yelp figures ship as sample defaults
  registered in `site.json.provisional` (02 D-02.20). 04 needs **no provisional-aware component**: the registry
  is read only by `pnpm validate:content`, so there is no badge, no wrapper, no "placeholder" styling and no
  conditional. `collections.teachers.<id>.name|credentials` are ordinary per-locale collection text read exactly
  like every other collection field, and `contact.phoneDisplay` / `contact.phone` are ordinary `site.json`
  fields. The corollary this document enforces: **no component, prop, class, test fixture or layout table in 04
  names a teacher** — geometry keys off the `head` flag and `site.teachers[]` order (D-04.6), never off "Ping",
  so replacing the three names is a content edit that moves nothing (INV-04.11).

## Design

### 1 · Architecture

```mermaid
flowchart TD
  RL["app/[locale]/layout.tsx · RSC<br/>html lang + font vars · NextIntlClientProvider(common, visit, errors[, gallery])<br/>MotionProvider · SkipLink · SiteHeader · {children} · SiteFooter · Analytics"]
  RL --> HP["app/[locale]/page.tsx · RSC<br/>PageTransition → main[data-snap-root] → 8 × Section"]
  RL --> SP["app/[locale]/&lt;route&gt;/page.tsx × 6 · RSC · faq+enroll reserved, not built<br/>PageTransition → SubpageBar → composites"]
  HP --> S1["HeroSection · RSC"] --> L1["Reveal / RevealItem · client"] --> C1["content · RSC children"]
  S1 --> D1["Sun · Leaf · ScrollCue · client (m.div outer, CSS inner)"]
  HP --> S4["MenuSection · RSC"] --> L4["MenuDayChips · client<br/>props: days[], lines Record&lt;day, ReactNode&gt;"]
  HP --> S8["VisitSection · RSC"] --> L8["InquiryForm · client (visit.form.*)"] --> T8["Turnstile · client"]
  SP --> G["GalleryExplorer · client<br/>props: items[], categories[], allLabel"]
```

**Providers and layout.** `app/[locale]/layout.tsx` (06 owns the route tree; 04 owns what it renders): `<html
lang={LOCALE_META[locale].htmlLang} data-scroll-behavior="smooth" className={fonts}>` (02 D-02.9, 03 §3.1, 05
D-05.11), `<body>` → `NextIntlClientProvider messages={pick(messages, CLIENT_NAMESPACES)}` (02 D-02.16; the
`pick` is the only place the client allowlist exists) → `MotionProvider` (05 D-05.5) → `SkipLink` →
`SiteHeader` → `<main id="main">{children}</main>`? No: `main` is rendered by each page so the home page can
carry `data-snap-root` (05 §5.8) and detail pages cannot; the layout renders `SkipLink`, `SiteHeader`,
`{children}`, `SiteFooter` and the analytics components (07 D-07.9). Whether a pass-through `app/layout.tsx`
exists for a root `not-found` is 06's call (02 §Routing).

**Pages.** `page.tsx` (home) = `PageTransition` → `<main id="main" data-snap-root>` → `HeroSection`,
`PhilosophySection`, `ProgramsSection`, `MenuSection`, `GallerySection`, `TestimonialsSection`,
`TeachersSection`, `VisitSection`. The six detail pages (`philosophy`, `programs`, `menu`, `gallery`, `reviews`,
`team`; ids from `site.routes[]`) = `PageTransition` → `SubpageBar` → `<main id="main">` → `SubpageHeader` +
the composites in §3.6, with a focusable `h1` (`tabIndex={-1}`) for 05 §5.7. **Six is the whole set** (HD-5,
02 D-02.17): "Staff" in `docs/design/README.md` line 17 **is** Team — one page, the `team` namespace, and no
`staff` component or namespace exists anywhere in this inventory. `faq` and `enroll` are **reserved, not
built**: the plan records how they would compose (`SubpageBar` + `FaqList` / `InquiryForm source="enroll"`) so
the route can ship the day content exists, and until then neither page, nor `FaqList`, nor a nav entry, nor a
sitemap row, nor a Playwright row is created. Metadata per page is 06's (`<page>.meta.*`).

**Boundary rule.** Props that cross to a client component are strings, numbers, booleans, plain arrays/objects
of those, or React nodes rendered on the server — never functions, never collection objects, never `t`. Client
components that need copy read it through `useTranslations` from a client namespace or receive it as props;
§5.2 lists which.

**Data flow.** Messages: `getTranslations('home.hero')` in async RSC, `useTranslations` in sync RSC and in client
leaves. Collections: `getPrograms()`, `getMenu()`, `getGallery()`, `getTestimonials()`, `getTeachers()`,
`getFaq()` from `src/content/collections.ts` (server-only, `import 'server-only'`), each returning entries of
`site.json` joined with the current locale's text (locale from next-intl's `getLocale()`). Shared config:
`site` from `src/content/site.ts` (server; client leaves get the values they need as props). Formats:
`getFormatter()` / `useFormatter()` with 02's named formats (`weekdayShort`, `weekdayLong`, `timeShort`,
`rating`, `dateMonth`).

### 2 · Directory layout (`src/`)

```text
src/
├── app/
│   ├── globals.css                  @import tailwindcss; imports styles/tokens.css; html { overflow-x: clip } (05 §5.8)
│   ├── [locale]/layout.tsx          html/body, fonts, providers, SkipLink, SiteHeader, SiteFooter (06 routes; 04 content)
│   ├── [locale]/page.tsx            home · [locale]/{philosophy,programs,menu,gallery,reviews,team}/page.tsx
│   ├── [locale]/{faq,enroll}/       RESERVED, not built (D-02.17) · error.tsx* · global-error.tsx* (06)
│   ├── global-not-found.tsx         the 404 — its own html/body, outside every layout (06 D-06.14)
├── components/
│   ├── layout/        SiteHeader, PrimaryNav*, LangSwitcher*, BookTourButton, TrackedLink*, Hamburger*,
│   │                  MobileMenu*, SiteFooter, LogoCard, FooterLinks*, Copyright, SkipLink, Section,
│   │                  SectionHeader, SubpageBar, BackLink*, SubpageHeader
│   ├── ui/            Eyebrow, SectionTitle, LearnMoreLink, Button, Chip, Emoji, Picture, PhotoSlot, StarRow, IconDot,
│   │                  VisuallyHidden, rich.tsx (richTags helper)
│   ├── motion/        05's modules: MotionProvider*, Reveal*/RevealItem*, WordSwap*, CountUp*, PageTransition*,
│   │                  variants.ts, registry.ts, ambient.css, view-transitions.css, AmbientScope*
│   ├── decor/         Sun*, Leaf*, ScrollCue*, QuoteMark, Plate*, Polaroid*, SteppingStone*, Bubble*, TeacherFrame*
│   ├── sections/      hero/ philosophy/ programs/ menu/ gallery/ testimonials/ teachers/ visit/ — one folder per
│   │                  section: <Name>Section.tsx + leaves + layout.ts (geometry, D-04.6) + <Name>Section.test.tsx
│   ├── pages/         PrinciplesList, DailyTimeline, PhilosophyBadges, RoomCards, WeeklyMenuTable, DayCards,
│   │                  GalleryExplorer* (GalleryFilters, GalleryGrid, Lightbox), ReviewsList, YelpButton, TeamBio, FaqList, ErrorPanel*
│   └── forms/         InquiryForm*, FormField*, Turnstile*, SuccessPanel*, FormAlert*, NoscriptFallback, inquiry-codes.ts (07)
├── content/ · design/ 02: schemas/, site.ts, collections.ts · 03: tokens.ts (TS mirror, ADJ-8), fonts.ts
├── i18n/              02: routing.ts, navigation.ts, request.ts, messages.ts, formats.ts, global.d.ts · negotiate.ts (06 D-06.15)
├── lib/               inquiry/schema.ts (07), analytics.ts (track wrappers, 07 §4), menu-day.ts (default day), cn.ts
├── styles/            03: tokens.css — the one token source, and the only file here (no base.css; see below)
└── proxy.ts           02/06
```

`*` = client component (`'use client'`). Outside the tree above, `src/app/api/inquiry/route.ts` is 07's handler
and `src/app/sitemap.ts` / `src/app/robots.ts` are 06's. 05's proposed `src/motion/*` paths map 1:1 into
`src/components/motion/` (05 §5.1: "names are binding, locations are not"); the token mirror is
`src/design/tokens.ts` (memo ADJ-8 — 05's `src/motion/tokens.ts` spelling is superseded).

**There is no `src/styles/base.css`.** An earlier draft of this tree gave that file four jobs; the build ships
all four elsewhere and the file was never created. The reset is Tailwind v4's preflight, which
`@import "tailwindcss"` already brings in. `:focus-visible` (03 D-03.11) and the three `:lang()` rules live in
`src/styles/tokens.css`, the one token source (03 D-03.1). The `[data-reveal]` no-JavaScript rule ships **inline
in `MotionProvider`**, written into a `<noscript>` element — 05 INV-05.10's requirement, PR-4.3a's deliverable
(10 §3), and the stronger placement of the two: the rule travels with the component that creates the hidden
state it undoes, so there is no second wiring step to forget and no stylesheet left behind if the provider ever
moves. (The same component emits the reduced-motion `[data-reveal]` rule beside it, 05 §5.9.) The two motion
stylesheets follow the same rule and are imported by their consumers rather than by `globals.css`:
`ambient.css` by each decoration that can carry a loop, `view-transitions.css` by `PageTransition`.
`html { overflow-x: clip }` (05 §5.8) is the one declaration `globals.css` owns outright, and
`.stylelintrc.mjs` scopes INV-05.2's `overflow` ban to `src/components/**` precisely so that this file is the
single site where the gallery's bleed may land.

**This tree is the target, not a manifest.** It fixes where a file belongs *once it exists* — which is what
makes a new file's location a settled question instead of a fresh one — and claims nothing about which of
these files exist today. Two authorities answer that better than a paragraph can, and stay right without
anyone remembering to edit them: the working tree, for what is built, and
[`11-work-tracking.md`](11-work-tracking.md)'s tracker, for what is planned and who holds it.

A dated "Status against `main`" block used to stand here, and the convention that replaced it is general —
05 now follows it too. **A document states what must be true and cites the decision, open question or bead
that owns anything not yet true; it does not enumerate what currently exists.** A dated snapshot rots on a
schedule nobody controls: this one was wrong within two pull requests, twice, and each time it read as
authoritative *because* it carried a date. Where a gap is genuinely load-bearing — a reader would write the
wrong code without it — it belongs in the row that owns the thing, worded as a condition on the
specification, where a reader is already standing when the gap matters. `AmbientScope` is the worked example:
§3.3 fixes what it does and where it goes, and the one fact a caller needs — that no section mounts it yet —
is recorded in `ambient.css`, beside the rule that is waiting for it.

### 3 · Component inventory

Columns: **Kind** S = server, C = client · **Keys / data** cite 02's keys and `site.json` fields (R1 inventory
keys in `SCRATCH/inventory/strings.md` map onto them in §4) · **Motion** = 05 variant names · **A11y** = the
contract 08 checks. Sizes, radii, shadows and colours are always 03 tokens and are not repeated here.

#### 3.1 App chrome and layout

| Component | Kind | Props (sketch) | Keys / data | Design | Desktop ↔ mobile | Motion | A11y |
|---|---|---|---|---|---|---|---|
| `SiteHeader` | S | — | `common.logo.alt`, `common.nav.<id>` for `site.nav.primary[]`, `common.nav.bookTour`; `site.routes[]` | desktop/README "Layout"; mobile/README "Layout" | `≥ lg`: logo 50px · `PrimaryNav` · divider · `LangSwitcher` · pill; `< lg`: logo 38px · pill · `Hamburger` (D-04.9) | nav items `Reveal variant="none"` (join the locale cascade) | `<header>` + `<nav aria-label={t('common.nav.label')}>` (key requested, §10); sticky, height `--nav-h`; never transformed (INV-05.4) |
| `PrimaryNav` | C | `items: {id, anchor, label, href}[]` | as above — labels are resolved by `SiteHeader` and arrive as props; this component reads no messages | desktop/README "Layout" | row `≥ lg` only | none | client because it calls `usePathname()` from `src/i18n/navigation` and picks per item `<a href="#anchor">` on the home page vs next-intl `Link href` elsewhere (06 D-06.7); current section not tracked (no scroll spy at launch) |
| `LangSwitcher` | C | `variant: 'nav' \| 'sheet'`, `current: Locale` (06 D-06.9's sketch passes it; `useLocale()` would also do) | `common.localeSwitcher.ariaLabel\|optionAriaLabel`; `LOCALE_META[id].shortLabel` and `nativeName` (02 rule 11 — endonyms live in `LOCALE_META`, never message keys); `routing.locales` | root README "EN ↔ 中文 toggle" — the design's one two-name item, now three options (D-04.16, OQ-04.11) | `nav`: `<details>` trigger `≥ lg` showing `shortLabel` and no chevron (ADJ-20), styled with the design's lang-toggle recipe (Nunito 700 14px, `--color-muted` → 03 §10's `#7a7160`), panel on `--color-nav-bg` + `--shadow-nav` + `--radius-card`; `sheet`: three flat rows `< lg`, no disclosure | option click calls `registry.markLocaleSwap()` then `router.replace(pathname + search + hash, {locale, scroll:false, transitionTypes:['locale-swap']})` (02 D-02.10, 05 §5.6, 06 D-06.9) | `<details>/<summary>` disclosure (works unscripted), **not** `role="menu"` — the options are links; `<ul>` of next-intl `Link`s with `hrefLang`, `aria-current="true"` on the current locale, `optionAriaLabel {locale}` per option; `Escape` / outside `pointerdown` close and restore focus to the `<summary>`; the option list is `routing.locales.map(...)`, so no locale id is written in the component (INV-02.9, INV-04.12) |
| `BookTourButton` | S | `placement: 'nav' \| 'hero' \| 'sheet'` | `common.nav.bookTour` / `home.hero.ctaPrimary`; `site.nav.cta.href` (`/#visit`) | root README §1, §8 | nav pill 16px/12×24 vs 13px/10×16; hero full-width `< md` | hover lift (05 §5.10) | renders `TrackedLink event="cta_book_tour" params={{placement}}` (07 §4); the label and pill styling stay server-rendered children |
| `TrackedLink` | C | `href`, `event: 'cta_book_tour' \| 'yelp_click'`, `params?: Record<string, string>`, `external?`, `children` | — (no copy: the label arrives as children) | — (behaviour only) | same | none | the only analytics `onClick` wrapper (07 §4's event list, via `src/lib/analytics.ts`); renders next-intl `Link`, or `<a target="_blank" rel="noopener noreferrer">` when `external`; used by `BookTourButton` and `YelpButton`; keyboard and focus behaviour are the underlying link's, so it adds no a11y surface |
| `Hamburger` | C | `controlsId` | `common.nav.menuOpen\|menuClose` | mobile/README "Mobile-only behaviors" | `< lg` only | none | `<button aria-expanded aria-controls>`; hit area ≥ `--tap-min`; three bars are CSS |
| `MobileMenu` | C | `links: {id, anchor, label, href}[]`, `contact: {href, label}`, `children` (`LangSwitcher variant="sheet"`, BookTourButton nodes) | labels passed as props from `SiteHeader`; the sheet's link list is the third of 06 D-06.7's three `usePathname()` link lists and lives inside this already-client component | mobile/README "Hamburger opens nav menu (… Contact, EN·中文)" — that single language item is now three locale rows (D-04.8), one sheet row taller | sheet only `< lg`; desktop never mounts it | `fade` + `rise` open/close (05 OQ-05.3 default) | `role="dialog" aria-modal`, focus trap, `Escape` closes, background `inert`, scroll lock, focus returns to `Hamburger`; link hit areas ≥ 44px |
| `SkipLink` | S | — | `common.a11y.skipToContent` | — (production a11y) | same | none | first focusable element; visible on focus; target `#main` |
| `Section` | S | `id: SectionId`, `labelledBy`, `children`, `decor?` | `site.routes[].homeAnchor` for ids | root README "Section inventory", "Interactions & state" | padding `--section-py/--section-px` per view; gallery `px` bleed | none (shell is never transformed, INV-05.4) | `<section id aria-labelledby>`; `scroll-margin-top: var(--nav-h)`; `snap-start`; role variables (D-04.3) |
| `SectionHeader` | S | `eyebrow?`, `title`, `intro?`, `introShort?`, `align`, `as: 'h1' \| 'h2'` | caller's keys | every section/subpage header | intro hidden `< md` where the key is desktop-only; gap 12px → 9–10px | wrapped in `Reveal variant="rise"`; the id is the caller's — `<section>.header` from a home section, `subpage.<page>.header` from `SubpageHeader` (§3.3's id rule) | heading element provided by `as`; one `h1` per page |
| `SubpageBar` | S | `routeId` | `<page>.kicker`; `common.back.label\|labelShort` | desktop reference L350–352: tinted bar (the page's section colour at `.94`) + `backdrop-filter: blur(6px)` — the `--color-nav-bg` recipe (03 §2.4); `--shadow-subnav` on the bar, white pill + `--shadow-back` on `BackLink` (03 §5); token `--color-subnav-bg` requested, §10 | kicker always; back label ↔ `labelShort` via `md:` toggle | — | sticky under the header; `BackLink` first in tab order on detail pages |
| `BackLink` | C | `homeAnchor`, `children` | — (label passed from `SubpageBar`) | root README "Detail subpages" | — | `router.replace('/#'+homeAnchor, {transitionTypes:['subpage-exit']})` (05 §5.7) | rendered as `Link` (works without JS); after navigation focus moves to the origin section heading |
| `SiteFooter` | S | — | `common.nav.<id>` for `site.nav.footer[]` (six + contact), `common.nav.footerLabel`, `common.footer.copyright` `{year, brandName, brandNameOther, license}`, `common.logo.alt`; `site.brand.name` (localized value) via `brandArgs(locale)`, `site.license` | root README §8; desktop reference L336–342; mobile L245–249 | row `≥ lg` (logo card · links) vs centred column; license renders on both (D-02.13) | inside the Visit `fade` block | `<footer>` + `<nav aria-label={t('common.nav.footerLabel')}>` — its own name, not the header's (§10); link colour `--color-link-visit`; contrast caveat 03 §10 |
| `LogoCard` / `FooterLinks` / `Copyright` | S / **C** / S | `height`, `items: {id, anchor, label, href}[]`, — | as `SiteFooter` | desktop/README §8 | logo 42px vs 34px | — | logo `alt` from `common.logo.alt`; copyright `<small>`; `FooterLinks` is client for the same reason as `PrimaryNav` — `usePathname()` per item (06 D-06.7) — and reads no messages, `SiteFooter` resolves the labels |
| `SubpageHeader` | S | `page` | `<page>.eyebrow\|heading\|intro\|introShort` | desktop reference subpage headers | intro shortened `< md` | `Reveal rise`, id `subpage.<page>.header` — derived inside the component, never a prop, so a seventh detail page cannot forget it (§3.3) | `h1 tabIndex={-1}` focused after the slide (05 §5.7) |

#### 3.2 Primitives (`components/ui`)

| Component | Kind | Props (sketch) | Keys / data | Notes (design · responsive · a11y) |
|---|---|---|---|---|
| `Eyebrow` | S | `size: 'eyebrow' \| 'sm' \| 'panel'`, `children` | caller's key | The only recipe that applies `uppercase` + `tracking-eyebrow` (03 §3.3; never on mixed EN/中文 strings such as `home.philosophy.badgeBilingual`); colour `--section-accent`; used for section eyebrows, age labels, role lines, plate dot captions, info-panel labels; arrows/stars never inside (03 §3.1 glyph note) |
| `SectionTitle` | S | `as: 'h1' \| 'h2' \| 'h3'`, `size: 'headline' \| 'section' \| 'quote' \| …`, `children` | — | `text-<token>`, `text-wrap: balance`, `whitespace-pre-line` when the message carries `\n` (02 §Line breaks; the hero honours `\n` only `≥ md` — the mobile variant has no break, mobile reference L55) |
| `LearnMoreLink` | S | `routeId`, `children` | `home.<section>.link`; `site.routes[]` | next-intl `Link href={route.path} transitionTypes={['subpage-enter']}` (05 §5.7, 06 passes the prop through); `border-b-2` in `--section-link-underline`, text `--section-link`; hit area ≥ 44px via padding; the `→` glyph stays in the string (02) |
| `Button` | S | `as: 'link' \| 'button'`, `size: 'nav' \| 'hero' \| 'submit'`, `tone: 'sage' \| 'yelp'` | — | pill radius, `--shadow-primary*`; hover lift `@media (hover:hover)` (05 §5.10); `--tap-min` |
| `Chip` | S | `tone: 'sage' \| 'sage-soft' \| 'gold' \| 'cool' \| 'lavender' \| 'white'` (default `sage-soft`), `icon?` (emoji via `Emoji`), `children` | — | hero badge, trust row, dietary chips, filter chips (visual only — the interactive filter is in `GalleryExplorer`), programme highlight chips, teacher tags, HEAD TEACHER badge (`tone="sage"`, uppercase through `Eyebrow` inside); padding tokens `--chip-*`. **Six tones, not five:** the design draws two sage chips and this row long listed one. `sage` is the solid sage fill with white text that the HEAD TEACHER badge and the credential badge use (desktop L292, L152); `sage-soft` is the pale `--color-chip-bg` fill of the hero badge, the trust row and the preschool tags (L115, L73, L425). They cannot be merged: white text on `#eef2e8` is about 1:1 |
| `Emoji` | S | `symbol`, `label?`, `size: 'dot' \| 'tile' \| 'inline'` | icon from `site.json` (`icon` fields) | `<span role="img" aria-label>` when `label` given, else `aria-hidden="true"`; `font-emoji`; fixed box so glyph width never shifts layout (03 D-03.8, §9) |
| `Picture` | S | `image?: {src,width,height,blurDataURL?}`, `alt`, `sizes`, `radius: RadiusToken`, `priority?`, `fit` | `alt` from messages/collections | D-04.12; renders `PhotoSlot` when `image` is absent; `sizes` per breakpoint is mandatory (INV-04.6) |
| `PhotoSlot` | S | `slotId`, `alt?`, `radius`, `shape: 'rect' \| 'circle'` | — | 03 §9 fill `color-mix(in oklab, var(--section-bg) 92%, var(--color-ink))`; no visible text in production (a dev-only `slotId` label is data, not copy); `role="img" aria-label={alt}` when `alt` exists, else `aria-hidden` |
| `StarRow` | S | `rating`, `size` | `common.rating.ariaLabel` `{rating}` | five `★` glyphs in `--color-amber`, `aria-hidden`; the accessible text is the sibling rating/aria-label (03 §10: stars are decorative) |
| `IconDot` | S | `icon`, `size: 'md' \| 'lg'` | `site.teachers[].icon`, `site.principles[].icon` | white circle 56/48px (teachers) or 48/40px tile (principles) with `Emoji aria-hidden` |
| `VisuallyHidden` | S | `children`, `as` | — | sr-only utility wrapper |
| `richTags()` | helper | `(ctx: {href?, count?}) => Record<Tag, fn>` | 02 allowlist `em strong link count day` | D-04.13; used by `PullQuote`, hero title, visit title, `SpeechBubble`, `SampleLine`, `ReviewsHeader`, `FaqList` |

#### 3.3 Motion (05 names; 04 places them)

| Component | Kind | Placed where (this doc) | Notes |
|---|---|---|---|
| `MotionProvider` | C | `app/[locale]/layout.tsx` body root | 05 D-05.5 |
| `Reveal` / `RevealItem` | C | every `SectionHeader`, every link row, every stagger group per 05 §5.3; nav items `variant="none"` | **ids are unique across the site, not per page.** The registry is once per session keyed by the id alone (05 D-05.6), so two blocks on two routes that share an id share one entrance and the second never plays. A home section's blocks are `<section>.<slot>` (`programs.stones`); a subpage composite's are `<page>.<slot>` (`reviews.count`); the header every detail page shares is `subpage.<page>.header`, because `gallery`, `programs` and `menu` are page namespaces *and* home section ids — unprefixed, those three headers spent their entrance on the home page and arrived already-played. `RevealItem` carries no id: the registry and the cascade work on the block, not its parts (05 §5.1). `as` chosen so semantics survive (`ul`/`li` for lists, `figure` for polaroids) |
| `WordSwap` | C | `MenuDayChips` sample line only | keyed by `selectedDay` (05 D-05.9) |
| `CountUp` | C | `ReviewsHeader` (home) via the `count` rich tag and the rating | values from `site.yelp.*`; `tabular-nums`, `min-width` in `ch` (INV-05.7); reads `useRevealed()` from `Reveal id="testimonials.header"` — the home section's id, which is `testimonials`, not `reviews` (05 §5.5). The Reviews *page* prints both numbers and counts neither: neither subpage reference carries the design's `data-count` |
| `PageTransition` | C | first child of every `page.tsx` | 05 §5.7 |
| `AmbientScope` | C | `HeroSection` (and `PhilosophySection` on mobile) | one `IntersectionObserver` toggling `data-ambient="paused"` on the nearest `[data-section]` ancestor — which `Section` is the only thing to write (D-04.3), so the scope needs no id and no prop (05 §5.4). Renders a hidden `span` as its foothold and nothing visible. **Not Motion's `useInView`**, which this row used to specify: that hook takes a ref to an element React rendered, and the element that must carry the attribute is a `<section>` a *server* component renders several layers up. It is the same single observer INV-05.9 counts either way, with the contract in the file rather than in Motion's internals |

#### 3.4 Decorations (`components/decor`; client unless noted; INV-05.5 two-layer contract; INV-04.5)

| Component | Props | Where · per view | Loop / variant (05) | Notes |
|---|---|---|---|---|
| `Sun` | `id`, `size: 'hero' \| 'programs' \| 'visit' \| 'sm'`, `loop?: boolean` (default `true`) | hero top-right 118/72px; programs 100px (desktop reference L160); visit 120/70px | `gpsun` 9s on the hero sun only; programs and visit are `loop={false}` (desktop reference L160, L308 carry no `animation`; mobile L222 likewise) | inline SVG (reference path), fill `--color-sun`; `aria-hidden` |
| `Leaf` | `id`, `size`, `speed: 'fast' \| 'base' \| 'slow'`, `variant: 'a' \| 'b'`, `tint: LeafToken`, `position`, `loop?: boolean` (default `true`) | hero ×3 desktop (40/28/22px) / ×1 mobile (26px); philosophy ×2 desktop / ×1 mobile; teachers ×2 / ×1; visit ×1 | `gpfloat`/`gpfloat2` 7/8/9s on the hero leaves and the mobile philosophy leaf; the seven other section leaves are `loop={false}` | `--color-leaf-*` tokens; positions in `layout.ts`; `aria-hidden`; counts read off the references, not 05 §5.4 (desktop L111–113 hero animated, L140/L141 philosophy and L276/L277 teachers and L309 visit static; mobile L52 hero and L79 philosophy animated, L189 teachers static) |
| `ScrollCue` | `id`, `href`, `children` | hero bottom, both views | `gpbounce` 2s | text `home.hero.scrollCue` passed as children; a real `<a href="#philosophy">` |
| `QuoteMark` (S) | — | philosophy, 84/58px | none | decorative `“`, `aria-hidden`, `--color-quote-mark-text` |
| `Plate` | `id`, `dots: {id, label}[]` | menu, 230/190px, dots 46/56/46 → 36/46/36 | `roll` (stagger child 0) | dot fills `--color-dot-*`, captions `Eyebrow size="sm"` in `--color-dot-label-*` (`menu.meals.*`); inset ring `--shadow-plate` |
| `Polaroid` | `id`, `slot: Slot`, `children` (Picture) | gallery field, 7 / 5 | `polaroid` on the `RevealItem`; resting tilt + hover on the inner frame | frame `--radius-polaroid`, `--shadow-polaroid`, 10+30px / 8+24px frame; `figure` |
| `SteppingStone` | `id`, `size: 'base' \| 'featured'`, `children` | programs; 150/188 → 104/122px | `sprout` | white ring, `--shadow-stone(-lg)`; `featured` from `site.programs[].featured` |
| `Bubble` | `id`, `tail: 'left' \| 'right'`, `children` | testimonials; tails per 03 §5 radius tokens | `bubble` origin by tail | `rounded-bubble-l/r`; desktop cards 1,3 left / 2 right (+30px push); mobile alternating |
| `TeacherFrame` | `id`, `children` | teachers ×3 | `swing` origin `50% 0%` | wraps `HeadTeacherCard` / `AssistantCard` |

Only the hero decorations (plus the mobile philosophy leaf) loop in the references; the seven static section
leaves and the two static suns are the same components with `loop={false}`, which drops the `.loop` class so no
keyframes attach. 05 §5.4 carries the same flag in its prop list and the same reading in its prose (§10); its
loop table covers only the looping instances by design. A prop, not a new component.

#### 3.5 Home sections and their leaves (all server unless noted)

| Component | Props | Keys / data (02 names) | Desktop ↔ mobile | Motion (05 §5.3) | A11y |
|---|---|---|---|---|---|
| `HeroSection` | — | `home.hero.badge\|title\|subtitle\|subtitleShort\|ctaPrimary\|ctaSecondary\|scrollCue\|photo.alt`; `site.images.hero`, `site.nav.cta.href`, `site.routes[philosophy]` | column max 760px, headline 64 → 36px, CTA pill → full-width, photo 1040×380 r26 → 230px tall r22, sun 118 → 72, leaves 3 → 1 | text column `rise`; photo block `rise opaque` (LCP, OQ-05.8); `Sun`, `Leaf`, `ScrollCue` | `h1` = title (`richTags` `em`); `ctaSecondary` is a hash `Link` to `#philosophy`; badge is text, not a heading |
| `TrustRow` | — | `home.hero.trust.yelp {rating}`, `trust.ages\|agesShort`, `common.rating.ariaLabel`; `site.yelp.rating` | 14px row with divider → compressed (`agesShort`) | inside hero text `rise` | `StarRow aria-hidden` + visible "5.0 on Yelp" text; divider `aria-hidden` |
| `FloatingMealsCard` | — | `home.hero.mealsCard.title\|subtitle\|subtitleShort`; icon `site.hero.mealsIcon` (🍎, §10) | bottom-left of photo, r16; icon dot 38 → 30px | with the photo block | `Emoji aria-hidden`; plain `<p>`s |
| `PhilosophySection` | — | `home.philosophy.eyebrow\|quote\|attribution\|badgeCertified\|badgeBilingual\|link\|photo.alt`; `site.images.philosophy`, `site.routes[philosophy]` | quote 44 → 26px max 820px; photo 560×260 r22 → full-width 190px r18; badges row → stacked | quote block `ink`; badges row `ink`; `Leaf` ×2 / ×1 | `h2` = eyebrow? No — `h2` is visually the quote: `SectionHeader` renders the eyebrow as `<p>` and the `PullQuote` as `<blockquote>` with an `h2` `VisuallyHidden` = `home.philosophy.eyebrow` (section label); `aria-labelledby` points at it |
| `PullQuote` | — | `home.philosophy.quote` (rich `em`), `attribution` | — | `ink` | `<blockquote><p>` + `<footer>` attribution; `QuoteMark aria-hidden` |
| `BadgeRow` | `items` | `badgeCertified` (🌱 inside the string), `badgeBilingual` (never uppercase) | row → stacked | `ink` | `Chip` list `<ul>` |
| `ProgramsSection` | — | `home.programs.eyebrow\|title\|intro\|link`; `collections.programs.<id>.name\|ageLabel\|summary\|summaryShort\|photoAlt`; `site.programs[] {id, ratio, photo, featured}` | `≥ lg`: row 200/236/200 gap 44, bottom-aligned, featured raised 34px; `< lg`: alternating left/right path (featured right-aligned text) | header `rise`; stones `sprout` stagger; link `rise` | `<ul>` of three `<li>` (`RevealItem as="li"`); each stone `h3` name + `Eyebrow size="sm"` age + `<p>` summary; photo `alt` = `photoAlt` |
| `StonePath` | `items` | geometry from `programs/layout.ts` | row vs path | — | order = `site.programs[]` order on both views |
| `MenuSection` | — | `home.menu.eyebrow\|title\|intro\|sampleLine\|link`; `menu.meals.<id>`; `collections.menu.week.<day>.<meal>`, `dietary.<id>.label\|labelShort`; `site.menu.days\|meals\|dietary[]`, `site.timeZone`; format `weekdayShort\|weekdayLong` | plate 230 → 190; chips 14 → 13px; sample line 15 → 13px; 2 dietary chips on home (`onHome`) | header `rise`; plate `roll`; chip row + sample line `drop`; chips/link row `rise` | plate dots are decorative with visible captions; see `MenuDayChips`; computes `defaultDay` server-side (D-04.10) |
| `MenuDayChips` | C · `days: {id, label}[]`, `lines: Record<DayId, ReactNode>`, `defaultDay: DayId`, `groupLabel` | labels pre-formatted on the server (`weekdayShort`); `groupLabel` = `menu.dayChips.label` (requested, §10) | selected padding 8×20 / 9×16 (03 §4); hit area extended to 44px with `::before` inset, visual unchanged (03 §6) | `WordSwap` keyed by day (D-05.9) | `role="tablist"` with `role="tab" aria-selected`, arrow-key roving focus; the line is `role="tabpanel"`; `defaultDay` is server-computed so the selected chip is correct before hydration and without JS; `prefers-reduced-motion` → instant |
| `SampleLine` | `day` | `home.menu.sampleLine` (`<day>{weekday}</day> — {breakfast} · {lunch} · {snack}`) with `weekdayLong` | max 580px | — | rendered five times on the server (D-04.10), one visible. **Menu-cell casing (02's "Flag for 04"):** the capitalised, comma-joined cells render **as written**, here and in `WeeklyMenuTable` / `DayCards` — no CSS `lowercase`, because `text-transform` does nothing to Chinese text and would make `en` disagree with both Chinese locales; casing stays 02's to edit |
| `DietaryChips` | `items: {id, label, labelShort}[]` | `collections.menu.dietary.<id>.label\|labelShort`; `site.menu.dietary[] {id, onHome}` | `label` ↔ `labelShort` toggle | `rise` | `<ul>`; the chip emoji is inline in the label string (02: `dietary[] {id, onHome}`, "chip emoji lives in the label text"), so there is no `icon` field and no `Emoji` child here |
| `GallerySection` | — | `home.gallery.eyebrow\|title\|intro\|link` — `title` takes `{brandShortName}` from `brandArgs(locale)` (D-04.17: "Life at {brandShortName}" / "{brandShortName}的日常"; 绿茵园 is rejected copy and must never reappear); `collections.gallery.photos.<id>.alt\|caption?`; `site.gallery.photos[] {id, src, width, height, category, wide, rotation?, onHome, onMobile}` | `≥ lg`: 980×410 field, 7 slots (`%` of the field, `aspect-ratio 980/410`); `< lg`: 420px-tall fluid field, 5 slots anchored left/right (reference L152–156); section `px` 10px `< md` | header `rise`; polaroids `polaroid` stagger, side by index parity; link `rise` | `<ul>`/`figure` per polaroid; `alt` per photo; `html { overflow-x: clip }` absorbs fly-in bleed (05 §5.8) |
| `PolaroidField` | `photos`, `slots` | geometry `gallery/layout.ts` (D-04.6) | 7 vs 5 slots; photos with `onMobile: false` hidden `< lg` | stagger container never transformed | — |
| `TestimonialsSection` | — | `home.testimonials.title\|countLine\|link`; `common.brand.yelp`, `common.rating.ariaLabel`, `common.punctuation.quoteOpen\|quoteClose`; `collections.testimonials.<id>.quote\|author\|relation`; `site.yelp.rating\|reviewCount`; `site.testimonials[] {id, rating, avatar?, onHome, onMobile}`; `site.routes[reviews]` | `≥ lg`: 3-col grid gap 24, middle pushed 30px, tails L/R/L; `< lg`: stacked, alternating tails, `karenT` hidden (`onMobile:false`) | header `rise` (contains both `CountUp`s); bubbles `bubble` stagger; link `rise` | `h2` title; count line `aria-live="off"` (count-up is decorative — the server HTML already holds the final number); link to the reviews subpage via `LearnMoreLink routeId="reviews"` (§5.6, `subpage-enter`) — an internal link, so no `target`, no `rel` and no `common.links.newTab` |
| `ReviewsHeader` | `variant: 'home' \| 'page'` | `home.testimonials.countLine` / `reviews.countLine` with `<count>` → `CountUp`; rating via `{rating, number, rating}` | — | `rise` | `StarRow`; rating text visible |
| `YelpBadge` | — | `common.brand.yelp` | 5×11 → 4×9 padding | — | `--color-yelp` fill, white text (AA) |
| `SpeechBubble` | `item`, `tail` | `quote` (rich `em`), `author`, `relation`, quote marks from `common.punctuation.*` | avatar 44 → 38px (`PhotoSlot` circle when no `avatar`) | `Bubble` | `<figure><blockquote>` + `<figcaption>`; stars `aria-hidden` |
| `ReviewsLink` | — | `home.testimonials.link`; `site.routes[reviews]` | centred under the bubbles | in the link `rise` | the section's "learn more →": `LearnMoreLink`, one line, sync so the async section keeps its message reads in a child |
| `TeachersSection` | — | `home.teachers.eyebrow\|title\|intro\|introShort\|link`; `team.roles.head\|assistant`; `collections.teachers.<id>.name\|credentials\|summary\|summaryShort\|photoAlt`; `site.teachers[] {id, head, icon, photo}` | `≥ lg`: triptych in `site.teachers[]` order — assistant 230px (offset 44) · `head` 300px · assistant 230px, gaps 40; `< lg`: `head` first (CSS `order`), assistants side-by-side 2-col. Geometry keys off the `head` flag and array position, never off a name (D-04.18) | header `rise`; frames `swing` stagger; link `rise` | DOM order = `site.teachers[]` (desktop reading order); mobile reorder is visual only — cards hold no interactive content, so tab order is unaffected; `h3` names, read from the collection (provisional per 02 D-02.20, but ordinary text to this component) |
| `HeadTeacherCard` | `teacher` | `name`, `credentials` (Eyebrow sm), `summary\|summaryShort`, `photoAlt`; `team.roles.head` badge | photo 196 → 150px, badge 5×13 | `TeacherFrame` | `Picture` circle (→ `PhotoSlot` until the headshot exists, HD-12) + `Chip tone="sage"` badge (uppercase via `Eyebrow`); `name` and `credentials` are collection text — provisional sample defaults today (02 D-02.20), never literals here (D-04.18) |
| `AssistantCard` | `teacher`, `variant: 'home' \| 'page'` | `name`, `summary\|summaryShort` (home) / `bio\|bioShort` (page), `team.roles.assistant` | `IconDot` 56 → 48px | `TeacherFrame` | `Emoji aria-hidden` (name carries the meaning); the icon is `site.teachers[].icon`, so which assistant gets which emoji is data, not a name test (D-04.18) |
| `VisitSection` | — | `home.visit.title\|subtitle\|subtitleShort\|info.*\|map.alt`; `common.format.dayRange\|timeRange`; formats `weekdayLong`, `timeShort` over `site.hours`; `site.images.map`, `site.contact.mapsUrl\|email\|phone\|phoneDisplay` (`phone` is E.164 for `tel:`, `phoneDisplay` is what is printed — 02 §Shared config) | `≥ lg`: 1.2fr/1fr grid gap 30 max 1000; `< lg`: stacked; photo 150 → 120px; `--color-focus` = sun here (03 D-03.11) | three blocks `fade`; `Sun`, `Leaf` | `h2` title (rich, `\n`); `InfoPanel` is a `<dl>`; section is the `#visit` target (07 §6, 06) |
| `InfoPanel` | `hours`, `city`, `languages` | `home.visit.info.visitLabel\|hoursLabel\|languagesLabel\|city\|languages\|mapsLink`; `common.links.newTab` | two-line hours `≥ md` (`dayRange` / `timeRange` as two values, 02), one line `< md` | `fade` | `<dl>`; labels via `Eyebrow size="panel"`; contrast caveat (03 §10 panel labels) |
| `MapPhoto` | — | `home.visit.map.alt`; `site.images.map`, `site.contact.mapsUrl` | 150 → 120px, r16 → r14 | `fade` | `Picture` wrapped in a plain external `<a>` when `mapsUrl` exists (07 §6 — no embed, and 07 §4 defines no map event, so no `TrackedLink`) |
| `InquiryForm` | C · `source: 'home' \| 'enroll'`, `contact: {email, phone?}`, `turnstileSiteKey`, `noscript: ReactNode` (the server-rendered `NoscriptFallback`) | `visit.form.*` (client namespace `visit`), `useLocale()` for the hidden `locale` field; `useFormatter` `dateMonth` for month options | 2-col field grid → stacked (age/start share a row on mobile); inputs 44 → 46px; submit full-width `< md` | in the Visit `fade` block | 07 §1 contract (labels bound, `aria-describedby`, `aria-invalid`, live region, focus management, `aria-busy` never `disabled`) plus `lang` on the `<form>` = the page locale (07 §1, so IMEs and screen readers switch); no `autoFocus` on arrival (07 §6) |
| `HiddenFields` | — (inside `InquiryForm`) | `locale`, `source`, `submissionId` (UUID v4, regenerated only after success), `startedAt` (epoch ms at mount), `website` — 07 §1's five technical fields | none rendered | — | `website` is the honeypot: **visually hidden off-screen, never `display:none`** (07 §1: naive bots must still fill it), plus `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"` |
| `FormField` | C · `name`, `label`, `control`, `error?`, `help?` | labels from props (`InquiryForm` resolves keys) | — | — | `<label htmlFor>`; error sibling with `id` |
| `Turnstile` | C · `siteKey`, `onToken`, `locale` | — | reserved height; loads when the Visit section is in view or the form gains focus (07 §1) | — | reserved height so no shift; `aria-live` handled by the form |
| `SuccessPanel` / `FormAlert` | C · `SuccessPanel {onReset}`, `FormAlert {messageKey}` — both rendered by `InquiryForm` from client state | `visit.form.status.success.*`, `visit.form.errors.<code>` via `useTranslations('visit.form')` (the `visit` namespace is already on the client, §5.2) | panel replaces the form in the same card (07 D-07.4); banner sits above the submit | — | success heading `tabIndex={-1}` receives focus; alert `role="alert"`; **client because the key is chosen at runtime** from the wire code the server never saw (D-04.14) |
| `NoscriptFallback` | S — passed to `InquiryForm` as the `noscript` prop | `visit.form.noscript {email, phone}` and `visit.form.directContact {email, phone}`; `{phone}` is `site.contact.phoneDisplay` (the printed form) while the `tel:` href is `site.contact.phone` (E.164) — never the same field twice | replaces the submit button without JS (07 D-07.5) | — | plain `<noscript>` with `mailto:` / `tel:` links; no client code, so it survives the client-boundary lint (INV-04.1) |

`InquiryForm` follows 07 D-07.4 exactly: **no toasts** (every outcome renders inline — `SuccessPanel` in the
card, `FormAlert` above the submit), **no form library at launch** (`react-hook-form` only if every 07 §1
behaviour is kept, and that is 07's call, not a 04 default), and **no `autoFocus`** when the page or the
`#visit` anchor loads (07 §6). `childAge` and `desiredStart` are native `<select>`s (07 §1) — no combobox
widget — with the disabled `Select…` placeholder option coming from JSON.

#### 3.6 Subpage composites (`components/pages`; server unless noted)

| Component | Page | Props | Keys / data | Desktop ↔ mobile | Motion | A11y |
|---|---|---|---|---|---|---|
| `PrinciplesList` / `PrincipleCard` | philosophy | — | `philosophy.principles.<id>.title\|body`; `site.principles[] {id, icon}` | 3-col grid → stacked; tile 48 → 40px | `Reveal stagger` → `riseChild` | `<ul>`; `IconDot` `aria-hidden`; `h2` = `philosophy.heading`? — page `h1` = heading; cards `h3` |
| `DailyTimeline` / `TimelineRow` | philosophy | — | `philosophy.dayTitle`, `philosophy.day.<id>.title\|body`; `site.dailyRhythm[] {id, time}` with `timeShort` | title/body shortened variants are `*Short` if 02 adds them (inventory `var:mobile` on four rows; §10) | `riseChild` stagger | `<ol>`; time in `<time dateTime>`; `<strong>` title — `—` separator is punctuation in the component |
| `PhilosophyBadges` | philosophy | — | `philosophy.badges.certified\|ams\|bilingualDaily` (02 `badges.*`; ids proposed here) | `ams`/`bilingualDaily` desktop-only → hidden `< md` | `riseChild` | `<ul>` of `Chip` |
| `RoomCards` / `RoomCard` | programs | — | `programs.ratioLabel {adults}{children}`, `programs.footnote`; `collections.programs.<id>.name\|ageLabel\|description\|highlights[]\|photoAlt`; `site.programs[] {ratio, photo}` | photo 116 → 72px; highlights: ratio + 2 `≥ md`, ratio + 1 `< md` (index ≥ 1 hidden) | `riseChild` stagger | `<ul>`; `h2` name; chips `<ul>` |
| `WeeklyMenuTable` | menu | — | `menu.meals.<id>`; `collections.menu.week.<day>.<meal>`; `weekdayShort` | `≥ md` only (D-04.11); grid `120px repeat(5,1fr)` | `rise` | `<table><caption VisuallyHidden><th scope="col">` days, `<th scope="row">` meals |
| `DayCards` | menu | — | same data, `weekdayLong` | `< md` only | `riseChild` stagger | `<section>` per day with `h2`, `<dl>` meal → dish |
| `DietaryChips` (reuse) + note | menu | `surface: 'page'` | all three chips; `menu.note` | — | `rise` | — |
| `GalleryExplorer` | gallery | C · `items: {id, src, width, height, alt, caption?, category, wide, onMobile}[]`, `categories: {id, label, onMobile}[]`, `allLabel` | `gallery.filters.all` (prop), `collections.gallery.categories.<id>` (props), `common.lightbox.close\|prev\|next` (client namespace `common`) | grid 3-col with `span` rules (8 photos, one wide, `grid-row: span 2` slots) → 2-col (6 photos); `celebrations` filter desktop-only (`onMobile:false`) | grid items `riseChild`; lightbox open = `fade` | filters `role="group"` of toggle buttons `aria-pressed`; `<dialog>` modal lightbox, arrow keys, focus return; `next/image` with `sizes` |
| `GalleryFilters` / `GalleryGrid` / `Lightbox` | gallery | internal to `GalleryExplorer` | — | — | — | — |
| `ReviewsList` / `ReviewCard` | reviews | — | `collections.testimonials.*` (4; `alanW` `onHome:false`, `karenT` `onMobile:false`), `common.punctuation.*`; `site.testimonials[]` | 2-col → stacked (3 cards) | `riseChild` stagger | `<ul>` of `<figure>`; `·` separator is punctuation |
| `YelpButton` | reviews | — | `reviews.yelpCta`, `common.links.newTab`; `site.yelp.url` | centred | `rise` | `Button tone="yelp"` rendered through `TrackedLink external event="yelp_click"`; `↗` stays in the string |
| `TeamBio` | team | — | `team.roles.*`, `team.footnote`; the `head` teacher's `collections.teachers.<id>.bio\|bioShort\|tags[]`, assistants `bio`; `site.teachers[]` (ids are stable and outlive the provisional names — D-04.18) | head photo 160 → 120px (`PhotoSlot` until it exists); tags 3 → 2 (`tags[2]` hidden `< md`); assistants 2-col → stacked | head block `rise`; assistants `riseChild` | `h2` head name; DOM order head first on this page (different composition from home) |
| `FaqList` | faq — **reserved, not built** (HD-5 / 02 D-02.17) | — | `faq.*`, `collections.faq.<id>.question\|answer` | — | `riseChild` | `<details>/<summary>` per item — no custom accordion. The row records the composition; the file is not created while `site.json.faq[]` is empty |
| `ErrorPanel` | not-found / error | C · `kind`, `reset?` | `errors.notFound.*` / `errors.serverError.*` via `useTranslations('errors')` (client namespace `errors`, 02 D-02.16) | — | none | `h1`; CTA `Link` to `/`; client because `app/[locale]/error.tsx` imports it (06 §6.2) — `not-found.tsx` stays a server component and renders the same component |

Component count: 14 (chrome) + 12 (ui, incl. the `richTags` helper) + 6 (motion) + 9 (decor) + 31 (home sections
and leaves; `HiddenFields` is a fragment inside `InquiryForm`, not its own file) + 14 (subpage composites) =
**86 named components**, **30 of them client** — exactly the D-04.1 list, which is exactly the `*` files in §2
(7 layout + 7 motion + 8 decor + `MenuDayChips` + `GalleryExplorer` + `ErrorPanel` + 5 forms).
The ADJ-11 flips (`PrimaryNav`, `FooterLinks`, `ErrorPanel`, and the sheet's link list inside the already-client
`MobileMenu`) change kinds, not membership, so the named total stays 86; the client column moves 27 → 30. The two
route-file boundaries `app/[locale]/error.tsx` and `app/[locale]/global-error.tsx` are 06's files, not components
in this inventory, so they sit outside the 86 while counting toward the 32 `'use client'` files D-04.1 closes over.
HD-5 and HD-10 leave every count intact. **HD-5**: one of the 86, `FaqList`, is reserved and not built while
`site.json.faq[]` is empty, so **85 ship at launch**; Enrollment adds no component (it is `InquiryForm
source="enroll"`), and Staff was never a component because Staff is Team. **HD-10**: the third locale changes
no count either — `LangSwitcher` is one file whether it offers two options or three (D-04.16), so the client
column stays 30.

### 4 · Section → key map

Every key below is a 02 key (R1 inventory keys in `SCRATCH/inventory/strings.md` map as noted: R1 `nav.*` →
`common.nav.*`, `pages.<route>.title` → `<route>.kicker`, `menuWeek.*` → `collections.menu.week.*`, `menuChips.*`
→ `collections.menu.dietary.*`, `form.*` → `visit.form.*`, `footer.copyright` → `common.footer.copyright`,
`home.hero.trustRating` → `home.hero.trust.yelp`, `*.sub` → `*.subtitle`, R1 `variants.mobile` → `*Short`).
**Surface flags** are `site.json` data (D-02.13): `onHome`, `onMobile`, `featured`, `head`. Rule (INV-04.4):
no component branches on `locale`, hard-codes a view's copy, or hard-codes membership — it reads `*Short`
siblings, `views` become CSS toggles, and flags come from `site.json`.

| Section (id) | Message keys (namespace.key) | Collections / shared data | Per-view and surface rules |
|---|---|---|---|
| Header (`SiteHeader`) | `common.logo.alt`, `common.nav.philosophy\|programs\|menu\|gallery\|reviews\|team\|contact\|bookTour\|menuOpen\|menuClose\|label*`, `common.localeSwitcher.ariaLabel\|optionAriaLabel`, `common.a11y.skipToContent` | `site.nav.primary[]`, `site.nav.cta`, `site.routes[]`, `routing.locales`, `LOCALE_META[].shortLabel\|nativeName` (locale-invariant data, 02 rule 11) | `contact` only in the sheet and footer (R1: desktop-only surface → now data: `site.nav.footer[]` + sheet list). **`contact` target = `/#visit`**: there is no contact route and no `#contact` anchor in `site.routes[]`, and the Visit section is the address/hours/form surface, so `site.nav.footer[]`'s `contact` entry carries `href: "/#visit"` — the same href as `site.nav.cta` (02 §Shared config). `common.localeSwitcher.label` — the two-name "{current} · {other}" template — is **retired** (02 rule 11, HD-10): a three-option menu has no two-name label, so the trigger's visible text is `LOCALE_META[current].shortLabel` (data) and the two accessible strings are `ariaLabel` ("Change language") and `optionAriaLabel` ("Switch to {locale}", one per option) |
| Hero (`hero`) | `home.hero.badge\|title\|subtitle\|subtitleShort\|ctaPrimary\|ctaSecondary\|trust.yelp\|trust.ages\|trust.agesShort\|mealsCard.title\|mealsCard.subtitle\|mealsCard.subtitleShort\|scrollCue\|photo.alt`, `common.rating.ariaLabel` | `site.yelp.rating`, `site.images.hero`, `site.hero.mealsIcon*`, `site.nav.cta.href`, `site.routes[philosophy]` | three `*Short` toggles; `title` `\n` honoured `≥ md` only; rich `em` |
| Philosophy (`philosophy`) | `home.philosophy.eyebrow\|quote\|attribution\|badgeCertified\|badgeBilingual\|link\|photo.alt` | `site.images.philosophy`, `site.routes[philosophy]` | `badgeCertified` R1 `var:wireframe` is ignored (wireframe copy is not a surface) |
| Programs (`programs`) | `home.programs.eyebrow\|title\|intro\|link` | `collections.programs.<id>.name\|ageLabel\|summary\|summaryShort\|photoAlt`; `site.programs[] {id, ageMonths, ratio, photo, featured}` | `intro` desktop-only → hidden `< md`; `summaryShort` (infant) toggle; `featured` → raised stone |
| Menu (`menu`) | `home.menu.eyebrow\|title\|intro\|sampleLine\|link`, `menu.meals.breakfast\|lunch\|snack`, `menu.dayChips.label*` | `collections.menu.week.<day>.<meal>` (15), `collections.menu.dietary.<id>.label\|labelShort`; `site.menu.days\|meals\|dietary[] {id, onHome}`, `site.timeZone`; formats `weekdayShort\|weekdayLong` | `intro` desktop-only; dietary chips: home shows `onHome` (2), page shows all (3); `labelShort` `< md`; weekday names are never stored (02 D-02.6) |
| Gallery (`gallery`) | `home.gallery.eyebrow\|title\|intro\|link` (`title` takes `{brandShortName}`, D-04.17) | `collections.gallery.photos.<id>.alt\|caption?`; `site.gallery.photos[] {…, onHome, onMobile, rotation?}` | home = `onHome` photos; 7 `≥ lg` / 5 `< lg` via `onMobile`; slots from `layout.ts` |
| Testimonials (`testimonials`) | `home.testimonials.title\|countLine\|link`, `common.brand.yelp`, `common.rating.ariaLabel`, `common.punctuation.quoteOpen\|quoteClose` | `collections.testimonials.<id>.quote\|author\|relation`; `site.yelp.rating\|reviewCount`; `site.testimonials[] {id, rating, avatar?*, onHome, onMobile}`; `site.routes[reviews]` | `meiL`, `davidPriya` everywhere; `karenT` `onMobile:false`; `alanW` `onHome:false`; `countLine` ICU plural + `<count>`; `link` names no destination — it points at the subpage, not at Yelp |
| Teachers (`teachers`) | `home.teachers.eyebrow\|title\|intro\|introShort\|link`, `team.roles.head\|assistant` | `collections.teachers.<id>.name\|credentials\|summary\|summaryShort\|photoAlt`; `site.teachers[] {id, head, icon, photo}` | `introShort`, `summaryShort` toggles; only `head` has `photo`/`credentials`; order = `site.teachers[]`, mobile `order` CSS |
| Visit (`visit`) + footer | `home.visit.title\|subtitle\|subtitleShort\|info.visitLabel\|info.hoursLabel\|info.languagesLabel\|info.city\|info.languages\|info.mapsLink\|map.alt`, `common.format.dayRange\|timeRange`, `common.links.newTab`, `visit.form.*` (all of 02 §Key naming 8), `common.footer.copyright`, `common.nav.<id>` (footer), `common.logo.alt` | `site.hours`, `site.images.map`, `site.contact.mapsUrl\|email\|phone\|phoneDisplay`, `site.nav.footer[]`, `site.brand.name` + `LOCALE_META[locale].brandPairLocale` through `brandArgs(locale)`, `site.license`; formats `weekdayLong`, `timeShort` | hours = two formatted values (no `Short`); copyright + license on both views (D-02.13); the copyright's arguments are `{year, brandName, brandNameOther, license}` — `{brandNameZh}` is retired (D-04.17); `noscript`/`directContact` use `{email}` and `{phone}` = `contact.phoneDisplay` |
| Philosophy page | `philosophy.kicker\|eyebrow\|heading\|intro\|introShort\|dayTitle\|principles.<id>.title\|body\|day.<id>.title\|body\|badges.*\|meta.*`, `common.back.label\|labelShort` | `site.principles[] {id, icon}`, `site.dailyRhythm[] {id, time}` | badges `ams`/`bilingualDaily` desktop-only; R1 marks four timeline rows `var:mobile` — §10 asks 02 for `*Short` there |
| Programs page | `programs.kicker\|eyebrow\|heading\|ratioLabel\|footnote\|meta.*` | `collections.programs.<id>.description\|highlights[]` + home fields; `site.programs[].ratio` | highlights index ≥ 1 hidden `< md` |
| Menu page | `menu.kicker\|eyebrow\|heading\|intro\|note\|meals.*\|meta.*` | `collections.menu.*`; `site.menu.*` | `intro` desktop-only; table `≥ md` / cards `< md` |
| Gallery page | `gallery.kicker\|heading\|hint\|filters.all\|meta.*`, `common.lightbox.close\|prev\|next` | `collections.gallery.categories.<id>`, `photos.<id>.alt\|caption?`; `site.gallery.categories[] {id, onMobile}`, `photos[] {…, wide, onMobile}` | `celebrations` `onMobile:false`; 8 → 6 photos via `onMobile`; `hint` R1 `var:wireframe` ignored |
| Reviews page | `reviews.kicker\|heading\|countLine\|yelpCta\|meta.*`, `common.brand.yelp`, `common.links.newTab`, `common.punctuation.*` | all four testimonials; `site.yelp.*` | `karenT` hidden `< md` |
| Team page | `team.kicker\|heading\|footnote\|roles.*\|meta.*` | `collections.teachers.<id>.bio\|bioShort\|tags[]`; `site.teachers[]` | `bioShort` toggle; `tags[2]` hidden `< md` |
| Errors / reserved pages | `errors.notFound.*`, `errors.serverError.*`, `faq.*`, `visit.kicker\|heading\|meta.*` (enroll) | `collections.faq.*`, `site.faq[]` | errors ship; FAQ and Enrollment are **reserved, not built** (HD-5, D-02.17) — their namespaces stay optional and out of parity, nav, sitemap and the Playwright matrix while `site.faq[]` is empty |

`*` = key or field requested from 02 in §10 (not yet in the contract).

### 5 · Props and data conventions

**5.1 Server side.** Sections call `getTranslations('<namespace>.<section>')` (or `useTranslations` when
synchronous) and the collection loaders; they never receive copy as props. Formatting (`weekday*`,
`timeShort`, `rating`, `dateMonth`) happens on the server wherever the result is static. The `t.rich` tag
mapping is `richTags()` (D-04.13). `year` for the copyright is computed at build (02 §Plurals). Brand-name ICU
arguments come from one server helper, `brandArgs(locale)` → `{ brandName, brandShortName, brandNameOther }`
(D-04.17); a component never reads `site.brand.name[...]` itself and never writes a locale id to index it.

**5.2 Client namespaces per component** (02 D-02.16; `NextIntlClientProvider` receives the union):

| Client component | Namespaces read on the client | Formats | Everything else arrives as |
|---|---|---|---|
| `LangSwitcher` | `common` (`localeSwitcher.ariaLabel\|optionAriaLabel`) | — | `routing.locales` (the option list and its order) and `LOCALE_META` `shortLabel`/`nativeName`/`hreflang` — config, not content (02 rule 11); the retired `localeSwitcher.label` is read by nothing |
| `PrimaryNav`, `FooterLinks` | — | — | resolved `{id, anchor, label, href}[]` as props; only `usePathname()` is read on the client (06 D-06.7) |
| `ErrorPanel` | `errors` (`notFound.*`, `serverError.*`) | — | `kind` and `reset` from the route boundary |
| `MobileMenu`, `Hamburger` | `common` (`nav.menuOpen\|menuClose`) | — | link labels/hrefs as props |
| `BackLink` | — | — | label as children |
| `MenuDayChips` | — | — | day labels, lines, group label as props (D-04.10) |
| `GalleryExplorer` | `common` (`lightbox.*`) | — | items, categories, `allLabel` as props |
| `InquiryForm` (+`FormField`, `Turnstile`) | `visit` (`form.*`) | `dateMonth` | `contact`, `siteKey`, `source`, the `noscript` node as props; `locale` via `useLocale()` |
| `SuccessPanel`, `FormAlert` | `visit` (`form.status.success.*`, `form.errors.*`) | — | the resolved error/success key from `InquiryForm` state (D-04.14) |
| `TrackedLink` | — | — | `href`, event name, params, label as children |
| `CountUp` | — | `number` (`rating` format) | `value`, `decimals` as props |
| `WordSwap`, `Reveal*`, `PageTransition`, decorations | — | — | children / ids / variant names |

The allowlist is 02's, verbatim (D-02.16): `common`, `visit`, `gallery` at launch, plus `errors` for
`error.tsx`. `menu` is **not** a client namespace — the day chips and the sample line receive props, never
messages (D-04.10, 02 D-02.16). `gallery` is on 02's list but no launch component reads it on the client either:
`GalleryExplorer` reads only `common.lightbox.*` and takes its filter labels as props, so 02's entry is headroom
for the lightbox captions, not a component requirement.

**5.3 Images.** `Picture` only (INV-04.6): `sizes` per breakpoint (hero `100vw` `< md`, `min(1040px, 100vw)`
above; polaroids `(min-width: 64rem) 210px, 45vw`; stones/teacher circles their token size), radius token
names from 03 §5's concrete steps (`card-lg` for the philosophy photo, `card-sm`, `tile`, `polaroid`, `full`)
plus `hero` — the 26px hero-photo radius that 03 §5 describes but does not mint as a step, requested in §10.
`alt` required (empty string only for decorative images, which the design does not have), `priority` on the
hero photo only. No `<img>` outside `Picture`/`PhotoSlot`; the logo is `Picture` over
`public/brand/logo.png` (03 D-03.9) with `common.logo.alt`.

**5.4 Emoji and glyphs.** Icon emoji come from `site.json` `icon` fields and render through `Emoji` (D-03.8);
sentence emoji stay in the string. `→ ↗ ← ★ ⌄` stay inside strings or `StarRow` and never inside tracked
uppercase text (03 §3.1). `⌄` occurs in exactly one place — inside `home.hero.scrollCue` — and the language
switcher adds none: its trigger renders `LOCALE_META[current].shortLabel` and nothing else (D-04.16, ADJ-20),
so no component invents punctuation of its own and 08's `allowedStrings` list needs no new entry.

**5.5 Hit targets, uppercase, min-height.** Every interactive element ≥ `--tap-min` (day chips and filter chips
extend their hit area with padding/pseudo-element, visual unchanged — 03 §6). `uppercase` is applied only by
`Eyebrow` (never on `badgeBilingual`, `contact.languages`, tags with `中文`). Where 08's per-locale height
snapshot (`en` vs `zh-Hans` vs `zh-Hant`) shows a section differing by more than one text line (03 §3.3), 04
requests a `--section-minh-<id>` token from 03 and applies it on the `Section` — no raw px. Three locales make
this more likely, not less: `zh-Hant` is routinely a character or two longer than `zh-Hans` for the same
sentence, so the snapshot compares all three against `en`, not a single 中文 column.

**5.6 Links.** All internal links use `Link` from `src/i18n/navigation.ts` (INV-02.7); home-section links
resolve per 06 D-06.7 — a plain `<a href="#<homeAnchor>">` when `usePathname()` reports `'/'`, next-intl
`Link href={homeHref(homeAnchor)}` on any other page — which is why `PrimaryNav`, `FooterLinks` and the sheet's
link list are client (D-04.1) while the header and footer that feed them stay server;
"learn more" links carry `transitionTypes={['subpage-enter']}`; external links (Yelp, Maps)
use `target="_blank" rel="noopener noreferrer"` + `VisuallyHidden` `common.links.newTab`. Every link that fires
an analytics event does so through the one client wrapper `TrackedLink` (§3.1) over `src/lib/analytics.ts`
(07 §4's five events, no PII); no other link component gets an `onClick`, so the D-04.1 allowlist stays closed.

### 6 · Responsive

Breakpoints are 03's only (`md` 48rem, `lg` 64rem; `xl` only for container caps — INV-03.3). Token values flip
at `md`; 04's layout switches are:

| Component | `< md` (390 spec) | `md`–`lg` | `≥ lg` (1280 spec) |
|---|---|---|---|
| `SiteHeader` | logo 38, pill 13px, hamburger (the three locale rows live in the sheet) | md tokens (logo 50, pill 16) + hamburger (D-04.9) | full row: links · divider · switcher trigger (`EN`, no chevron) · pill |
| `HeroSection` | stacked, full-width CTA, `agesShort`, `subtitleShort`, no `\n`, 1 leaf | desktop type, single column, `\n` honoured | 3 leaves, photo 1040×380 |
| `PhilosophySection` | badges stacked, photo 190px | desktop type | photo 560×260 |
| `ProgramsSection` | alternating path (stones 104/122) | path with desktop type | 3-col row 200/236/200, featured raised |
| `MenuSection` | plate 190, chips 13px, `labelShort` | desktop sizes, chip row wraps | — |
| `GallerySection` | 5 slots, 420px field, `px` 10px | 5 slots, desktop frame | 7 slots, 980×410 field |
| `TestimonialsSection` | 2 stacked bubbles, alternating tails | stacked | 3-col grid, middle +30px |
| `TeachersSection` | `head` first, assistants 2-col, names 22/17 | `head` first, desktop type | triptych, assistants offset 44px |
| `VisitSection` | stacked, inputs 46px, photo 120 | stacked, inputs 44px | 1.2fr/1fr grid gap 30 |
| `SiteFooter` | centred column, copyright 10px | column | row, 14px links |
| Subpages | single column; `DayCards`; 2-col gallery grid; 3 reviews | desktop type; `WeeklyMenuTable`; 3-col grid | as designed (desktop reference) |

Tablet (768–1023) renders desktop type in mobile structure per 03 D-03.6 / OQ-03.1; no third composition is
invented.

### 7 · Accessibility

- **Landmarks and headings.** `header` (nav labelled), `main#main` (skip-link target), `footer` (nav labelled);
  each home section `<section aria-labelledby>`; one `h1` per page (hero title / subpage heading); `h2` per
  section; `h3` for items. The Philosophy section's visible heading is the pull-quote, so its `h2` is a
  visually-hidden eyebrow text (§3.5).
- **Focus order.** Skip link → header (logo, links, switcher, CTA / hamburger) → main content in DOM order →
  footer. `MobileMenu`: focus trapped, `Escape` closes, focus returns to the button, rest of page `inert`.
  `GalleryExplorer` lightbox: native modal `<dialog>` (built-in trap), focus returns to the opening thumbnail.
  Subpage navigation: `h1` receives focus after the slide; Back focuses the origin section heading (05 §5.7;
  OQ-05.2 e).
- **Language switcher** (D-04.16). A `<details>` disclosure, not a menu widget and not a modal: `Tab` moves
  through the three option links in `routing.locales` order once the panel is open, `Escape` closes it and
  returns focus to the `<summary>`, and focus is **not** trapped — a disclosure over three links has no reason
  to hold it. The current locale is `aria-current="true"`, not `disabled` (a disabled control is unreachable
  and tells a screen-reader user nothing about which language they are on). Each option's accessible name is
  `common.localeSwitcher.optionAriaLabel` with the target's `nativeName`, so "Switch to 简体中文" is announced
  in full even though the trigger shows only `简`. In the mobile sheet there is no disclosure: the three links
  are ordinary rows inside the already-trapped `MobileMenu`, which is one row taller than the design's list.
- **Sticky nav.** Never transformed; `--nav-h` keeps anchor targets visible (`scroll-margin-top`); focus rings
  per 03 D-03.11 (`--color-focus`, sun on the forest section).
- **Reduced motion** is 05's (`MotionConfig reducedMotion="user"`, media query); 04 adds nothing and removes
  nothing. **Forms** follow 07 §1's contract verbatim. **Contrast**: ship design values; 03 §10 lists the
  failing pairs (body on tinted sections, eyebrows, muted text, selected chip, copyright) pending OQ-03.2 —
  components use tokens only so the fix is a token change.
- **Text and language.** Quote marks, separators and arrows come from content/tokens; `white-space: pre-line`
  only where a message carries `\n`; `<html lang>` = `LOCALE_META[locale].htmlLang` (02 D-02.9); Chinese
  typography via `:lang(zh)` (03 §3.3), which matches **both** Chinese locales by CSS language-range rules,
  while 03 D-03.14 resolves the *glyph forms* with two further rules, `:root:lang(zh-Hans)` and
  `:root:lang(zh-Hant)`, switching `--font-cjk` between an SC and a TC stack. All of it is CSS: no
  component reads `locale` for layout, and the switcher is the only component that renders a locale at all —
  as `LOCALE_META` data, never as a comparison (INV-02.9, INV-04.12).
- **Images.** `alt` from per-locale JSON for every photo; decorative SVG/emoji `aria-hidden`; `PhotoSlot`
  carries the future photo's `alt` so the accessible name is stable before photography lands.
- **Count-up.** Server HTML holds the final number; the animation is `aria-hidden`-safe (no live region).

### 8 · Testing requirements (what; 08 owns how)

- Every component in §3 has an RTL test rendering in **every id in `routing.locales`** (`en`, `zh-Hans`,
  `zh-Hant`) with a real messages tree, asserting no `⟦` marker, no untranslated English in either Chinese
  locale, and the documented landmarks/roles (`aria-labelledby`, `tablist`, `dialog`, `<table>` headers). The
  test iterates `routing.locales`; a fourth locale must not require a new test file.
- A key-usage test per section/page: render with a recording messages proxy and compare the set of keys read
  against §4 (machine-readable copy of the table lives next to the tests); a key read that is not in the map, or
  a mapped key never read, fails.
- Client-boundary gate: no `'use client'` module imports `src/content/*`, `content/**`, or `src/i18n/messages.ts`
  (INV-04.2); the list of client files equals D-04.1.
- Token gates (INV-03.1–3) on `components/**`; `uppercase` only inside `Eyebra`… `Eyebrow` (lint on the class).
- No-literal-text ESLint rule (INV-02.1) over `src/components/**`: any string literal in JSX text position or in
  `alt` / `aria-label` / `title` / `placeholder` fails; the allowed exceptions are punctuation-only strings and
  the `data-*` values this doc fixes. 08 owns the rule and its exception list.
- Reveal-id uniqueness: a build-time scan of `Reveal` `id` props asserts every id is unique **across the
  site**, not merely within one page, and matches 05's registry keys; duplicates fail. Per-page uniqueness is
  the wrong property — the registry is once per session keyed by the id alone (05 D-05.6), so two blocks on
  two routes that share an id share one entrance and the second silently renders its final state. That is the
  defect `subpage.<page>.header` closes (§3.3), and a per-page scan would have passed over it.
- Image contract (INV-04.6): a static check that every `Picture` call site passes `sizes` and a non-undefined
  `alt`, and that no `<img>` appears outside `Picture`/`PhotoSlot`.
- Hit targets (INV-04.7): a Playwright pass measuring every focusable element's bounding box at 390 and 1280 —
  each must be ≥ 44px in both axes, including the day chips and gallery filter chips that extend theirs with a
  pseudo-element.
- Glyph fallback: visual snapshots at 390 and 1280 in all three locales (6 shots per surface) covering `StarRow`'s `★`, the `→ ↗ ← ⌄`
  glyphs in links and the scroll cue, and the emoji chips — the snapshot is what catches a font-stack change
  turning a glyph into a box or a colour-emoji `★` (03 §3.1, D-03.8).
- `*Short` and surface flags: for each documented toggle, both elements exist in the DOM and exactly one is
  visible at 390 and 1280; `onMobile:false` items exist and are hidden at 390.
- Playwright per route × locale (INV-02.5 — 7 routes × 3 locales) plus: hamburger open/close with focus trap
  and `Escape`; day-chip tablist keyboard; gallery filter + lightbox keyboard; form flows (07 §8); section
  heights `en` vs `zh-Hans` vs `zh-Hant` and CLS on a locale switch (03 §3.3); skip link; one `h1` per page;
  axe clean on every route in all three locales.
- Decorations: each has a stable `id`/`data-deco` and the two-layer structure (INV-04.5) — a DOM test.
- Language switcher (D-04.16, INV-04.12): the rendered option count equals `routing.locales.length` and the
  order matches it; exactly one option carries `aria-current="true"` and it is the current locale; each option's
  `href` is the same pathname under its locale, preserving query and hash; with JavaScript disabled the
  `<details>` still opens and each option still navigates; `Escape` closes and restores focus to the `<summary>`.
  A grep gate backs this up: no file under `src/components/**` contains the string `zh-Hans`, `zh-Hant` or `'en'`
  as a locale literal (INV-02.9), and none reads the retired `common.localeSwitcher.label`.
- Owner facts (INV-04.11): a grep gate over `src/**` for the shipped provisional strings — the three teacher
  names, `優朵`/`优朵`/`绿茵园`, `Green Pastures` as a bare literal, `(510) 555-0142`, `000000000`. A hit is a
  component that hard-coded a value the owner is about to change. The rendered pages still show these strings —
  they come from `content/`, which is exactly the point.

### 9 · Invariants

- **INV-04.1** Pages and sections are server components, and so is every subpage composite except `ErrorPanel`,
  which `error.tsx` pulls across the boundary; the client components are exactly the D-04.1 list — 30 files, the
  `*` entries in §2 — plus 06's two route boundaries `app/[locale]/error.tsx` and `app/[locale]/global-error.tsx`,
  for 32 `'use client'` paths in all (lint: allowlist of `'use client'` paths, 08). Anything that needs an
  `onClick`, `usePathname()`, a runtime-chosen message key or browser state is on that list or does not exist.
- **INV-04.2** No client module imports `src/content/*`, `content/**/*.json` or `src/i18n/messages.ts`; data
  crosses the boundary as plain props or server-rendered nodes; the provider carries only 02's client namespaces.
- **INV-04.3** Components use tokens/utilities only — no hex, px, ms, bezier, and only `md:`/`lg:` variants
  (cites INV-03.1–3); section colours reach primitives through the `Section` role variables (D-04.3).
- **INV-04.4** Every user-visible string comes from messages or collections (INV-02.1); no `locale ===`
  branching (INV-02.9) and no locale id written as a literal anywhere in `src/components/**`; per-view copy
  only via `*Short` + CSS, per-surface membership only via `site.json` flags (D-04.5); no per-view files, no
  view props.
- **INV-04.5** `Sun`, `Leaf`, `ScrollCue`, `Plate`, `Polaroid`, `SteppingStone`, `Bubble`, `TeacherFrame` are
  discrete components with a stable `id`, `data-deco`, a forwarded `ref` and the two-layer structure (INV-05.5);
  layout geometry lives in `layout.ts`, never in `site.json` (D-04.6).
- **INV-04.6** Every raster image renders through `Picture` (`next/image`) with `sizes`, a radius token and an
  `alt` from per-locale JSON, or through `PhotoSlot` while the photo is missing.
- **INV-04.7** Every interactive element has a hit area ≥ `--tap-min` (44px) on every view.
- **INV-04.8** Every home section is a `Section` with `id` = `site.routes[].homeAnchor` (or `hero`/`visit`),
  `aria-labelledby`, `scroll-snap-align: start`, `scroll-margin-top: var(--nav-h)`; each page has one `h1`.
- **INV-04.9** Every message-rendered text block sits inside a `Reveal` (or `RevealItem`) so it joins the
  locale cascade (05 §5.6); nav items use `variant="none"`.
- **INV-04.10** Form components implement 07 §1's accessibility contract and D-04.14's code record; no copy in
  form code (INV-07.1).
- **INV-04.11** No component contains an owner fact as a literal — no brand name, teacher name, credential,
  phone number, address, licence number or Yelp figure. Brand names arrive as the ICU arguments `{brandName}` /
  `{brandShortName}` / `{brandNameOther}` from `brandArgs(locale)` (D-04.17); everything else is `site.json` or
  a collection field (D-04.18). No component knows a value is provisional: `site.json.provisional` is the
  validator's, and 04 ships no provisional-aware UI (02 D-02.20, INV-02.10).
- **INV-04.12** The language switcher renders exactly one option per `routing.locales` entry, in that order,
  with labels from `LOCALE_META`; nothing in 04 assumes a locale count, names a locale, or pairs one locale
  against "the other". Adding a locale is a `routing.locales` entry plus a `LOCALE_META` row — no component
  edit (D-04.16). The same invariant is what lets `zh-Hant` ship late: while it is held out of `routing.locales`
  pending review (02 INV-02.11, HD-12), the switcher simply renders two options and every other component is
  unaffected — no build flag, no dead branch, no "coming soon" state.

### 10 · Requirements this doc places on other docs

- **02** — add: `common.nav.label` (header nav landmark name), `common.nav.footerLabel` (the footer's — the
  page carries two `<nav>` landmarks and one name cannot serve both), `menu.dayChips.label` (tablist name);
  shared data `site.images.logo` (03 `D-03.9`'s mark, so `LogoCard` holds no path of its own);
  `site.hero.mealsIcon` (🍎 — emoji-as-icon per D-02.5),
  optional `site.testimonials[].avatar {src,width,height}` (design avatar slots, README
  "optional testimonial avatars"), optional `blurDataURL` on image objects; `*Short` siblings for the four
  daily-rhythm rows R1 marks `var:mobile` (`philosophy.day.arrival.title|body`, `outdoor.body`, `lunch.body`) or a
  ruling that one copy serves both; state the `en` value of `home.gallery.title` as "Life at {brandShortName}"
  so the argument is declared in the reference locale (the new subset ICU-argument rule makes an argument used
  only in a translation an error); confirm that `brandArgs(locale)` — the one helper returning `{brandName,
  brandShortName, brandNameOther}` from `brand.name`/`brand.shortName` and `LOCALE_META[].brandPairLocale`
  (D-04.17) — lives in 02's `src/content/site.ts`; confirm `philosophy.badges.certified|ams|bilingualDaily` ids; align the
  "wrap the element in `<WordSwap>`" wording (02 §Checklists, D-02.10) with 05 D-05.9 (`Reveal` carries the
  cascade; `WordSwap` is the keyed swap) — 04 builds on 05's reading; record that `site.nav.footer[]`'s
  `contact` entry carries `href: "/#visit"` (§4) so the footer and sheet link resolves.
- **03** — the language switcher needs **no new token**: the trigger reuses the design's lang-toggle recipe
  (Nunito 700 14px on `--color-muted`, or 03 §10's `#7a7160` if OQ-03.2 takes the contrast fix — the toggle is
  one of the failing pairs 03 lists) and the panel reuses `--color-nav-bg` + `--shadow-nav` + `--radius-card`;
  03 need only confirm that reuse. The Traditional-glyph request is **adopted, nothing outstanding**: 03 D-03.14
  splits `--font-cjk` into `--font-cjk-sc` / `--font-cjk-tc` under `:root:lang(zh-Hans)` / `:root:lang(zh-Hant)`,
  which is entirely a CSS change and moves no component. `--radius-hero` is likewise **adopted, nothing
  outstanding**: 03 §5 minted the step and `src/styles/tokens.css` declares it under `@theme static` (22px,
  26px at `md`), so §5.3's `hero` radius name is a shipped token and `rounded-hero` a real utility. Still
  outstanding, and still requested names rather than shipped tokens: `--section-minh-<id>` on 04's measured
  request (§5.5), and `--color-subnav-bg` for the subpage bar's tinted `.94` background (§3.1, desktop
  reference L350). Note D-04.9 (nav row at `lg`) against 03 §8's nav row.
- **05** — `Reveal` needs `as="ul" | "li" | "figure"` (already listed) and `RevealItem as="li"`. Two earlier
  requests are **adopted, nothing outstanding**: the decorative components are client components (D-04.15) —
  05 §5.1's mermaid node reads `Sun / Leaf / ScrollCue · client`, no "RSC shell" label remains — and `Leaf` and
  `Sun` carry `loop?: boolean` (default `true`) in 05 §5.4, whose prose matches §3.4's seven static leaves and
  two static suns. The third request is now **adopted, nothing outstanding** as well: 05 §5.1's module map and
  §5.4 name `AmbientScope`, keeping 04's name, and both describe its mechanism as the plain
  `IntersectionObserver` it is rather than the `useInView` the two documents used to specify — Motion's hook
  cannot take the ref, because the element that must carry `data-ambient` is a `<section>` a server component
  renders (D-04.3), and the observer count INV-05.9 fixes is the same either way (§3.3).
- **06** — D-06.9's three-option menu is **adopted, nothing outstanding**: 04 supplies the primitive 06 assigns
  it (trigger semantics, `aria-current`, focus handling, no-JavaScript fallback, `routing.locales` iteration)
  as D-04.16, keeps 06's `LangSwitcher` name, and has dropped `common.localeSwitcher.label` from every list
  here (§3.1, §4, §5.2) along with the "differs per locale by content" description. Two clarifications back to
  06: its sketch's `<Menu>` is `LangSwitcher`'s own inlined `<details>`, not a separate exported primitive (so
  04's component counts do not move); and 06's grep gate for `localeSwitcher.label` now passes over 04's
  surface. `app/[locale]/layout.tsx` renders what §1 lists; `page.tsx` files wrap in `PageTransition`; `#visit`
  and `homeAnchor` ids as in D-04.3; next-intl `Link`/`useRouter` pass `transitionTypes` through; `h1` focus
  after slide (OQ-05.2 e). 06 §6.12's request is **adopted, nothing outstanding**: `PrimaryNav`, `FooterLinks`
  and the sheet's link list are client (D-04.1, D-06.7), `SiteHeader` / `SiteFooter` stay server, and 06's
  `error.tsx` / `global-error.tsx` boundaries are counted in D-04.1's 32 `'use client'` files.
- **07** — `InquiryForm` props (including the `noscript` node) and placement as §3.5; `source` values; the code
  record in D-04.14; `SuccessPanel` / `FormAlert` are client components (07 §9 assigns them to 04); §4's link
  events fire from the one `TrackedLink` wrapper, so no other component gets a handler. Two three-locale
  consequences, neither needing a 07 change: the `locale_toggle { to }` event already carries the target, so a
  three-option menu fires it unchanged; and `NoscriptFallback`/`directContact` print `{phone}` from
  `site.contact.phoneDisplay` while the `tel:` href uses `site.contact.phone` (§3.5).
- **08** — §8 as gates; the `'use client'` allowlist lint; the key-usage test harness. Every route × locale
  matrix in 08 grows from two rows to three (`en`, `zh-Hans`, `zh-Hant`), including the visual-regression
  matrix; the switcher trigger renders `LOCALE_META` data and no glyph (D-04.16, ADJ-20), so it needs no
  `allowedStrings` exception at all — `⌄` stays on the list for the hero scroll cue; add the
  two grep gates §8 now names (no locale literal in `src/components/**`, no owner fact literal in `src/**`).
- **10** — the View Transitions spike (OQ-05.2) precedes subpage work; the hamburger sheet and lightbox are
  separate beads; photo placeholders ship first, `Picture` swap is content-only. Two scope changes: the
  switcher is no longer a one-line toggle but a disclosure with keyboard and no-JS behaviour, so it deserves
  its own bead rather than a line in the header bead; and no bead builds an FAQ or Enrollment page, or a
  `staff` anything (HD-5).

## Open questions

- **OQ-04.1** · answerer: design owner — Hamburger sheet: full-screen cream sheet with the six links, Contact,
  the **three locale rows** (HD-10 turned the design's one "EN·中文" item into three) and the CTA (D-04.8) —
  approve or supply a design. Default: ship D-04.8.
- **OQ-04.2** · answerer: human (Hanyi) — Gallery lightbox at launch (D-04.7: yes, native `<dialog>`) and
  client-side filters vs URL-backed filters. Default: D-04.7.
- **OQ-04.3** · answerer: design owner (with 05 OQ-05.3) — `gpdevelop` (photo "develop" filter) is unused in the
  references; 04 plans no component for it. Confirm drop.
- **OQ-04.4** · **ANSWERED 2026-08-22 (human, HD-12)** — Photography stays a placeholder: `PhotoSlot` colour
  fill with no visible text, no temporary stock imagery. D-04.12 records it; `Picture` falls back to
  `PhotoSlot` whenever `site.json` carries no `image`, so the eventual swap is a content edit.
- **OQ-04.5** · **ANSWERED 2026-08-22 (human, HD-5)** — Six subpages: Philosophy, Programs, Menu, Gallery,
  Reviews, **Team** — and "Staff" is Team, so there is no `staff` component or namespace. FAQ and Enrollment
  are **reserved, not built**: `FaqList` and `InquiryForm source="enroll"` stay documented compositions, no
  file, no route, no nav entry, no test row (02 D-02.17, §1, §3.6). Closes bead gp-dln.6.
- **OQ-04.6** · answerer: design owner — Footer on mobile: the prototype omits "Contact"; 04 renders
  `site.nav.footer[]` (six + contact) on both views (same reasoning as the license, D-02.13). Confirm.
- **OQ-04.7** · answerer: design owner — Nav row switch at `lg` (D-04.9) rather than `md`: confirm, or
  provide a compact 768–1023 nav.
- **OQ-04.8** · closed, no answerer — the `invalid_email` reconciliation was never open: 02's error table
  already carries the `invalid_email` row and maps it to `visit.form.fields.email.errors.invalid`, exactly what
  D-04.14 records; the remaining key/field additions and the `WordSwap`-vs-`Reveal` wording are §10 requirements
  on 02, tracked there, not open questions.
- **OQ-04.9** · **answered 2026-08-22 (HD-14): the system CJK stack ships, no webfont at launch.** Answerer was
  the human (Hanyi); carried from **OQ-03.4**, narrowed twice — the CJK typeface. HD-11 first recorded that the
  premise of "the typeface used in the designs" was false: the design names Fredoka and Nunito and no CJK face,
  so the prototypes' 中文 renders in whatever the reader's OS substitutes. HD-14 then closed the corrected
  question in favour of 03 D-03.5's system stack for both Chinese scripts. HD-10's Traditional half was already
  handled: 03 D-03.14 splits the stack into `--font-cjk-sc` / `--font-cjk-tc` under `:root:lang(zh-Hans)` /
  `:root:lang(zh-Hant)`, so `zh-Hant` no longer renders Simplified glyph forms. 04's typography PR is
  unblocked and ships on the system stack; naming a Chinese face later stays a two-token change that moves no
  component in this document.
- **OQ-04.10** · answerer: owner, carried from **OQ-07.10** — the shipped option sets. 04 renders whatever ids
  02/07 declare (`childAge`'s canonical five, `desiredStart`'s months + `asap`/`flexible`) through native
  `<select>`s; a trim or relabel is JSON + enum only and moves nothing in §3.5. No longer blocking anything at
  launch: HD-5 reserved the Enrollment page, so the only surface reading these options today is the home Visit
  form. `visit.form.fields.preferredLanguage`-style copy that names a language takes it from `LOCALE_META`
  endonyms, so three locales change no option set here (07 owns the e-mail side).
- **OQ-04.11** · answerer: design owner (via Hanyi), **the markup half of OQ-06.10 — one question, answered
  once** — the switcher's appearance is OQ-06.10's and 04 does not restate its defaults. What 04 adds, because
  only the markup owner can see it: (a) **the chevron — answered 2026-08-22 (ADJ-20): none.** 02 D-02.10 wrote
  the trigger as `shortLabel` + `⌄` from an unverified premise; 06 checked the handoff and found its only `⌄`
  is the hero scroll cue's, with `[data-langtoggle]` a bare nav item, so D-04.16 now ships a trigger with no
  disclosure glyph. Should the design owner want one, it arrives as part of 06 OQ-06.10's open-state answer and
  is a class change inside one component. (b) **How the current locale is
  marked**: 04's default is weight plus `aria-current="true"` and no tick glyph, because a tick would be the
  only one on the site — but a marked row is the whole point of a three-option list, so if the design owner
  wants a visible marker, name it. (c) **The mobile sheet rows** are plain rows like the nav links, one row
  taller than the design's list (D-04.8) — confirm, or supply a grouped treatment. Default until answered: ship
  (a)–(c) as described. Nothing here blocks build: every answer is a class change inside one component.

## Cross-references

- `docs/design/README.md` — section inventory, animation-ready architecture, interactions, assets.
- `docs/design/desktop/README.md`, `docs/design/mobile/README.md` — per-section geometry, hamburger, hover.
- `docs/design/desktop/Green Pastures - Homepage.dc.html` (nav L97–105, gallery slots L222–229, subpages
  L349–581), `docs/design/mobile/Green Pastures - Homepage Mobile.dc.html` (nav L42–46, gallery slots
  L151–156, subpages L257–473).
- `docs/technical/01-stack-decisions.md` — ADR-001/004/005 (Next 16.x, Tailwind v4, Motion).
- `docs/technical/02-i18n-content-contract.md` — D-02.4/5/6/10/11/12/13/16/17/18/19/20, INV-02.1/7/9/10/11,
  key naming rules 11 and 13, *Locales* (`LOCALE_META`), *Brand names*, *Provisional values*.
- `docs/technical/03-design-system-tokens.md` — D-03.3/5/6/8/9/11/12, §2.3 role tokens, §4–6, §8, §10,
  INV-03.1–3.
- `docs/technical/05-animation-system.md` — D-05.2/5/6/7/9/10/11, §5.1–5.8, INV-05.1–10.
- `docs/technical/06-routing-pages-seo.md` — routes, layout, metadata, anchors.
- `docs/technical/07-forms-integrations.md` — D-07.2/4/5, §1, §6, §9.
- `docs/technical/08-testing-quality.md` — gates for §8 and INV-04.*.
- `docs/technical/10-work-breakdown.md` — component beads; `docs/technical/12-open-questions.md` — OQ-04.*.
- Inventory: `SCRATCH/inventory/strings.md`, `collections.md`, `README.md` (R1, 243 keys, 26 per-view variants).
