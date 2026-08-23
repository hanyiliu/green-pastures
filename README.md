# Green Pastures Montessori Daycare — website

This repository holds the website for Green Pastures Montessori Daycare in Fremont, California: a marketing
site for a childcare centre, published in English and Chinese, whose job is to let parents read about the
programs and request a tour. The designs and the technical plan are finished; the site itself is being built
against them now.

## Status

- **Designs — complete.** `docs/design/` is the handoff: the shared design system, per-view desktop and mobile
  specs, and the `.dc.html` hi-fi references that carry the prototype copy.
- **Technical plan — complete and merged.** `docs/technical/` holds thirteen documents (`00`–`12`) covering the
  stack, the content contract, components, animation, routing and SEO, forms, testing, operations, the work
  breakdown and the open questions.
- **Application code — building.** The scaffold has landed: `package.json`, the Next.js app under `src/`, the
  content tree under `content/`, and the test setup. The developer-facing half of this README — what to run,
  and how to get a dev server up — is written when Phase 2 replaces this file (10 PR-2.2); until then the
  commands live in `package.json` and the plan.

## Stack

Next.js 16 App Router with TypeScript `strict` and React 19.2, pnpm on Node 24, Tailwind CSS v4 with the design
tokens as CSS custom properties, next-intl for locale routing and messages, Motion for in-page animation, and
Vercel for hosting. Each choice — with its alternatives, costs and recorded dissent — is an ADR in
[docs/technical/01-stack-decisions.md](docs/technical/01-stack-decisions.md).

## How the content works

All user-visible text lives in editable JSON, one folder per locale under `content/` (`en` is the reference
locale, alongside Simplified and Traditional Chinese), while every locale-agnostic fact — phone, hours, URLs,
image paths, licence number — lives once in `content/site.json`.

**To change the words on the site, start here — no checkout, no install, all of it in the browser:**

- [content/README.md](content/README.md) — the editor's and translator's guide: where each sentence lives, how
  to edit one on github.com and open a pull request, and how to replace a value that is not real yet.
- [content/GLOSSARY.md](content/GLOSSARY.md) — the vocabulary that guide uses (*key*, *locale*, *collection*,
  *provisional*), and every recurring term with its English, Simplified and Traditional Chinese rendering.

Behind those two: [docs/technical/02-i18n-content-contract.md](docs/technical/02-i18n-content-contract.md) is
the binding contract for the content tree, and §4 of
[docs/technical/09-deployment-operations.md](docs/technical/09-deployment-operations.md) is the same editing
workflow written out in full.

## Where to start reading

- Building or reviewing the site → [docs/technical/00-README.md](docs/technical/00-README.md), the index of
  the plan, with a reading order for building the site, one for editing its words, and one for reviewing the
  gate.
- Changing the text on the site → [content/README.md](content/README.md), with
  [content/GLOSSARY.md](content/GLOSSARY.md) beside it. Nothing else in this repository is yours to edit.

## Repository layout today

```text
content/          every editable word and fact — README.md is the editor's guide, GLOSSARY.md the term list
docs/design/      design handoff — shared system, desktop and mobile specs, .dc.html references
docs/technical/   the technical plan, 13 documents; 00-README.md is the index
.beads/           issue-tracker state (Beads); see docs/technical/11-work-tracking.md
.claude/          agent configuration and skills for this repository
README.md         this file
```

`src/` and the toolchain are landing phase by phase; `public/` does not exist yet. The plan creates them in the
order set out in [docs/technical/10-work-breakdown.md](docs/technical/10-work-breakdown.md).
