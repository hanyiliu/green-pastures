# Green Pastures Montessori Daycare — website

This repository holds the website for Green Pastures Montessori Daycare in Fremont, California: a marketing
site for a childcare centre, published in English and Chinese, whose job is to let parents read about the
programs and request a tour. It is in planning — the designs and the technical plan are finished, the site
itself is not built yet.

## Status

- **Designs — complete.** `docs/design/` is the handoff: the shared design system, per-view desktop and mobile
  specs, and the `.dc.html` hi-fi references that carry the prototype copy.
- **Technical plan — complete and merged.** `docs/technical/` holds thirteen documents (`00`–`12`) covering the
  stack, the content contract, components, animation, routing and SEO, forms, testing, operations, the work
  breakdown and the open questions.
- **Application code — none.** There is no `package.json`, no dev server, no build, and no test suite, so this
  README documents no commands. Implementation begins when the Phase 1 gate (bead `gp-dln.4`) closes; the first
  scaffold PR adds the toolchain, and the commands belong in this file only once they exist.

## Stack (planned, not installed)

Next.js 16 App Router with TypeScript `strict` and React 19.2, pnpm on Node 24, Tailwind CSS v4 with the design
tokens as CSS custom properties, next-intl for locale routing and messages, Motion for in-page animation, and
Vercel for hosting. Each choice — with its alternatives, costs and recorded dissent — is an ADR in
[docs/technical/01-stack-decisions.md](docs/technical/01-stack-decisions.md).

## How the content works

All user-visible text lives in editable JSON, one folder per locale under `content/` (`en` is the reference
locale, alongside Simplified and Traditional Chinese), while every locale-agnostic fact — phone, hours, URLs,
image paths, licence number — lives once in `content/site.json`.
[docs/technical/02-i18n-content-contract.md](docs/technical/02-i18n-content-contract.md) is the binding
contract for that tree, §4 of
[docs/technical/09-deployment-operations.md](docs/technical/09-deployment-operations.md) is the editing
workflow written for a non-developer, and a shorter day-to-day guide will ship at `content/README.md` with the
content tree itself.

## Where to start reading

[docs/technical/00-README.md](docs/technical/00-README.md) — the index of the plan, with a reading order for
building the site, one for editing its words, and one for reviewing the gate.

## Repository layout today

```text
docs/design/      design handoff — shared system, desktop and mobile specs, .dc.html references
docs/technical/   the technical plan, 13 documents; 00-README.md is the index
.beads/           issue-tracker state (Beads); see docs/technical/11-work-tracking.md
.claude/          agent configuration and skills for this repository
README.md         this file
```

There is no `src/`, `content/`, `public/` or `package.json` yet. The plan creates them, in the order set out in
[docs/technical/10-work-breakdown.md](docs/technical/10-work-breakdown.md).
