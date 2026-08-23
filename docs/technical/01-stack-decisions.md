# 01 · Stack decisions (ADR log)

## Purpose

This document records the architecture decisions behind the Green Pastures site as an ADR log: the stack
(ADR-001) and the eight dependent choices that every other plan document assumes (i18n library, content
storage, styling, animation, form backend, hosting, locale routing, GSAP adoption). Each ADR states its
status, the context, the decision as adjudicated by the orchestrator (memo ADR-001 and ADJ-1..10, 2026-08-22),
the alternatives with their honest trade-offs, the consequences including costs, and open questions. Where the
writer disagrees with the adjudicated decision a **Dissent** note says so with evidence; the orchestrator
adjudicates. Decisions are challengeable only with evidence.

Status: draft · seat writer-contracts · 2026-08-22

## Decisions

- **D-01.1** ADR-001 — Next.js App Router (current Active LTS major: 16.x) + TypeScript `strict` + React 19.2,
  pnpm + Node 24, deployed on Vercel. Accepted 2026-08-22 after check-stack's refutation pass.
- **D-01.2** ADR-002 — next-intl 4.x for messages, formatting and locale routing (JSON messages, typed keys).
- **D-01.3** ADR-003 — Content is versioned JSON in the repository at launch; schema-first so a CMS can be added
  without changing the contract in `docs/technical/02-i18n-content-contract.md`.
- **D-01.4** ADR-004 — Tailwind CSS v4 with design tokens in `@theme`; CSS Modules for bespoke keyframes/shapes;
  no runtime CSS-in-JS.
- **D-01.5** ADR-005 — Motion (`motion` package) for in-page reveals, stagger, count-up and the locale enter
  cascade; ambient loops are CSS keyframes (05 `D-05.7`); route-level subpage slide = React `<ViewTransition>`
  + `<Link transitionTypes>` (Next ≥ 16.2), instant-swap fallback; `AnimatePresence` across routes rejected.
- **D-01.6** ADR-006 — Inquiry form = Next.js Route Handler on the Node.js runtime + Zod ≥ 4 (`z.email()`,
  `z.uuid()`) + Resend + Cloudflare Turnstile + honeypot.
- **D-01.7** ADR-007 — Vercel hosting: preview per PR, production from `main`; never a static export.
- **D-01.8** ADR-008 — Locale routing `localePrefix: 'always'` (`/en/...`, `/zh/...`), per `D-02.9`; the toggle
  is a same-path `router.replace(pathname, { locale, scroll: false })` with an enter-only per-block cascade,
  per `D-02.10`.
- **D-01.9** ADR-009 — GSAP ScrollTrigger is not adopted at launch; adoption trigger = pinning across sections,
  labelled timeline scrubs, or horizontal scroll (source: 05's GSAP decision).

## Design

### ADR-001 · Stack: Next.js App Router + TypeScript + React, pnpm, Node, Vercel

**Status.** Accepted 2026-08-22 (tier 0, memo ADR-001; versions corrected by memo ADJ-1). Challengeable with
evidence; the orchestrator adjudicates.

**Context.** A bilingual (English / 中文) marketing site for a daycare: one long homepage of eight animated
sections, six detail subpages, an inquiry form, SEO-indexable per-locale URLs, and a client who plans many more
scroll/interaction animations (`docs/design/README.md`). The previous site was a Create React App (stale
`README.md`); the owner knows React. Greenfield — no application code exists.

**Decision.** Next.js App Router on the current Active LTS major — **16.x** (16.3 at 2026-08; the memo's
original "15" is Maintenance LTS since 2025-10-21 and is not used) [verified: Next.js support policy,
2026-08-22], React 19.2 as bundled by Next, TypeScript `strict`, pnpm, **Node 24** (Active LTS [verified:
Node.js release schedule, 2026-08-22], Vercel's default for new projects [verified: Vercel Node.js versions,
2026-08-22]; Node 22 is Maintenance LTS, EOL 2027-04-30 [verified: Node.js release schedule, 2026-08-22], and
is not used). Next 16 specifics every doc respects: the request interceptor file is `proxy.ts` (it was named
`middleware.ts` before 16); Turbopack is the default bundler; `next lint` is removed so ESLint runs directly in
CI; default smooth scrolling is opt-in via `data-scroll-behavior="smooth"` on `html`; parallel-route slots need
`default.js`. Quality toolchain (detail in 08): Vitest + React Testing Library, Playwright e2e per locale, ESLint
with `react/jsx-no-literals`, and the key-parity + content-schema gates (`pnpm validate:content`, `D-02.7`) — all
GitHub Actions gates. Analytics launch default (adjudicated, 07 D-07.9): Vercel Web Analytics + Speed Insights
(cookieless, so no consent banner — 07 A-07.1, assumed for a California site pending counsel); the human may
override (OQ-01.1).

**Alternatives considered.**

- *Astro with React islands.* Wins when a page is mostly static HTML with a few isolated interactive islands
  and JavaScript weight is the top metric. It ships built-in locale routing (`prefixDefaultLocale`,
  `Astro.preferredLocale`) and a `<ClientRouter/>` with `fade`/`slide` page transitions including back
  navigation and reduced-motion handling — exactly the App Router's two weak spots (route exit animations and
  the locale-switch remount). Here the reveal system, the language toggle, scroll-snap navigation, decorative
  animated components and the form touch all eight sections, so the homepage is effectively one large React
  island with no shared context across islands, and a message library is still needed (Astro's i18n is
  routing-only). Applies partially; **not decisive**.
- *Vite React SPA (CRA successor).* Wins when SEO and a server are irrelevant: with client-state locale, a
  client router and `AnimatePresence`, both the per-string crossfade and the subpage slide are trivial. Does
  not apply: the site needs indexable `/en` and `/zh` pages, `hreflang`, and a backend for the form anyway.
- *Remix / React Router v7 framework mode.* Comparable SSR and routing; no first-class equivalent of
  next-intl's locale-routing layer (knowledge); the owner's history and the ecosystem favour Next.

**Dissent / strongest counter-argument (check-stack, not disqualifying).** ADR-001's two animation-flavoured
reasons for the App Router — "route-level slide transitions" and the per-string locale crossfade — are where
the App Router is weakest: route exits need View Transitions (React API still canary, Next ≥ 16.2) or a hack,
and URL-based locale switching remounts the tree. Astro gives the slide for less JavaScript; a SPA gives both
effects trivially. Neither wins here because SEO-indexable per-locale URLs, the form backend and the owner's
React history still favour Next, and both effects are achievable (ADR-005, ADR-008). The writer concurs.

**Consequences.** Positive: one framework for pages, metadata, proxy and the form endpoint; next-intl's
routing fits the `[locale]` segment; Vercel previews per PR. Costs: route-exit animations are not free (ADR-005);
the locale toggle is a navigation, not an in-place swap (ADR-008); the App Router's server/client component
split must be designed (02 decides which messages reach the client, `D-02.16`); framework majors move yearly,
so the pinned major is revisited at each LTS change.

**Open questions.** OQ-01.1 (analytics override).

### ADR-002 · i18n library: next-intl

**Status.** Accepted 2026-08-22 (memo ADR-001 i18n bullet; capabilities confirmed by ADJ-7).

**Context.** Requirement: every user-visible string in easy-to-edit JSON per locale; locale in the URL; typed
keys; ICU plurals and rich text; formatting of dates/times/numbers per locale; metadata per locale.

**Decision.** next-intl 4.x (4.13.7, August 2026; peer range includes `^16`) [verified: next-intl
`package.json`, 2026-08-22]. Verified capabilities used by the plan: `[locale]` segment + `proxy.ts` routing
from `defineRouting`, JSON messages via `getRequestConfig`, typed keys through the `AppConfig.Messages`
augmentation (strict ICU arguments via the plugin's `experimental.createMessagesDeclaration`), `t.rich` /
`t.markup` / `t.raw` / `t.has`, ICU `plural` / `select` / `selectordinal`, named formats, `useFormatter`,
`getTranslations` in metadata and Route Handlers, `createNavigation` (`Link`, `redirect`, `usePathname`,
`useRouter`, `getPathname`), `hasLocale`, `onError` / `getMessageFallback`, `localeDetection`, `localeCookie`
(`alternateLinks` exists but is disabled per `D-02.9`). `NextIntlClientProvider` is mandatory for client
components in v4.

**Alternatives considered.**

- *i18next + react-i18next.* Mature and flexible; App Router use needs extra wiring (resource loading per
  request, separate server/client instances) and typed keys need generated resource types (knowledge, not
  re-verified 2026-08). Loses on integration with Next routing and metadata.
- *Lingui.* Extraction/compile workflow with catalogs; message ids default to hashes of the source text unless
  explicit ids are set (knowledge). A build step and a mental model that is further from "edit one JSON file".
- *Hand-rolled typed dictionary* (`getDictionary(locale)` as in the Next.js example). Smallest footprint, but
  no ICU plurals, no rich text, no formatting, no routing/proxy, no fallback hooks — all would be rebuilt.

**Consequences.** Positive: one library covers messages, formatting, routing, metadata and typing; editors
only learn ICU braces and the tag allowlist (`D-02.5`). Costs: single-maintainer dependency (active; v4 docs now
target Next 16); ICU syntax can surprise editors (apostrophe quoting — covered in 02); client components need
the provider and a curated message subset.

**Open questions.** None beyond 02's (`OQ-02.1`, `OQ-02.2`).

### ADR-003 · Content storage: versioned JSON, CMS-ready

**Status.** Accepted 2026-08-22.

**Context.** The human's binding requirement is easy-to-edit JSON lang files; the editor is a non-developer;
content volume is small (≈240 strings at launch, six collections); there is no CMS today.

**Decision.** All text lives as JSON in git under `content/` (layout, naming, typing and validation in 02:
`D-02.2`, `D-02.4`, `D-02.7`). Collections are schema-first (Zod, `D-02.11`) and joined to one locale-agnostic
`content/site.json` (`D-02.12`) so a CMS can later be mapped onto the same schemas without touching components.
No CMS at launch; the editor workflow (branch → edit JSON → PR → Vercel preview → merge) is 09's.

**Alternatives considered.**

- *Hosted headless CMS (Sanity, Contentful, Payload).* Better editing UI and roles; costs a second system of
  record, API keys, webhooks/rebuilds, and per-locale modelling that duplicates the Zod schemas. Oversized for
  ≈240 strings and one editor.
- *Git-backed CMS UI (Keystatic, Decap, Tina).* Keeps JSON in git as the source of truth and adds a form UI;
  the natural upgrade if `OQ-02.3` says editors need a preview/form tool — evaluated in 09 when asked.
- *Spreadsheet export/import.* Familiar to translators but loses typing, parity checks and review.

**Consequences.** Positive: zero infrastructure; every change is a reviewable diff; parity/schema gates run on
every PR. Costs: editors need git/GitHub basics or a PR-by-proxy process (09); no in-browser editing at launch;
conflicts when two people edit the same file.

**Open questions.** `OQ-02.3` (preview tool — human).

### ADR-004 · Styling: Tailwind CSS v4 with `@theme` tokens

**Status.** Accepted 2026-08-22 (memo; ADJ-5 correction applied).

**Context.** The design is token-driven (`docs/design/README.md`: colours, radii, shadows, easings,
durations, two typefaces) with bespoke shapes and keyframes (plate, stepping stones, polaroids, speech-bubble
tails).

**Decision.** Tailwind CSS v4. Tokens are declared as CSS custom properties in `@theme` using the real
namespaces 03 uses — `--color-*`, `--font-*`, `--text-*`, `--tracking-*`, `--radius-*`, `--shadow-*`,
`--container-*`, `--breakpoint-*`, `--ease-*` — so utilities are generated from the design values (03 quotes
them exactly). Durations are plain CSS custom properties (`--dur-*`) declared alongside `@theme` and consumed
as `duration-(--dur-rise)` or via a TypeScript mirror for Motion — Tailwind v4 has no `--duration-*` theme
namespace. CSS Modules are allowed for keyframes and complex shapes. No runtime CSS-in-JS. Fonts (03 D-03.4 /
D-03.5): Fredoka at weights 500/600 and Nunito at 600/700/800 via `next/font/google` with
`subsets: ["latin"]`; the CJK fallback is the font-family stack ending in a **system CJK stack** exposed as
`--font-cjk` (per-glyph browser fallback) — no self-hosted CJK web font at launch; the
documented alternative is Noto Sans SC via `next/font/google` with `preload: false, adjustFontFallback: false`,
loaded only in the `zh` layout. `next/font` cannot assign a face per script (no `unicode-range` option); the
CJK typeface itself is an open question 03 surfaces to the human.

**Alternatives considered.**

- *CSS Modules only.* Zero framework, full control; loses the token-to-utility generation and consistency
  across many bespoke components; more hand-written CSS to keep in sync with tokens.
- *vanilla-extract.* Typed tokens at build time, no runtime; smaller ecosystem, extra build plugin, and the
  team's familiarity is with Tailwind.
- *Styled-components / Emotion.* Runtime CSS-in-JS conflicts with server components and adds client JS. Rejected.

**Consequences.** Positive: tokens live in one CSS file that mirrors the design README; utilities keep
components terse; v4 needs no config file. Costs: Tailwind v4's browser floor is modern (Safari 16.4+,
Chrome 111+, Firefox 128+ per its compatibility docs — assumption to re-verify at scaffold); utility-heavy
markup needs discipline in 04; `:lang(zh)` overrides for CJK typography live in CSS, not utilities.

**Open questions.** OQ-01.2 (CJK typeface — human via 03).

### ADR-005 · Animation: Motion for in-page motion; route transitions decided by 05

**Status.** Accepted 2026-08-22 with ADJ-3 applied.

**Context.** The design's motion system (`docs/design/README.md`): per-section staggered entrances (110 ms
per child, reveal once, ~16 % threshold), ambient loops, count-ups, a `.5s` SOFT slide-in/out for subpages,
and the locale crossfade; the client plans many more animations; `prefers-reduced-motion` must be honoured.

**Decision.** Motion (`motion` package, `motion/react`; formerly published as framer-motion) is the single
JavaScript engine for in-page motion: one reveal primitive built on `whileInView` / `useInView` with
`viewport: { once: true, amount: 0.16 }`, variants and stagger (`delayChildren` / `stagger()`), `useScroll` /
`useTransform` for scroll-linked parallax (post-launch, 05 `D-05.13`), `useReducedMotion` globally,
timing/easing tokens from 03. Ambient loops are CSS keyframes, not Motion (05 `D-05.7`). The locale toggle's
enter-only cascade (`D-02.10`) is a Motion variant.
Route-level subpage slide (in from the right, Back slides out): **`AnimatePresence` exit animations do not fire
across route-segment changes in the App Router** (children are swapped immediately; the known workaround
captures the internal `LayoutRouterContext`, which can break on upgrade; `template.tsx` is enter-only) —
`AnimatePresence` across routes is **rejected**. The decision (05, confirmed here): React/Next **View
Transitions** — `<ViewTransition>` + `<Link transitionTypes>` (Next ≥ 16.2, no config; React API canary but
bundled by Next; browser support per 05 §5.7) with the design's `.5s` SOFT slide expressed as
`::view-transition-old/new` CSS keyed by transition type; unsupported browsers get a silent **instant swap**.
Imperative exit-then-navigate and parallel-route overlays were considered and not adopted (extra latency /
`default.js` slot plumbing). The locale toggle reuses the same mechanism with its own `transitionTypes`
(ADR-008). GSAP ScrollTrigger is governed by ADR-009.

**Alternatives considered.**

- *GSAP + ScrollTrigger from day one.* Best-in-class scroll scrubbing/pinning; imperative, not React-native,
  and unnecessary for the launch motion set. Deferred, not rejected.
- *CSS-only animations + IntersectionObserver hook.* Cheapest; loses variants/stagger orchestration and
  interruptibility the client's roadmap needs.
- *View Transitions for everything.* Not a substitute for in-view reveals and loops.

**Consequences.** Positive: declarative motion colocated with components; one reveal API; reduced-motion in one
place. Costs: a client-side animation bundle on every page (size to be measured in 08; `LazyMotion`/`m` trims
it); route exits need a second mechanism; View Transitions' React API is canary and fallbacks must be tested
per browser (08).

**Open questions.** OQ-01.3 (confirm `<ViewTransition>` + `transitionTypes` at the pinned Next version — the
scaffold/spike task in 10).

### ADR-006 · Inquiry form backend: Route Handler + Zod + Resend + Turnstile

**Status.** Accepted 2026-08-22.

**Context.** One form (parent name, email, child's age, desired start, message) that must reach the daycare
inbox, with required-field and email validation, success/error states, spam protection, and localized copy
(`visit.form.*`, `email.*` per 02).

**Decision.** A Next.js Route Handler (`app/api/inquiry/route.ts`) on the **Node.js runtime**
(`export const runtime = 'nodejs'` — the Resend SDK and server-side verification use Node APIs; not Edge)
validates with the same **Zod ≥ 4** schema as the client (`z.email()`, `z.uuid()` are Zod 4 APIs — the pin is
recorded here and required by 07 §9), verifies Cloudflare Turnstile server-side (`siteverify`) and a honeypot
field, and sends e-mail via Resend (sender domain DNS-verified; free tier 3,000 e-mails/month, 100/day,
3 domains; Pro $20/month [verified: Resend pricing, 2026-08-22]). Turnstile Standard is free [verified:
Cloudflare, 2026-08-22]; its per-account caps of 20 widgets and 10 hostnames per widget are
[assumed — confirm] (no first-party pricing page states them). Error codes, not English strings, are returned;
the client resolves them through the locale JSON (`D-02.4` rule 8). 07 owns the endpoint.

**Alternatives considered.**

- *Server Action.* Less boilerplate and progressive enhancement for free; harder to curl/observe/rate-limit as a
  plain HTTP endpoint and opaque to Playwright API tests. Acceptable fallback if 07 finds the handler heavy.
- *Hosted form service (Formspree, Basin).* Zero backend; a third party processes parents' data and children's
  ages, e-mail templates are not localized by our JSON, and branding/limits apply. Lost on data handling.
- *SMTP via nodemailer.* Works, but needs credentials for a mailbox and loses delivery observability.

**Consequences.** Positive: testable endpoint; shared validation; localized copy end-to-end. Costs: two
third-party accounts (Resend, Cloudflare) and secrets in Vercel env; DNS records for the sender domain; the
Turnstile widget adds a script to the Visit section.

**Open questions.** `OQ-02.5` (e-mail language / auto-reply — human).

### ADR-007 · Hosting: Vercel

**Status.** Accepted 2026-08-22 (ADJ-2 applied).

**Context.** Next.js site with a proxy (locale negotiation), a Route Handler, image optimisation, per-PR
previews for editor review, production from `main`.

**Decision.** Vercel: preview deployment per PR, production from `main`, `next/image`, assets in `/public`, the
proxy and the Route Handler running as Functions. **Never `output: 'export'`**: next-intl's proxy does not run
under static export, which would drop Accept-Language/cookie locale negotiation on unprefixed URLs; all
pages are still statically generated per locale (`D-06.4`), so the Function footprint is the proxy and the form.
Analytics on the same platform: Vercel Web Analytics + Speed Insights as the launch default (cookieless, so no
consent banner — 07 D-07.9, on the assumption 07 records as A-07.1 pending counsel); a GA4/Plausible override
is the human's call (OQ-01.1).

**Alternatives considered.**

- *Netlify.* Runs Next via its own runtime; previews comparable; less first-party alignment with Next 16
  features (knowledge).
- *Cloudflare Pages/Workers via the OpenNext adapter.* Cheap and fast at the edge; image optimisation and some
  Next features need adapters (knowledge); more friction for a small team.
- *Static export to any CDN.* Cheapest, but rejected by ADJ-2 (no proxy → no negotiation).

**Consequences.** Positive: zero-config previews, env management, logs for `onError` reporting (09). Costs: a
commercial site needs a paid plan (Vercel's Hobby tier is non-commercial — assumption to confirm, OQ-01.4);
vendor coupling of the proxy/Functions runtime.

**Open questions.** OQ-01.4 (plan/cost — human).

### ADR-008 · Locale routing: prefix always; toggle = navigation

**Status.** Accepted 2026-08-22 (ADJ-4 applied; detail in 02).

**Context.** Two launch locales, SEO-indexable URLs, shareable links, the design's "EN · 中文" toggle with a
per-string crossfade (`docs/design/README.md`, Interactions).

**Decision.** `localePrefix: 'always'` — every page is `/en/...` or `/zh/...`; the bare root redirects via the
proxy (prefix → `NEXT_LOCALE` cookie → Accept-Language → `en`); `<html lang>` and `hreflang` use `en` /
`zh-Hans`; `x-default` points at the English URL; canonical per locale; sitemap with alternates — all as
specified by `D-02.1` and `D-02.9`, implemented by 06. The toggle is a next-intl `Link` to the same pathname in
the other locale whose handler calls `router.replace(pathname, { locale, scroll: false })` passing 05's
`transitionTypes` — a client navigation that **remounts the `[locale]` subtree**; the prototype's in-place
crossfade is therefore an enter-only staggered cascade **per text block** on the new tree (`D-02.10`: every
mounted `Reveal` plays 05's `swap` variant, `D-05.9`), under a 200 ms root View-Transition crossfade (type
`locale-swap`; browsers without View Transitions get the cascade alone) — 05 `D-05.9` owns the mechanism and
specifies it as capability-gated graceful degradation, not an option. The dual-bundle client-state toggle is
rejected.

**Alternatives considered.**

- *`localePrefix: 'as-needed'`* (`/about` for English, `/zh/about` for Chinese). Shorter default URLs, but the
  proxy must redirect `/en/...` to unprefixed and remember the preference by cookie; `hreflang` pairs become
  asymmetric and URL meaning depends on state. Rejected for a two-locale site where symmetry is cheaper.
- *Domain per locale.* Unnecessary for one brand/region.
- *Client-state language (no locale in URL).* Exact prototype effect, but not indexable/shareable per language;
  rejected by the memo and ADJ-4.

**Consequences.** Positive: one canonical URL per page per locale; adding a locale changes no existing URL;
simple caching. Costs: one redirect on `/`; the toggle is a navigation (enter cascade, not crossfade); the
`NEXT_LOCALE` cookie exists (session-scoped by default).

**Open questions.** None — detection on `/` is decided in `D-02.9`.

### ADR-009 · GSAP ScrollTrigger for scroll-scrubbed sequences: not at launch

**Status.** Accepted 2026-08-22 (source: 05's GSAP decision; recorded here so the trigger is an ADR, not a
footnote).

**Context.** The client plans many more scroll/interaction animations (`docs/design/README.md`, "Animation-ready
architecture"). The launch motion set — reveals, staggers, ambient loops, count-ups, the subpage slide, the
locale cascade — is covered by ADR-005's mechanisms: Motion for reveals, stagger, count-up and the locale
cascade; CSS keyframes for the ambient loops (05 `D-05.7`); View Transitions for the subpage slide (05
`D-05.10`; `AnimatePresence` across routes is rejected). None of it needs GSAP. Scroll-linked parallax
(Motion `useScroll` / `useTransform`, 05 `D-05.13`) is post-launch and still needs no GSAP.

**Decision.** GSAP (with ScrollTrigger) is **not** added at launch. It is adopted, by a follow-up ADR that
supersedes this one, when the first of these is requested: **pinning** a section while others scroll,
**labelled timeline scrubs** (multi-step sequences tied to scroll progress), or **horizontal scroll** sections.
Until then every new animation is built on the Motion reveal primitive and tokens (05).

**Alternatives considered.**

- *Adopt GSAP now, alongside Motion.* Two animation engines and two easing systems from day one; unnecessary
  for the launch set.
- *Replace Motion with GSAP entirely.* Loses the declarative React integration (`whileInView`, variants,
  `useReducedMotion`) the reveal system is built on.
- *Never adopt GSAP; stretch Motion.* Pinning and labelled scrubs are where Motion's scroll API is weakest; a
  hard "never" would be dishonest.

**Consequences.** Positive: one engine at launch; a clear, testable trigger; no speculative dependency. Costs:
when the trigger fires, a second library and its bundle arrive, and the affected sections must be refactored to
keep decorative elements individually addressable (already a design requirement).

**Open questions.** OQ-01.5 (which post-launch request first trips the trigger).

## Open questions

- **OQ-01.1** · answerer: human (Hanyi); 09 wires it — The launch default is Vercel Web Analytics + Speed
  Insights (cookieless, so no consent banner; 07 D-07.9, assumed pending counsel as 07 A-07.1). Override with
  GA4 or Plausible (which would bring consent implications)?
- **OQ-01.2** · answerer: human (Hanyi); surfaced and tokenised by 03 — CJK typeface for `zh` (Noto Sans SC vs
  system CJK stack); the design names none.
- **OQ-01.3** · answerer: the scaffold/spike task in 10 (check-stack verifies the result) — Confirm that React
  `<ViewTransition>` and `<Link transitionTypes>` are available and behave as documented at the pinned Next.js
  version (≥ 16.2); if not, the subpage slide falls back to an instant swap until they are.
- **OQ-01.4** · not open here — the Vercel plan and the monthly budget for Vercel + Resend + domain are 09's
  `OQ-09.1` (answerer: human (owner / Hanyi); cost model in 09 `D-09.20`), which supersedes this entry for the
  plan question. 01 records the outcome: **Pro**, because Hobby is non-commercial.
- **OQ-01.5** · answerer: human (Hanyi) with the seat writing 05 — Which post-launch animation request first
  trips ADR-009's trigger (pinning, labelled scrub, horizontal scroll), if any?

## Cross-references

- `docs/design/README.md` — motion system, interactions (subpage slide, EN ↔ 中文 toggle), tokens, fonts.
- `docs/design/desktop/README.md`, `docs/design/mobile/README.md` — per-view behaviours.
- `docs/technical/02-i18n-content-contract.md` — `D-02.1`, `D-02.2`, `D-02.4`, `D-02.5`, `D-02.7`, `D-02.9`,
  `D-02.10`, `D-02.11`, `D-02.12`, `D-02.16`, `INV-02.1` … `INV-02.9`, `OQ-02.1` … `OQ-02.7`.
- `docs/technical/03-design-system-tokens.md` — `@theme` tokens, `--dur-*`, fonts and CJK fallback.
- `docs/technical/04-components-sections.md` — component inventory; where utility-heavy markup is disciplined.
- `docs/technical/05-animation-system.md` — reveal primitive, View Transitions route slide, `swap` variant for
  the locale enter cascade (`D-05.9`), CSS ambient loops (`D-05.7`), GSAP trigger (ADR-009 source).
- `docs/technical/06-routing-pages-seo.md` — proxy, metadata, `hreflang`, sitemap.
- `docs/technical/07-forms-integrations.md` — Route Handler, Resend, Turnstile.
- `docs/technical/08-testing-quality.md` — ESLint (`react/jsx-no-literals`), Vitest/RTL, Playwright per locale,
  `pnpm validate:content` gates.
- `docs/technical/09-deployment-operations.md` — Vercel, env, logs, editor workflow.
- `docs/technical/10-work-breakdown.md` — the scaffold/spike task that answers OQ-01.3.
