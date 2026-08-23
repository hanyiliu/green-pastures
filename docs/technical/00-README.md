# 00 · Technical plan — README & index

## Purpose

The front door to the plan of record for building the Green Pastures Montessori daycare website from the
finished designs in `docs/design/` — what we build it with, in what order, and what the human must decide
before anyone writes code. It is a plan, not an implementation: the repository holds documentation and tracker
state only, and **nothing is implemented until the human closes the Phase 1 gate, bead `gp-dln.4`** (`D-10.1`,
`INV-10.1`); Phase 2, the first line of application code, starts the day that bead closes. This page asserts
nothing of its own — every stack line, phase, gate, milestone and number is lifted from one of the twelve
documents beside it and cited by identifier, so when the two disagree the owning document is right.

Status: draft · seat writer-index · 2026-08-22

## Decisions

- **D-00.1 This document is an index, not a source.** Every claim here is a citation; 00 introduces no
  decision about the stack, the schedule, the content model or the scope. A claim without an id is a defect.
- **D-00.2 The plan of record is these thirteen files** — `00-README.md` through `12-open-questions.md`, with
  `docs/design/**` as the input. Nothing else is binding and the file names are frozen.
- **D-00.3 Plan only until `gp-dln.4` closes.** No application code exists (the previous Create-React-App
  site was reset at `90bf6ba`) and none is written before the gate (`D-10.1`, `INV-10.1`).
- **D-00.4 A thin `CLAUDE.md` lands in PR-2.2; this file stays the conventions of record.** This answers
  `OQ-11.4`, which `11` routes to this document's owner. If PR-2.2 ships without it, `11`'s default holds and
  `00` plus `11-work-tracking.md` remain binding.
- **D-00.5 Three reading orders are published** (§5) — build, edit the words, review the gate — and the one
  for editing the site's words must never require the one for building it.

## Design

### 1 · The requirement that shapes everything

**Every user-visible string lives in an easy-to-edit per-locale JSON file**, English and 中文 both live at
launch. That requirement, not the framework, is why the stack looks as it does: it sets the i18n library
(`D-01.2`), the content storage (`D-01.3`), the URL scheme (`D-01.8`), the lint rule banning literal text in
JSX (`D-08.2`) and the gate that fails a build when the locales drift (`D-02.8`).
**How** — words live under `content/<locale>/` as `messages/` and `collections/`; everything that is not words
(URLs, image paths, ratios, hours, counts, license number, our own brand names) lives in one locale-agnostic
`content/site.json`, so translators never duplicate a fact. Adding a locale is one directory of JSON plus one
config entry. Full contract: `02-i18n-content-contract.md` (`D-02.1`…`D-02.17`, `INV-02.1`…`INV-02.9`).
**Who edits it** — the owner edits English text and facts in the GitHub web editor, a translator edits
`content/zh/**`, the developer reviews every content PR: `09-deployment-operations.md` §4 (`D-09.10`,
`D-09.12`), guide at `content/README.md`. Scale: **243 keys**, **33** of them already carrying prototype
Chinese (`10` §3); translation covers the ≈ **165** remaining copy keys plus the production-only keys
(`OQ-10.4`, `10` PR-8.1).

### 2 · The stack

Decided in `01-stack-decisions.md`, with alternatives and dissent per row; versions per memo ADJ-1, pinned at PR-2.4.

| Concern | Choice | Why | Decision |
|---|---|---|---|
| Framework / language | Next.js **16.x** App Router (`proxy.ts`, Turbopack, no `next lint`), TypeScript `strict`, React **19.2** | Server-rendered per-locale URLs, a form backend and a bespoke animation layer in one framework; the owner's previous site was React | ADR-001 · `D-01.1` |
| Package manager / runtime | pnpm, **Node 24** (Active LTS), `engines.node: "24.x"` | Vercel's default runtime | ADR-001 · `D-01.1` |
| Styling | Tailwind CSS v4, tokens in `@theme`; CSS Modules for bespoke keyframes | The design hands over a token vocabulary, not a component kit; no runtime CSS-in-JS | ADR-004 · `D-01.4` |
| i18n | next-intl 4.x — `[locale]` segment, `localePrefix: 'always'`, JSON messages, typed keys | JSON files are the deliverable; locale in the URL keeps pages indexable and links shareable | ADR-002 · `D-01.2` · ADR-008 · `D-01.8` |
| Content | Versioned JSON in `content/**`, Zod-validated, CMS-ready | The owner edits text in a pull request; a CMS can be added later without moving a key | ADR-003 · `D-01.3` |
| Animation | Motion (`motion/react`) for in-page motion; React `<ViewTransition>` + `<Link transitionTypes>` for the subpage slide; no GSAP at launch | One reveal primitive with variants covers every entrance; GSAP waits for a scroll-scrub need | ADR-005 · `D-01.5` · ADR-009 · `D-01.9` |
| Forms | Route Handler + Zod ≥ 4 + Resend + Turnstile + honeypot + a Vercel WAF rate-limit rule | One inquiry form, emailed to the daycare; no database, no third-party form host | ADR-006 · `D-01.6` · `D-07.7` |
| Hosting | Vercel — preview per PR, production from `main`; the locale proxy runs as a Function, never a static export | Static export cannot negotiate a locale | ADR-007 · `D-01.7` |
| Testing / quality | Vitest + RTL, Playwright per locale, ESLint (`react/jsx-no-literals`), Stylelint, `pnpm validate:content`, GitHub Actions | Literal copy in JSX and locale drift are this site's two real failure modes | `D-08.2` · `D-08.3` · `08` |
| Analytics | Vercel Web Analytics + Speed Insights, cookieless, no consent banner | Launch default; the owner may override with GA4 or Plausible | `D-07.9` · ADJ-10 · `OQ-01.1` |

### 3 · The phases and the roadmap

Eight phases, from `10-work-breakdown.md` (`D-10.1`). **Numbering starts at 1 because this plan is Phase 1** —
the existing bead `gp-dln.4` is titled "Phase 1 gate" — so implementation runs Phases 2–8 (`D-10.1`). A gate
is a *merge* barrier: work may branch early, but no PR of phase *n* lands before the phase *n−1* gate closes
(`D-10.2`, `INV-10.1`). Weeks are **relative to the day `gp-dln.4` closes**, never calendar dates (`OQ-10.2`
would fix one), and assume **two implementers** with gate reviews inside two business days — `A-10.1`,
confirmed by `OQ-10.1`; at one implementer the stack stretches to ≈ 24 weeks (`10` §11).

| # | Weeks | Phase · goal | Exit gate · milestone | Human inputs it needs |
|---|---|---|---|---|
| 1 | — | **Technical plan** — `docs/technical/00`–`12` accepted as the plan of record | `gp-dln.4` · Phase 1 gate · human sign-off | Read and accept the plan; §4 |
| 2 | 1 | **Foundation** — repo scaffolded (Next 16 / TS / pnpm / Tailwind v4 / next-intl / Motion), tooling and CI gates, tracker snapshot and `bead-trailer`, governance files, first Vercel preview | Phase 2 gate · CI + trailer gate required on `main`, preview deploys | `OQ-11.3` repo settings · `OQ-09.1` Vercel plan and billing · `OQ-09.3` preview protection · `OQ-08.3` CI minutes · `OQ-11.1` Dolt push |
| 3 | 2–3 | **Content & i18n infrastructure** — `content/` tree (all `en` keys, `site.json`, schemas), i18n runtime, proxy, `validate:content` + coverage report, the 33 prototype `zh` strings | Phase 3 gate · content contract live: `/en` and `/zh` render on preview, `INV-02.1`–`INV-02.9` on | `OQ-02.1` zh-Hans vs Hant · `OQ-02.4` Chinese brand name · `OQ-02.7` subpage set · `OQ-06.5` cookie · `OQ-09.4` approver · `OQ-10.4` translation · `OQ-02.2` fallback (decided — override only) |
| 4 | 4–5 | **Design system & motion primitives** — tokens, fonts and the CJK stack, layout shell, sticky nav + hamburger + locale switcher, footer, `Reveal`/variants/`WordSwap`/`CountUp`, the View Transitions spike, hero as the vertical slice | Phase 4 gate · **M1** skeleton on preview: both locales, nav + hero + footer, cascade, reveals | `OQ-03.2` AA palette · `OQ-03.4` CJK typeface · `OQ-03.1` tablet · `OQ-03.5` icons · `OQ-03.6` vector logo · `OQ-04.1/04.4/04.6/04.7` · `OQ-05.3/05.4/05.6/05.8` · `OQ-06.6` |
| 5 | 6–8 | **Homepage** — the remaining seven sections in both views, plus the inquiry-form lane (schema, handler, `InquiryForm`) | Phase 5 gate · **M2** homepage hi-fi complete; the form submits on preview | `OQ-07.10` option sets (decided — override only) · `OQ-07.1`/`OQ-02.5` e-mail language · `OQ-07.8` address · `OQ-02.6` zh testimonials · `OQ-04.3` · `OQ-08.1`/`OQ-08.6` · `OQ-10.3` photography |
| 6 | 9–10 | **Subpages, transitions & SEO** — six routes plus the catch-all, the slide and Back, per-locale metadata, `hreflang`, sitemap, robots, JSON-LD, 404, security headers | Phase 6 gate · **M3** subpages + SEO | `gp-dln.6` subpage set (hard here) · `OQ-04.5`/`OQ-06.1` FAQ + Enrollment · `OQ-07.5`/`OQ-06.4` privacy · `OQ-04.2` lightbox · `OQ-06.7` share image · `OQ-06.2`/`OQ-09.2` domain · `gp-dln.13` for the JSON-LD |
| 7 | 10–11 | **Integrations** (overlaps 6) — Resend domain and inbox, Turnstile production keys, Vercel env scopes and the WAF rule, analytics | Phase 7 gate · **M4** inquiry form live in production | `OQ-07.6` sending domain + inbox (no default) · `OQ-07.4` retention · `OQ-01.1`/`OQ-07.9` analytics · `OQ-09.1`/`OQ-09.2` accounts |
| 8 | 11–13 | **Hardening, content completion & launch** — `zh` complete, owner facts and photography in, a11y / performance / visual-regression gates, `validate:content --release`, launch checklist | Phase 8 gate · **M5** launch (DNS cutover approved) | `gp-dln.13` all facts final · `gp-dln.12` · `OQ-07.7` Yelp · `OQ-10.3` photos · `OQ-10.4` translation · `OQ-06.3`/`OQ-09.8` · `OQ-08.2` · `OQ-09.6` · `OQ-09.7` · `OQ-10.2` |

Size (`10` §Summary, `D-10.8`): **≈ 53 PRs**, **≈ 114 implementer-days**, **≈ 12–13 weeks** at `A-10.1`; one
gate review per phase. **Critical path**, PR by PR in `10` §10: `gp-dln.4` → scaffold → i18n runtime, `en`
content and validator → tokens → shell and motion core → nav → hero → the seven sections (Visit last, fed by
the forms lane) → subpage shell (needs the View Transitions spike) → routes → routes e2e → integrations
(owner-paced) → translation and `--release` → launch. Everything else runs beside it in `10` §10's parallel
lanes — content, forms, tokens/motion, quality, ops, tracker — on disjoint file sets. Post-launch work (FAQ
and Enrollment, a CMS UI, GSAP, Yelp Fusion, a CRM, `zh-Hant`) is a gateless backlog epic (`10` §9).

### 4 · What the human must decide or supply before work starts

Items 1–2 block Phase 2 from closing; the rest are needed at the phase named in §3's last column. The full
register, with the default the plan proceeds under if a question is never answered, is `12-open-questions.md`;
its §6 lists the six whose default cannot ship and therefore stop a gate.

| # | Decide or supply | Ids |
|---|---|---|
| 1 | **Close `gp-dln.4`** — accept these documents as the plan of record. Everything waits on it | — |
| 2 | **Repo settings** (*no default*): branch protection with `bead-trailer` required on `main`, squash-only merges, "PR title and description" as the squash message source | `OQ-11.3` |
| 3 | **Money and accounts**: Vercel plan, billing and budget; preview protection; the domain and registrar; the sending domain and inbox for inquiries (*no default* — the form cannot go live without it) | `OQ-09.1` (supersedes the plan half of `OQ-01.4`) · `OQ-09.3` · `OQ-09.2` · `OQ-07.6` |
| 4 | **Three filed beads**: the subpage set — eight inner pages in the design README against six in the prototypes, and whether "Staff" is "Team"; the Chinese brand name — 优朵幼儿园 against 绿茵园; the owner facts the design never carries — address, phone, inbox, Yelp URL, license number, teacher names (`TODO` allowed until Phase 8, when `validate:content --release` rejects them) | `gp-dln.6` = `OQ-02.7` · `gp-dln.12` = `OQ-02.4` · `gp-dln.13` = `OQ-06.9` |
| 5 | **How the site reads**: Simplified or Traditional Chinese, and the CJK typeface the design names nowhere | `OQ-02.1` · `OQ-03.4` / `OQ-01.2` |
| 6 | **Deliveries with lead time**: photography, and a translator for the ≈ 165 remaining copy keys plus the production-only keys | `OQ-10.3` · `OQ-10.4` |

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
| `12-open-questions.md` | The single roll-up of every open question and assumption in the set, who answers each, what it blocks, and the default if it is never answered. |

**Building the site, from cold** — `00` (this file) → `01` (why the stack is what it is) → `02` (the contract
everything else obeys) → `10` (what happens when) → then the owning document for whatever you are about to
build: `03` → `04` → `05` → `06` → `07`, with `08` and `09` before your first PR and `11` before your first
branch. Finish with `12` so you know which of your inputs are still assumptions.

**Only editing the words** — §1 of this file → `09` §4, the workflow written for you → `content/README.md` in
the repository once PR-3.8 ships → `02` *Directory layout* and *Key naming* if you need to add a key rather
than change one → the human-owned table in `12` for the facts still needed from you. You never need `01`,
`03`–`08`, `10` or `11`.

**Deciding the Phase 1 gate** — `00` §2–§4 → `12` §1, the human-owned register ordered by the phase that
blocks on it → `10` §11 for the roadmap and what it assumes about your availability.

### 6 · Invariants

- **INV-00.1** Every number, phase name, gate title, milestone and stack line in this document carries the id
  of the document that owns it. A claim here without a citation is a defect in this file, not a decision.
- **INV-00.2** When an owning document changes a phase, gate, milestone, stack row or open question, the
  matching row here is updated in the same PR (the rule `INV-10.5` sets for `10`'s plan rows).
- **INV-00.3** The thirteen file names in §5 are fixed; renaming one is a breaking change to every
  cross-reference in the set.

## Open questions

- **OQ-00.1** · answerer: human (Hanyi), at the Phase 1 gate `gp-dln.4` — Is this document set accepted as the
  plan of record, and is anything in the phase order or launch scope to be re-cut before Phase 2 opens?
  Default if unanswered: nothing starts; `gp-dln.4` holds every later phase (`INV-10.1`).
- **OQ-00.2** · answerer: human (Hanyi); PR-2.2 implements — The repository root `README.md` is stale
  Create-React-App boilerplate and PR-2.2 replaces it with a pointer to this file. Does the owner also want a
  public-facing project README (what the site is, how to run it), or is a pointer enough? Default: a pointer.
- **OQ-00.3** · answerer: human (Hanyi) with `11` — Should the document set be tagged (`plan-v1`) when
  `gp-dln.4` closes, so later amendments are diffable against what was signed off? Default: no tag;
  amendments land as ordinary PRs against `main` and the bead trailer is the audit trail (`11` §5).

## Cross-references

- Design handoff: `docs/design/README.md` (shared system, section inventory, motion, interactions),
  `docs/design/desktop/README.md`, `docs/design/mobile/README.md`, and the `.dc.html` hi-fi references.
- Plan: `docs/technical/01-stack-decisions.md` (ADR-001…009, `D-01.1`…`D-01.9`);
  `docs/technical/02-i18n-content-contract.md` (`D-02.1`…`D-02.17`, `INV-02.1`…`INV-02.9`);
  `docs/technical/03-design-system-tokens.md`; `docs/technical/04-components-sections.md`;
  `docs/technical/05-animation-system.md`; `docs/technical/06-routing-pages-seo.md`;
  `docs/technical/07-forms-integrations.md` (`D-07.7`, `D-07.9`);
  `docs/technical/08-testing-quality.md` (`D-08.2`, `D-08.3`); `docs/technical/09-deployment-operations.md`
  (§4, `D-09.10`, `D-09.12`); `docs/technical/10-work-breakdown.md` (`D-10.1`, `D-10.2`, `D-10.8`,
  `INV-10.1`, `INV-10.5`, §3, §9, §10, §11, §14); `docs/technical/11-work-tracking.md` (`OQ-11.3`,
  `OQ-11.4`, §5); `docs/technical/12-open-questions.md` — the full register of what is still open.
- Beads: `gp-dln.4` (Phase 1 gate), `gp-dln.6` (subpage set), `gp-dln.12` (Chinese brand name),
  `gp-dln.13` (owner-supplied facts).
