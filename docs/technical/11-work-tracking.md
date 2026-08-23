# 11 · Work tracking conventions (beads)

**Purpose.** This document is the binding rulebook for how work on the Green Pastures site is tracked:
which tool is the tracker of record, who may write to it, how a unit of work relates to branches, commits
and PRs, what CI enforces, and how the tracker survives across machines and clones. It exists because the
`super-orchestrator` skill (`.claude/skills/super-orchestrator/SKILL.md`) cites a work-tracking document
by rule id on almost every page; this is that document for this repository. It covers the tracker only —
the plan's content lives in `10-work-breakdown.md`, the CI gate inventory in `08-testing-quality.md`.

Status: draft · seat writer-tracking · 2026-08-22

## Decisions

- **D-11.1** Beads (`bd` 1.1.0, prefix `gp`, embedded Dolt) is the tracker of record: every unit of work is a
  bead in the `bd` graph, and the board is a projection of that graph, never a second copy. It is adopted as
  a *tracker only*: issues, parent/child, dependencies, claims, status. Not adopted: molecules and formulas,
  swarms, gates and merge-slots, wisps/ephemeral beads, memories, agent/mail beads, federation, the
  Jira/Linear/GitHub integrations, `bd todo`, and the `AGENTS.md`/Codex/Claude setup files that `bd init`,
  `bd setup` and `bd onboard` generate (TRAP-11.2, TRAP-11.10).
- **D-11.2** Three roles write to or read from the tracker: the **human**, the **orchestrator** (the one
  process that runs `bd`), and **seats** (dispatched agents, who never run `bd`). Claims are made *on
  behalf of* seats: `bd update <id> --claim --actor <seat>`.
- **D-11.3** Graph shape: an epic bead is a lane; its children (created with `--parent`, ids like
  `gp-73v.1`) are task rows; `bd dep add <blocked> <blocker>` is the only ordering edge. Open questions are
  `decision` beads assigned to `human` that block the work waiting on them. When a plan is finer than the
  graph, board-only rows carry the bead id in their title and `board.py beads` upserts by bead id, leaving
  them alone — a finer projection of the same beads, never a second backlog.
- **D-11.4** Every non-merge commit carries exactly one `Bead: <id>` trailer; the `bead-trailer` GitHub
  Actions gate checks the PR's commit range and body, and resolves ids against the committed
  `.beads/issues.jsonl` at the PR head (CI has no Dolt).
- **D-11.5** PRs squash-merge. The PR body ends with the PR's single `Bead:` trailer and the repo's squash
  message source is "PR title and description", so the commit that lands on `main` keeps the trailer.
- **D-11.6** Sync policy: the embedded Dolt database is the source of truth; `export.auto` on;
  `.beads/issues.jsonl` and `.beads/interactions.jsonl` are tracked and committed in tracker-snapshot
  commits; `bd dolt push` to origin at session end once OQ-11.1 is answered; a fresh clone runs
  `bd bootstrap`. The Dolt data is never committed on a branch; once OQ-11.1 is yes it travels to origin
  only as `refs/dolt/data`.
- **D-11.7** Worktrees: one embedded database per machine, and `BEADS_DIR` points at it in every shell that
  runs `bd`. The `.beads/hooks/` shims stay tracked but are not activated; enforcement is CI, not hooks.
- **D-11.8** The ids in this document (`W-11.n`, `INV-11.n`, `TRAP-11.n`, `D-11.n`, `OQ-11.n`) are stable
  and are what the skill cites. The mapping from the skill's current foreign ids is in section 9.

## Design

### 1 · Roles and the lock

`bd` holds a Dolt lock for the life of each invocation; two from different shells serialise or hang
(TRAP-11.11). So only the orchestrator's shell runs `bd`. Seats receive the bead text pre-dumped to a file
(`bd show <id> > <scratch>/beads/<id>.txt`) and report in prose; the orchestrator applies the mutations.
The board (`board.py beads`) reads the graph with `bd --readonly list --json` and never writes back
(INV-11.2). The human runs `bd` freely and is the only role allowed to force anything (INV-11.5).

Seat names are the assignee strings: `writer-<topic>` implements, `check-<topic>` verifies,
`scout-<topic>` researches, `human` is the human. The orchestrator is never an assignee — `board.py`
refuses to render a row owned or verified by any orchestrator-word, which is the tier-0 fence made
checkable (INV-11.3).

### 2 · Rules

| id | rule |
|---|---|
| **W-11.1** | **Bead before branch.** A bead exists and is claimed before any branch, commit or PR for it. Discovered scope mid-task gets its own bead first (W-11.4). |
| **W-11.2** | **The seat is the assignee; the orchestrator never is.** `bd update <id> --claim --actor <seat>` sets the assignee to the actor and the status to `in_progress`, idempotently if the same actor already holds it. The actor resolves `--actor` > `$BEADS_ACTOR` > git `user.name` > `$USER`, so the seat name is always passed explicitly. The orchestrator runs the command on the seat's behalf (D-11.2), records the claim in the seat's brief, and must never be the assignee — nor any name `board.py` refuses (`orchestrator`, `orchestrators`, `orchestration`, `tier0`, `self`, `me`, `you`). Unclaim: `bd update <id> --assignee "" --status open` (or `bd assign <id> ""`); there is no `--unclaim`. |
| **W-11.3** | **`Bead: <id>` trailer on every commit.** Regex `^Bead: gp-[a-z0-9]+(\.[0-9]+)*$`, exactly one per non-merge commit, in the trailer block, resolving to a claimed bead. Enforced by the `bead-trailer` gate (section 6). |
| **W-11.4** | **Discovered work becomes a bead**: `bd create "<title>" --parent <epic-id> --type <task, bug or chore> --priority <0-4> --deps discovered-from:<origin>`, plus `bd dep add <blocked> <new>` if it blocks something, then `board.py beads`. Never a `TODO`, `FIXME`, `HACK` or a private list. Accepted sweep findings follow the same rule; the reviewer's ledger is its memory, not a backlog. |
| **W-11.5** | **`bd prime` at session start**, every session, before routing anything; then `board.py beads` to re-sync. Dispatching against a stale picture is how two seats land on one bead. |
| **W-11.6** | **Never self-close.** Phase gates define done; the verifier reports the gate result; the orchestrator closes with `bd close <id> --reason "<gate>: pass · <verifier>"`. An implementer never closes its own bead, and a seat never closes anything. |
| **W-11.7** | **Escalate, don't spin.** One mechanical retry (flaky command, missing path) with the failure added to the brief. Anything else: unclaim (W-11.2), set the board row `failed`, and flag the human. The same restraint binds the watchdog: after a close-out instruction the heartbeat originates no beads — it confirms nothing is dropped, leaves remaining beads `open` and assigned `human`, and stays quiet. |
| **W-11.8** | **Open questions and sign-off gates are beads owned by the human**: `bd create "OQ-<doc>.<n> · <question>" -t decision -a human -l oq`, then `bd dep add <waiting-work> <oq-bead>` (first argument depends on the second). `gp-dln.4` is the existing human-owned gate. Nobody but the human closes one; a bead blocked on an OQ is unclaimed (W-11.2), flagged, and routed around — never answered by the orchestrator. |
| **W-11.9** | **`--force` is the human's call.** A refused `bd close` (`blocked by open issues [...]`), `bd delete`, `--discard-remote`, `bd dolt push --force` — report the refusal and its reason; never override. |
| **W-11.10** | **`.beads/` is mutated through `bd` only.** No hand edits to graph or config state; `issues.jsonl` is a projection that lags the tracker and is never read for state (TRAP-11.1). |
| **W-11.11** | **Two seats per task bead**: implementer ≠ verifier ≠ orchestrator. The verifier writes its check before seeing the implementation and grades adversarially. |
| **W-11.12** | **Worktrees export `BEADS_DIR`.** Any shell running `bd` inside a git worktree exports `BEADS_DIR=<checkout>/.beads` pointing at the machine's one database (D-11.7). |

Invariants other documents may cite:

- **INV-11.1** Every commit that reaches `main` after the `bead-trailer` gate is required, merge commits
  excepted, carries exactly one `Bead:` trailer that resolves to a bead that was claimed when the commit
  was made (W-11.1 + W-11.3). History before the gate carries none: `main`'s existing commits have no
  trailer, and the first trailer-bearing commit is `e2a06f0` on this branch.
- **INV-11.2** `bd` is the only writer of tracker state. The board, `issues.jsonl` and
  `interactions.jsonl` are projections; a projection never writes back. A bead-backed board row never has
  its `--status` hand-set: change it in `bd`, then re-sync — every `bd` mutation (claim, create, close, dep)
  is followed by `board.py beads` before anything else.
- **INV-11.3** On every task bead, implementer, verifier and orchestrator are three different identities.
- **INV-11.4** Only the orchestrator's shell runs `bd`; seats read bead text from the dumped files.
- **INV-11.5** Only the human forces: `--force`, `--discard-remote`, `bd delete`, reopening a closed gate.

### 3 · Graph shape, vocabulary, board mapping

**Epics are lanes, children are rows.** `bd create "<lane>" -t epic` then `bd create "<task>" --parent
<epic-id>` gives hierarchical ids (`gp-dln.2`). `board.py beads` turns each epic into a lane and each
child into a row keyed by its bead id; charters and verifiers are board-only and are added on top.
A bead that has children renders as a lane even if typed `task`, so do not parent rows under rows. When a
plan is finer than the graph, board-only rows carry the bead id in their title
(`task P1.4 --lane P1 --title "gp-73v.2 · messages schema"`); `beads` upserts by bead id and leaves them
alone (D-11.3). Board reads are `bd --readonly list --json --all` — without `--all`, closed beads vanish
(TRAP-11.15).

**Dependencies.** `bd dep add <blocked> <blocker>` (type `blocks`, default). Use `-t discovered-from` for
provenance of W-11.4 beads; `related` is not a dependency and draws nothing. The board computes
*blocked* from edges (an unclosed bead with an unclosed blocker), exactly as `bd ready` does — so the
`blocked` status is hand-set only for a block no edge can express, and that should be rare.

**Types** (`-t`): `epic` = lane · `task` = row (default) · `chore` = tracker/skill/tooling housekeeping ·
`decision` = an open question (`-a human`, W-11.8) or an orchestrator-owned ADR (unassigned, since the
orchestrator can never be an assignee; closed by the orchestrator on the verifier's report, W-11.6) ·
`bug` and `feature` = post-launch work.
Gate beads are `task` typed and titled `Phase <n> gate · <what is signed off>` — `board.py` detects a
gate by the adjacent words `phase <n> gate` and nothing else (TRAP-11.12).

**Priorities** (`-p`, bd's 0–4): P0 gates, contract beads, and OQs that block a contract · P1 anything on
the critical path of the current phase · P2 default · P3 polish · P4 backlog. Priority is the
orchestrator's to set at creation and the human's to change.

**Labels** (`-l`, inherited from the parent unless `--no-inherit-labels`): `oq` open question ·
`sweep` accepted reviewer finding · `ci` gate or workflow work · `i18n` touches the lang files or the
content contract · `a11y` · `flake` a test known to be timing-sensitive · `docs`. Other labels are
allowed but mean nothing to the board or to these rules.

**Status vocabulary → board** (`board.py` `BEAD_ST`):

| bd status | meaning in this repo | board |
|---|---|---|
| `open` | exists, unclaimed (or unclaimed again after W-11.7) | `queued` |
| `in_progress` | claimed by a seat via W-11.2 | `running` |
| `blocked` | hand-set only for a non-edge block; edge blocks are computed | `blocked` |
| `deferred` | parked by the human; hidden from `bd ready` | `queued` |
| `closed` | orchestrator closed after the verifier's gate report (W-11.6) | `done` |

`failed` is a board-only state (W-11.7); the tracker shows that bead as `open` and unassigned.

### 4 · Session protocol (orchestrator)

1. `export BEADS_DIR=<checkout>/.beads` when working in a worktree (W-11.12); `bd prime` (W-11.5) — a
   tracked `.beads/PRIME.md` overrides its generic text and points here; `board.py beads`; publish.
2. Create or re-read beads; dump each seat's bead to `<scratch>/beads/<id>.txt`; claim on the seat's
   behalf (W-11.2); re-sync the board.
3. Dispatch. Seats never run `bd`, never commit, never push (INV-11.4; `memo.md` platform rules); a seat
   given its own worktree may commit inside that worktree only, trailer included.
4. On report: verifier's gate verdict → `bd close` (W-11.6) or unclaim and flag (W-11.7); re-sync. Every
   `bd` mutation — claim, create, close, dep — is followed by `board.py beads` before anything else
   (INV-11.2).
5. Session end: `bd export -o .beads/issues.jsonl`, commit the tracker snapshot (section 5), then
   `bd dolt push` once OQ-11.1 is answered yes. After a close-out instruction the heartbeat originates no
   beads: it confirms nothing is dropped, leaves remaining beads `open` and assigned `human`, and stays
   quiet (W-11.7).

### 5 · Commit and PR conventions that touch tracking

- **Trailer placement.** The trailer block is the last paragraph of the message, separated by a blank
  line, one `Bead:` line, other trailers allowed beside it. `git interpret-trailers --parse` must see it —
  that is how the gate reads it, so a `Bead:` line in the body text does not count. One id per trailer and
  one trailer per commit — a commit never carries several ids. The `gp` prefix is the `bd init --prefix gp`
  choice recorded in `.beads/metadata.json` (`dolt_database: gp`); ids have the form
  `<prefix>-<base>(.<n>)*` that bd 1.1.0 generates (`gp-dln`, `gp-dln.2`). No tool-attribution trailers
  (`.claude/settings.json` already blanks them).

  ```text
  docs(technical): add work-tracking conventions

  Rules W-11.1–W-11.12 and the bead-trailer gate spec.

  Bead: gp-dln.2
  ```

- **One primary bead per PR.** Commits may carry different ids (a stack that serves several beads), but
  the PR body ends with exactly one `Bead:` trailer naming the primary bead and lists any others under a
  `## Beads` heading as plain ids. GitHub `Closes #n` keywords are not used: beads are not GitHub
  Issues, and W-11.6 says the close follows the verifier, not the merge.
- **Squash-merge only.** The squash commit's message comes from the PR title and description, so it
  inherits the PR body's single trailer and INV-11.1 holds on `main` (TRAP-11.14). Merge commits
  (`git merge main` into a branch) carry no trailer and are exempt from the gate.
- **Tracker-snapshot commits.** `chore(beads): sync tracker snapshot` with the trailer of the epic or
  bead the session served; contains only `.beads/issues.jsonl` and `.beads/interactions.jsonl`. Required
  in any PR whose commits cite an id the base's `issues.jsonl` does not yet contain, or contains unclaimed
  (empty `assignee`), and at session end.
  On conflict, never hand-merge `issues.jsonl`: regenerate with `bd export -o .beads/issues.jsonl`.
  `interactions.jsonl` is append-only and will carry `merge=union` in `.gitattributes` (file scheduled in
  `10-work-breakdown.md`; it does not exist yet).

### 6 · The `bead-trailer` gate

Listed in `08-testing-quality.md` as a merge gate; defined here. Workflow `.github/workflows/bead-trailer.yml`
on `pull_request` (opened, synchronize, edited, reopened), check name `bead-trailer`, required on `main`.
No `push` trigger: `main` is protected, only squash merges land, and item 3 below checks the line the squash
commit will carry. Script `scripts/ci/bead-trailer.sh <base-ref> <head-sha>` with `PR_BODY` in the environment:

```yaml
name: bead-trailer
on:
  pull_request:
    types: [opened, synchronize, reopened, edited]
jobs:
  bead-trailer:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - run: scripts/ci/bead-trailer.sh "origin/${{ github.base_ref }}" "${{ github.event.pull_request.head.sha }}"
        env:
          PR_BODY: ${{ github.event.pull_request.body }}
```

The script (bash, `set -euo pipefail`; `git` and `jq` only, both present on `ubuntu-latest`; no `bd`) fails
the PR if any of these is false:

1. For every `git rev-list --no-merges <base>..<head>` commit (merge commits exempt, reverts not),
   `git log -1 --format=%B <sha> | git interpret-trailers --parse` contains exactly one line matching
   `^Bead: gp-[a-z0-9]+(\.[0-9]+)*$`.
2. That id exists as `.id` in `git show <head>:.beads/issues.jsonl` (read with `jq`) and is claimed:
   `.assignee` non-empty, or `.status` is `in_progress` or `closed`; and `.assignee` is not an
   orchestrator word (`orchestrator`, `orchestrators`, `orchestration`, `tier0`, `self`, `me`, `you` —
   `board.py`'s `ORCH_WORD` list, which is authoritative), which makes INV-11.3 mechanical for this one
   line. A bead assigned `human` is a valid
   target even while `open` — `gp-dln.4` is the case: the human's sign-off commit cites it. Failure text
   names the fix: *"unknown or unclaimed bead <id> — claim it, `bd export`, commit `.beads/issues.jsonl`"*.
3. `PR_BODY`'s last paragraph contains exactly one `Bead:` line matching the same regex, and it resolves
   by the same rule — this is the line the squash commit will carry.

Each failure prints the sha, the subject and the reason; the job exits non-zero on the first class of
failure but reports all offending commits. Until the workflow lands (scheduled in `10-work-breakdown.md`),
the orchestrator runs the same three checks by hand before opening a PR.

**Why the committed export, given W-11.10.** CI has no Dolt and no network to the tracker, so the tracked
`issues.jsonl` is the only tracker view it can have. W-11.10 forbids *agents* reading state from the export
to decide what to do; the gate reads it only to check that a commit and the committed projection agree.
The snapshot-commit rule (section 5) makes that projection fresh at the PR head, and the check fails closed:
a bead missing from the export costs one re-export, never a wrong merge. The alternative — `bd bootstrap`
on the runner from `sync.remote`, then `bd --readonly show <id> --json` — needs Dolt on the runner and a
yes to OQ-11.1; it is the upgrade path once that is answered.

### 7 · Storage, sync, worktrees, hooks

**What `.beads/` holds** (non-exhaustive; `.beads/.gitignore`, written by `bd init`, is the authoritative
ignore list):

| path | git | owner | notes |
|---|---|---|---|
| `.beads/metadata.json` | tracked | bd | backend `dolt`, mode `embedded`, database `gp`, project id |
| `.beads/config.yaml` | tracked | bd (`bd config set`) | holds `sync.remote` and `export.*`; commit after changes |
| `.beads/.gitignore`, `.beads/README.md` | tracked | bd | regenerated by `bd init`/`bd doctor`; do not edit |
| `.beads/hooks/*` | tracked | bd | shims calling `bd hooks run <hook>`; inert unless `core.hooksPath` points here (D-11.7) |
| `.beads/PRIME.md` | tracked (to add) | human / orchestrator | overrides `bd prime` output; says "read `docs/technical/11-work-tracking.md`" and lists W-11.1–W-11.12 |
| `.beads/issues.jsonl` | tracked once created (D-11.6; absent today) | bd export | projection for CI and for readers without Dolt; regenerate, never hand-merge |
| `.beads/interactions.jsonl` | tracked | bd | append-only audit of field changes; `merge=union` once `.gitattributes` exists |
| `.beads/embeddeddolt/` | ignored | bd / Dolt | **the database**, per machine; never committed on a branch (travels to origin only as `refs/dolt/data`, D-11.6); moves with `BEADS_DIR` |
| `.beads/backup/` | ignored | bd | local auto-backup (`*.darc`, manifest); recovery only |
| `.beads/dolt/`, `.beads/proxieddb/` | ignored | bd | alternative Dolt layouts; unused here |
| `.beads/last-touched`, `.beads/.local_version`, `redirect`, `last_pull`, `bd.sock*`, `daemon.*`, `*.lock`, `sync-state.json`, `push-state.json`, `export-state*`, `.beads-credential-key`, `.env` | ignored | bd | runtime, per machine; `redirect` is bd's own worktree pointer and is never committed |
| `.beads/dolt-server.*`, `.beads/ephemeral.sqlite3*`, `.beads/dolt-pprof/` | ignored | bd | server-mode, ephemeral-store and debug files; unused in embedded mode |
| root `.gitignore` lines `.dolt/`, `*.db`, `.beads-credential-key`, `.beads/proxieddb/` | tracked | bd init | keep |

**Sync policy (D-11.6).**

- `bd config set export.auto true` once (writes `config.yaml`; throttled to 60 s; `export.git-add` stays
  off so the orchestrator stages deliberately). `issues.jsonl` then refreshes after each write command.
- Cross-machine sync of the real history is `bd dolt push` / `bd dolt pull` against `sync.remote`, which
  `bd init` set to `git+https://github.com/hanyiliu/green-pastures.git` — it stores Dolt data under
  `refs/dolt/data` on the same GitHub remote. This needs push rights on origin and is OQ-11.1; until
  answered, the orchestrator does not push Dolt refs (use `--sandbox` if an auto-push is ever configured)
  and the committed `issues.jsonl` plus `.beads/backup/` are the recovery paths. Whether origin already
  carries Dolt data is checked with `git ls-remote origin 'refs/dolt/*'` (not verifiable from the sandbox
  today).
- **Fresh clone:** `bd bootstrap --dry-run`, then `bd bootstrap` (non-destructive). Because `sync.remote`
  is set it tries origin first and clones `refs/dolt/data` if present, otherwise imports the tracked
  `issues.jsonl`, otherwise creates an empty database; then `git config beads.role maintainer`
  (TRAP-11.4). Never `bd init`, `bd init --force` or `--reinit-local` in a clone that already has `.beads/`
  — `bd help init-safety` documents the refusals (exit codes 10–12) and the destroy token.

**Worktrees (D-11.7).** `bd` resolves `.beads` from the main checkout root (git common-dir discovery), not
the worktree, unless `BEADS_DIR` is exported (`bd -C <dir>` also works per call). The database was
initialised on 2026-08-22 inside this worktree, at
`.claude/worktrees/multilingual-text-mapping-plan-c28791/.beads/embeddeddolt/gp/.dolt`, with `BEADS_DIR`
pointing at that `.beads/`; the main checkout `/Users/hanyiliu/Documents/GitHub/green-pastures` has no
`.beads/` at all until this branch merges. Canonical location after the merge: the main checkout's
`.beads/`. Move `embeddeddolt/` and `backup/` there (or `bd dolt push` then `bd bootstrap` there) **before**
removing the worktree (TRAP-11.6). Verify which database a shell sees with `bd where` or
`bd worktree info`; `bd context` reads config only and works even when the database is broken. Never run
`bd` from a checkout that would mint a second database: one machine, one database, one `BEADS_DIR`.

**Hooks.** `bd init` wrote shims to `.beads/hooks/` and did not install them: `core.hooksPath` is unset
and the shared `.git/hooks/` holds only samples. They stay tracked because `bd doctor` expects them, and
stay inert: activating them would run `bd` (and take the Dolt lock) on every commit, checkout, merge and
push of the orchestrator's git work, and the trailer rule is enforced by CI instead. If the human wants
them, `git config core.hooksPath .beads/hooks` in the main checkout is the whole activation — local git
config, never committed. Even active, no hook writes or checks the `Bead:` trailer: `prepare-commit-msg`
adds bd's agent-identity trailers only, and on macOS the shims fall back from `timeout` to `gtimeout` or a
perl alarm. Never `bd hooks install` from a worktree (TRAP-11.5).

### 8 · Traps

- **TRAP-11.1 The export is not the tracker.** `issues.jsonl` lags by up to 60 s and by whatever was
  never committed; a seat's "not found" in it is not absence. State comes from `bd` (orchestrator) or
  from the dumped bead text (seats).
- **TRAP-11.2 `bd init` auto-commits and scaffolds other tools.** On 2026-08-22 it committed
  `bd init: initialize beads issue tracking` (`f645819`) containing `AGENTS.md`,
  `.agents/skills/beads/SKILL.md`, `.agents/skills/beads/agents/openai.yaml`, `.codex/config.toml` and
  `.codex/hooks.json`; the orchestrator amended those five paths out (`e2a06f0`). If a re-init or
  upgrade recreates them, delete exactly those paths and keep `.beads/` plus the root `.gitignore` lines.
  Guard: any future `bd init` runs with `--skip-agents --skip-hooks --non-interactive` (`--skip-hooks` only
  stops bd rewriting the shims `.beads/hooks/` already holds; `bd doctor` still sees them), and after
  any `bd` command that may commit, inspect `git log -1 --stat`. The Claude session hook
  (`.claude/settings.json` → `bd prime --hook-json`) is the one we keep.
- **TRAP-11.3 zsh does not word-split `$var`.** A helper doing `bd $sub --help` with `sub="dep add"`
  runs `bd "dep add"` and gets `unknown command "dep add"` (it happened while writing this document).
  Give helper scripts a `#!/usr/bin/env bash` shebang, or use arrays / `${=sub}` in zsh.
- **TRAP-11.4 Role warning.** `bd` warns until `git config beads.role maintainer` is set in the clone
  (local git config, per clone, never committed; `contributor` is for forks).
- **TRAP-11.5 Hooks and worktrees.** `bd hooks install` targets `.git/hooks/`; in a worktree `.git` is a
  file and `.git/hooks/` does not exist. And the tracked shims do nothing without `core.hooksPath`. Do not
  rely on hooks for any rule here.
- **TRAP-11.6 Removing a worktree can delete the tracker.** If `BEADS_DIR` points inside a worktree,
  `git worktree remove` deletes `embeddeddolt/`. Export and push, or move the directory, first.
- **TRAP-11.7 `bd` flags move.** Verify against `bd <cmd> --help` before scripting; `board.py` reads
  with `--readonly list --json` and accepts field-name variants; `ORCH_BD` overrides the binary.
- **TRAP-11.8 Self-closing.** A seat that closes its own bead has graded itself (W-11.6).
- **TRAP-11.9 `TODO`/`FIXME`/`HACK`.** A comment is not tracked work (W-11.4). The mechanical check — a
  `TODO|FIXME|HACK` grep over `src/**` as a CI gate — belongs in `08-testing-quality.md`'s gate inventory.
- **TRAP-11.10 Importing beads workflows.** Molecules, swarms, wisps, gates, memories, `bd ready --claim`,
  the generated AGENTS.md — not adopted (D-11.1); the tier-0 fence and the two-seat rule replace them.
- **TRAP-11.11 The Dolt lock.** Concurrent `bd` processes serialise or hang; a seat running `bd` stalls
  the orchestrator. Seats never run it (INV-11.4).
- **TRAP-11.12 Gate titles.** `board.py` recognises a gate only by the adjacent words `phase <n> gate`;
  `GATE · Human sign-off …` is a row, not a gate. Title gates `Phase <n> gate · …`.
- **TRAP-11.13 Forcing a refused close.** `cannot close X: blocked by open issues [Y] (use --force to
  override)` is the integrity check working; `bd close --force` is the human's (W-11.9), even after the
  human said "close it".
- **TRAP-11.14 Squash message source.** If the repo setting is "commit messages" instead of "PR title
  and description", the squash commit carries one trailer per squashed commit and INV-11.1 breaks on
  `main`. The setting is part of OQ-11.3; the gate's body check (section 6, item 3) is the guard.
- **TRAP-11.15 `bd list --json` without `--all` hides closed beads.** Any count or percentage computed off
  that listing shows every lane at 0% done forever; `board.py` cross-checks against `bd status --json`.

### 9 · Migration table for the skill (bead gp-dln.5)

`.claude/skills/super-orchestrator/SKILL.md` was written against another project. Mechanical edits:

| skill text today | replace with |
|---|---|
| `docs/technical/13-work-tracking.md` (and "13 makes bd the authority", "since 13 was written") | `docs/technical/11-work-tracking.md` (and "11 …") |
| W1 | W-11.1 |
| W2 — never cited by the skill; its unnumbered "the implementer claims its own bead — `bd update <id> --claim`" is the same rule | W-11.2, with `--actor <seat>` and "the orchestrator runs it on the seat's behalf" |
| W3 | W-11.3 |
| W4 | W-11.4 |
| W5 | W-11.5 |
| W6 | W-11.6 |
| W7 | W-11.7 |
| INV-18 | INV-11.1 |
| D-27 | W-11.8 |
| D-28 | D-11.1 |
| TRAP-10 | TRAP-11.7 |
| TRAP-23 | TRAP-11.9 |
| TRAP-24 | TRAP-11.10 |
| TRAP-25 | TRAP-11.8 |
| `PRO-x7q · input rules` (board example) and every other `PRO-*` | foreign project ids, examples only, never reused here; use a real `gp-*` id, e.g. `gp-73v.2 · i18n & content contract` |
| the "500 hand-written lines" history paragraph citing `PRO-vagt`, `PRO-e01s`, `PRO-e1hv`, `PRO-3snc`, `#228`, `CLAUDE.md` | delete; it is another repository's history. Size guidance for this repo is in `10-work-breakdown.md` |
| "Follow the repo's `CLAUDE.md`" | "Follow `docs/technical/00-README.md` and this document" until a `CLAUDE.md` exists (OQ-11.4) |
| `bead-trailer` gate "blocks the merge otherwise" | unchanged — the gate keeps the name `bead-trailer`; section 6 here defines it |
| `ORCH_BD` | unchanged — kept as the board's binary override (TRAP-11.7) |

`scripts/board.py` also mentions `13-work-tracking.md` (lines 59, 316), `TRAP-10` (line 62) and 23
`PRO-*` ids in comments; those are the tool's own history and may stay, or be re-pointed in the same chore.

## Open questions

- **OQ-11.1** May the orchestrator push Dolt data (`refs/dolt/data`) to `origin` with `bd dolt push`, and
  whose credentials does that use? Until yes, D-11.6 runs export-only. — *human*.
- **OQ-11.2** Does the human want `bd` as the long-term tracker once the site ships, or only for the build?
  If only for the build, `issues.jsonl` is the archive and `.beads/` is frozen at launch. — *human*.
- **OQ-11.3** CI provider and repo settings: GitHub Actions is assumed (`memo.md`, ADR-001); the human
  must set branch protection (`bead-trailer` required on `main`), squash-only merges, and "PR title and
  description" as the squash message source. — *human*, with `09-deployment-operations.md`.
- **OQ-11.4** Will the repo get a `CLAUDE.md`? The skill tells seats to follow it; today the binding
  conventions are `00-README.md` and this document. — *orchestrator → 00-README owner (gp-dln.3)*.

## Cross-references

- `.claude/skills/super-orchestrator/SKILL.md` — the skill that cites these rules (section 9 maps its ids).
- `.claude/skills/super-orchestrator/scripts/board.py` — `BEAD_ST`, `is_gate`, `sync_beads`.
- `.beads/config.yaml`, `.beads/metadata.json`, `.beads/.gitignore`, `.beads/hooks/*` — tracked tracker
  config.
- `docs/technical/08-testing-quality.md` — lists `bead-trailer` among the gates.
- `docs/technical/09-deployment-operations.md` — branch protection and repo settings (OQ-11.3).
- `docs/technical/10-work-breakdown.md` — schedules the workflow and `.gitattributes` PR; one bead per PR.
- `docs/technical/12-open-questions.md` — collects OQ-11.1–OQ-11.4.
- `docs/technical/00-README.md` — index.
