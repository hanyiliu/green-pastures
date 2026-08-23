# 00 · Technical plan — README & index

## Purpose

The front door to the plan of record for building the Green Pastures Montessori daycare website from the
finished designs in `docs/design/` — what we build it with, in what order, and what the human must decide
before anyone writes code. The site will be served from **`greenpasturesdaycare.com`**, apex canonical with
`www` redirecting to it (HD-13, `D-09.5`, `D-06.11`). The set is **merged and signed off**: the human read it
and answered at the Phase 1 gate on **2026-08-22**, signing off bead `gp-dln.4`, then answered three more
questions the same day; the fifteen answers are cited across the plan as `HD-1`…`HD-15` (`D-12.7`), with three
orchestrator adjudications (`ADJ-20`…`ADJ-22`), and are rolled up in `12` §5. It is still a plan, not an
implementation — the repository holds documentation and tracker state only, there is no `src/` and no
`content/` tree yet, and Phase 2 is where the first line of application code is written (`D-10.1`,
`INV-10.1`). This page asserts nothing of its own — every stack line, phase, gate, milestone and number is
lifted from one of the twelve documents beside it and cited by identifier, so when the two disagree the owning
document is right.

Status: draft · seat writer-index · 2026-08-22 · revised 2026-08-22 (HD-1…HD-15, ADJ-20…ADJ-22)

## Decisions

- **D-00.1 This document is an index, not a source.** Every claim here is a citation; 00 introduces no
  decision about the stack, the schedule, the content model or the scope. A claim without an id is a defect.
- **D-00.2 The plan of record is these thirteen files** — `00-README.md` through `12-open-questions.md`, with
  `docs/design/**` as the input. Nothing else is binding and the file names are frozen.
- **D-00.3 Signed off, and still plan-only.** The human accepted these documents as the plan of record at the
  Phase 1 gate on 2026-08-22 and answered twelve questions with it, then three more the same day. No
  application code exists (the previous Create-React-App site was reset at `90bf6ba`), no `src/` or `content/`
  tree exists, and none is written before Phase 2 opens (`D-10.1`, `INV-10.1`). Recording a gate answer in
  these documents is not implementation — and neither is knowing the domain: no absolute origin is written
  into `src/` at any point (`INV-06.10`).
- **D-00.4 A thin `CLAUDE.md` lands in PR-2.2; this file stays the conventions of record.** This answers
  `OQ-11.4`, which `11` routes to this document's owner. If PR-2.2 ships without it, `11`'s default holds and
  `00` plus `11-work-tracking.md` remain binding.
- **D-00.5 Three reading orders are published** (§5) — build, edit the words, review the gate — and the one
  for editing the site's words must never require the one for building it.
- **D-00.6 The gate answers live in the documents that own them.** Each of `HD-1`…`HD-15` changed the document
  that owns its subject — three locales and the retirement of the `zh` identifier in `D-02.1`, the subpage set
  in `D-02.17`, the owner's entry point in `D-02.18`, brand names in `D-02.19`, provisional values in
  `D-02.20`, the `zh-Hant` seed in `D-02.21`, the hosting plan in `09`, and from the second sitting the domain
  in `D-09.5` / `D-06.11` (HD-13) and the CJK stack in `D-03.5` / `D-03.14` (HD-14, which closed `OQ-03.4`);
  HD-15 confirmed `D-02.18`'s split and changed no text. `12` §5 is the roll-up. This file reflects them and
  adds nothing, which is `D-00.1` applied to a decision rather than to a fact — the same rule under which the
  adjudications `ADJ-20`…`ADJ-22` are cited here only where the owning documents record them.

## Design

### 1 · The requirement that shapes everything

**Every user-visible string lives in an easy-to-edit per-locale JSON file**, in **three** locales that all go
live from one codebase: `en` (default and reference), `zh-Hans` (Simplified — the Chinese that ships at
launch) and `zh-Hant` (Traditional — an additional language, which may be enabled after launch without
blocking it). The locale id, the URL segment, `<html lang>` and `hreflang` are the same string, so the bare
identifier `zh` no longer exists anywhere (`D-02.1`, HD-10). That requirement, not the framework, is why the
stack looks as it does: it sets the i18n library (`D-01.2`), the content storage (`D-01.3`), the URL scheme
(`D-01.8`), the lint rule banning literal text in JSX (`D-08.2`) and the gate that fails a build when the
locales drift (`D-02.8`).
**How** — words live under `content/en/`, `content/zh-Hans/` and `content/zh-Hant/` as `messages/` and
`collections/`; everything that is not words (URLs, image paths, ratios, hours, counts, license number, our
own brand names) lives in one shared `content/site.json`, so translators never duplicate a fact. The two
values that genuinely read differently per language — `brand.name` and `brand.shortName` — are *localized
values* in that same one file, not translations in a language file (`D-02.19`). Adding a locale is one
directory of JSON plus one config entry. Full contract: `02-i18n-content-contract.md` (`D-02.1`…`D-02.21`,
`INV-02.1`…`INV-02.11`).
**Where the placeholders are** — the facts nobody has supplied yet (address, phone, inbox, sending domain,
licence number, Yelp figures, teacher names, the Chinese brand name, the site origin) ship as editable sample
defaults rather than `TODO` sentinels, and every one is registered by path in `content/site.json` →
`provisional`. `pnpm validate:content --release` fails while that list is non-empty, so a plausible fake
cannot reach production unnoticed (`D-02.20`, `INV-02.10`). There are **23** entries at Phase 3; `12` §6
enumerates them and names who clears each. One of them — `brand.url` — now has a known value rather than an
open question behind it (HD-13), but the entry clears only when somebody edits it, or when `OQ-09.10` deletes
the field in favour of `NEXT_PUBLIC_SITE_URL`.
**Who edits it** — the owner edits English text and facts in the GitHub web editor, a translator edits
`content/zh-Hans/**` and `content/zh-Hant/**`, the developer reviews every content PR:
`09-deployment-operations.md` §4 (`D-09.10`, `D-09.12`), guide at `content/README.md`. The single entry point
is the `content/` folder — words per locale, facts once in `site.json`, nothing editable in `src/`, in
environment variables or in a CMS (`D-02.18`). Scale: **243 keys**, **33** of them already carrying prototype
Simplified Chinese (`10` §3); translation covers the ≈ **165** remaining copy keys plus the production-only
keys, and `zh-Hant` is seeded by conversion rather than translated a second time (`D-02.21`, `OQ-10.4`,
`10` PR-8.1).

### 2 · The stack

Decided in `01-stack-decisions.md`, with alternatives and dissent per row; versions per memo ADJ-1, pinned at PR-2.4.

| Concern | Choice | Why | Decision |
|---|---|---|---|
| Framework / language | Next.js **16.x** App Router (`proxy.ts`, Turbopack, no `next lint`), TypeScript `strict`, React **19.2** | Server-rendered per-locale URLs, a form backend and a bespoke animation layer in one framework; the owner's previous site was React | ADR-001 · `D-01.1` |
| Package manager / runtime | pnpm, **Node 24** (Active LTS), `engines.node: "24.x"` | Vercel's default runtime | ADR-001 · `D-01.1` |
| Styling | Tailwind CSS v4, tokens in `@theme`; CSS Modules for bespoke keyframes | The design hands over a token vocabulary, not a component kit; no runtime CSS-in-JS | ADR-004 · `D-01.4` |
| i18n | next-intl 4.x — `[locale]` segment, `localePrefix: 'always'`, JSON messages, typed keys; three locales `en` / `zh-Hans` / `zh-Hant`, the id also being the URL segment, `lang` and `hreflang` | JSON files are the deliverable; locale in the URL keeps pages indexable and links shareable, and one identifier per locale leaves nothing to drift | ADR-002 · `D-01.2` · ADR-008 · `D-01.8` · `D-02.1` |
| Content | Versioned JSON in `content/**`, Zod-validated, CMS-ready; unsupplied facts ship as sample defaults listed in `site.json.provisional` | The owner edits text in a pull request; a CMS can be added later without moving a key; `--release` refuses to ship a placeholder | ADR-003 · `D-01.3` · `D-02.20` |
| Animation | Motion (`motion/react`) for in-page motion; React `<ViewTransition>` + `<Link transitionTypes>` for the subpage slide; no GSAP at launch | One reveal primitive with variants covers every entrance; GSAP waits for a scroll-scrub need | ADR-005 · `D-01.5` · ADR-009 · `D-01.9` |
| Forms | Route Handler + Zod ≥ 4 + Resend + Turnstile + honeypot + a Vercel WAF rate-limit rule | One inquiry form, emailed to the daycare; no database, no third-party form host | ADR-006 · `D-01.6` · `D-07.7` |
| Hosting | Vercel — **Hobby at start** (HD-3, `D-09.2`), preview per PR, production from `main`; the locale proxy runs as a Function, never a static export. Production origin **`https://greenpasturesdaycare.com`** (HD-13), apex canonical with `www` → apex 308, set once as `NEXT_PUBLIC_SITE_URL` in the Production scope | Static export cannot negotiate a locale. Hobby is licensed for non-commercial use, so the plan is revisited before the DNS cutover — a launch blocker, `12` §6. The origin reaches metadata only through the variable; no absolute host appears in `src/` | ADR-007 · `D-01.7` · `D-09.2` · `D-09.5` · `D-06.11` · `INV-06.10` · `OQ-09.1` · `OQ-10.7` |
| Testing / quality | Vitest + RTL, Playwright per locale, ESLint (`react/jsx-no-literals`), Stylelint, `pnpm validate:content`, GitHub Actions | Literal copy in JSX and locale drift are this site's two real failure modes | `D-08.2` · `D-08.3` · `08` |
| Analytics | Vercel Web Analytics + Speed Insights, cookieless, no consent banner; **no third-party tag** — no GA4, no Google Tag, no Plausible snippet (the human, 2026-08-22) | The override was the last open half and it was declined, so `A-07.1` stands and no consent UI is built | `D-07.9` · ADJ-10 · `12` §5 |

### 3 · The phases and the roadmap

Eight phases, from `10-work-breakdown.md` (`D-10.1`). **Numbering starts at 1 because this plan is Phase 1** —
the existing bead `gp-dln.4` is titled "Phase 1 gate" — so implementation runs Phases 2–8 (`D-10.1`). A gate
is a *merge* barrier: work may branch early, but no PR of phase *n* lands before the phase *n−1* gate closes
(`D-10.2`, `INV-10.1`). Weeks are **relative to the day `gp-dln.4` closes** — 2026-08-22 — never calendar
dates (`OQ-10.2` would fix one), and assume **two implementers** with gate reviews inside two business days —
`A-10.1`, confirmed by `OQ-10.1`; at one implementer the stack stretches to ≈ 24 weeks (`10` §11).

| # | Weeks | Phase · goal | Exit gate · milestone | Human inputs it needs |
|---|---|---|---|---|
| 1 | — | **Technical plan** — `docs/technical/00`–`12` accepted as the plan of record | `gp-dln.4` · Phase 1 gate · **human sign-off, 2026-08-22** | done; the fifteen answers of 2026-08-22 are `12` §5, and what they did **not** clear is `12` §6 |
| 2 | 1 | **Foundation** — repo scaffolded (Next 16 / TS / pnpm / Tailwind v4 / next-intl / Motion), tooling and CI gates, tracker snapshot and `bead-trailer`, governance files, the root README if this plan round has not already replaced it (`10` §2 scope (b)), first Vercel preview | Phase 2 gate · CI + trailer gate required on `main` — which needs the HD-2 ruleset pointed at a branch first — and preview deploys | `OQ-11.3` repo settings — answered in intent, but the ruleset targets no branch (`12` §6) · `OQ-09.3` preview protection · `OQ-08.3` CI minutes · `OQ-11.1` Dolt push |
| 3 | 2–3 | **Content & i18n infrastructure** — `content/` tree (all `en` keys, `site.json` incl. the 23-entry `provisional` array, schemas), i18n runtime, proxy, `validate:content` + coverage report, the 33 prototype `zh-Hans` strings and `zh-Hant` seeded from them (`D-02.21`) | Phase 3 gate · content contract live: `/en`, `/zh-Hans` and `/zh-Hant` render on preview, `INV-02.1`–`INV-02.11` on | `OQ-06.5` cookie · `OQ-09.4` approver · `OQ-10.4` translation (now two Chinese locales) · `OQ-02.2` fallback (decided — override only) |
| 4 | 4–5 | **Design system & motion primitives** — tokens, fonts and the CJK stack (split SC/TC, `D-03.14`), layout shell, sticky nav + hamburger + the three-option locale switcher, footer, `Reveal`/variants/`WordSwap`/`CountUp`, the View Transitions spike, hero as the vertical slice | Phase 4 gate · **M1** skeleton on preview: every locale, nav + hero + footer, cascade, reveals | `OQ-03.2` AA palette · `OQ-06.10`/`OQ-04.11` what the three-option switcher looks like (its chevron is settled — none, ADJ-20) · `OQ-03.1` tablet · `OQ-03.5` icons · `OQ-03.6` vector logo · `OQ-04.1/04.6/04.7` · `OQ-05.3/05.4/05.6/05.8` · `OQ-06.6`. The CJK typeface is **closed** (HD-14): the system stack ships, split per script by `D-03.14`, and PR-4.1 carries no font decision |
| 5 | 6–8 | **Homepage** — the remaining seven sections in both views, plus the inquiry-form lane (schema, handler, `InquiryForm`) | Phase 5 gate · **M2** homepage hi-fi complete; the form submits on preview | `OQ-07.10` option sets (decided — override only) · `OQ-07.1`/`OQ-02.5` e-mail language · `OQ-02.6` testimonials in the Chinese locales · `OQ-04.3` · `OQ-08.1`/`OQ-08.6` · `OQ-10.3` photography |
| 6 | 9–10 | **Subpages, transitions & SEO** — the six routes (Philosophy, Programs, Menu, Gallery, Reviews, Team) plus the catch-all, the slide and Back, per-locale metadata, `hreflang` × 3 + `x-default`, the 21-URL sitemap, robots, JSON-LD, 404, security headers | Phase 6 gate · **M3** subpages + SEO | the subpage set is settled (`D-02.17`) · `OQ-07.5`/`OQ-06.4` privacy · `OQ-04.2` lightbox · `OQ-06.7` share image · the JSON-LD's owner facts ship provisional (`D-02.20`); the domain name is settled (HD-13) and `metadataBase` still reads `NEXT_PUBLIC_SITE_URL` (`D-06.11`), so what is asked here instead is **registrar or DNS-host access for the developer**, opened with OPS-7.x at the Phase 5 gate so propagation overlaps Phase 7 (`D-10.14`) |
| 7 | 10–11 | **Integrations** (overlaps 6) — Resend domain and inbox, Turnstile production keys, Vercel env scopes and the WAF rule, analytics | Phase 7 gate · **M4** inquiry form live in production | `OQ-07.6` the real mailbox names and the DKIM/SPF that verifies the sending subdomain — the samples are already written on `mail.greenpasturesdaycare.com` (`D-07.10`), and a named domain is not a verified one (`12` §6) · `OQ-07.4` retention · `OQ-10.7` when the Vercel plan changes (the WAF rule lands here) · registrar access, so OPS-7.3 can attach the domain |
| 8 | 11–13 | **Hardening, content completion & launch** — `zh-Hans` complete and `zh-Hant` reviewed or dropped from `routing.locales` (`INV-02.11`), owner facts replacing every provisional value, photography in, a11y / performance / visual-regression gates, `validate:content --release`, the Vercel plan resolved, launch checklist | Phase 8 gate · **M5** launch (`provisional` empty, DNS cutover approved) | the `provisional` array emptied — 23 entries incl. `gp-dln.12`'s brand name and `OQ-07.7`'s Yelp figures (`12` §6) · **`OQ-06.2`/`OQ-09.2` who holds the registrar login** — the name is answered (HD-13) and the access is not · the Vercel plan (`OQ-09.1`, Hobby is non-commercial) · `OQ-10.3` photos · `OQ-10.4` translation · `OQ-02.8` the `zh-Hant` review · `OQ-06.3`/`OQ-09.8` · `OQ-08.2` · `OQ-09.6` · `OQ-09.7` · `OQ-10.2` |

Size (`10` §Size, `D-10.8`): **≈ 55 PRs**, **≈ 115 implementer-days**, **≈ 12–13 weeks** at `A-10.1`; one
gate review per phase. **Critical path**, PR by PR in `10` §10: `gp-dln.4` → scaffold → i18n runtime, `en`
content and validator → tokens → shell and motion core → nav → hero → the seven sections (Visit last, fed by
the forms lane) → subpage shell (needs the View Transitions spike) → routes → routes e2e → integrations
(owner-paced) → translation and `--release` → launch. Everything else runs beside it in `10` §10's parallel
lanes — content, forms, tokens/motion, quality, ops, tracker — on disjoint file sets. **The gate answers of
2026-08-22 move none of these weeks** (`10` §11 says so of both sittings): HD-14 confirms the choice PR-4.1
was already making, and HD-13 removes a wait rather than adding work — what changes is the shape of the Phase
8 risk, from "nothing to cut over to" to "no login to cut over with" (`D-10.14`). Post-launch work (FAQ
and Enrollment, a CMS UI, GSAP, Yelp Fusion, a CRM, and — because HD-14 closed a question rather than leaving
it open — naming a CJK webfont) is a gateless backlog epic (`10` §9). `zh-Hant` left that
backlog on 2026-08-22 and now has rows in Phases 3 and 8 — but it is the one deliverable that may still fall
either side of the launch line, because an unfinished locale is dropped from `routing.locales` rather than
shipped half-translated, and its rows can be cut at the Phase 8 gate without moving the date
(`INV-02.11`, `D-10.12`, `OQ-02.8`).

### 4 · What the human decided, and what is still needed

The Phase 1 gate answered twelve questions on 2026-08-22 and the three filed beads with them; a second sitting
the same day answered three more (HD-13…HD-15). The register is `12-open-questions.md`: its §5 carries each
answer, its §1 the **59** identifiers still open, and its §6 the **eight** items that still stop a named gate.
**Seven** of those eight now read as *answered* — a sample default unblocks the build and clears nothing at
launch, and a named domain is not an account somebody can sign into — which is why the two halves below are
separate.

**Answered at the gate and in the second sitting** (full text in `12` §5):

| What | The answer | Recorded in |
|---|---|---|
| The plan itself | Accepted as the plan of record; ADR-001…009 stand as written | HD-1 · `gp-dln.4` |
| Languages | Three locales — `en`, `zh-Hans` (Simplified, ships at launch), `zh-Hant` (Traditional, additional) | HD-10 · `D-02.1` |
| Subpages | Six: Philosophy, Programs, Menu, Gallery, Reviews, **Team** — "Staff" *is* Team; FAQ and Enrollment reserved, not built | HD-5 · `D-02.17` · `gp-dln.6` |
| Chinese brand name | 优朵幼儿园 (優朵幼兒園 in Traditional), used provisionally; 绿茵园 rejected | HD-6 · `D-02.19` · `gp-dln.12` |
| Owner facts, sending domain, inbox | Ship now as editable sample defaults, each registered in `site.json.provisional`, so previews are honest and `--release` still blocks launch | HD-4 · HD-7 · HD-9 · `D-02.20` · `gp-dln.13` |
| Where the owner edits | One folder — `content/`: words per locale, facts once in `site.json`; nothing in `src/`, in env vars or in a CMS. Re-confirmed in the second sitting | HD-8 · HD-15 · `D-02.18` |
| Hosting | Vercel, **Hobby at start**, no budget concern raised | HD-3 · `OQ-09.1` |
| **The domain** | **`greenpasturesdaycare.com`** — apex canonical, `www` → apex 308, apex primary at Vercel and the Search Console property; `NEXT_PUBLIC_SITE_URL` = `https://greenpasturesdaycare.com` in Production only. The mock's `greenpasturesmontessori.com` is excluded | HD-13 · `D-09.5` · `D-06.11` |
| Repo protection | Added by the human — see the caveat below | HD-2 · `OQ-11.3` |
| CJK typeface | The question's premise was false — the design names none — and the human then confirmed the system CJK stack for both scripts: **no webfont at launch**, split per script into `--font-cjk-sc` / `--font-cjk-tc` | HD-11 · HD-14 · `D-03.5` · `D-03.14` |
| Photos and translations | Stay placeholders as planned — `PhotoSlot`, and Chinese parity in warn mode until Phase 8 | HD-12 · `D-04.12` · `D-10.6` |
| Analytics and tags | **No third-party tag** — no GA4, Google Tag or Plausible; Vercel Web Analytics + Speed Insights only. Read the same way for a git release tag: none is cut | the human · `D-07.9` · `OQ-00.3` |
| The register's defaults | Accepted — silence means the default everywhere except the blockers | `OQ-12.1` |

**Still needed, and nothing in the plan can supply it** (`12` §6 in full):

| # | Needed | When it bites | Ids |
|---|---|---|---|
| 1 | **Who holds the registrar login** (and the DNS host, if that is a separate account). The name is answered — HD-13 — and written through `06` §6.5–6.6 and `09` §5.1; what is left is access: the apex `A` record, the `www` `CNAME`, Search Console verification, the Turnstile hostnames and the Resend records all need someone who can sign in and edit the zone. Per `D-09.19` the answer is an invitation to the daycare's own account, never a shared password | the DNS cutover (Phase 8); the ask is opened at the Phase 5 gate so propagation overlaps Phase 7 | `OQ-06.2` · `OQ-09.2` · `D-10.14` |
| 2 | The protection ruleset **pointed at a branch**. "Main Protection" exists, but its `ref_name.include` list is empty, so it applies to nothing and `main` is unprotected in fact; `bead-trailer` also has to become a required check once that workflow exists | the Phase 2 gate | `OQ-11.3` |
| 3 | The **Vercel plan for production**, and when it changes. Hobby is licensed for non-commercial use and this is a commercial site; it also allows one custom WAF rule, which the rate limit already spends, keeps runtime logs one hour rather than a day, and has no free Viewer seat for a reviewer. Launch item 3a needs an upgrade to Pro or a written eligibility confirmation | the launch gate; the timing question bites at OPS-7.3 | `OQ-09.1` · `OQ-10.7` · `D-07.7` |
| 4 | **23 real values** in place of the sample defaults: the brand name, the site origin, the sending domain and inquiry inbox, phone, address, licence number, the Yelp figures, and three teachers' names and credentials. HD-13 supplies the origin's value and empties no entry — clearing one is still an edit somebody makes | the launch gate — `validate:content --release` fails while any entry remains | `D-02.20` · `OQ-02.4` · `OQ-06.9` · `OQ-07.6` · `OQ-07.7` · `OQ-07.8` |
| 5 | **Deliveries with lead time**: photography; a translator for the ≈ 165 remaining copy keys plus the production-only keys, now in two Chinese locales; and a named reviewer for the Traditional tree before that locale is enabled | Phase 5 for LCP tuning, Phase 8 for the rest | `OQ-10.3` · `OQ-10.4` · `OQ-02.8` |
| 6 | The smaller choices at the phase named in §3's last column — preview protection, CI minutes, cookie lifetime, the AA palette, privacy counsel, the look of the three-option locale switcher (its chevron is settled: none, ADJ-20), and the rest | per phase | `12` §1: 59 ids on 51 rows |

### 5 · Document index and reading orders

| File | What it decides |
|---|---|
| `01-stack-decisions.md` | The ADR log: ADR-001 (framework, language, runtime, hosting) and the eight dependent choices, each with alternatives and dissent. |
| `02-i18n-content-contract.md` | The binding contract for every user-visible string: tree, key naming, ICU syntax, typing, loading, fallback, validation, the add-a-locale checklist. |
| `03-design-system-tokens.md` | The token vocabulary from the design handoff: colours, type, spacing, shape, elevation, touch targets, motion timing, fonts and the CJK fallback. |
| `04-components-sections.md` | The React component architecture: layout and provider stack, the server/client boundary, `src/` layout, and every component with the messages it consumes. |
| `05-animation-system.md` | How every motion is built: the `Reveal` primitive and its variants, ambient loops, count-up, text swaps, the subpage slide, reduced motion. |
| `06-routing-pages-seo.md` | The URL space: routes per locale, the proxy, in-page navigation and anchors, metadata, `hreflang`, sitemap, robots, JSON-LD, error routes. |
| `07-forms-integrations.md` | The one inquiry form end to end — fields, validation, the mail path, spam controls, privacy — plus Yelp and analytics as third parties. |
| `08-testing-quality.md` | Which check enforces which invariant, where it runs, and what "green" means per PR, per phase and at launch. |
| `09-deployment-operations.md` | Environments, environment variables and secrets, CI/CD and rollback, and the content-editing workflow written for a non-developer. |
| `10-work-breakdown.md` | Phases, the PR stack inside each with dependencies and verifier checks, the dependency graph and critical path, the roadmap and working agreements. |
| `11-work-tracking.md` | How work is tracked: the tracker of record, bead-per-branch, commit trailers, what CI enforces, how the tracker survives across clones. |
| `12-open-questions.md` | The single roll-up of every open question and assumption in the set, who answers each, what it blocks, the default if it is never answered, the answers taken on 2026-08-22 (§5) and the eight things that still stop a gate (§6), seven of which read as answered. |

**Building the site, from cold** — `00` (this file) → `01` (why the stack is what it is) → `02` (the contract
everything else obeys) → `10` (what happens when) → then the owning document for whatever you are about to
build: `03` → `04` → `05` → `06` → `07`, with `08` and `09` before your first PR and `11` before your first
branch. Finish with `12` so you know which of your inputs are still assumptions.

**Only editing the words** — §1 of this file → `09` §4, the workflow written for you → `content/README.md` in
the repository once PR-3.8 ships → `02` *Where the owner edits* for which file holds what, and *Directory
layout* / *Key naming* if you need to add a key rather than change one → `02` *Provisional values* for the
sample defaults waiting on you → the human-owned table in `12` for the facts still needed. You never need
`01`, `03`–`08`, `10` or `11`.

**Reviewing the gate** — `00` §2–§4 → `12` §5, what was decided on 2026-08-22 across both sittings and what
each answer did *not* clear → `12` §6, the eight blockers, seven of which read as answered → `12` §1 for
everything still open, ordered by the phase that blocks on it → `10` §11 for the roadmap and what it assumes
about your availability.

### 6 · Invariants

- **INV-00.1** Every number, phase name, gate title, milestone and stack line in this document carries the id
  of the document that owns it. A claim here without a citation is a defect in this file, not a decision.
- **INV-00.2** When an owning document changes a phase, gate, milestone, stack row or open question, the
  matching row here is updated in the same PR (the rule `INV-10.5` sets for `10`'s plan rows).
- **INV-00.3** The thirteen file names in §5 are fixed; renaming one is a breaking change to every
  cross-reference in the set.

## Open questions

- **OQ-00.1** · answerer: human (Hanyi), at the Phase 1 gate `gp-dln.4` — **ANSWERED 2026-08-22 (human,
  HD-1).** The set is accepted as the plan of record and ADR-001…009 stand as written. Nothing in the phase
  order or launch scope was re-cut; the fifteen answers change what the phases *contain* (three locales, six
  subpages, provisional values, a named domain, a settled font stack) and not their order or their weeks
  (`10` §11). The gate is answered, so `gp-dln.4` closes and Phase 2 may open.
- **OQ-00.2** · answerer: human (Hanyi); PR-2.2 implements — **HALF ANSWERED 2026-08-22 (human).** The
  replacement is confirmed: the root `README.md` is Create-React-App boilerplate for a project that no longer
  is one. `10` §2 scope (b) puts the replacement in this documentation round, with PR-2.2 writing it only if
  that has not already landed (bead `gp-dln.8`). Still open, and cheap either way: does the owner
  also want a public-facing project README (what the site is, how to run it), or is a pointer to this file
  enough? Default: a pointer.
- **OQ-00.3** · answerer: human (Hanyi) with `11` — **ANSWERED 2026-08-22 (human).** The human's "no tag is
  necessary" was given about analytics; it is recorded here too because it reads the same way for a release
  tag, and the orchestrator flagged both readings. **No tag is cut** when `gp-dln.4` closes: amendments land as
  ordinary PRs against `main` and the bead trailer is the audit trail (`11` §5). Post-gate amendments are
  therefore diffable only through git history, which is what the trailer exists for.
- **OQ-00.4** · answerer: human (Hanyi), before the Phase 2 gate — The sign-off of 2026-08-22 was given on the
  merged set, and the answers were then written into the documents that own them: the first twelve changed
  `02` most of all, and the second sitting's three changed `03`, `06`, `07`, `09` and `10`. Does the sign-off
  stand over the amended set, or does the human want to re-read before Phase 2 opens? Default: it stands.
  Every amendment is an answer the human gave, recorded where `D-00.6` says it belongs, and `12` §5 is the one
  page that shows all fifteen at once; no phase waits on a second reading.

## Cross-references

- Design handoff: `docs/design/README.md` (shared system, section inventory, motion, interactions),
  `docs/design/desktop/README.md`, `docs/design/mobile/README.md`, and the `.dc.html` hi-fi references.
- Plan: `docs/technical/01-stack-decisions.md` (ADR-001…009, `D-01.1`…`D-01.9`);
  `docs/technical/02-i18n-content-contract.md` (`D-02.1`…`D-02.21`, `INV-02.1`…`INV-02.11`);
  `docs/technical/03-design-system-tokens.md` (`D-03.5`, `D-03.14`); `docs/technical/04-components-sections.md`
  (`D-04.12`, `D-04.16`); `docs/technical/05-animation-system.md`; `docs/technical/06-routing-pages-seo.md`
  (`D-06.11`, `INV-06.10`, §6.5–6.6); `docs/technical/07-forms-integrations.md` (`D-07.7`, `D-07.9`,
  `D-07.10`); `docs/technical/08-testing-quality.md` (`D-08.2`, `D-08.3`);
  `docs/technical/09-deployment-operations.md` (§4, §5.1, `D-09.5`, `D-09.10`, `D-09.12`, `D-09.19`);
  `docs/technical/10-work-breakdown.md` (`D-10.1`, `D-10.2`, `D-10.8`, `D-10.14`,
  `INV-10.1`, `INV-10.5`, §3, §9, §10, §11, §14); `docs/technical/11-work-tracking.md` (`OQ-11.3`,
  `OQ-11.4`, §5); `docs/technical/12-open-questions.md` — the full register of what is still open, of what
  2026-08-22 answered across its two sittings (§5), and of the eight blockers that remain (§6).
- Beads: `gp-dln.4` (Phase 1 gate, signed off 2026-08-22), `gp-dln.6` (subpage set), `gp-dln.12` (Chinese brand
  name), `gp-dln.13` (owner-supplied facts) — all answered at the gate — and `gp-dln.8` (root `README.md`).
- The human's answers are cited across the set as `HD-1`…`HD-15` — `HD-1`…`HD-12` at the Phase 1 gate,
  `HD-13` (the domain), `HD-14` (the CJK stack) and `HD-15` (the `site.json` split) in the second sitting the
  same day — and the orchestrator's adjudications as `ADJ-20` (the switcher trigger carries no chevron),
  `ADJ-21` (the 303 fallback is `/{locale}#visit`) and `ADJ-22` (`12` and `00` re-sync last). `D-12.7` defines
  the citation and `12` §5 is the roll-up.
