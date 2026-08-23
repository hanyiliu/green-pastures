# CLAUDE.md

Orientation for anyone — human or agent — writing code here. It is deliberately thin. The conventions of
record are [`docs/technical/00-README.md`](docs/technical/00-README.md) and
[`docs/technical/11-work-tracking.md`](docs/technical/11-work-tracking.md); this file carries only the few
rules that are easy to break before you have read them, and defers everything else (`D-00.4`).

## What this repository is

The website for **Green Pastures Montessori Daycare**, a childcare centre in Fremont, California — a marketing
site whose job is to let parents read about the programs and request a tour. It ships from one codebase in
three locales: `en` (default and reference), `zh-Hans` and `zh-Hant`. The finished designs are in
`docs/design/`; the technical plan of record is `docs/technical/00`–`12`.

## The rule that shapes the codebase

**Every user-visible string lives in the content JSON, never as a literal in a component.** Words belong in
`content/<locale>/`; facts that read the same in every language — phone, hours, URLs, image paths, licence
number — belong once in `content/site.json`. A string typed into a file under `src/` is a defect, not a
shortcut, and two separate gates catch it: ESLint's `react/jsx-no-literals` fails the build on the literal
itself (`INV-02.1`), and `pnpm validate:content` fails on the key drift that follows when only one locale
gets the new text (`INV-02.2`). The binding contract is
[`docs/technical/02-i18n-content-contract.md`](docs/technical/02-i18n-content-contract.md).

## Commits and merges

- **One `Bead:` trailer per commit.** Every non-merge commit carries exactly one, in the trailer block,
  matching `^Bead: gp-[a-z0-9]+(\.[0-9]+)*$` and naming a bead that exists — e.g. `Bead: gp-dln.8`. The
  `bead-trailer` check fails the pull request otherwise (`W-11.3`, `D-11.4`). Never invent an id.
- **`main` takes squash merges only** — no merge commits, no rebase merges, no direct pushes. One pull
  request is one squash commit is one bead (`D-09.9`, `INV-09.5`).
- **Do not run `bd`.** The tracker is the orchestrator's; it claims and closes beads on a seat's behalf
  (`INV-11.4`).

## Everything else

[`docs/technical/00-README.md`](docs/technical/00-README.md) indexes the thirteen documents and publishes
three reading orders — build the site, edit its words, review a gate. Where this file and an owning document
disagree, the owning document is right.
