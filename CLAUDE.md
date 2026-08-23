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

## The local agent sandbox

Three facts about the Claude Code sandbox on a developer machine. None is a defect in this repository, and
none of them applies to CI or to Vercel.

- **Run `pnpm build` and `pnpm verify` with the sandbox disabled.** Turbopack compiles `globals.css`
  through a PostCSS worker, the worker spawns a process that binds a loopback port, and the sandbox
  denies that — a bare `listen(0, "127.0.0.1")` returns `EPERM` inside it and succeeds outside. The build
  dies with `TurbopackInternalError … creating new process … binding to a port … Operation not permitted
  (os error 1)`.
- **One sandboxed build poisons the tree.** Next 16 stores the failure in its persistent cache, so every
  later build replays the same error *even with the sandbox disabled*. The failure then looks permanent
  and reproducible; it is neither. Recovery is `rm -rf .next/cache/turbopack`, then build unsandboxed.
  Two seats independently concluded the build was broken before anyone cleared that cache — check it
  before you report a broken build.
- **No agent here can read `.env*`.** The permission layer denies it to the shell and to file-reading
  tools alike, so a seat can write `.env.example` and cannot read back what it wrote. Its contents are
  verified by a human, never by the seat that produced them.

## Everything else

[`docs/technical/00-README.md`](docs/technical/00-README.md) indexes the thirteen documents and publishes
three reading orders — build the site, edit its words, review a gate. Where this file and an owning document
disagree, the owning document is right.
