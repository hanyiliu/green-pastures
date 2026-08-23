# 12 · Open questions & assumptions

## Purpose

This is the single register of everything the plan has not settled: every `OQ-` identifier declared in
`01`–`11`, both local assumption families (`A-07.n`, `A-10.n`), who answers each one, which document
implements the answer, what is blocked until it arrives, and — the column that matters most — what the plan
ships if it is never answered. It exists so the human can read one page instead of eleven, and so that silence
is a decision with a known outcome rather than a stall. It answers nothing itself: an answer lands in the
document that owns the question, and this register is updated in the same pull request.

Status: draft · seat writer-index · 2026-08-22

## Decisions

- **D-12.1 A register, not an owner.** Every row belongs to the document that declared it. 12 never invents a
  question, never renumbers one, and never records an answer that the owning document has not adopted.
- **D-12.2 Every row carries a default.** The plan proceeds under the default when a question goes
  unanswered. A row whose default cannot ship — none at all, or one a release gate rejects — is a hard
  blocker and is repeated in §6; there are six.
- **D-12.3 Two classes.** §1 holds the questions only the owner or the human can answer — facts about the
  business, money, accounts, taste and scope. §2 holds the ones the build answers for itself — spikes,
  version confirmations, and requests one seat owes another. Every §2 question is owned by a named seat, so
  none of them holds a phase waiting on the human to sit down and decide; `OQ-08.1` is the one that also wants
  the design owner's eye, and the seat proposes there while the owner confirms in review.
- **D-12.4 §1 is ordered by the phase that blocks on it,** using `10` §14's phase column, so the human works
  top-down and answers nothing earlier than the build needs it.
- **D-12.5 Alias rows.** Where two documents ask the same question from different angles, they share one row
  and the row names every identifier it closes (for example `OQ-01.1` and `OQ-07.9` are one analytics
  decision). One answer closes every id on the row.
- **D-12.6 Closed questions are moved, never deleted.** §5 keeps them visible so nobody re-opens a settled
  question; each entry names the decision that closed it.

## Design

### 1 · Human-owned questions, ordered by the phase that blocks

66 identifiers on 56 rows. "Answer lands in" is the document whose text changes when the answer arrives.

| Phase | Id(s) | Question | Answerer | Answer lands in | Blocked until answered | If never answered |
|---|---|---|---|---|---|---|
| 2 | `OQ-11.3` | Repo settings: branch protection with `bead-trailer` required on `main`, squash-only merges, "PR title and description" as the squash message | human | `09`, `11` | the Phase 2 gate itself | **none** — the gate cannot close |
| 2 | `OQ-09.1` | Vercel plan (Pro assumed; Hobby is non-commercial), who holds billing, how many paid seats, monthly budget cap | human (owner) | `09` (`D-09.20`) | OPS-2.1, the Vercel project | Pro, one paid seat, budget per `D-09.20` |
| 2 | `OQ-01.4` | Monthly budget for Vercel + Resend + domain (the plan half is answered by `OQ-09.1`) | human | `01`, `09` | OPS-2.1, OPS-7.3 | plan from `OQ-09.1`; the budget stays with the owner |
| 2 | `OQ-09.3` | Deployment Protection on previews — reviewers sign in to Vercel rather than opening public links | human (owner) | `09` (`D-09.4`) | OPS-2.1 | previews private; reviewers get a free Viewer seat |
| 2 | `OQ-08.3` | Is the repo private (2,000 free CI minutes), and is ≈ 30 runner-minutes per PR acceptable? | human | `08` | PR-2.6 | `webkit-mobile` stays on PRs; it moves to `main`-only if minutes bite |
| 2 | `OQ-11.1` | May the orchestrator `bd dolt push` to `origin`, and on whose credentials? | human | `11` (`D-11.6`) | PR-2.1 | export-only; no Dolt push |
| 2 | `OQ-10.1` | Capacity: how many implementers or agent seats run in parallel, and what gate-review turnaround can the human commit to? | human | `10` §11 | the roadmap's scale (never its order) | two implementers, ≤ 2 business days (`A-10.1`) |
| 3 | `OQ-02.1` | Simplified (`zh-Hans`), Traditional (`zh-Hant`), or both? | human | `02` (`D-02.1`), `03` `--font-cjk` | PR-3.5, the CJK stack | Simplified only; `zh-Hant` would follow the add-a-locale checklist |
| 3 | `OQ-02.4` · `gp-dln.12` | Chinese brand name: the footer says 优朵幼儿园, the prototype's `zh` table says 绿茵园 — which is real, and does the English copyright keep both? | human | `02`, `content/site.json` | PR-3.2; final at PR-8.1 | **none that ships** — it stays `TODO`, `validate:content --release` rejects it at Phase 8 and launch cannot proceed (§6) |
| 3 | `OQ-02.7` · `gp-dln.6` | Subpage set: `docs/design/README.md` lists eight inner pages, the interactions and both prototypes define six. Is "Staff" = Team, and are FAQ / Enrollment in scope at launch? | human | `02` (`D-02.17`), `04`, `06`, `10` | PR-3.2 namespaces; hard at PR-6.1 | six routes; FAQ and Enrollment reserved, not built |
| 3 | `OQ-02.2` | **Decided** (`D-02.8`), open only as an override: production deep-merges over `en` and logs. Overrule only to make a missing `zh` key fail the build with no fallback | human (may overrule) | `02` | PR-3.4 | `D-02.8` stands — see §5 |
| 3 | `OQ-06.5` | `NEXT_LOCALE` cookie lifetime: one year, or session? (Root-path detection is already settled *on*.) | human | `06` | PR-3.1 | one year; detection on `/` stays on (`D-02.9`) |
| 3 | `OQ-09.4` | Who approves and merges content PRs: owner and developer as co-owners, or owner-only after launch? | human (owner) | `09` §4.11 (`D-09.10`) | PR-3.8, the editor guide | co-owners; the translator's PRs are reviewed by the owner |
| 3 | `OQ-10.4` | Translation resource and timing for the ≈ 165 remaining copy keys plus the production-only keys, and confirmation of warn-mode `zh` parity until PR-8.1 | human | `10` (`D-10.6`), `02` | PR-3.4's locale policy | warn mode until PR-8.1; a strict answer puts translation on the critical path and extends the roadmap |
| 4 | `OQ-03.4` · `OQ-01.2` · `OQ-04.9` | CJK typeface for `zh` — the design names none: system CJK stack, or self-hosted Noto Sans SC (`preload: false`, `zh` only)? | human (Hanyi) | `03` (`D-03.5`, `--font-cjk`) | PR-4.1; deadline is the 04 typography PR | the system CJK stack ships; the question stays open for a post-launch review with per-OS screenshots |
| 4 | `OQ-03.2` | Which of `03` §10's AA contrast replacements are approved? Grouped in `03` §10 as (a) body and muted inks, (b) eyebrow/link/subhead darkening, (c) primary-button fill, (d) day-chip ink, (e) footer copyright, (f) input border | design owner (with `04`) | `03` §10 | PR-4.1; blocking at PR-8.4 | ship the design values; `03` §10 stays the known-failure list |
| 4 | `OQ-03.1` | Is the intermediate 768–1023px rendering (desktop type, mobile structure) acceptable, or is a tablet spec wanted? | design owner | `03`, `04` | PR-4.2 | no tablet spec |
| 4 | `OQ-03.5` | Keep emoji icons, or move to an icon set (which would need a fill token per section)? | design owner | `03` (`D-03.8`), `04` `Emoji` | PR-4.2 | emoji stay |
| 4 | `OQ-03.6` | Supply a vector (SVG/PDF) logo master | client | `03`, `public/brand/` | PR-4.1 | the 373×161 PNG ships; no crisp rendering above ≈ 186px and no recolouring |
| 4 | `OQ-04.1` | Hamburger sheet: approve `D-04.8`'s full-screen cream sheet, or supply a design | design owner | `04` | PR-4.5 | `D-04.8` ships |
| 4 | `OQ-04.6` | Mobile footer: the prototype omits "Contact" — render it on both views? | design owner | `04` | PR-4.5 | `site.nav.footer[]` (six links + Contact) renders on both views |
| 4 | `OQ-04.7` | Nav row switches at `lg` rather than `md` — confirm, or supply a compact 768–1023 nav | design owner | `04` (`D-04.9`) | PR-4.5 | the switch stays at `lg` |
| 4 | `OQ-04.4` | Photo placeholders until photography lands: `PhotoSlot` colour fill, or temporary stock imagery? | human | `04` (`D-04.12`) | PR-4.6 | `PhotoSlot`; no stock imagery |
| 4 | `OQ-05.3` | Three prototype gaps: `gpdevelop` is defined but unused; the day-chip sample line has no specified animation; the hamburger sheet has no specified motion | design / owner | `05`, `04` | PR-4.5, PR-5.3 | defaults ship — `fade`+`rise` sheet, `WordSwap` on the sample line, `gpdevelop` dropped |
| 4 | `OQ-05.4` | Sign off two conscious deviations from the prototype: the locale cascade runs per text block and enter-only; the sticky nav stays anchored while the subpage slides | design / owner | `05` | Phase 4 gate | both ship as decided (memo ADJ-4) |
| 4 | `OQ-05.6` | Mobile rise distance: 18px chosen from the design's 16–20px range | design / owner | `03` §7, `05` | PR-4.3a | `--reveal-rise-sm: 18px` |
| 4 | `OQ-05.8` | The hero photo is `opaque` (transform-only rise, never at opacity 0) to protect LCP — acceptable, or take the LCP cost of a full fade? | `09` · owner | `05`, `04` | PR-4.6 | stays `opaque` |
| 4 | `OQ-06.6` | Active-section highlight in the sticky nav? Not in the design | design owner | `06` | PR-4.5 | off at launch |
| 5 | `OQ-07.10` · `OQ-04.10` | **Decided** (`D-07.2` + `02`'s canonical five ids; child's age = `infant`/`toddler`/`preschool`/`expecting`/`other`, desired start = next 12 months + `asap` + `flexible`), open only as the owner's right to trim or relabel | owner | `07` (`D-07.2`), `02`, `04` | PR-5.8 | the canonical sets ship — see §5; a later trim is JSON + enum only |
| 5 | `OQ-07.1` · `OQ-02.5` | Language of the staff notification e-mail, and whether parents receive an auto-reply | owner | `07` (`D-07.6`), `02` `email.*` | PR-5.8 | staff mail in `en` with a preferred-language line |
| 5 | `OQ-07.2` | Enable the parent auto-acknowledgement at launch? | owner | `07` | PR-7.2 | off |
| 5 | `OQ-07.8` · `gp-dln.13` | Publish the street address and a Maps link? The design shows only "Fremont, California" | owner | `07`, `06` JSON-LD | PR-5.7, PR-6.8 | locality + region only; the JSON-LD emits no street address |
| 5 | `OQ-02.6` | Testimonials in `zh`: translated quotes, or the original English quotes with a `zh` attribution line? | human | `02`, `content/zh/collections` | PR-8.1 | translated quotes; an attribution-only answer is a content edit, not a code change |
| 5 | `OQ-04.3` | Confirm dropping `gpdevelop`, the photo "develop" filter that no reference uses | design owner | `04`, `05` | PR-5.4 | dropped; no component is built for it |
| 5 | `OQ-08.6` | By which phase gate does each `axe-exceptions.json` entry expire? (The approvals themselves are `OQ-03.2`; one answer settles both) | design owner | `08` §6 (`D-08.8`) | the Phase 5 gate | `color-contrast` reports but does not block until `OQ-03.2` lands |
| 5 | `OQ-10.3` | Photography delivery: hero, classroom, three rooms, 5–7 gallery frames, Ms. Ping, map/building | owner via human | `04` `PhotoSlot`, `08` LCP budget | Phase 5 gate for LCP tuning; at the latest PR-8.3 | `PhotoSlot` stands in and LCP tuning repeats in Phase 8 |
| 6 | `OQ-06.2` · `OQ-09.2` | Production domain, registrar, DNS host, who holds the registrar login; apex or `www` as the canonical host | human (owner) | `06` `metadataBase`, `09` §5 (`D-09.5`) | PR-6.8, OPS-8.1, the DNS cutover | host form defaults to apex canonical with `www` → apex 308; **the domain itself has no default** |
| 6 | `OQ-04.5` · `OQ-06.1` · `gp-dln.6` | FAQ and Enrollment pages at launch; if Enrollment ships, is the route `/enroll` or `/contact`? | human | `04`, `06`, `02` namespaces | PR-6.1 | not at launch; `faq` and `visit` namespaces stay reserved and the home `#visit` section is the contact surface |
| 6 | `OQ-07.5` · `OQ-06.4` | Is a privacy-policy page required (assumption `A-07.3`, CalOPPA)? If yes: route, strings, footer link | owner with counsel | `06` `/privacy`, `02` strings | PR-6.9 | no privacy route ships; PR-6.9 stays blocked and is dropped at the gate |
| 6 | `OQ-04.2` | Gallery lightbox at launch, and client-side versus URL-backed filters | human | `04` (`D-04.7`) | PR-6.5 | native `<dialog>` lightbox, client-side filters |
| 6 | `OQ-06.7` | Social share image artwork, 1200×630 | design owner / human | `06` `images.og` | PR-6.8 | a logo-on-cream placeholder is generated once and committed |
| 6 | `OQ-06.9` · `gp-dln.13` | JSON-LD owner facts for the `ChildCare` object: telephone, e-mail, street address (or an explicit locality-only decision), the real Yelp URL and other `sameAs` profiles, and confirmation that Mon–Fri 07:30–18:00 is current | human (owner) | `06` §6.6, `02` `content/site.json` | PR-6.8; hard at Phase 8 | the object ships with `TODO` values and `--release` fails at Phase 8; `geo`, `priceRange` and ratings stay absent either way |
| 7 | `OQ-07.6` | Sending domain for `INQUIRY_FROM_EMAIL` and the inbox(es) that receive inquiries — needed for Resend domain verification and DNS | owner / `09` | `07` §5, `09` DNS | OPS-7.1, the Phase 7 gate | **none** — the form cannot go live |
| 7 | `OQ-01.1` · `OQ-07.9` | Analytics provider: keep Vercel Web Analytics + Speed Insights, or override with Plausible or GA4 (GA4 implies a consent banner in both locales) | human (owner) | `09` wires it; `07` (`D-07.9`) | PR-7.1 | the cookieless Vercel default, no consent UI (memo ADJ-10) |
| 7 | `OQ-07.4` | Resend message-content retention and account ownership; retention policy for inquiry e-mail in the inbox | `09` + owner | `09` §5.1 | OPS-7.1 | Resend's default retention, reviewed at `09` §5.1 item 6 |
| 8 | `OQ-07.7` · `gp-dln.13` | Real Yelp page URL and the figures behind the `5.0` / `47` placeholders; hand-edited, or Yelp Fusion with ISR? | owner | `02` `site.json`, `07` §6 | PR-8.2, the launch gate | **none that ships** — the values stay `TODO`, `--release` fails and launch cannot proceed |
| 8 | `OQ-08.2` | Lighthouse thresholds and resource budgets, after the first calibration run with real photography | human with `09` | `08` §7, `lighthouserc.cjs` | PR-8.5 | `08` §7's plan thresholds are enforced as written |
| 8 | `OQ-06.3` · `OQ-09.8` | Was the previous CRA site ever live at this domain with indexed URLs beyond `/`? | human (owner) | `06` §6.9, `next.config.ts` `redirects()` | PR-8.7 | "none beyond `/`"; no legacy redirect map ships |
| 8 | `OQ-09.6` | Menu: a rotating sample week refreshed on rotation changes, or a real weekly menu edited every Friday (one 15-cell PR per week)? | human (owner) | `09` (`D-09.13`), `02` `menu` | PR-8.2 | rotating sample week |
| 8 | `OQ-09.7` | Error monitoring beyond Vercel's one-day logs: a log drain with alerting, Sentry for the client, or neither until the first incident? | human (owner) with the developer | `09` §5 (`D-09.15`) | OPS-8.2 | Vercel logs plus the uptime check only; no drain, no Sentry |
| 8 | `OQ-10.2` | Target launch window or hard date (enrolment season, marketing) | human | `10` §11 | the Phase 8 gate | the roadmap stays relative; no fixed date and nothing is cut |
| post | `OQ-01.5` | Which post-launch animation request first trips ADR-009's GSAP trigger (pinning, labelled scrub, horizontal scroll), if any? | human with `05` | `01`, as a new ADR | — | no GSAP; the trigger is unfired |
| post | `OQ-02.3` · `OQ-09.9` | Do editors need an in-browser preview or CMS beyond the Vercel preview per PR? | human (owner) | `09` (`D-09.14`) → ADR-010 in `01` | — | the preview per PR is the editor tool; a CMS needs ADR-010, which evaluates Keystatic first |
| post | `OQ-07.3` | Which CRM, if any, should receive inquiries later (HubSpot, a Google Sheet, a daycare tool)? | owner | `07` (`D-07.8`) | — | no CRM; the inbox is the record |
| post | `OQ-08.7` | Should `pnpm audit` high/critical block PRs after launch? | human | `08` | — | advisory only, with a weekly Renovate cadence (`D-09.17`) |
| post | `OQ-11.2` | Is `bd` the long-term tracker once the site ships, or only for the build? | human | `11` | — | `bd` continues; `issues.jsonl` is the archive either way |

### 2 · Questions the build answers for itself

12 identifiers on 11 rows. Each has a named seat and a phase, and none holds a phase waiting on the human
(`D-12.3`); `OQ-08.1` is the single row whose seat confirms its answer with the design owner in review.

| Phase | Id(s) | Question | Answered by | Answer lands in | Blocked until answered | If unresolved |
|---|---|---|---|---|---|---|
| 2 | `OQ-01.3` · `OQ-05.1` | Confirm that React `<ViewTransition>` and `<Link transitionTypes>` exist and behave as documented at the pinned Next.js version (≥ 16.2) with React 19.2 | the scaffold PR, verified by `check-stack` | `01` (ADR-005 amendment if it fails) | PR-2.4, then the PR-4.4 spike | the subpage slide falls back to an instant swap and `05` §5.7's F1 becomes the decision |
| 2 | `OQ-08.5` | Do `eslint-plugin-react` ≥ 7.37 with flat config, `next typegen` before `tsc`, and the esquery literal selectors all work as documented? | the scaffold PR implementer | `08` §2 | PR-2.5 | a 20-line local ESLint rule replaces whichever plugin fails; the gates do not change |
| 2 | `OQ-08.8` | Apply the one-line wording fix to `INV-02.1` (`restrictedAttributes`, an enumerated allowlist) | `02` (writer-contracts) | `02` `INV-02.1` | PR-2.5 | `INV-02.1` ships as written; the fix is a later docs PR |
| 2 | `OQ-09.5` | Create the two standing human-assigned beads ("content edits", "dependency updates"), export them to `.beads/issues.jsonl` on `main`, and decide whether content-only PRs may satisfy the trailer gate by the PR body alone | orchestrator (`11`) | `09` (`D-09.11`, `D-09.17`), `11` §6 | PR-2.3, PR-2.9, the first editor or Renovate PR | the beads are created at kickoff and editors paste the trailer into every commit |
| 2 | `OQ-11.4` | Will the repo get a `CLAUDE.md`? | orchestrator → the `00-README` owner (`gp-dln.3`) | `00` (`D-00.4`), PR-2.2 | PR-2.2 | **answered:** `D-00.4` — a thin pointer `CLAUDE.md` lands in PR-2.2; `00` and `11` stay the conventions of record |
| 3 | `OQ-03.3` | Is `zh` Simplified only? The `--font-cjk` stack is SC-first; a Traditional locale needs a TC-first stack | orchestrator / `02` | `03` §5 | PR-4.1 | SC-first stack; this resolves the moment `OQ-02.1` is answered |
| 3 | `OQ-06.8` | Accept `06` §6.12's requests: `brand.url`, `LOCALE_META`'s `ogLocale` and `dir`, `common.meta.ogImageAlt` on the client namespace list, and scoping the unknown-locale 404 sentence to matcher-excluded paths. The `errors` client namespace is no longer asked for — `D-02.16` already lists it | `02` (writer-contracts) | `02` | PR-3.2 | `06` §6.12's requests are folded in as written |
| 3 | `OQ-09.10` | Drop `content/site.json` → `brand.url` in favour of `NEXT_PUBLIC_SITE_URL`, or keep it as the human-edited value `06` reads — and what `metadataBase`, the sitemap and robots use on a Preview deployment, where that variable is unset | `02`'s seat, on `06`'s requirement (`D-06.11`) | `02`, `06` | PR-3.2, PR-6.8 | both exist and `--release` checks `brand.url` for `"TODO"`; preview metadata behaviour stays unspecified until answered |
| 4 | `OQ-05.2` | The View Transitions spike, (a)–(f): typed navigations, z-order of `.gp-page` during `subpage-exit`, Safari behaviour, snapshot size on a tall mobile page, whether Next already focuses the new page, and whether next-intl's `Link`/`useRouter` pass `transitionTypes` through | the 04 implementer, spike PR-4.4 | `05` §5.7, `04` | PR-4.4, then PR-6.1 | the spike answers itself; a "no" on any of (a)–(f) selects F1 and `01` records the ADR-005 amendment in the same PR |
| 4 | `OQ-08.9` | Reword `03` §5 to point at `MC-08.1`, the named manual per-OS glyph check — `08` cannot pin per-OS screenshot baselines | `03` (writer-design-system) | `03` §5 | the Phase 4 docs pass | `03` §5 keeps pointing at a per-OS snapshot that does not exist; `MC-08.1` still runs |
| 5 | `OQ-08.1` | Visual-regression tolerance (`maxDiffPixelRatio 0.01`, `threshold 0.2`) and chromium-only scope, or widen to webkit for an iOS-heavy audience at ≈ 2× CI time | the 04 implementer with the design owner | `08` §6 | PR-8.6 | chromium only, at the stated tolerances |

### 3 · The three filed beads

Three questions are also tracker beads, because they need the human and they block more than one document.

- **`gp-dln.6`** — *Subpage set*: the design README lists eight inner pages (including Staff, FAQ, Enrollment)
  while the interactions section and both prototypes define six (Philosophy, Programs, Menu, Gallery, Reviews,
  Team). Is "Staff" the same page as "Team", and are FAQ and Enrollment in scope at launch? Carries
  `OQ-02.7`, `OQ-04.5` and `OQ-06.1`. Blocks `04`, `06` and `10`; soft at PR-3.2 (namespaces), hard at PR-6.1.
- **`gp-dln.12`** — *Chinese brand name*: the footer says 优朵幼儿园, the prototype's `zh` table says 绿茵园.
  Carries `OQ-02.4`. The value lives in `content/site.json`, so both locales need the canonical form; until it
  is real the field is `"TODO"` and `validate:content --release` fails at Phase 8.
- **`gp-dln.13`** — *Owner-supplied facts missing from the design*: address, phone, e-mail inbox, Yelp URL,
  license number, real teacher names and credentials. Carries `OQ-06.9` and feeds `OQ-06.2` (the domain the
  contact facts publish under), `OQ-07.6`, `OQ-07.7` and `OQ-07.8`. Modelled as required shared-config
  fields; `TODO` values are allowed until Phase 8, when `--release` rejects them.

Two related beads: `gp-dln.4` is the *Phase 1 gate* — nothing in this register is acted on before the human
closes it — and `gp-dln.9` (the mobile footer's licence-number line) is answered and can be closed; see §5.

### 4 · Assumptions carried

These are not questions; they are claims the plan relies on and would have to revisit if falsified. `A-07.n`
and `A-10.n` are local identifier families of their own documents.

| Id | Assumption | Owner | Falsified by | Consequence if false |
|---|---|---|---|---|
| `A-07.1` | Cookieless aggregate analytics needs no consent banner for a California site | `07` (pending counsel) | legal advice, or an answer to `OQ-07.9` that selects GA4 | a consent banner in both locales, and the strings for it in `02` |
| `A-07.2` | English is the daycare's working inbox language | `07` | the owner's answer to `OQ-07.1` | staff notifications render in the parent's locale instead |
| `A-07.3` | CalOPPA applies and a privacy policy is required | `07` | counsel, via `OQ-07.5` | if not required, PR-6.9 is dropped; if required, the route, strings and footer link ship |
| `A-07.4` | Resend's `delivered@resend.dev` sink is acceptable for preview deployments | `07` | Resend policy change | previews need a real verified domain earlier than Phase 7 |
| `A-07.5` | Yelp Fusion terms and limits are as summarised in `07` §6 | `07` | Yelp terms change | the Yelp figures stay hand-edited (which is the default anyway, `OQ-07.7`) |
| `A-10.1` | Two implementers, and gate reviews turned around within two business days | `10` | the answer to `OQ-10.1` | the roadmap rescales — ≈ 24 weeks at one implementer — but the order does not change |
| `A-10.2` | The `.dc.html` references remain the acceptance baseline for visual checks until photography lands | `10` | new design work, or `OQ-10.3` arriving early | visual-regression baselines are rebuilt against the real photographs |
| `A-10.3` | The orchestrator creates the phase epics, task beads and gate beads at kickoff | `10` (`D-10.9`) | the human taking over the tracker | gate beads must be created by hand before each phase, or `INV-10.4` cannot hold |

### 5 · Decided, not open — do not re-open

The `OQ-` ids their own documents have retired reach neither §1 nor §2, so their answerers are recorded here:
`OQ-03.7` (answerer `05`, implemented in `03` §7), `OQ-04.8` (withdrawn by `04`, no answerer), `OQ-05.5`
(answerers `02` and `06`, implemented in `D-06.8`), `OQ-05.7` (answerer `03`, implemented in `03` §7),
`OQ-08.4` (answerer `09`, implemented in `D-09.4`), `OQ-10.5` and `OQ-10.6` (answerer `10`, implemented in
`10` §14). Three further rows below stay on the register because something narrower is still open: `OQ-02.2`
and `OQ-07.10` on §1 as live overrides, and `OQ-11.4` on §2 until `11` retires its own entry.

| Was open as | Settled by | The answer |
|---|---|---|
| `OQ-03.7` | `05`, memo ADJ-8 | `--dur-subpage: 500ms` (the reference's `.55s` desktop value is not adopted), and three per-instance leaf durations rather than one duration with `animation-delay` |
| `OQ-04.8` | `04`, no answerer | The `invalid_email` reconciliation was never open — `02`'s error table already carries the `invalid_email` row and maps it to `visit.form.fields.email.errors.invalid`, exactly what `D-04.14` records. The remaining key and field additions and the `WordSwap`-versus-`Reveal` wording are `04` §10 requirements on `02`, tracked there, not open questions |
| `OQ-05.7` | `03` §7, memo ADJ-8 | `03` adopted all 17 of `05` §5.13's token names and values verbatim; `03` owns token names, `05` consumes them |
| `OQ-10.5` | `10` | Account and registrar ownership is asked once, by `OQ-09.1`, `OQ-09.2`, `OQ-07.6` and `OQ-01.4`; `10` does not ask a fifth time |
| `OQ-10.6` | `10` | The legacy-URL list is `OQ-06.3` and `OQ-09.8`, both of which already carry the expected answer |
| `OQ-02.2` (still on §1 as an override) | `D-02.8` | dev shows `⟦namespace.key⟧`, CI fails on any parity problem, production deep-merges over `en` and logs once. The human may overrule; nobody re-asks the design |
| `OQ-07.10` (still on §1 as an override) | `D-07.2`, `02`'s key set, `07` §9 | child's age = `infant`, `toddler`, `preschool`, `expecting`, `other`; desired start = the next 12 months plus `asap` and `flexible`; the Enrollment page reuses the five-field superset |
| `OQ-05.5` | `D-02.10`, `D-02.16`, `D-06.7`, `D-06.8` | Locale switch is a same-path `router.replace`; the Back mapping and client-namespace coverage are fixed |
| `OQ-08.4` | `D-09.4` | Previews stay protected; OPS-2.1 generates the bypass secret `lighthouse-preview` needs |
| `OQ-11.4` (still on §2 until `11` retires it) | `D-00.4` | A thin pointer `CLAUDE.md` lands in PR-2.2; `00-README.md` and `11-work-tracking.md` remain the conventions of record |
| Root-path locale detection | `D-02.9` | Detection on the bare root is **on**; `localePrefix: 'always'` for every other path |
| "Child's age" option set | `D-02.4` rule 8, memo ADJ-9 | The canonical five ids — `infant`, `toddler`, `preschool`, `expecting`, `other`. `OQ-07.10` keeps only the owner's right to trim or relabel |
| Mobile footer licence line (`gp-dln.9`) | `D-02.13` | The licence number renders on **both** views; the mobile prototype's omission is prototype drift |
| Route-transition mechanism | memo ADJ-3, `D-05.10` | React `<ViewTransition>` with `<Link transitionTypes>`; `05` §5.7's F1 is the fallback only if the PR-4.4 spike fails |
| Locale-toggle animation | memo ADJ-4, `D-05.9` | An enter-only per-block cascade via `Reveal variant="swap"`; `WordSwap` is only the menu sample-line and day swap. The per-string crossfade is not portable to URL-based locales |
| Static export | memo ADJ-2, ADR-007 | Never `output: 'export'` — next-intl's proxy does not run under static export |
| Framework and runtime versions | memo ADJ-1, ADR-001 | Next.js 16.x, React 19.2, Node 24; `proxy.ts`, Turbopack, no `next lint` |
| Tailwind duration tokens | memo ADJ-5 | There is no `--duration-*` theme namespace; `--dur-*` are plain custom properties, `--ease-*` is a namespace |
| Motion-token TS mirror | memo ADJ-8 | `src/design/tokens.ts` |
| Namespaces and option sets of record | memo ADJ-9 | `02` is the contract of record; `07` owns the handler's error-code list and `02` defines a message for every code |
| Analytics launch default | memo ADJ-10, `D-07.9` | Vercel Web Analytics + Speed Insights, cookieless. Only the *override* remains open, as `OQ-01.1` / `OQ-07.9` |

### 6 · The six hard blockers

Every other row in §1 has a default the plan can ship under. These six do not — either no default at all, or
one `validate:content --release` rejects — and each stops a specific gate.

| Id(s) | Stops | Why its default cannot ship |
|---|---|---|
| `OQ-11.3` | the Phase 2 gate | branch protection and squash-only are repository settings only the human can make; `bead-trailer` cannot be a required check without them |
| `OQ-09.2` (domain half) | the Phase 8 DNS cutover | apex-versus-`www` has a default; the domain name and registrar login do not |
| `OQ-07.6` | the Phase 7 gate | Resend cannot send from an unverified domain, and nobody receives an inquiry without an inbox |
| `OQ-07.7` | the launch gate | `5.0` / `47` are placeholders; `validate:content --release` rejects `TODO` |
| `OQ-06.9` · `gp-dln.13` | the launch gate | the JSON-LD and the contact surface publish owner facts nobody else can supply |
| `OQ-02.4` · `gp-dln.12` | the launch gate | the Chinese brand name is one canonical string in `content/site.json`; no placeholder is shippable in a footer and `--release` rejects `TODO` |

### 7 · How a question gets closed

1. The human or the named seat answers it.
2. The **owning** document changes: the decision text, and the `OQ-` entry is marked answered with the
   decision that answers it. An answer that lives only here is not an answer (`D-12.1`).
3. This register's row moves to §5 in the same pull request, keeping the id and naming the decision.
4. If the question had a bead (`gp-dln.6`, `gp-dln.12`, `gp-dln.13`), the bead is closed by the human in the
   same pass, per `11`.
5. If the answer changes a phase, a gate or the roadmap, `10`'s affected rows and `00` §2–§4 change in the
   same pull request (`INV-10.5`, `INV-00.2`).

### 8 · Invariants

- **INV-12.1 The register is complete.** The **Id(s) column** of §1 and §2 together contains, exactly once,
  every `OQ-` identifier declared in `01`–`11` that is still on the register; §5 carries the ids their own
  documents have retired, which reach neither §1 nor §2. The two together must reproduce the whole population:
  each document numbers its questions contiguously from `.1`, so that population is the sum of the highest
  id in each — `01` 5 · `02` 7 · `03` 7 · `04` 10 · `05` 8 · `06` 9 · `07` 10 · `08` 9 · `09` 10 ·
  `10` 6 · `11` 4 = **85** as of 2026-08-22 — which makes the total re-derivable from the documents rather
  than trusted here. **How many of the 85 are already decided is deliberately not restated as a number:
  §5 is that list.** It grows every time an owning document closes a question, and a count repeated in this
  invariant would rot silently, since nothing mechanically enforces it. An id is in §5 *and* still on the
  register only while something narrower stays open — the human's right to override a decision already taken
  (`OQ-02.2`, `OQ-07.10`), or an owning document that has recorded the answer without yet retiring its own
  entry. Both assumption families are in §4: `A-07.1`–`A-07.5` and `A-10.1`–`A-10.3`, eight in total.
- **INV-12.2 No question is answered here.** A row may *record* an answer another document adopted; it may
  never be the only place that answer exists.
- **INV-12.3 Every row has a default, or it is in §6.** A row whose default cannot ship — no default at all,
  or a default that fails a release gate — is a hard blocker and appears in §6 with the gate it stops. There
  are six: `OQ-11.3`, `OQ-09.2`, `OQ-07.6` have no default; `OQ-07.7`, `OQ-06.9`, `OQ-02.4` default to `TODO`
  values that `validate:content --release` rejects.
- **INV-12.4 Alias rows name every id they close** (`D-12.5`) in the Id(s) column, so a reader searching any
  single `OQ-` id finds exactly one row. Prose in other columns may cite an id in passing; only the Id(s)
  column registers one.

## Open questions

- **OQ-12.1** · answerer: human (Hanyi), at the Phase 1 gate — Of the 56 human-owned rows in §1, which does
  the human want to answer now, and which are accepted as defaults? The register assumes silence means the
  default everywhere except §6. Default if unanswered: silence is taken as acceptance of every default, and
  the six blockers in §6 are chased individually at their phase.
- **OQ-12.2** · answerer: `10` (writer-breakdown) — **answered.** The question was whether `10` §14 should be
  re-synced or shrink to a pointer at this document. `10` took the default: §14 stays, has been re-synced —
  it now carries `OQ-04.9`, `OQ-04.10`, `OQ-06.9`, `OQ-08.9` and `OQ-09.10`, and `10`'s cross-references
  read `OQ-04.1…10`, `OQ-06.1…9`, `OQ-08.1…9`, `OQ-09.1…10` — and §14 records in writing that this
  document is authoritative wherever the two disagree.
- **OQ-12.3** · answerer: `04` (writer-components) — **answered.** `04` cited a subpage-set identifier in
  02's family that `02` never declares (`02` stops at `OQ-02.7`, which *is* the subpage-set question). All
  four sites now cite `OQ-02.7`, `OQ-04.5` among them. This register never propagated the phantom id.

## Cross-references

- `docs/technical/00-README.md` — §4 lists the short version of §1 for the human; `D-00.4` answers `OQ-11.4`.
- `docs/technical/01-stack-decisions.md` — `OQ-01.1`…`OQ-01.5`; ADR-005 and ADR-009 are amended by
  `OQ-05.2` and `OQ-01.5` respectively.
- `docs/technical/02-i18n-content-contract.md` — `OQ-02.1`…`OQ-02.7`; `D-02.4`, `D-02.8`, `D-02.9`,
  `D-02.10`, `D-02.13`, `D-02.16`, `D-02.17` close several entries in §5.
- `docs/technical/03-design-system-tokens.md` — `OQ-03.1`…`OQ-03.7`; `D-03.5` is the CJK default.
- `docs/technical/04-components-sections.md` — `OQ-04.1`…`OQ-04.10`; `D-04.7`, `D-04.8`, `D-04.9`, `D-04.12`.
- `docs/technical/05-animation-system.md` — `OQ-05.1`…`OQ-05.8`; `D-05.9`, `D-05.10` and §5.7's F1 fallback.
- `docs/technical/06-routing-pages-seo.md` — `OQ-06.1`…`OQ-06.9`; `D-06.7`, `D-06.8`, `D-06.11`, §6.6, §6.9.
- `docs/technical/07-forms-integrations.md` — `OQ-07.1`…`OQ-07.10` and `A-07.1`…`A-07.5`; `D-07.2`, `D-07.6`,
  `D-07.8`, `D-07.9`.
- `docs/technical/08-testing-quality.md` — `OQ-08.1`…`OQ-08.9`; `D-08.8`, `INV-08.7`, `MC-08.1`.
- `docs/technical/09-deployment-operations.md` — `OQ-09.1`…`OQ-09.10`; `D-09.4`, `D-09.5`, `D-09.10`,
  `D-09.13`, `D-09.15`, `D-09.20`.
- `docs/technical/10-work-breakdown.md` — `OQ-10.1`…`OQ-10.6` and `A-10.1`…`A-10.3`; §14 is the phase-and-row
  view of the same set, `D-10.6` the `zh` warn policy, `INV-10.5` the update rule.
- `docs/technical/11-work-tracking.md` — `OQ-11.1`…`OQ-11.4`; `D-11.6` and §5–§6.
- Beads: `gp-dln.4` (Phase 1 gate), `gp-dln.6`, `gp-dln.12`, `gp-dln.13`, `gp-dln.9` (answered, see §5).
- `docs/design/README.md` — the source of the subpage-set discrepancy (`gp-dln.6`) and of the assets list
  behind `OQ-10.3` and `OQ-03.6`.
