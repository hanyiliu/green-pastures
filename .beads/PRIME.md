# Green Pastures · tracker card

`bd prime` — the orchestrator's session-start command (W-11.5), never a seat's — prints this file instead
of its own text; a seat is handed this card, it never runs the command. This is the short card. The binding
rulebook is **`docs/technical/11-work-tracking.md`** — read it whenever this card is not enough. Every id below
(`D-11.n`, `W-11.n`, `INV-11.n`, `TRAP-11.n`) is that document's, and it wins on any disagreement.

## What the tracker is here

Beads (`bd` 1.1.0, prefix `gp`, embedded Dolt) is the tracker of record: every unit of work is a bead in
the `bd` graph, and the board is a projection of that graph, never a second copy (D-11.1). It is adopted
as a **tracker only** — issues, parent/child, dependencies, claims, status. Not adopted: molecules and
formulas, swarms, gates and merge-slots, wisps, memories, agent/mail beads, federation, the
Jira/Linear/GitHub integrations, and `bd todo` (D-11.1, TRAP-11.10).

Epics are lanes and their children are rows: `gp-dln` is a lane, `gp-dln.10` a row (D-11.3).
Three roles touch the tracker (D-11.2): the **human**; the **orchestrator**, the one process that runs
`bd`; and **seats** — `writer-<topic>` implements, `check-<topic>` verifies, `scout-<topic>` researches.
Two different seats work every task bead, and neither is the orchestrator (W-11.11, INV-11.3).

## If you are a seat, these six rules bind you

1. **Bead before branch (W-11.1).** A bead exists and is claimed before any branch, commit or PR for it.
   Scope you discover mid-task gets its own bead first (rule 4).
2. **You are the assignee; the orchestrator never is (W-11.2).** The claim is
   `bd update <id> --claim --actor <seat>`, run by the orchestrator on your behalf, which sets the
   assignee to your seat name and the status to `in_progress`. The assignee is never `orchestrator`,
   `orchestrators`, `orchestration`, `tier0`, `self`, `me` or `you` — the board refuses those rows.
   Unclaiming is `bd update <id> --assignee "" --status open`; there is no `--unclaim`.
3. **`Bead: gp-…` trailer on every commit (W-11.3).** Exactly one per non-merge commit, matching
   `^Bead: gp-[a-z0-9]+(\.[0-9]+)*$`, in the trailer block — the last paragraph, separated by a blank
   line, where `git interpret-trailers --parse` can see it. A `Bead:` line in the body text does not
   count. The id must resolve to a claimed bead; the `bead-trailer` CI gate (11 §6) checks every commit
   in the PR range and the PR body's last paragraph, and blocks the merge otherwise.
4. **Discovered work becomes a bead, never a `TODO` (W-11.4).** No `TODO`, `FIXME`, `HACK` or private
   list stands in for tracked work — report the discovery and the orchestrator creates the bead with
   `--parent <epic> --deps discovered-from:<origin>`. A CI grep over `src/**` enforces this (TRAP-11.9).
5. **Never self-close (W-11.6, TRAP-11.8).** Phase gates define done. The verifier reports the gate
   result and the orchestrator closes the bead. An implementer never closes its own bead, and no seat
   closes anything — a seat that closes its own bead has graded itself.
6. **Only the orchestrator runs `bd` (INV-11.4, TRAP-11.11).** `bd` holds a Dolt lock for the life of
   each invocation, so a second one from another shell serialises or hangs. You receive your bead text
   pre-dumped to a file (`<scratch>/beads/<id>.txt`) and report in prose; the orchestrator applies every
   mutation. You also never commit or push — unless you were given your own worktree, in which case you
   may commit inside that worktree only, trailer included (11 §4).

Two corollaries worth stating on their own:

- **`.beads/issues.jsonl` is not the tracker (TRAP-11.1, W-11.10).** It is an export that lags by up to
  60 s plus whatever was never committed; "not in the file" is not "does not exist". Read state from
  your dumped bead text, not from the export, and never hand-edit anything under `.beads/`. On a merge
  conflict it is regenerated with `bd export -o .beads/issues.jsonl`, never hand-merged (11 §5).
- **Escalate, don't spin (W-11.7).** One mechanical retry for a flaky command or a missing path, with the
  failure written into your report. Anything else — a blocked dependency, a refused `bd` command, an open
  question — is reported up, not worked around. `--force` is the human's call alone (W-11.9, INV-11.5).

## The worktree pitfall (`BEADS_DIR`)

`bd` finds `.beads/` from the **main checkout root** by git common-dir discovery, not from the worktree
you are standing in, unless `BEADS_DIR` is exported. So any shell that runs `bd` inside a git worktree
must first `export BEADS_DIR=<checkout>/.beads`, pointing at the machine's one database (W-11.12, D-11.7).
One machine, one database, one `BEADS_DIR`: running `bd` from a checkout that would mint a second
database splits the tracker in two.

Two consequences for a seat working in a worktree:

- The `.beads/` directory you can see is **not** necessarily the live database — do not infer tracker
  state from it (see TRAP-11.1 above), and do not "fix" it.
- **`git worktree remove` can delete the tracker (TRAP-11.6).** If `BEADS_DIR` points inside a worktree,
  removing that worktree deletes `embeddeddolt/` with it. Never remove a worktree yourself; the
  relocation is the orchestrator's scheduled chore. Which database a shell sees is checked with
  `bd where` or `bd worktree info` — an orchestrator command, not yours. 11 §7 records where the
  database currently lives.

## Rule index (11 §2)

| id | rule |
|---|---|
| W-11.1 | Bead before branch. |
| W-11.2 | The seat is the assignee; the orchestrator never is. |
| W-11.3 | `Bead: <id>` trailer on every non-merge commit. |
| W-11.4 | Discovered work becomes a bead, not a `TODO`. |
| W-11.5 | `bd prime` at session start, every session, then re-sync the board. |
| W-11.6 | Never self-close; the verifier reports, the orchestrator closes. |
| W-11.7 | Escalate, don't spin: one mechanical retry, then unclaim and flag. |
| W-11.8 | Open questions and sign-off gates are `decision` beads owned by the human. |
| W-11.9 | `--force` is the human's call. |
| W-11.10 | `.beads/` is mutated through `bd` only; the export is never read for state. |
| W-11.11 | Two seats per task bead: implementer ≠ verifier ≠ orchestrator. |
| W-11.12 | Worktrees export `BEADS_DIR`. |

Where to look next: `docs/technical/11-work-tracking.md` for all of the above in full, `§6` for the
`bead-trailer` gate, `§7` for storage and sync, `§8` for the traps; `docs/technical/10-work-breakdown.md`
for which bead belongs to which PR; `docs/technical/00-README.md` for the document index.
