# 12 · Open questions & assumptions

## Purpose

This is the single register of everything the plan has not settled: every `OQ-` identifier declared in
`01`–`11`, both local assumption families (`A-07.n`, `A-10.n`), who answers each one, which document
implements the answer, what is blocked until it arrives, and — the column that matters most — what the plan
ships if it is never answered. It exists so the human can read one page instead of eleven, and so that silence
is a decision with a known outcome rather than a stall. It answers nothing itself: an answer lands in the
document that owns the question, and this register is updated in the same pull request. On **2026-08-22** the
human answered at the Phase 1 gate and then again later the same day — fifteen decisions, cited across the set
as `HD-1`…`HD-15` (`D-12.7`), with four orchestrator adjudications (`ADJ-20`…`ADJ-22` and `ADJ-24`) settling
what the answers left in conflict. This revision records both rounds: **twelve** identifiers retire to §5,
**seven** rows keep an answer *and* an open launch half, **eight** new questions arrived with the first round and
**none** with the second, and §6 is re-derived around the distinction all of this turns on, which is the
single most misreadable thing in this document. **An answer that unblocks the build is not an answer that
unblocks launch.** Seven of the eight hard blockers in §6 now carry a 2026-08-22 answer and block anyway.
One later change is folded in without renumbering anything: on **2026-08-23** `08` retired its own `OQ-08.11`
entry — the last document still carrying a question its named seat had already answered — so that id leaves
§2 for §5 and the split becomes **59 · 14 · 20**. It opened no question and moved no blocker. The same day
`01` marked `OQ-01.1` and `OQ-01.2` answered in place and corrected its Vercel-plan line to `D-09.2`'s
Hobby-at-start, which retires the three "`01` has still to" notes §5 was carrying and changes no count.

Status: draft · seat writer-index · 2026-08-22 · revised 2026-08-22 (HD-1…HD-15, ADJ-20…ADJ-22, ADJ-24) ·
revised 2026-08-23 (`OQ-08.11` retired by `08`, closed by `06` `D-06.15`(a); `01` synced — `OQ-01.1`,
`OQ-01.2`, the plan line) · corrected 2026-08-23 (`OQ-11.3` — ruleset ground truth re-read from the GitHub
API: the include list *does* name the default branch, so the protection half is true in fact; what is missing
is any `required_status_checks` rule, and that half stays open — §1, §5, §6)

## Decisions

- **D-12.1 A register, not an owner.** Every row belongs to the document that declared it. 12 never invents a
  question, never renumbers one, and never records an answer that the owning document has not adopted.
- **D-12.2 Every row carries a default — and a default that carries the build is not a default that carries
  launch.** The plan proceeds under the default when a question goes unanswered. A row whose default cannot
  ship — none at all, or one a release gate rejects — is a hard blocker and is repeated in §6; there are
  **eight**. Since 2026-08-22 a blocker may be *decided* and still blocking: HD-4 and HD-7 replaced the `TODO`
  sentinels with plausible sample defaults (`D-02.20`), which unblocks every build and unblocks no launch. §6
  therefore draws from §5 as well as from §1, and each row says which of the two it is.
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
  question; each entry names the decision that closed it and the date it was taken. Moving an id to §5 says
  only that the owning document has recorded an answer — it never says the thing can ship. That is said in §6.
- **D-12.7 The Phase 1 gate answers are cited as `HD-n`.** The human's answers of 2026-08-22 are numbered
  `HD-1`…`HD-15` in the orchestration memo (`decisions-2026-08-22.md`) — `HD-1`…`HD-12` at the gate itself and
  `HD-13` (the domain), `HD-14` (the CJK stack) and `HD-15` (the `site.json` split) in a second sitting the
  same day — and are cited by that id wherever a document records one, exactly as the adjudications are cited
  as `memo ADJ-n`. `HD-n` is a provenance label, not a decision of this register: the decision itself lives in
  the owning document (`D-02.17`, `D-02.19`, `D-02.20`, `D-02.21`, `D-03.5`, `D-06.11`, `D-09.5`, …), and an
  `HD-n` whose owning document has not yet recorded it is marked pending here rather than silently promoted to
  an answer (`D-12.1`). The same holds for an adjudication: `ADJ-20`'s chevron ruling is registered here only
  because `04` and `06` both wrote it into their own text.

## Design

### 1 · Human-owned questions, ordered by the phase that blocks

59 identifiers on 51 rows. "Answer lands in" is the document whose text changes when the answer arrives. Seven
rows carry a 2026-08-22 answer and stay here anyway, because their owning document answered one half and left
the other open — each says so in the Question column and each is in §6. The seventh is new to that group this
round: `OQ-06.2`/`OQ-09.2` got its name (HD-13) and kept a registrar-access sliver.

| Phase | Id(s) | Question | Answerer | Answer lands in | Blocked until answered | If never answered |
|---|---|---|---|---|---|---|
| 2 | `OQ-11.3` | **Answered in intent 2026-08-22 (HD-2); the protection half is now true in fact, the required-checks half is not.** Verified against the GitHub API 2026-08-23: the "Main Protection" ruleset targets the default branch (`conditions.ref_name.include` = `~DEFAULT_BRANCH`) and its `deletion`, `non_fast_forward` and `pull_request` (squash-only) rules are live, so `main` rejects a direct push, a force-push and a non-squash merge today. Still needed: a `required_status_checks` rule — the ruleset carries none — listing the six check names of `08` `D-08.12`, `bead-trailer` among them, and "PR title and description" as the squash message | human | `09`, `11` | the Phase 2 gate itself | **none** — the gate cannot close while not one check is required (§6) |
| 2 | `OQ-09.1` · `OQ-01.4` | **Plan half answered 2026-08-22 (HD-3):** Vercel, **Hobby at the start, Pro before the DNS cutover** (`D-09.2`; `01` now records the same outcome). No budget concern was raised while the site is not public. Still open: who holds the billing, how many paid seats, the monthly budget cap, and whether Hobby's non-commercial terms are answered by upgrading to Pro or by a written eligibility confirmation from Vercel — the same four `01` hands back to `09` | human (owner) | `09` (`D-09.2`, `D-09.20`), `01` | nothing now — launch item 3a | Hobby is technically enough through **Phase 7** (`D-09.2`, `01`) and under `OQ-10.7`'s default is *scheduled* to carry **Phases 2–6**, upgrading at OPS-7.3 (`10` `D-10.13`) — capability and schedule, not a disagreement. The launch gate cannot tick without one of the two answers (§6), and `OQ-10.7` decides when the change happens |
| 2 | `OQ-09.3` | Deployment Protection on previews — reviewers sign in to Vercel rather than opening public links. HD-3 gave this a new edge: a free Viewer seat exists only on a team, so on Hobby the developer is the only person who can open a preview at all | human (owner) | `09` (`D-09.4`) | OPS-2.1 | previews private; reviewers get a free Viewer seat once the project is on a team |
| 2 | `OQ-08.3` | CI minutes: is the repo private (2,000 free GitHub minutes/month), and is the **three-locale** figure acceptable — ≈ 38–40 runner-minutes per PR and ≈ 1,300–2,000 a month, against ≈ 30 and ≈ 1,000–1,500 for two locales? | human | `08` §10 | PR-2.6 | change nothing and let the scaffold PR measure it; nothing needs deciding until `zh-Hant` joins `routing.locales` |
| 2 | `OQ-11.1` | May the orchestrator `bd dolt push` to `origin`, and on whose credentials? | human | `11` (`D-11.6`) | PR-2.1 | export-only; no Dolt push |
| 2 | `OQ-10.1` | Capacity: how many implementers or agent seats run in parallel, and what gate-review turnaround can the human commit to? | human | `10` §11 | the roadmap's scale (never its order) | two implementers, ≤ 2 business days (`A-10.1`) |
| 3 | `OQ-02.2` | **Decided** (`D-02.8`), open only as an override: production deep-merges over `en` and logs; a locale still being filled is demoted explicitly with `--warn-locale zh-Hans` / `--warn-locale zh-Hant`, never left silent, and `--release` refuses the demotion (`INV-02.11`). Overrule only to make a missing Chinese key fail the build with no fallback | human (may overrule) | `02` | PR-3.4 | `D-02.8` stands — see §5 |
| 3 | `OQ-06.5` | `NEXT_LOCALE` cookie lifetime: one year, or session? (Root-path detection is already settled *on*.) Three locales raise the stakes: the cookie is what keeps a `zh-TW` reader who deliberately chose 简体中文 on that choice | human | `06` | PR-3.1 | one year; detection on `/` stays on (`D-02.9`) |
| 3 | `OQ-09.4` | Who approves and merges content PRs: owner and developer as co-owners, or owner-only after launch? | human (owner) | `09` §4.11 (`D-09.10`) | PR-3.8, the editor guide | co-owners; the translator's PRs are reviewed by the owner |
| 3 | `OQ-10.4` | **Partly answered 2026-08-22 (HD-12):** warn-mode parity is the policy, spelled `--warn-locale zh-Hans` / `--warn-locale zh-Hant` (`D-10.6`). Still open: the translation resource and timing for the ≈ 165 remaining `zh-Hans` copy keys plus the production-only keys. `zh-Hant` needs no second translator — it is an OpenCC `s2t` conversion of whatever `zh-Hans` says (`D-02.21`) — but it does need `OQ-02.8`'s reviewer | human | `10` (`D-10.6`), `02` | PR-3.4's locale policy | warn mode until PR-8.1, and `zh-Hant` may stay out of `routing.locales` (`INV-02.11`) rather than block launch; a strict answer puts translation on the critical path |
| 4 | `OQ-06.10` · `OQ-04.11` | **What the three-option locale switcher looks like** — minus the chevron, which is settled. HD-10 turned the design's single "EN · 中文" nav item into a menu and the handoff draws none. **Adjudicated 2026-08-22 (ADJ-20): the trigger carries no chevron** — the handoff's only `⌄` is the hero scroll cue's and `[data-langtoggle]` is a bare nav item, so `06` beat `02` `D-02.10`'s unverified reading and `04` `D-04.16` now ships a bare `shortLabel`. That is the default of record in all three documents, not a proposal awaiting the design owner; adding a chevron is a new instruction, and the scroll cue cannot be cited as evidence for one. Still open: the trigger's resting/hover/open appearance and what surface the open list sits on, how the current locale is marked, and the mobile sheet's three rows | design owner (via Hanyi) | `06` (`D-06.9`), `04` (`D-04.8`, `D-04.16`) | nothing — every answer is a class change inside one component | reuse rather than invention: nav-item type and colour showing `shortLabel` and no glyph, a plain popover on 03's card surface, endonyms in nav-item type, current row by weight + `aria-current`, three inline rows on mobile |
| 4 | `OQ-03.2` | Which of `03` §10's AA contrast replacements are approved? Grouped in `03` §10 as (a) body and muted inks, (b) eyebrow/link/subhead darkening, (c) primary-button fill, (d) day-chip ink, (e) footer copyright, (f) input border | design owner (with `04`) | `03` §10 | PR-4.1; blocking at PR-8.4 | ship the design values; `03` §10 stays the known-failure list |
| 4 | `OQ-03.1` | Is the intermediate 768–1023px rendering (desktop type, mobile structure) acceptable, or is a tablet spec wanted? | design owner | `03`, `04` | PR-4.2 | no tablet spec |
| 4 | `OQ-03.5` | Keep emoji icons, or move to an icon set (which would need a fill token per section)? | design owner | `03` (`D-03.8`), `04` `Emoji` | PR-4.2 | emoji stay |
| 4 | `OQ-03.6` | Supply a vector (SVG/PDF) logo master | client | `03`, `public/brand/` | PR-4.1 | the 373×161 PNG ships; no crisp rendering above ≈ 186px and no recolouring |
| 4 | `OQ-04.1` | Hamburger sheet: approve `D-04.8`'s full-screen cream sheet — now carrying **three** locale rows rather than the design's one toggle — or supply a design | design owner | `04` | PR-4.5 | `D-04.8` ships |
| 4 | `OQ-04.6` | Mobile footer: the prototype omits "Contact" — render it on both views? | design owner | `04` | PR-4.5 | `site.nav.footer[]` (six links + Contact) renders on both views |
| 4 | `OQ-04.7` | Nav row switches at `lg` rather than `md` — confirm, or supply a compact 768–1023 nav | design owner | `04` (`D-04.9`) | PR-4.5 | the switch stays at `lg` |
| 4 | `OQ-05.3` | Three prototype gaps: `gpdevelop` is defined but unused; the day-chip sample line has no specified animation; the hamburger sheet has no specified motion | design / owner | `05`, `04` | PR-4.5, PR-5.3 | defaults ship — `fade`+`rise` sheet, `WordSwap` on the sample line, `gpdevelop` dropped |
| 4 | `OQ-05.4` | Sign off two conscious deviations from the prototype: the locale cascade runs per text block and enter-only; the sticky nav stays anchored while the subpage slides | design / owner | `05` | Phase 4 gate | both ship as decided (memo ADJ-4) |
| 4 | `OQ-05.6` | Mobile rise distance: 18px chosen from the design's 16–20px range | design / owner | `03` §7, `05` | PR-4.3a | `--reveal-rise-sm: 18px` |
| 4 | `OQ-05.8` | The hero photo is `opaque` (transform-only rise, never at opacity 0) to protect LCP — acceptable, or take the LCP cost of a full fade? | `09` · owner | `05`, `04` | PR-4.6 | stays `opaque` |
| 4 | `OQ-06.6` | Active-section highlight in the sticky nav? Not in the design | design owner | `06` | PR-4.5 | off at launch |
| 5 | `OQ-07.10` · `OQ-04.10` | **Decided** (`D-07.2` + `02`'s canonical five ids; child's age = `infant`/`toddler`/`preschool`/`expecting`/`other`, desired start = next 12 months + `asap` + `flexible`), open only as the owner's right to trim or relabel. HD-5 reserved the Enrollment page, so the only surface reading these today is the home Visit form | owner | `07` (`D-07.2`), `02`, `04` | nothing at launch | the canonical sets ship — see §5; a later trim is JSON + enum only |
| 5 | `OQ-07.1` · `OQ-02.5` | Language of the staff notification e-mail, and whether parents receive an auto-reply. The preferred-language line now names one of three endonyms | owner | `07` (`D-07.6`), `02` `email.*` | PR-5.8 | staff mail in `en` with a preferred-language line |
| 5 | `OQ-07.2` | Enable the parent auto-acknowledgement at launch? | owner | `07` | PR-7.2 | off |
| 5 | `OQ-07.8` · `gp-dln.13` | **Answered for the build 2026-08-22 (HD-7); still a launch blocker.** The street address and Maps link ship as required fields with sample defaults (`1234 Sample Way`, `94538`, a Maps query URL), so no component branches on their absence. Still open: the real street and Maps link, and whether the owner wants a street published at all — "do not publish" is a `02` schema change (make `contact.address.street` optional) plus a `04` composition change | owner | `07`, `06` JSON-LD, `02` `site.json` | nothing in the build | the sample address ships and `--release` fails on its `provisional` entries (§6) |
| 5 | `OQ-02.6` | Testimonials in the Chinese locales: translated quotes, or the original English quotes with a Chinese attribution line? One answer covers `zh-Hans` and `zh-Hant` | human | `02`, `content/zh-Hans/collections` + `content/zh-Hant/collections` | PR-8.1 | translated quotes; an attribution-only answer is a content edit, not a code change |
| 5 | `OQ-04.3` | Confirm dropping `gpdevelop`, the photo "develop" filter that no reference uses | design owner | `04`, `05` | PR-5.4 | dropped; no component is built for it |
| 5 | `OQ-08.6` | By which phase gate does each `axe-exceptions.json` entry expire? (The approvals themselves are `OQ-03.2`; one answer settles both) | design owner | `08` §6 (`D-08.8`) | the Phase 5 gate | `color-contrast` reports but does not block until `OQ-03.2` lands |
| 5 | `OQ-10.3` | Photography delivery: hero, classroom, three rooms, 5–7 gallery frames, Ms. Ping, map/building. HD-12 confirms placeholders until it lands; it does not supply a date | owner via human | `04` `PhotoSlot`, `08` LCP budget | Phase 5 gate for LCP tuning; at the latest PR-8.3 | `PhotoSlot` stands in and LCP tuning repeats in Phase 8 |
| 6 → 8 | `OQ-06.2` · `OQ-09.2` | **Name answered 2026-08-22 (HD-13): `greenpasturesdaycare.com`**, with the host form as already decided — apex canonical, `www` → apex 308 (`D-09.5`, `D-06.11`). The build never read it and still does not (`INV-06.10`); what the name buys is a known production value for `NEXT_PUBLIC_SITE_URL` and the worked canonical / `hreflang` / sitemap URLs in `06` §6.5–6.6. The design mock's `greenpasturesmontessori.com` is positively **not** the domain. **Still open, and now the whole of it: who holds the registrar login**, plus the DNS host if that is a separate account — an access question, not a naming one | human (owner) | `09` §5.1 items 1–2 (`D-09.5`), `06` `OQ-06.2` | OPS-8.1 and the DNS cutover, Search Console verification, the Turnstile hostnames and 07's Resend records — each needs someone who can edit the zone | the name ships everywhere it is needed; **nobody can be assumed into an account**, so the cutover does not happen (§6). `D-09.19`'s shape applies: the account belongs to the daycare and the developer is invited to it |
| 6 | `OQ-06.9` · `gp-dln.13` | **Partly answered 2026-08-22 (HD-7 + HD-9); still a launch blocker.** The JSON-LD owner facts no longer block the build: telephone, e-mail, address, Yelp URL and the rest ship as provisional sample defaults, so the `ChildCare` object always renders. Still open: the **real** values, plus confirmation that Mon–Fri 07:30–18:00 is current | human (owner) | `06` §6.6, `02` `content/site.json` | nothing in the build | the object ships with sample values and `--release` fails at Phase 8 (§6); `geo`, `priceRange` and ratings stay absent either way |
| 6 | `OQ-07.5` · `OQ-06.4` | Is a privacy-policy page required (assumption `A-07.3`, CalOPPA)? If yes: route, strings, footer link | owner with counsel | `06` `/privacy`, `02` strings | PR-6.9 | no privacy route ships; PR-6.9 stays blocked and is dropped at the gate |
| 6 | `OQ-04.2` | Gallery lightbox at launch, and client-side versus URL-backed filters | human | `04` (`D-04.7`) | PR-6.5 | native `<dialog>` lightbox, client-side filters |
| 6 | `OQ-06.7` | Social share image artwork, 1200×630 | design owner / human | `06` `images.og` | PR-6.8 | a logo-on-cream placeholder is generated once and committed |
| 7 | `OQ-07.6` | **Narrowed twice, 2026-08-22; still a launch blocker.** HD-4 made the sending identity content with sample defaults; HD-13 then put those samples on the real host — `07` `D-07.10` writes `email.sendingDomain` `mail.greenpasturesdaycare.com`, `email.fromAddress` `no-reply@mail.greenpasturesdaycare.com`, `contact.email` `hello@greenpasturesdaycare.com`, edited in `content/site.json`. (**`ADJ-24`, 2026-08-22**, settled the split six documents had opened: `07`'s spelling is the one of record, and `02`'s *Provisional values* table and `09` §5.1 item 6 have moved off `mail.greenpastures.example` to it, checked in both documents. What the adjudication preserves from `09`'s objection: the sending domain is a value of its own — not implied by `NEXT_PUBLIC_SITE_URL`, nothing derives one from the other — and it stays provisional until Resend verification.) Still open: whether `mail.` is the subdomain the owner wants, which mailbox the daycare reads, and Resend verification. **The reason changed with HD-13** — not that `.example` is unverifiable, but that a named domain is not a verified one | owner / `09` | `07` §5 (`D-07.10`), `09` DNS | OPS-7.1, the Phase 7 gate | **none that delivers** — the form renders and validates but no e-mail reaches anyone until DKIM/SPF exist (§6); `OQ-07.11` covers the preview interim |
| 7 | `OQ-10.7` | **When** does the Vercel plan change? Hobby suits Phases 2–6 and is wrong for launch, and OPS-7.3 sits in between: the WAF rate-limit rule consumes Hobby's single custom rule, and a rule published on one plan should be re-verified after an upgrade | human (Hanyi / owner) | `10` (`D-10.13`), `09` | OPS-7.3's sequencing, never the launch itself | upgrade at OPS-7.3 — the cheaper mistake is a spare month of Pro, not an unchecked rate-limit rule; OPS-8.1 cannot cut DNS over until the plan is settled |
| 7 | `OQ-07.4` | Resend message-content retention and account ownership; retention policy for inquiry e-mail in the inbox | `09` + owner | `09` §5.1 | OPS-7.1 | Resend's default retention, reviewed at `09` §5.1 item 6 |
| 8 | `OQ-02.8` | `zh-Hant` review: who reads the OpenCC-seeded Traditional tree before the locale is enabled, and which regional conventions govern word choice (Taiwan or Hong Kong) where Simplified and Traditional usage differ by more than glyphs? | human (Hanyi) | `02` (`D-02.21`), affects `09`, `10` | enabling `zh-Hant` in `routing.locales` — nothing else | seed with `s2t` (glyphs only), keep `zh-Hant` out of `routing.locales` until a named human has reviewed it (`INV-02.11`), and treat the review as post-launch work; `en` and `zh-Hans` launch either way |
| 8 | `OQ-07.7` · `gp-dln.13` | **Answered for the build 2026-08-22 (HD-7); still a launch blocker.** `5.0` / `47` / a plausible business URL ship as provisional sample defaults and stay hand-edited — Yelp Fusion is not wired. Still open: the real rating, count and page URL, or the decision to delete the `yelp` block entirely | owner | `02` `site.json`, `07` §6 | nothing in the build | the samples ship and `--release` fails while the three entries remain (§6) |
| 8 | `OQ-08.2` | Lighthouse thresholds and resource budgets, after the first calibration run with real photography | human with `09` | `08` §7, `lighthouserc.cjs` | PR-8.5 | `08` §7's plan thresholds are enforced as written |
| 8 | `OQ-06.3` · `OQ-09.8` | Was the previous CRA site ever live at this domain with indexed URLs beyond `/`? | human (owner) | `06` §6.9, `next.config.ts` `redirects()` | PR-8.7 | "none beyond `/`"; no legacy redirect map ships |
| 8 | `OQ-09.6` | Menu: a rotating sample week refreshed on rotation changes, or a real weekly menu edited every Friday (one 15-cell PR per week)? | human (owner) | `09` (`D-09.13`), `02` `menu` | PR-8.2 | rotating sample week |
| 8 | `OQ-09.7` | Error monitoring beyond Vercel's built-in logs (one hour on Hobby, one day after the upgrade): a log drain with alerting, Sentry for the client, or neither until the first incident? | human (owner) with the developer | `09` §5 (`D-09.15`) | OPS-8.2 | Vercel logs plus the uptime check only; no drain, no Sentry |
| 8 | `OQ-10.2` | Target launch window or hard date (enrolment season, marketing) | human | `10` §11 | the Phase 8 gate | the roadmap stays relative; no fixed date and nothing is cut |
| post | `OQ-01.5` | Which post-launch animation request first trips ADR-009's GSAP trigger (pinning, labelled scrub, horizontal scroll), if any? | human with `05` | `01`, as a new ADR | — | no GSAP; the trigger is unfired |
| post | `OQ-02.3` · `OQ-09.9` | Do editors need an in-browser preview or CMS beyond the Vercel preview per PR? | human (owner) | `09` (`D-09.14`) → ADR-010 in `01` | — | the preview per PR is the editor tool; a CMS needs ADR-010, which evaluates Keystatic first |
| post | `OQ-07.3` | Which CRM, if any, should receive inquiries later (HubSpot, a Google Sheet, a daycare tool)? | owner | `07` (`D-07.8`) | — | no CRM; the inbox is the record |
| post | `OQ-08.7` | Should `pnpm audit` high/critical block PRs after launch? | human | `08` | — | advisory only, with a weekly Renovate cadence (`D-09.17`) |
| post | `OQ-11.2` | Is `bd` the long-term tracker once the site ships, or only for the build? | human | `11` | — | `bd` continues; `issues.jsonl` is the archive either way |

### 2 · Questions the build answers for itself

14 identifiers on 13 rows. Each has a named seat and a phase, and none holds a phase waiting on the human
(`D-12.3`); `OQ-08.1` is the single row whose seat confirms its answer with the design owner in review. Three
of the rows are new on 2026-08-22 — the three-locale decision and the provisional registry each left a seam
between two documents, and a seam is a question one seat owes another. A fourth arrived with them and has
since left: `OQ-08.11`, answered by `06` in `D-06.15`(a) and retired by `08` on **2026-08-23**, is now in §5
and nowhere else on the register.

| Phase | Id(s) | Question | Answered by | Answer lands in | Blocked until answered | If unresolved |
|---|---|---|---|---|---|---|
| 2 | `OQ-01.3` · `OQ-05.1` | Confirm that React `<ViewTransition>` and `<Link transitionTypes>` exist and behave as documented at the pinned Next.js version (≥ 16.2) with React 19.2 | the scaffold PR, verified by `check-stack` | `01` (ADR-005 amendment if it fails) | PR-2.4, then the PR-4.4 spike | the subpage slide falls back to an instant swap and `05` §5.7's F1 becomes the decision |
| 2 | `OQ-08.5` | Do `eslint-plugin-react` ≥ 7.37 with flat config, `next typegen` before `tsc`, and the esquery literal selectors all work as documented? | the scaffold PR implementer | `08` §2 | PR-2.5 | a 20-line local ESLint rule replaces whichever plugin fails; the gates do not change |
| 2 | `OQ-08.8` | Apply the one-line wording fix to `INV-02.1` (`restrictedAttributes`, an enumerated allowlist) | `02` (writer-contracts) | `02` `INV-02.1` | PR-2.5 | `INV-02.1` ships as written; the fix is a later docs PR |
| 2 | `OQ-09.5` | Create the two standing human-assigned beads ("content edits", "dependency updates"), **claim and export them** to `.beads/issues.jsonl` on `main`, and decide whether content-only PRs may satisfy the trailer gate by the PR body alone | orchestrator (`11`) | `09` (`D-09.11`, `D-09.17`), `11` §6 | PR-2.3, PR-2.9, the first editor or Renovate PR | the beads are created at kickoff and editors paste the trailer into every commit |
| 2 | `OQ-11.4` | Will the repo get a `CLAUDE.md`? | orchestrator → the `00-README` owner (`gp-dln.3`) | `00` (`D-00.4`), PR-2.2 | PR-2.2 | **answered:** `D-00.4` — a thin pointer `CLAUDE.md` lands in PR-2.2; `00` and `11` stay the conventions of record |
| 3 | `OQ-06.8` | Accept `06` §6.12's four requests — **three still live**: (1) `brand.url` is not the metadata origin — relabel or drop, and HD-13 lets `02` retire its `https://greenpastures.example` sample either way (`ADJ-24` keeps `brand.url` out of the sending-identity move: its value and its fate stay `OQ-09.10`'s); (2) `ogLocale` becomes a sixth `LOCALE_META` field; (3) the unknown-locale 404 sentence is scoped to matcher-excluded paths; (4) **satisfied 2026-08-22** — the ask was to strike "plus the design's `⌄` chevron" from `D-02.10`, and `02` has done it: `D-02.10` no longer carries the phrase and `02`'s switcher prose now reads "no chevron, no disclosure glyph (ADJ-20)". `06` §6.12 still lists four; the correction has landed | `02` (writer-contracts) | `02` | PR-3.2 | `06` ships as written — `NEXT_PUBLIC_SITE_URL` is the origin, `ogLocale` lives in `LOCALE_META`, `INV-06.10` keeps `brand.url` out of every metadata path, and the trigger renders no chevron, which `D-02.10` now says itself |
| 3 | `OQ-08.10` | **Pending-locale provisional paths.** The 23-entry seed contains `brand.name.zh-Hant` and `brand.shortName.zh-Hant`; `INV-02.3` allows a localized value only for ids in `routing.locales`, and `INV-02.11`/`OQ-02.8` keep `zh-Hant` out of it — so two seeded paths are unresolvable, and an unresolvable path fails `validate:content` in every mode. Confirm `08` §3 rule 6 (*pending locale*: reported, still blocking `--release`, never an error), or drop the two paths until the locale is enabled | `02` (writer-contracts), on `08`'s finding | `02` *Provisional values* | the day `--warn-locale` is first used | `08` §3 rule 6 stands and the `content` job stays green; the alternative is 02's call, not 08's |
| 3 | `OQ-09.10` | Drop `content/site.json` → `brand.url` in favour of `NEXT_PUBLIC_SITE_URL`, or keep it as the human-edited value `06` reads — and what `metadataBase`, the sitemap and robots use on a Preview deployment, where that variable is unset. Sharpened by HD-4/HD-9: `brand.url` is `provisional` entry 1, so keeping it means the owner types the origin into `site.json` *and* the developer types it into a Vercel variable, which `INV-09.6` forbids. **Sharpened again, not settled, by HD-13**: the reason to keep the field was never that the origin was unknown, and it demonstrably is not now — the choice is unchanged and the answer is cheaper, because whichever way it goes the literal is `https://greenpasturesdaycare.com`. `06` answers the Preview half at source (`D-06.11`'s `VERCEL_URL` fallback chain); `02` still owes the field's fate | `02`'s seat, on `06`'s requirement (`D-06.11`) | `02`, `06`, `09` §2 | PR-3.2, PR-6.8 | both exist, `--release` blocks on the provisional entry, and `02`'s copy of the origin can drift from the variable |
| 4 | `OQ-05.2` | The View Transitions spike, (a)–(f): typed navigations, z-order of `.gp-page` during `subpage-exit`, Safari behaviour, snapshot size on a tall mobile page, whether Next already focuses the new page, and whether next-intl's `Link`/`useRouter` pass `transitionTypes` through | the 04 implementer, spike PR-4.4 | `05` §5.7, `04` | PR-4.4, then PR-6.1 | the spike answers itself; a "no" on any of (a)–(f) selects F1 and `01` records the ADR-005 amendment in the same PR |
| 4 | `OQ-08.9` | Reword `03` §5 to point at `MC-08.1`, the named manual per-OS glyph check — `08` cannot pin per-OS screenshot baselines | `03` (writer-design-system) | `03` §5 | the Phase 4 docs pass | `03` §5 keeps pointing at a per-OS snapshot that does not exist; `MC-08.1` still runs |
| 5 | `OQ-07.11` | Preview sending while the sending domain is still a provisional sample: (a) `INQUIRY_TRANSPORT=log` in the Preview scope, (b) Preview `INQUIRY_FROM_EMAIL` = `onboarding@resend.dev`, which delivers only to the Resend account owner (`A-07.6`), or (c) verify the real sending domain early? Raised by HD-4 — real transport on a preview cannot succeed from an **unverified** sending domain, which HD-13 does not change: `mail.greenpasturesdaycare.com` has no DKIM until `09` publishes it. Option (b) now also needs Preview's `INQUIRY_TO_EMAIL` kept, because the content default is a mailbox on a real domain | `09`, with the owner only if (c) | `07` §5, `09` §2 | PR-5.8's preview behaviour | (a) — previews log the payload and send nothing |
| 5 | `OQ-09.11` | HD-4 moved the sending identity into content (`email.sendingDomain`, `email.fromAddress`, `email.notifyTo`) while `07` still reads `INQUIRY_FROM_EMAIL` / `INQUIRY_TO_EMAIL`. Which survives, and in what precedence? `09`'s position: the from-address is content only (`INV-09.6`), and `INQUIRY_TO_EMAIL` stays as the per-environment override content cannot express, because `site.json` is byte-identical in every deployment and a preview must never mail the real inbox | `07`'s seat, with `02` | `07` §5, `02` `email.*`, `09` §2 | PR-5.8, `.env.example`, `08`'s completeness gate | two homes for one string, which `INV-09.6` forbids; `08`'s env-completeness gate settles nothing on its own |
| 5 | `OQ-08.1` | Visual-regression tolerance (`maxDiffPixelRatio 0.01`, `threshold 0.2`) and chromium-only scope, or widen to webkit for an iOS-heavy audience at ≈ 2× CI time. The locale dimension is now part of the same answer: three locales make the suite **102** images rather than 68, and `zh-Hant` differs from `zh-Hans` only in glyph forms and wrapping | the 04 implementer with the design owner | `08` §6, §8 | PR-8.6 | chromium only at the stated tolerances, all three locales in (`INV-08.4`) |

### 3 · The three filed beads — all answered on 2026-08-22

Three questions were also tracker beads, because they needed the human and blocked more than one document.
All three were answered at the Phase 1 gate. Two of them left a launch obligation behind, and closing the bead
is not that obligation being met — the bead tracked *the human deciding*, and §6 tracks *the real value
arriving*.

- **`gp-dln.6`** — *Subpage set*: **closed** (HD-5). "Staff" **is** Team — one page, the `team` namespace, and
  no `staff` namespace ever. Six routes ship: Philosophy, Programs, Menu, Gallery, Reviews, Team. FAQ and
  Enrollment are **reserved, not built** — `faq.json` and an empty `site.json.faq[]` stay in the tree,
  excluded from parity, the sitemap, the nav and the Playwright matrix while the array is empty, so the route
  can ship the day content exists. Recorded in `D-02.17`; carried `OQ-02.7`, `OQ-04.5` and `OQ-06.1`, all now
  in §5. Nothing about the subpage set is open any more.
- **`gp-dln.12`** — *Chinese brand name*: **answered, provisionally** (HD-6). 优朵幼儿园 is the name; 绿茵园 is
  **rejected**, and the prototype's gallery title "绿茵园的生活" is re-authored as `{brandShortName}的日常`. The
  name is explicitly *not finalised*, so it is one localized value in one file — `brand.name["zh-Hans"]`, with
  `zh-Hant` carrying its own 優朵幼兒園 — and it is registered in `site.json.provisional`, which `--release`
  rejects (§6). The bead closes; the provisional entry does not, until the human confirms the name. Changing
  it is one edit in `content/site.json` and nothing else in the repository mentions it (`D-02.19`).
- **`gp-dln.13`** — *Owner-supplied facts missing from the design*: **answered for the build** (HD-7). Address,
  phone, inquiry inbox, Yelp URL/rating/count, licence number and the three teachers' names and credentials
  all ship **now** as editable sample defaults rather than `TODO` sentinels, so previews and layout are
  honest. Because a plausible fake is exactly what a `TODO` scan cannot see, every one is listed by dotted
  path in `site.json.provisional` and `--release` fails while that list is non-empty (`D-02.20`, `INV-02.10`).
  Carried `OQ-06.9`, `OQ-07.7` and `OQ-07.8` — each recorded as answered in §5 **and still registered in §1**,
  because `06` and `07` answered the build half in writing and left the launch half open. The real values
  remain a launch gate (§6).

Also settled at the gate: **`gp-dln.4`**, the *Phase 1 gate* itself — the plan set is accepted as the plan of
record (HD-1; `00` records the sign-off) — and **`gp-dln.8`**, the stale Create-React-App root `README.md`,
which the human confirmed is to be replaced: `10` §2 scope (b) puts that in this documentation round, and
PR-2.2 writes it only if the round has not. **`gp-dln.9`** (the mobile footer's licence-number line) was
already answered by `D-02.13`; see §5.

### 4 · Assumptions carried

These are not questions; they are claims the plan relies on and would have to revisit if falsified. `A-07.n`
and `A-10.n` are local identifier families of their own documents. Ten of them, two added on 2026-08-22 by the
answers themselves.

| Id | Assumption | Owner | Falsified by | Consequence if false |
|---|---|---|---|---|
| `A-07.1` | Cookieless aggregate analytics needs no consent banner for a California site | `07` (pending counsel) | legal advice only — the GA4 route that would have falsified it is closed (2026-08-22: no third-party tag, §5) | a consent banner in all three locales, and the strings for it in `02` |
| `A-07.2` | English is the daycare's working inbox language | `07` | the owner's answer to `OQ-07.1` | staff notifications render in the parent's locale instead |
| `A-07.3` | CalOPPA applies and a privacy policy is required | `07` | counsel, via `OQ-07.5` | if not required, PR-6.9 is dropped; if required, the route, strings and footer link ship |
| `A-07.4` | Resend's `delivered@resend.dev` sink is acceptable for preview deployments | `07` | Resend policy change | previews need a real verified domain earlier than Phase 7 |
| `A-07.5` | Yelp Fusion terms and limits are as summarised in `07` §6 | `07` | Yelp terms change | the Yelp figures stay hand-edited (which is the default anyway, `OQ-07.7`) |
| `A-07.6` | Resend's shared `onboarding@resend.dev` sender is usable before the daycare's own domain is verified — delivering only to the account owner's address — and the SDK RFC 2047-encodes a non-ASCII `from` display name | `07` (new 2026-08-22, raised by HD-4) | Resend policy, or a Chinese brand name that arrives mangled in a preview | `OQ-07.11` falls back to option (a): previews log the payload and send nothing |
| `A-07.7` | Cloudflare Turnstile supports `zh-tw` as a widget language, as it does `zh-cn` | `07` (new 2026-08-22, raised by HD-10) | checking Turnstile's language list before `zh-Hant` is enabled | the Traditional widget renders in another language, or the locale ships without the widget localized |
| `A-10.1` | Two implementers, and gate reviews turned around within two business days | `10` | the answer to `OQ-10.1` | the roadmap rescales — ≈ 24 weeks at one implementer — but the order does not change |
| `A-10.2` | The `.dc.html` references remain the acceptance baseline for visual checks until photography lands | `10` | new design work, or `OQ-10.3` arriving early | visual-regression baselines are rebuilt against the real photographs |
| `A-10.3` | The orchestrator creates the phase epics, task beads and gate beads at kickoff | `10` (`D-10.9`) | the human taking over the tracker | gate beads must be created by hand before each phase, or `INV-10.4` cannot hold |

### 5 · Decided, not open — do not re-open

Two tables. The first is the batch the human answered on **2026-08-22**, at the Phase 1 gate and in the second
sitting later that day; the second is what the plan had already settled inside itself. Both obey `D-12.6`, and
the first one's last column is the reason this section is not a victory lap: **an id here is answered, not
necessarily shippable.**

The `OQ-` ids their own documents have retired reach neither §1 nor §2, so their answerers are recorded here:
`OQ-03.7` (answerer `05`, implemented in `03` §7), `OQ-04.8` (withdrawn by `04`, no answerer), `OQ-05.5`
(answerers `02` and `06`, implemented in `D-06.8`), `OQ-05.7` (answerer `03`, implemented in `03` §7),
`OQ-08.4` (answerer `09`, implemented in `D-09.4`), `OQ-08.11` (answerer `06`, implemented in `D-06.15`(a),
retired by `08` on 2026-08-23), `OQ-10.5` and `OQ-10.6` (answerer `10`, implemented in
`10` §14) — plus the **twelve** the two rounds retired outright: `OQ-01.1`, `OQ-02.1`, `OQ-02.4`, `OQ-02.7`,
`OQ-03.3`, `OQ-04.4`, `OQ-04.5`, `OQ-06.1` and `OQ-07.9` at the gate, and `OQ-03.4`, `OQ-01.2` and `OQ-04.9`
in the second sitting (HD-14).

**Seven more rows are answered and still registered in §1**, because their owning document answered one half
in writing and left the other open in the same breath: `OQ-11.3`, `OQ-09.1`/`OQ-01.4`, `OQ-06.9`, `OQ-07.6`,
`OQ-07.7`, `OQ-07.8` and — new this round — `OQ-06.2`/`OQ-09.2`. They appear in the table below marked
*(still on §1)*: the answer is recorded, the question is not finished. Two further rows are decided but kept
on §1 as live overrides (`OQ-02.2`, `OQ-07.10`), and **one** stays on §2 carrying its answer inline until the
document that declared it retires its own entry — `OQ-11.4`, until `11` does. `OQ-08.11` was the second such
row for one day: `06` answered it in `D-06.15`(a) on 2026-08-22 and `08` retired its own entry on
**2026-08-23**, which is the whole of what §7 step 3 asks for, so the id has left §2 for the table below.
The first round left one answer that closed nothing — **HD-11 rejected the premise of `OQ-03.4`** rather than
answering it, since the design names no CJK typeface anywhere — and the second round closed the corrected
question outright (HD-14), which is why that row is in the table below rather than in §1.

| Was open as | Settled by | The answer — 2026-08-22 | Still blocks |
|---|---|---|---|
| `OQ-02.1` | HD-10 · `D-02.1` | **Three locales, not two:** `en` (default and reference), `zh-Hans` (Simplified — ships at launch, the language of the 33 prototype strings) and `zh-Hant` (Traditional — an additional language). The locale id, the URL segment, `htmlLang` and `hreflang` are one and the same string, so `zh` no longer exists as an identifier anywhere | nothing at launch — `INV-02.11` lets `zh-Hant` stay out of `routing.locales` until it is reviewed. Follow-up `OQ-02.8` is on §1 |
| `OQ-02.4` · `gp-dln.12` | HD-6 · `D-02.19` | The Chinese brand name is **优朵幼儿园** (short 优朵); **绿茵园 is rejected** and the prototype's "绿茵园的生活" gallery title is re-authored as `{brandShortName}的日常`. `zh-Hant` carries its own 優朵幼兒園 / 優朵. The English footer keeps both names through `{brandNameOther}`, not a locale branch. Explicitly **provisional** | **the launch gate** — the name is not final, and its `provisional` entries make `--release` fail (§6) |
| `OQ-02.7` · `OQ-04.5` · `OQ-06.1` · `gp-dln.6` | HD-5 · `D-02.17` | **"Staff" is Team** — one page, the `team` namespace. Six subpage routes at launch: Philosophy, Programs, Menu, Gallery, Reviews, Team. FAQ and Enrollment are reserved, not built | nothing |
| `OQ-03.3` | HD-10 · `03` `D-03.14` | Not Simplified-only, so one SC-first stack is not enough. `--font-cjk` now resolves per script: `--font-cjk-sc` under `:root:lang(zh-Hans)` and `--font-cjk-tc` (`PingFang TC`, `Hiragino Sans CNS`, `Microsoft JhengHei`, Noto/Source Han TC) under `:root:lang(zh-Hant)`; the shared `:root:lang(zh)` typography rules match both scripts and are not split | nothing — `08`'s visual-regression matrix gains a `zh-Hant` row, which `08` owns |
| `OQ-03.4` · `OQ-01.2` · `OQ-04.9` | HD-11 then **HD-14** · `03` `D-03.5`, `D-03.14` | **The system CJK stack ships for both Chinese scripts and no CJK webfont is loaded at launch.** HD-11 had found the question's premise false — the handoff names Fredoka and Nunito, neither carrying a Han ideograph, so the 中文 in the prototypes already renders in an OS substitute — and HD-14 confirmed that stack as the decision rather than the fallback. `--font-cjk-sc` / `--font-cjk-tc` / `--font-cjk` stand as `03` §3.1 and `D-03.14` declare them. Naming a face later is possible without being open: two token values and a `next/font` loader scoped to the Chinese layouts, now on `10` §9's post-launch backlog as new brand work | nothing — `PR-4.1` carries no font decision. **All three documents have now marked their copies:** `03` and `04` on 2026-08-22, and `01` since — its `OQ-01.2` entry is marked answered in place, dated 2026-08-22 and citing HD-14 with `03` `D-03.5` / `D-03.14` (confirmed here 2026-08-23). `01` states the same thing this row does, including that naming a face later is a one-token change and not a pending answer. The per-OS look is covered by `08`'s manual check `MC-08.1`, not by this question |
| `OQ-09.1` · `OQ-01.4` *(still on §1)* | HD-3 · `D-09.2` | Hosting is Vercel and the plan is **Hobby at start, Pro before the DNS cutover** — `01` records the same outcome from `D-09.2` and no longer reads "Pro" as the starting plan. No budget concern was raised while the site is not public, so `OQ-01.4` contributes no cap of its own; the monthly cap itself is not answered and stays open on §1 as `09`'s | **the launch gate** — Hobby is licensed for non-commercial use and this is a commercial site; it also has a single custom WAF rule, which `D-07.7`'s rate limit consumes (§6) |
| `OQ-11.3` *(still on §1)* | HD-2 | The human states branch protection **is added**, and a "Main Protection" ruleset does exist with `deletion`, `non_fast_forward` and `pull_request` (squash-only, 0 required approvals) | **the Phase 2 gate** — verified against the GitHub API 2026-08-23: the ruleset's `ref_name.include` list names the default branch, so those three rules are live and `main` *is* protected in fact; what it has no rule for is `required_status_checks`, so none of `08`'s six checks is required to merge (§6) |
| `OQ-06.2` · `OQ-09.2` *(still on §1)* | HD-13 · `06` `D-06.11` · `09` `D-09.5` | **The domain is `greenpasturesdaycare.com`.** Apex canonical, `www` → apex 308, apex primary at Vercel and the Search Console property; `NEXT_PUBLIC_SITE_URL` = `https://greenpasturesdaycare.com` in the Production scope only. `06` INV-06.10 is untouched — the origin still reaches `metadataBase`, `hreflang`, the sitemap, robots and JSON-LD through the variable, and the literal appears nowhere in `src/`. The design mock's `greenpasturesmontessori.com` is excluded | **the DNS cutover** — the name is not the access. Who holds the registrar login (and the DNS host, if separate) was never asked before and is now the whole of the question (§6) |
| `OQ-07.6` *(still on §1)* | HD-4, then HD-13 · `D-02.20` · `07` `D-07.10` | The sending identity becomes content instead of invention, and HD-13 puts the samples on the real host: `email.sendingDomain` `mail.greenpasturesdaycare.com`, `email.fromAddress` `no-reply@mail.greenpasturesdaycare.com`, inquiry inbox `contact.email` `hello@greenpasturesdaycare.com`, all provisional; the from display name is `brand.name[locale]`, never duplicated. `ADJ-24` (2026-08-22) settled that spelling against `02`'s and `09`'s `mail.greenpastures.example` and both have adopted it; only the sample changed — the sending domain is still a value of its own, and `brand.url` did not move with it (`OQ-09.10`) | **the Phase 7 gate** — a named domain is not a verified one: Resend refuses an unverified `from`, the `mail.` subdomain is still the owner's to confirm, and nobody yet reads that inbox (§6) |
| `OQ-07.7` *(still on §1)* | HD-7 · `D-02.20` | `yelp.rating` `5.0`, `yelp.reviewCount` `47` and a plausible `yelp.url` ship as provisional sample values rather than `TODO` | **the launch gate** — replace with the real figures **or delete the `yelp` block**, then clear the three entries (§6) |
| `OQ-07.8` *(still on §1)* | HD-7 · `D-02.20` | The street address ships as a sample: `contact.address.street` `1234 Sample Way`, `postalCode` `94538`, `contact.mapsUrl` a matching Maps link — all provisional. `city` Fremont, `region` CA and `country` US are deliberately **not** provisional; they are known good | **the launch gate** — replace with the real address, or drop the field for a locality-only publication; either way the entries must clear (§6) |
| `OQ-06.9` · `gp-dln.13` *(still on §1)* | HD-7 · `D-02.20` | Every owner fact the JSON-LD and the contact surface publish ships as an editable sample default registered in `site.json.provisional`: phone `+15105550142` / `(510) 555-0142`, `license` `000000000`, the address above, the inbox, and the three teachers' names and credentials. `hours` and `timeZone` are not provisional — the design and the human state them | **the launch gate** — 23 entries, enumerated in §6; `--release` fails while any remain (`INV-02.10`) |
| `OQ-01.1` · `OQ-07.9` | the human ("no tag is necessary") | **No third-party analytics tag** — no GA4, no Google Tag, no Plausible snippet. Vercel Web Analytics + Speed Insights remains the launch default (memo ADJ-10, `D-07.9`): cookieless, no consent banner, `A-07.1` untouched. Read the same way if the human meant a git release tag — none is cut (`OQ-00.3`) | nothing — **both copies are now marked.** `07` recorded it (`D-07.13`, `INV-07.8`) and `01` has since marked `OQ-01.1` answered in place, dated 2026-08-22 and citing the gate answer with `07` `D-07.13` / `OQ-07.9` and memo ADJ-10 (confirmed here 2026-08-23). `01` adds only the price of a later override: a new ADR there, a consent story in all three locales, and an amendment to `07` `INV-07.8` |
| `OQ-04.4` | HD-12 · `D-04.12` | Photos and translations stay placeholders as planned: `PhotoSlot` colour fill, no stock imagery, and Chinese parity in warn mode until PR-8.1 | nothing — but `OQ-10.3` (the photographs themselves) is still open on §1 |
| `OQ-12.1` | the human | **Accepted:** silence is acceptance of every default in §1. The gate then answered what it could of §6 and left the rest as this table's last column | nothing |
| `gp-dln.4` | HD-1 | The document set is accepted as the plan of record and ADR-001…009 stand as written. `00` records the sign-off | nothing |
| `gp-dln.8` | the human | The root `README.md` is Create-React-App boilerplate for a project that no longer is one and is replaced — in this documentation round per `10` §2 scope (b), with PR-2.2 as the fallback writer (`OQ-00.2`) | nothing |

Settled inside the plan, before the gate:

| Was open as | Settled by | The answer |
|---|---|---|
| `OQ-03.7` | `05`, memo ADJ-8 | `--dur-subpage: 500ms` (the reference's `.55s` desktop value is not adopted), and three per-instance leaf durations rather than one duration with `animation-delay` |
| `OQ-04.8` | `04`, no answerer | The `invalid_email` reconciliation was never open — `02`'s error table already carries the `invalid_email` row and maps it to `visit.form.fields.email.errors.invalid`, exactly what `D-04.14` records. The remaining key and field additions and the `WordSwap`-versus-`Reveal` wording are `04` §10 requirements on `02`, tracked there, not open questions |
| `OQ-05.7` | `03` §7, memo ADJ-8 | `03` adopted all 17 of `05` §5.13's token names and values verbatim; `03` owns token names, `05` consumes them |
| `OQ-10.5` | `10` | Account and registrar ownership is asked once, by `OQ-09.1`, `OQ-09.2`, `OQ-07.6` and `OQ-01.4`; `10` does not ask a fifth time. HD-13 does not revive it — the registrar login stays `OQ-09.2`'s to carry and `10` only schedules the ask (`D-10.14`) |
| `OQ-10.6` | `10` | The legacy-URL list is `OQ-06.3` and `OQ-09.8`, both of which already carry the expected answer |
| `OQ-02.2` (still on §1 as an override) | `D-02.8` | dev shows `⟦namespace.key⟧`, CI fails on any parity problem, production deep-merges over `en` and logs once. The human may overrule; nobody re-asks the design |
| `OQ-07.10` (still on §1 as an override) | `D-07.2`, `02`'s key set, `07` §9 | child's age = `infant`, `toddler`, `preschool`, `expecting`, `other`; desired start = the next 12 months plus `asap` and `flexible`; the Enrollment page reuses the five-field superset |
| `OQ-05.5` | `D-02.10`, `D-02.16`, `D-06.7`, `D-06.8` | Locale switch is a same-path `router.replace`; the Back mapping and client-namespace coverage are fixed |
| `OQ-08.4` | `D-09.4` | Previews stay protected; OPS-2.1 generates the bypass secret `lighthouse-preview` needs |
| `OQ-08.11` — **closed 2026-08-23**, off §2 | `06` `D-06.15`(a); `08` retired its own entry 2026-08-23 | While `zh-Hant` is held out of `routing.locales`, a `zh-TW` / `zh-HK` / `zh-MO` / `zh-Hant-*` reader negotiates to `zh-Hans`, never to `en`: each row of `02`'s table is an ordered preference chain filtered by `routing.locales` and the first survivor wins. `08` asserts both halves — its `@i18n` row (`zh-TW` → `/zh-Hans` while the locale is held back, `zh-TW` → `/zh-Hant` once it is enabled) and `06` §6.10's pure negotiation unit test. Nothing here reaches launch: the answer is a proxy behaviour PR-3.1 implements, and enabling `zh-Hant` is still `OQ-02.8`'s |
| `OQ-11.4` (still on §2 until `11` retires it) | `D-00.4` | A thin pointer `CLAUDE.md` lands in PR-2.2; `00-README.md` and `11-work-tracking.md` remain the conventions of record |
| Root-path locale detection | `D-02.9` | Detection on the bare root is **on**; `localePrefix: 'always'` for every other path |
| "Child's age" option set | `D-02.4` rule 8, memo ADJ-9 | The canonical five ids — `infant`, `toddler`, `preschool`, `expecting`, `other`. `OQ-07.10` keeps only the owner's right to trim or relabel |
| Mobile footer licence line (`gp-dln.9`) | `D-02.13` | The licence number renders on **both** views; the mobile prototype's omission is prototype drift |
| Route-transition mechanism | memo ADJ-3, `D-05.10` | React `<ViewTransition>` with `<Link transitionTypes>`; `05` §5.7's F1 is the fallback only if the PR-4.4 spike fails |
| Locale-toggle animation | memo ADJ-4, `D-05.9` | An enter-only per-block cascade via `Reveal variant="swap"`; `WordSwap` is only the menu sample-line and day swap. The per-string crossfade is not portable to URL-based locales |
| Language-switcher chevron | memo ADJ-20, `D-06.9`, `D-04.16` | **None.** The trigger's visible content is the fixed-width `shortLabel` and nothing else. `02` `D-02.10` wrote "plus the design's `⌄`" from a premise nobody had checked; `06` checked the handoff — its only `⌄` is the hero scroll cue's and `[data-langtoggle]` is a bare nav item — and `04` `D-04.16` flagged the conflict rather than burying it. Chevron-less is the default of record in all three documents, and adding one is a new design instruction, not the resolution of an open half. What `OQ-06.10` still asks is the open state, not this |
| The sending-identity sample | memo ADJ-24, `07` `D-07.10` | `mail.greenpasturesdaycare.com` / `no-reply@mail.greenpasturesdaycare.com` / `hello@greenpasturesdaycare.com`. Six documents had split between this spelling and `mail.greenpastures.example`; `07`'s wins, and `02` and `09` have adopted it, because a placeholder on the domain the owner holds is one they can verify in Resend without inventing a hostname. Only the sample changed: the sending domain remains a separate value from the site domain, nothing derives one from the other at runtime, it stays provisional until verification (`OQ-07.6`), and `brand.url` does not move with it (`OQ-09.10`) |
| The 303 fallback target | memo ADJ-21, `D-06.6` | `/{locale}#visit` — no slash before the hash, so the no-JavaScript fallback does not spend a `trailingSlash` 308 hop first. `07` carried `/{locale}/#visit` in two places and has corrected both |
| Static export | memo ADJ-2, ADR-007 | Never `output: 'export'` — next-intl's proxy does not run under static export |
| Framework and runtime versions | memo ADJ-1, ADR-001 | Next.js 16.x, React 19.2, Node 24; `proxy.ts`, Turbopack, no `next lint` |
| Tailwind duration tokens | memo ADJ-5 | There is no `--duration-*` theme namespace; `--dur-*` are plain custom properties, `--ease-*` is a namespace |
| Motion-token TS mirror | memo ADJ-8 | `src/design/tokens.ts` |
| Namespaces and option sets of record | memo ADJ-9 | `02` is the contract of record; `07` owns the handler's error-code list and `02` defines a message for every code |
| Analytics launch default | memo ADJ-10, `D-07.9` | Vercel Web Analytics + Speed Insights, cookieless. The *override* was the last open half and the human declined it on 2026-08-22 — see the gate table above |

### 6 · The hard blockers — still eight, and seven of them already read as "answered"

Every other row in §1 has a default the plan can ship under. These eight do not — no default at all, or one a
release gate rejects — and each stops a named gate. **The trap this section exists to spring is that seven of
the eight now carry an answer dated 2026-08-22**, one more than before the second round. HD-4 and HD-7
replaced the `TODO` sentinels with plausible sample values, which is a real improvement — previews look
honest and the owner edits a value instead of inventing one — and it moved nothing across the launch line.
Their owning documents say so in the same words: `07` marks `OQ-07.6`, `OQ-07.7` and `OQ-07.8` "answered for
build purposes; still a launch blocker", and `06` marks `OQ-06.9` "partly answered".

**HD-13 is the same trap in a new shape, and the one row that changed substance.** The domain was the last
blocker here with *no shippable default at all*; it now has a name, so what stops the cutover is no longer a
missing fact but a missing login. That is a smaller thing and a different kind of thing — an access item, not
a decision — and it is still an unanswered one, so the row stays with its gate. Nothing else moved: HD-14
closed a question that was never in this section, and HD-15, `ADJ-20`…`ADJ-22` and `ADJ-24` touch no row
here — `ADJ-24` fixes which spelling of the sending sample is of record, and row 4 blocks on the same thing
under either spelling: an unverified domain. A reader who sees "answered" and infers "launch is clear" is
now wrong seven times out of eight.

| # | Id(s) | Stops | State after 2026-08-22 | Why it still cannot ship |
|---|---|---|---|---|
| 1 | `OQ-11.3` | the **Phase 2 gate** | answered in intent (§1 + §5) and half true in fact — the human added protection, and it targets the default branch | Verified against the GitHub API 2026-08-23: the "Main Protection" ruleset's `ref_name.include` list **does** name the default branch, so `deletion`, `non_fast_forward` and `pull_request` (squash-only) are live and `main` rejects a direct push. What does not exist is a `required_status_checks` rule — **zero** required checks — so none of `08`'s six (`static`, `content`, `unit`, `build`, `e2e-ok`, `bead-trailer`) blocks a merge, and the gate's "CI and `bead-trailer` required on `main`" still cannot be ticked. Adding that rule is a repository setting only the human can make (`11` §5, `09`) |
| 2 | `OQ-09.1` (the launch half) · `OQ-10.7` | the **launch gate** / the DNS cutover | plan half answered (§1 + §5) — Hobby at start | Vercel's Hobby plan is licensed for non-commercial use and a daycare's marketing site is commercial, so production cannot stay on it: launch item 3a needs either an upgrade to Pro or a written eligibility confirmation. Hobby also allows a single custom WAF rule, which `D-07.7`'s rate limit consumes entirely, and it keeps runtime logs for one hour rather than a day (`OQ-09.7`) and offers no free Viewer seat for a reviewer (`OQ-09.3`). `OQ-10.7` decides *when* the change happens — OPS-7.3 or OPS-8.1 — and `OQ-09.1` still owes billing, seats and a budget cap |
| 3 | `OQ-06.2` · `OQ-09.2` (**the registrar half** — the name is no longer a blocker) | the **DNS cutover** (OPS-8.1), and nothing earlier | **name answered 2026-08-22 (HD-13)** — `greenpasturesdaycare.com` (§1 + §5) | The name is settled and written through `06` §6.5–6.6, `09` §1–§2 and `09` §5.1; no `<domain>` placeholder survives in either document. What has never been answered is **who can sign in and edit the zone.** OPS-8.1 adds an apex `A` record and a `www` `CNAME`, and neither can be typed by someone without the registrar (or DNS-host) login; the same access gates Search Console verification, the Turnstile hostname list and 07's Resend records. No default exists, because nobody can be assumed into an account — and per `D-09.19` the answer must be an invitation to the daycare's own account, never a shared password |
| 4 | `OQ-07.6` | the **Phase 7 gate** | answered for the build, twice (§1 + §5) — HD-4 gave it a shape, HD-13 a real host | `07` `D-07.10` now writes `mail.greenpasturesdaycare.com` and `hello@greenpasturesdaycare.com`, which is a better placeholder and not a working one. **The reason it blocks changed with the domain:** the old guarantee was RFC 2606 (`.example` can never hold DKIM records); the new one is verification state — Resend refuses an unverified `from` and the subdomain has no DKIM/SPF until `09` publishes it (which needs blocker 3's access). The mailbox names are still the owner's to confirm, and no human reads that inbox yet. The form renders, validates, submits — and fails at the last hop |
| 5 | `site.json.provisional` non-empty — `D-02.20` · `INV-02.10` (no `OQ-` of its own) | the **launch gate** | the one row with no question to answer: a machine rule, unchanged by either round | `pnpm validate:content --release` fails while the array has any entry, listing every one. This is the machine rule behind rows 6–8, and it also covers two values no single question owns: `brand.url` and the `email.*` sending identity. **23 entries** ship at Phase 3 (grouped below); HD-13 supplies the *value* for one of them and empties none, because clearing an entry is an edit somebody still has to make. Two entries — the `zh-Hant` brand values — are unresolvable while that locale is held out of `routing.locales`, which is `OQ-08.10` in §2, not a launch matter |
| 6 | `OQ-02.4` · `gp-dln.12` | the launch gate | answered provisionally, retired from §1 (§5) | 优朵幼儿园 is the human's answer *and* the human said it is not final. Four entries — `brand.name` and `brand.shortName` for both Chinese locales — stay in `provisional` until it is confirmed, and no placeholder is shippable in a footer |
| 7 | `OQ-06.9` · `OQ-07.8` · `gp-dln.13` | the launch gate | answered for the build (§1 + §5) | A licence number of `000000000`, a reserved-range phone number and `1234 Sample Way` are the kind of wrong a live site publishes confidently, in JSON-LD as well as on the page. Twelve entries; nobody but the owner can supply the real values |
| 8 | `OQ-07.7` | the launch gate | answered for the build (§1 + §5) | `5.0` from `47` reviews is a claim about a real business made by a placeholder. Three entries; deleting the `yelp` block clears them just as well as replacing them |

**The 23 provisional entries, grouped by the question that supplies the real value** (`D-02.20` carries the
array verbatim; this is the same list read from the other end, so the launch checklist can be worked question
by question):

| Group | Paths | Count | Cleared by |
|---|---|---|---|
| Domain | `brand.url` | 1 | **no longer waiting on an answer** — HD-13 supplies the value (`https://greenpasturesdaycare.com`), so this entry is cleared by an edit: `02` replaces the `https://greenpastures.example` sample and drops the entry, or `OQ-09.10` deletes the field in favour of `NEXT_PUBLIC_SITE_URL` and the entry with it. `ADJ-24` did **not** make that edit: the sending identity moved to the real host and `brand.url` was left where it is, sample and all, because its fate is `OQ-09.10`'s (`09` §5.1 items 1 and 11 say the same) |
| Brand name | `brand.name.zh-Hans` · `brand.name.zh-Hant` · `brand.shortName.zh-Hans` · `brand.shortName.zh-Hant` | 4 | `OQ-02.4` · `gp-dln.12` |
| Sending identity and inbox | `contact.email` · `email.sendingDomain` · `email.fromAddress` | 3 | `OQ-07.6` |
| Owner facts | `contact.phone` · `contact.phoneDisplay` · `contact.address.street` · `contact.address.postalCode` · `contact.mapsUrl` · `license` · `collections.teachers.{ping,reyes,chen}.name` · `collections.teachers.{ping,reyes,chen}.credentials` | 12 | `OQ-06.9` · `OQ-07.8` · `gp-dln.13` |
| Yelp | `yelp.rating` · `yelp.reviewCount` · `yelp.url` | 3 | `OQ-07.7` |

Two of the eight stop a gate *before* launch — `OQ-11.3` at Phase 2 and `OQ-07.6` at Phase 7 — and six stop
launch itself, the registrar login among them (it is needed at the cutover, not at PR-6.8). None of them can
be cleared by the build: every one needs a person to supply a value, open an account or change a setting, and
no amount of code shortens the list. That is the shape the second round left rather than a length it changed —
it took a fact off the list and put an access item in its place, which is why the count is still eight. The
provisional block printed by `pnpm validate:content` and repeated in `reports/content-coverage.md` is the
working copy of rows 5–8; `09` owns the launch checklist that reads it.

### 7 · How a question gets closed

1. The human or the named seat answers it.
2. The **owning** document changes: the decision text, and the `OQ-` entry is marked answered with the
   decision that answers it. An answer that lives only here is not an answer (`D-12.1`).
3. This register's row moves to §5 in the same pull request, keeping the id and naming both the decision and
   the date. If the answer unblocks the build without unblocking launch — a sample default, a plan that must
   change before the cutover, a setting that exists but is misconfigured — §6 keeps a row for it and names
   the gate it still stops (`D-12.2`). Moving a row out of §1 without asking that question is the failure
   mode this step exists to prevent.
4. If the question had a bead (`gp-dln.6`, `gp-dln.12`, `gp-dln.13`), the bead is closed by the human in the
   same pass, per `11`. All three were answered on 2026-08-22 (§3).
5. If the answer changes a phase, a gate or the roadmap, `10`'s affected rows and `00` §2–§4 change in the
   same pull request (`INV-10.5`, `INV-00.2`).

### 8 · Invariants

- **INV-12.1 The register is complete.** The **Id(s) column** of §1 and §2 together contains, exactly once,
  every `OQ-` identifier declared in `01`–`11` that is still on the register; §5 carries the ids their own
  documents have retired, which reach neither §1 nor §2. Ids declared by `00` and by this document
  (`OQ-00.n`, `OQ-12.n`) are outside that population and live in their own *Open questions* sections; §5 may
  quote one for context without registering it. The two together must reproduce the whole population:
  each document numbers its questions contiguously from `.1`, so that population is the sum of the highest
  id in each — `01` 5 · `02` 8 · `03` 7 · `04` 11 · `05` 8 · `06` 10 · `07` 11 · `08` 11 · `09` 11 ·
  `10` 7 · `11` 4 = **93** as of 2026-08-23 — which makes the total re-derivable from the documents rather
  than trusted here. It was 85 before the Phase 1 gate: answering twelve questions opened eight new ones
  (`OQ-02.8`, `OQ-04.11`, `OQ-06.10`, `OQ-07.11`, `OQ-08.10`, `OQ-08.11`, `OQ-09.11`, `OQ-10.7`), which is
  what a decision that reaches four documents costs. The second round (HD-13…HD-15) opened **none** — it
  answered inside questions that already existed — and neither did `08` retiring `OQ-08.11` on 2026-08-23,
  because retiring an id moves it rather than adding one. The population is therefore unchanged at 93 and
  only the split moved: **59** ids sit in §1, **14** in §2 and the remaining **20** in §5 (15 and 19 before
  2026-08-23).
  **How many of the 93 are already decided is deliberately not restated as a number:
  §5 is that list.** It grows every time an owning document closes a question, and a count repeated in this
  invariant would rot silently, since nothing mechanically enforces it. An id is in §5 *and* still on the
  register only while something narrower stays open — the human's right to override a decision already taken
  (`OQ-02.2`, `OQ-07.10`), a document that has recorded the answer without yet retiring its own entry
  (`OQ-11.4` — and `OQ-08.11` for one day, until `08` retired its entry on 2026-08-23 and the id left the
  register for §5, which is what this clause is for), or — new on 2026-08-22 — an answer
  that covers the build and not the launch (`OQ-11.3`, `OQ-09.1`/`OQ-01.4`, `OQ-06.9`, `OQ-07.6`, `OQ-07.7`,
  `OQ-07.8` and, since HD-13, `OQ-06.2`/`OQ-09.2`).
  Both assumption families are in §4: `A-07.1`–`A-07.7` and `A-10.1`–`A-10.3`, ten in total — `A-07.6` and
  `A-07.7` are new on 2026-08-22, and neither round since has added or falsified one.
- **INV-12.2 No question is answered here.** A row may *record* an answer another document adopted; it may
  never be the only place that answer exists.
- **INV-12.3 Every row has a default, or it is in §6 — and being in §5 is not an exemption.** A row whose
  default cannot ship (none at all, or one a release gate rejects) is a hard blocker and appears in §6 with
  the gate it stops, whether the question is still open in §1 or already decided in §5. There are **eight**:
  `OQ-11.3` and the **registrar half** of `OQ-06.2`/`OQ-09.2` have no shippable default (HD-13 answered the
  name half, which removes a fact from the list and leaves an access item on it); `OQ-09.1`'s launch half
  defaults to a plan whose own terms forbid this use; `OQ-07.6`, `OQ-07.7`, `OQ-07.8`/`OQ-06.9` and `OQ-02.4`
  default to provisional sample values; and the registry rule itself (`D-02.20`, `INV-02.10`) fails
  `validate:content --release` while any of the 23 entries remains.
- **INV-12.4 Alias rows name every id they close** (`D-12.5`) in the Id(s) column, so a reader searching any
  single `OQ-` id finds exactly one row. Prose in other columns may cite an id in passing; only the Id(s)
  column registers one.
- **INV-12.5 §6 is derived, not curated.** A row belongs in §6 if and only if some named gate would fail
  today with the values and settings the plan currently ships. A §6 row is deleted only in the pull request
  that clears the thing — the entry replaced, the setting fixed, the name supplied — and never in advance of
  it. A question moving to §5 is not that pull request.

## Open questions

- **OQ-12.1** · answerer: human (Hanyi), at the Phase 1 gate — **ANSWERED 2026-08-22 (human).** The question
  was which of the then 56 human-owned rows in §1 the human wanted to answer now and which were accepted as
  defaults. The answer is **accepted**: silence is acceptance of every default. The same sitting then answered
  fourteen of the rows outright (§5) and left the rest at their defaults; the blockers in §6 are chased
  individually at their phase, which is now eight rather than six.
- **OQ-12.2** · answerer: `10` (writer-breakdown) — **answered.** The question was whether `10` §14 should be
  re-synced or shrink to a pointer at this document. `10` took the default: §14 stays, and records in writing
  that this document is authoritative wherever the two disagree. It has now been re-synced four times; on the
  fourth pass `10` synced against the **owning documents** rather than against this register, because `12`
  re-syncs last this round (`ADJ-22`) and was the older of the two sources. That pass added the six ids §14
  was missing — `OQ-04.11`, `OQ-06.10`, `OQ-07.11`, `OQ-08.10`, `OQ-08.11`, `OQ-09.11` — all six of which
  `INV-12.1`'s census had already counted here, and corrected `10`'s cross-reference ranges to `OQ-04.1…11`,
  `OQ-06.1…10`, `OQ-08.1…11` and `OQ-09.1…11`. The two documents agree as of this revision.
- **OQ-12.3** · answerer: `04` (writer-components) — **answered.** `04` cited a subpage-set identifier in
  02's family that `02` never declares (`02` stops at `OQ-02.7`, which *is* the subpage-set question). All
  four sites now cite `OQ-02.7`, `OQ-04.5` among them. This register never propagated the phantom id.
- **OQ-12.4** · answerer: human (Hanyi), at the next gate — The 2026-08-22 acceptance was given against the
  defaults as they read on that day, and some of them changed in the same pass: `OQ-07.8`'s default went from
  "locality only" to a provisional street address, `OQ-10.4`'s from one Chinese locale to two, `OQ-04.4`'s
  from a question to a decision. The second sitting did it again in the other direction — `OQ-03.4`'s default
  became a decision and stopped being a default at all, and `OQ-06.10`'s chevron half was adjudicated rather
  than defaulted (`ADJ-20`), which is a stronger claim on the design owner than a default would have been.
  Does standing acceptance carry to a row whose default is rewritten after the gate? Default if unanswered:
  yes — silence continues to mean acceptance, and any row whose default changes materially is re-surfaced in
  the phase gate review that follows the change rather than waiting for a new sitting.

## Cross-references

- `docs/technical/00-README.md` — §4 lists the short version of §1 for the human; `D-00.4` answers `OQ-11.4`.
- `docs/technical/01-stack-decisions.md` — `OQ-01.1`…`OQ-01.5`; ADR-005 and ADR-009 are amended by
  `OQ-05.2` and `OQ-01.5` respectively.
- `docs/technical/02-i18n-content-contract.md` — `OQ-02.1`…`OQ-02.8`; `D-02.4`, `D-02.8`, `D-02.9`,
  `D-02.10`, `D-02.13`, `D-02.16`, `D-02.17`, `D-02.19`, `D-02.20`, `D-02.21` close several entries in §5,
  and `INV-02.10` / `INV-02.11` are the machine rules behind §6.
- `docs/technical/03-design-system-tokens.md` — `OQ-03.1`…`OQ-03.7`; `D-03.5` is the CJK stack HD-14 confirmed
  as the launch decision and `D-03.14` splits it into `--font-cjk-sc` / `--font-cjk-tc`; `OQ-03.4` is closed
  there, and names `OQ-01.2` and `OQ-04.9` as closing with it.
- `docs/technical/04-components-sections.md` — `OQ-04.1`…`OQ-04.11`; `D-04.7`, `D-04.8`, `D-04.9`, `D-04.12`,
  `D-04.16` (the chevron-less trigger, `ADJ-20`).
- `docs/technical/05-animation-system.md` — `OQ-05.1`…`OQ-05.8`; `D-05.9`, `D-05.10` and §5.7's F1 fallback.
- `docs/technical/06-routing-pages-seo.md` — `OQ-06.1`…`OQ-06.10`; `D-06.6` (the `#visit` fallback target,
  `ADJ-21`), `D-06.7`, `D-06.8`, `D-06.9`, `D-06.11` (HD-13's production origin), `D-06.15`(a) with §6.10's
  negotiation unit test (the answer to `OQ-08.11`, which `08` retired on 2026-08-23), `INV-06.10`, §6.5,
  §6.6, §6.9, §6.10's origin gate, §6.12's four asks on `02` — of which the chevron correction is satisfied
  and three stay live (`OQ-06.8`).
- `docs/technical/07-forms-integrations.md` — `OQ-07.1`…`OQ-07.11` and `A-07.1`…`A-07.7`; `D-07.2`, `D-07.6`,
  `D-07.8`, `D-07.9`, `D-07.10` (the sending identity, written on HD-13's domain), `D-07.11`, `D-07.13`,
  `INV-07.8`.
- `docs/technical/08-testing-quality.md` — `OQ-08.1`…`OQ-08.11`, of which `OQ-08.11` is **closed there
  2026-08-23** on `06` `D-06.15`(a) and now sits in §5 only; `D-08.8`, `D-08.18`, `INV-08.4`, `INV-08.7`,
  `MC-08.1`, §3 rule 6, the `@i18n` row's held-back and enabled `zh-TW` cases, §8, §10.
- `docs/technical/09-deployment-operations.md` — `OQ-09.1`…`OQ-09.11`; `D-09.2` (the Hobby decision), `D-09.4`,
  `D-09.5` (`greenpasturesdaycare.com`, apex canonical, `www` → apex 308), `D-09.10`, `D-09.12`, `D-09.13`,
  `D-09.15`, `D-09.19` (accounts belong to the daycare, the developer is invited), `D-09.20`, `INV-09.6`;
  §5.1 items 1–2, 6–7, 11, 13.
- `docs/technical/10-work-breakdown.md` — `OQ-10.1`…`OQ-10.7` and `A-10.1`…`A-10.3`; `D-10.12`, `D-10.13`,
  `D-10.14` (the domain as lead time rather than a blocker); §14 is the phase-and-row view of the same set,
  re-synced on its fourth pass against the owning documents because this register goes last (`ADJ-22`),
  `D-10.6` the Chinese-locale warn policy, `INV-10.5` the update rule, §9 the post-launch backlog a CJK
  webfont joined when HD-14 closed `OQ-03.4`.
- `docs/technical/11-work-tracking.md` — `OQ-11.1`…`OQ-11.4`; `D-11.6` and §5–§6.
- Beads: `gp-dln.4` (Phase 1 gate, closed at the gate), `gp-dln.6`, `gp-dln.12`, `gp-dln.13` (all three
  answered 2026-08-22, §3), `gp-dln.8` (root `README.md`) and `gp-dln.9` (answered, see §5).
- The human's answers `HD-1`…`HD-15` (`D-12.7`) — `HD-1`…`HD-12` at the Phase 1 gate, `HD-13`…`HD-15` in the
  second sitting the same day — and the adjudications `ADJ-20` (no chevron), `ADJ-21` (`/{locale}#visit`),
  `ADJ-22` (this register and `00` re-sync last) and `ADJ-24` (the sending identity is spelled on the real
  domain; `02` and `09` move to `07`'s samples) are recorded in the documents that own them; this register
  cites them, and §5 is the roll-up.
- `docs/design/README.md` — the source of the subpage-set discrepancy (`gp-dln.6`) and of the assets list
  behind `OQ-10.3` and `OQ-03.6`.
