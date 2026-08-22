#!/usr/bin/env python3
"""State store + HTML board for the super-orchestrator skill.

board.json is the single source of truth. Every mutating command rewrites it and
re-renders board.html beside it, so the loop is always: mutate -> publish that
same board.html path with the Artifact tool. Same path means same URL, so the
page the user already has open simply updates.

  board.py init   --mission "..." [--repo owner/name] [--branch b]
  board.py lane   L1 --name "Contracts" [--charter "owns src/types/**"]
                     [--status queued|running|done] [--milestone yes]
                     [--epic PRO-x]   pin the bead epic this lane is a view of
                                      (alias: wave; the epic is otherwise matched
                                       by name, see lane_epic)
  board.py task   T1 --lane L1 --title "..." --owner <impl> --verifier <check>
                     [--tier 1] [--status ...] [--files a.ts,b.ts]
                                      once the row's PR is merged and the base
                                      confirms it, these are reconciled against
                                      the measured diff and any file the range
                                      does not contain is bannered (reconcile)
                     [--added 40] [--removed 3] [--note "..."]
                     [--branch feat/x] [--pr 7] [--pr-url ...] [--pr-added 40]
                     [--pr-removed 3] [--pr-created "2026-08-04 09:00"]
                     [--pr-checks passing] [--pr-state open] [--pr-merged 1]
  board.py event  ok "wave 1 landed"                    kinds: info ok warn err
  board.py pr     --number 7 --url ... --state open --checks passing [--task T1]
  board.py review --by correctness --verdict pass|block [--finding "major:..."]
  board.py scan   [--base origin/main]        pull file diffs + commits from git
  board.py beads  [--limit 500] [--status open,in_progress,blocked]
                     mirror the bd graph onto the board (see sync_beads)
  board.py caveat sync-wiring --title "..." --body "..."
                     [--file PATHSPEC --absent NEEDLE]...
                     [--file PATHSPEC --present NEEDLE]...
                     [--drop]   a standing truth no bead can express, carrying
                                the falsifiers that expire it (see caveats). The
                                pair repeats: each --absent/--present binds to
                                the --file before it, a PATHSPEC is a file or a
                                directory, and the claim needs ALL of them.
  board.py render [--out board.html]

Statuses: queued running review done failed blocked. Set ORCH_BOARD to move the
state file; everything else defaults relative to it.

Every command re-reads git before it writes, so the header numbers are a
property of the board rather than of anyone remembering to run `scan` — see
refresh(). A `scan` nobody runs is a statistic that is permanently wrong, and
this ledger sat at commits:[] for the whole of a run because of exactly that.
`--base` is remembered once set, so the range is stated on the page rather than
retyped per command.

Schema 3: a task row may carry its own branch and PR (see task_pr). Schema 2's
single board-level `pr` still loads and still renders; a row without PR data
degrades to one muted line. A PR's state is checked against the tracked base
rather than believed — see landed_prs, and the failure it exists for. Every task
row carries an owner (who implements) and a verifier (who grades). Naming the
orchestrator in either seat, or the same agent in both, is refused rather than
rendered — see guard().

Beads (13-work-tracking.md) is the tracker of record; this board is a projection
of it. `beads` pulls the graph in rather than the board keeping its own copy of
the truth. Set ORCH_BD to override the command if the CLI's flags have moved
(TRAP-10 warns they may have).

Every render also re-reads bd and redraws the blocking graph as mermaid — see
dep_section. It is live by design, which costs a `bd` start per publish; set
ORCH_DEP_TIMEOUT to bound that wait. The diagram needs no script and no CDN, so
it survives the artifact CSP, and every way it can fail degrades to a one-line
note with the rest of the board intact.

Schema 4 adds two keys and reads a schema-3 ledger unchanged: `caveats` (see
caveats) and `src` (see src_lines). Both default to empty everywhere they are
read, because the live ledger is instrumentation for a running fleet and a
format change that blanks the page has broken the run rather than improved it.
It also draws each phase's GATE beside its epic. A gate closing and an epic
closing are different events — Phase 3's gate is closed while its epic is not —
and a board that shows one fraction can state neither. Which bead is a phase's
gate is derived from bd (see is_gate/gate_of), never listed here.
"""
import fnmatch, json, os, subprocess, sys, time
from html import escape as esc

STATE = os.environ.get("ORCH_BOARD", "board.json")
SCHEMA = 4
BLANK = {"schema": SCHEMA, "mission": "", "repo": "", "branch": "", "started": "",
         "updated": "", "waves": [], "tasks": [], "commits": [], "diff": [], "pr": {},
         "reviews": [], "events": [], "base": "", "scan": {}, "landed": {},
         "caveats": [], "src": {}}
DONE, RUN, REVIEW, FAIL, BLOCK = "done", "running", "review", "failed", "blocked"
# Names that mean "the orchestrator itself". A row owned or verified by tier 0 is
# the failure this schema exists to catch, so it is refused rather than rendered.
ORCH = {"orchestrator", "super-orchestrator", "tier0", "tier-0", "self", "me", "you"}
# Exact match let `orchestrator-review` through — the very name SKILL.md told every
# sweep dispatch to copy (PRO-ijn). Tokenising catches it and every sibling nobody
# has coined yet. It deliberately over-refuses: `check-orchestration-notes` is
# turned away too, and that is the correct bias for a guard whose entire job is to
# be loud. A false refusal costs one rename and says so; a false accept is the
# silent self-grading this exists to stop.
ORCH_WORD = {"orchestrator", "orchestrators", "orchestration", "tier0", "self", "me", "you"}


def now():
    return time.strftime("%Y-%m-%d %H:%M")


def tokens(name):
    return [p for p in "".join(c if c.isalnum() else " " for c in name).split() if p]


def orchish(name):
    """Tier 0 wearing a costume: a name with an orchestrator word among its tokens."""
    tk = tokens(name)
    return bool(tk) and (any(w in ORCH_WORD for w in tk)
                         or ("tier" in tk and "0" in tk))


def seat_faults(tasks):
    """Every tier-0 seating in `tasks`, as (task id, seat, name) — no exit, no print."""
    out = []
    for t in tasks:
        own = (t.get("owner") or "").strip().lower()
        ver = (t.get("verifier") or "").strip().lower()
        for seat, who in (("owner", own), ("verifier", ver)):
            if who and (who in ORCH or orchish(who)):
                out.append((t["id"], seat, who))
        if own and own == ver:
            out.append((t["id"], "owner and verifier", own))
    return out


def guard(tasks, strict=True):
    """Refuse any ledger that seats tier 0 in a task row, or self-grades one.

    A run where the router owns a row has stopped being an orchestration; one
    where the router grades a row has stopped being a verification. Both are
    quiet failures at runtime, so they are made loud here instead.

    `strict` is the write path — a task command cannot introduce one of these,
    full stop. Render is deliberately softer for the widened token rule: this
    board is live instrumentation, and a ledger written before the rule existed
    must not go dark on its next publish. The original exact-match names stay
    fatal on both paths, so no ledger that renders today stops rendering
    tomorrow.
    """
    for t in tasks:
        own = (t.get("owner") or "").strip().lower()
        ver = (t.get("verifier") or "").strip().lower()
        for seat, who in (("owner", own), ("verifier", ver)):
            if who in ORCH or (strict and orchish(who)):
                sys.exit(f"REFUSED: task {t['id']} names the orchestrator as {seat} "
                         f"('{who}'). Tier 0 owns no task and grades no task — dispatch "
                         f"a tier-1 subagent into that seat.")
        if own and own == ver:
            sys.exit(f"REFUSED: task {t['id']} has the same agent as owner and verifier "
                     f"('{own}'). Grading is adversarial; it needs a second party.")


def load():
    """The ledger, with every key BLANK declares guaranteed present.

    The fill is not tidiness. A ledger written by an older board — or by a hand
    edit, or by a sync that predates a key — is missing whatever did not exist
    when it was written, and every reader after it either repeats a `.get(k) or
    []` or crashes. It crashed: a ledger with no `events` took refresh() down
    with a KeyError before one line of HTML was written, so the published page
    froze at its last good publish while the run carried on underneath it. That
    is the exact failure mode "a schema the board wrote before must still
    render" exists to forbid, and filling once here is the only version of the
    fix that cannot be forgotten at the next call site.
    """
    try:
        with open(STATE) as f:
            s = json.load(f)
    except (FileNotFoundError, ValueError):
        return json.loads(json.dumps(BLANK))
    if not isinstance(s, dict):
        return json.loads(json.dumps(BLANK))
    for k, v in BLANK.items():
        s.setdefault(k, json.loads(json.dumps(v)))
    return s


def save(s):
    s["updated"] = now()
    s["schema"] = SCHEMA  # what wrote the file, not what the file happens to use
    with open(STATE, "w") as f:
        json.dump(s, f, indent=1)


def kv(argv):
    """--key value pairs into {key: [values]}. Repeatable keys accumulate."""
    d, i = {}, 0
    while i < len(argv):
        if argv[i].startswith("--"):
            nxt = argv[i + 1] if i + 1 < len(argv) else None
            val = nxt if nxt is not None and not nxt.startswith("--") else "1"
            d.setdefault(argv[i][2:], []).append(val)
            i += 2 if val is nxt else 1
        else:
            i += 1
    return d


def one(d, k, default=""):
    return d.get(k, [default])[0]


def upsert(rows, ident, fields):
    for r in rows:
        if r["id"] == ident:
            r.update(fields)
            return r
    r = {"id": ident, **fields}
    rows.append(r)
    return r


PR_KEYS = ("number", "url", "state", "checks", "title", "created", "added", "removed")


def set_pr(box, d, pre):
    """Merge PR flags into `box['pr']` — the board's own, or one task row's.

    `pre` is "" for the board-level `pr` command and "pr-" on a task, so the same
    five facts are spelled the same way in both places. `created` fills itself in
    the first time a PR appears: a timestamp behind an extra flag is a timestamp
    that stays empty, which is the same failure `scan` had. It also bounds what
    landed_prs is willing to judge, so it has to be set by something other than
    memory.
    """
    p = dict(box.get("pr") or {})
    for k in PR_KEYS:
        if pre + k in d:
            p[k] = one(d, pre + k)
    if pre and "pr" in d and one(d, "pr") != "1":
        p["number"] = one(d, "pr")          # --pr 7 is the number on a task row
    if pre + "merged" in d:
        p["merged"] = one(d, pre + "merged") in ("1", "true", "yes")
    if p:
        p.setdefault("created", now())
        box["pr"] = p
    return box


def git(*a):
    """(ok, stdout, reason). The return code is checked because not checking it
    is how `scan --base <typo>` reported a *clean* board — a failed git and a
    genuinely empty diff are the same empty string otherwise (PRO-jy0, PRO-ka8).
    """
    try:
        p = subprocess.run(["git", *a], capture_output=True, text=True, timeout=30)
    except subprocess.TimeoutExpired:
        return False, "", f"`git {a[0]}` gave no answer in 30s"
    except OSError as e:
        return False, "", f"cannot run git: {e}"
    if p.returncode != 0:
        return False, "", (" ".join((p.stderr or "").split())[:150]
                           or f"git {a[0]} exited {p.returncode}")
    return True, p.stdout.strip(), ""


def git_out(*a):
    return git(*a)[1]


BD = os.environ.get("ORCH_BD", "bd")
# bd statuses (open in_progress blocked deferred closed) onto board statuses.
# deferred is idle rather than broken, so it reads as queued, not blocked.
BEAD_ST = {"open": "queued", "in_progress": RUN, "blocked": BLOCK,
           "deferred": "queued", "closed": DONE}


def pick(row, *names):
    """bd's JSON field spellings are not pinned by its docs; accept the variants."""
    for n in names:
        if row.get(n) not in (None, ""):
            return row[n]
    return ""


def parents_of(rows):
    """bead id -> parent bead id, from the tracker's own edges rather than from
    the shape of a string.

    `lane_of` used to split the id on a dot, which is true of `bd-a3f8.1.1` and
    false of this graph: 62 of 64 tasks piled into a lane literally named BACKLOG
    while every phase epic rendered empty beside it (PRO-8gt). The real edge is
    `parent-child`, whose `issue_id` is the child and `depends_on_id` the parent,
    and bd also denormalises it onto a `parent` field. Both are read: they agree
    on all 158 child beads here, and the field alone was once wrong in a way the
    edges were not. Dotted ids stay as the last fallback so an id scheme that
    does encode its tree still lands in the right lane — this graph has dotted
    ids whose real parent is a different bead entirely, so the fallback must
    never win over an edge.
    """
    par = {}
    for r in rows:
        if not isinstance(r, dict):
            continue
        own = str(pick(r, "id", "issue_id", "key"))
        for d in (r.get("dependencies") or []):
            if isinstance(d, dict) and d.get("type") == "parent-child":
                kid = str(d.get("issue_id") or own)
                if d.get("depends_on_id"):
                    par.setdefault(kid, str(d["depends_on_id"]))
        if own and r.get("parent"):
            par.setdefault(own, str(r["parent"]))
        if own and "." in own:
            par.setdefault(own, own.rsplit(".", 1)[0])
    return par


def sync_beads(s, limit, status):
    """Mirror the bd graph onto the board. Beads owns status; the board displays it.

    Deliberately one-way. Writing board state back into bd would let a rendering
    bug rewrite the tracker, and 13-work-tracking.md makes bd the source of truth
    for what is done — the board must not be able to disagree with it.

    Closed beads are pulled too. Without them a bead that closes between syncs
    freezes at its last status — stuck `running`, still pulsing — and the
    completion count undercounts forever, because it is computed over a set the
    query already dropped (PRO-btk). An unfiltered `--all` query is also a
    superset of the dependency graph's, so the two share one process instead of
    paying two bd starts for overlapping bytes (PRO-jw3).
    """
    # A status filter is the one query `--all` cannot serve, so it gets its own
    # process; every other call lands on the shared one.
    rows, note = (bd_fetch(("--no-pager", "--status", status, "--limit", str(limit)))
                  if status else bd_fetch())
    if note:
        sys.exit(f"{note}. Is bd installed and `bd init` run? Set ORCH_BD to override.")
    rows = rows[:limit] if limit else rows

    par = parents_of(rows)
    # A bead with children is an epic, so it renders as the lane rather than as a
    # row inside one — held alongside the type field, which this graph does set.
    epics = set(par.values())
    seen = 0
    for r in rows:
        bid = str(pick(r, "id", "issue_id", "key"))
        if not bid:
            continue
        seen += 1
        title = str(pick(r, "title", "summary", "name") or bid)
        st = BEAD_ST.get(str(pick(r, "status", "state")), "queued")
        if bid in epics or str(pick(r, "issue_type", "type")) == "epic":
            w = upsert(s["waves"], bid, {"name": title, "status": st})
            w.setdefault("charter", f"epic {bid}")
            continue
        lane = par.get(bid, "BACKLOG")
        w = upsert(s["waves"], lane, {})
        w.setdefault("status", "running")
        w.setdefault("name", "Backlog" if lane == "BACKLOG" else lane)
        t = upsert(s["tasks"], bid, {
            "wave": lane, "bead": bid, "title": title, "status": st,
            "owner": str(pick(r, "assignee", "owner", "claimed_by")),
        })
        t.setdefault("verifier", "")
        t.setdefault("tier", 1)
    guard(s["tasks"], strict=False)
    if limit and seen >= limit:
        s["events"].append({"t": now(), "kind": "warn", "text":
                            f"bd returned {seen} beads at the --limit; raise it, the "
                            f"board may be missing work"})
    return seen


# -------------------------------------------------------------- dependency graph

# Fills are literal hex rather than the board's CSS variables: mermaid paints the
# node shape and the label sits on that fill, so the pair has to stay legible on
# its own instead of tracking whichever theme the reader happens to be in.
DEP_FILL = {DONE: "#2f7a4f", BLOCK: "#b23c30", RUN: "#a06a12", "queued": "#5b6570"}
# Grey is "unblocked", not "ready": bd's own ready set excludes deferred beads,
# which land here too. The two words agree on every open bead and only that.
DEP_WORD = {DONE: "closed", BLOCK: "blocked", RUN: "in progress", "queued": "unblocked"}
DEP_LABEL = 46  # title chars per node; wider boxes push the diagram off the card
try:  # a fat-fingered env var is a bad graph, not a dead board
    DEP_TIMEOUT = max(1.0, float(os.environ.get("ORCH_DEP_TIMEOUT", "25")))
except ValueError:
    DEP_TIMEOUT = 25.0


_BD_CACHE = {}
# The one query both readers share. Spelled out rather than assembled so it stays
# byte-identical to the call the dependency graph was verified against.
BD_ALL = ("--all", "--no-pager")


def bd_fetch(args=BD_ALL, timeout=DEP_TIMEOUT):
    """Nodes and edges in one `bd` call — every row already carries `dependencies`.

    `bd dep tree` per bead would be one subprocess per node for the same bytes,
    and the process start, not the query, is what costs. `--all` is passed
    because the graph needs closed blockers: an arrow into a bead the listing
    dropped would dangle. It is also what makes finished work visible in the
    lanes, so the unfiltered query serves both readers and is memoised for the
    life of the process — one `beads` command used to pay two bd starts for a
    query and its own superset (PRO-jw3). The memo is per-process on purpose:
    the graph stays live across publishes, which is the point of drawing it.

    Returns (rows, note) with exactly one truthy, so every failure below leaves
    the rest of the board standing and prints a reason instead of raising or
    emitting a half-written diagram.
    """
    cmd = [BD, "--readonly", "list", "--json", *args]
    key = tuple(cmd)
    if key not in _BD_CACHE:
        _BD_CACHE[key] = _bd_run(cmd, timeout)
    return _BD_CACHE[key]


def _bd_run(cmd, timeout):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return [], f"`{BD} list` gave no answer in {timeout:g}s — bead database busy or hung"
    except OSError as e:
        return [], f"cannot run `{BD}`: {e} — install the bd CLI, or set ORCH_BD to its path"
    if p.returncode != 0:
        return [], (f"`{BD} list` failed ({p.returncode}): "
                    + (" ".join((p.stderr or "").split())[:160] or "no stderr"))
    try:
        rows = json.loads(p.stdout or "[]")
    except ValueError:
        return [], f"`{BD} list --json` did not return JSON — run the command by hand"
    rows = rows.get("issues", rows) if isinstance(rows, dict) else rows
    return (rows, "") if isinstance(rows, list) else ([], "bd JSON was not a list of beads")


# ------------------------------------------------------------------ bead ledger
#
# The board used to carry two disjoint projections of the same project and add
# them: hand-made seat rows under lanes NAMED "Phase 4", and bead rows synced
# from bd under the epic that actually IS Phase 4 — a different lane on the same
# board. The rail counted the first, so "Phase 4 · 25/38" was seat-tasks
# dispatched under a lane with that name, and the headline was the two sets
# summed, reconciling with nothing (PRO-86ju). Everything below exists so a phase
# pin counts beads, from the tracker, with the query stated on the page.

# How a phase's bead set is chosen. Named, printed, and load-bearing: three rules
# were available and each gives a different number, so the board says which.
#
#   direct children      — the epic's immediate parent-child kids only. Phase 2
#                          reads 23 and loses the nested plan rows under them.
#   subtree              — parent-child to any depth. Phase 2 reads 32, but a
#                          phase's GATE is not its child: the epic `blocks`-
#                          depends on the gate epic, so gate work vanishes.
#   subtree + one hop    — this one. The epic's subtree, plus each bead the epic
#                          directly depends on and that bead's subtree. bd's own
#                          edges say a phase is not finished until its gate and
#                          its blocking decisions are, and PRO-a0l depends on
#                          every phase epic for the same reason.
#
# The hop is exactly one, never transitive: the DoD epic depends on all eight
# phases, so a transitive walk from it swallows the project and the rail becomes
# one pin at 100%. Arbitration is nearest-pin — a bead inside a pin's own subtree
# belongs to that pin even when a second pin reaches it through a dependency, so
# the pins partition the graph instead of double-counting it.
#
# Plus the phase's own gate, whether or not an edge reaches it. Seven of the
# eight phase epics here `blocks`-depend on their gate and are counted by the hop
# above; Phase 4's does not, so an edge-only rule put PRO-d76 and its nine clause
# beads *behind no phase at all* — the gate that is the entire remaining question
# was the one weight missing from the road. The gate is found by title instead
# (is_gate), added as one more hop root, and the pin says which of the two rules
# reached it. A missing edge is a defect in the graph, not a licence for the
# board to under-count.
COUNT_RULE = ("epic subtree + one hop of dependency (gate and blocking decisions) "
              "+ the phase gate even when no edge reaches it, nearest pin wins")


def bead_edges(rows):
    """(kids, needs): containment downward, one hop of prerequisite sideways.

    Both come off the `dependencies` array bd already ships on every row, so the
    whole projection costs no query beyond the one `bd list --all` the board was
    already making. Containment is read through parents_of rather than re-derived
    here, so the lanes and the pins agree on parentage by construction.
    """
    kids = {}
    for kid, par in parents_of(rows).items():
        kids.setdefault(par, []).append(kid)
    needs = {}
    for r in rows:
        if not isinstance(r, dict):
            continue
        own = str(pick(r, "id", "issue_id", "key"))
        for d in (r.get("dependencies") or []):
            if isinstance(d, dict) and d.get("type") == "blocks" and d.get("depends_on_id"):
                needs.setdefault(str(d.get("issue_id") or own), []).append(
                    str(d["depends_on_id"]))
    return kids, needs


def subtree(root, kids):
    """`root` and every bead beneath it, containment only. Cycle-safe by the seen set."""
    seen, stack = {root}, [root]
    while stack:
        for k in kids.get(stack.pop(), ()):
            if k not in seen:
                seen.add(k)
                stack.append(k)
    return seen


def phase_beads(rows, roots, extra=None):
    """{root epic id -> set of bead ids counted for it}, under COUNT_RULE.

    `roots` is ordered, and the order is the rail's, so the one bead two phases
    both depend on (PRO-iii, an open question blocking Phase 4 and Phase 6 alike)
    lands on the earlier pin deterministically instead of being counted twice.

    `extra` is {root -> [more hop roots]} and exists for exactly one case: a gate
    its own epic carries no edge to. It joins the dependency hop rather than the
    containment pass, so a gate never outranks a phase that actually contains the
    bead, and the arbitration stays the one rule stated in COUNT_RULE.

    Every returned id exists in `rows`: parents_of has a dotted-id fallback that
    can name a parent no bead carries, and a phantom in a total is a number that
    cannot be reproduced by any query.
    """
    kids, needs = bead_edges(rows)
    # `isinstance` for the reason parents_of, bead_edges, epic_index and dep_graph
    # all carry it and these two id-indexes did not: pick() reaches for `.get`,
    # while _bd_run only promises a list — never a list of objects. Every other
    # reader of the same rows survives a stray scalar; this comprehension was the
    # first that did not, and it takes the whole page with it while the dependency
    # card beside it would have degraded to a note. Measured: a listing with one
    # bare string in it died here, not at the `by` index below it.
    live = {str(pick(r, "id", "issue_id", "key")) for r in rows if isinstance(r, dict)}
    live.discard("")
    held, near = {}, {}
    for e in roots:  # containment wins over dependency, whichever pin is nearer
        for b in subtree(e, kids) & live:
            held.setdefault(b, e)
    for e in roots:
        for p in list(needs.get(e, ())) + list((extra or {}).get(e, ())):
            for b in subtree(p, kids) & live:
                near.setdefault(b, e)
    out = {e: set() for e in roots}
    for b in live:
        e = held.get(b) or near.get(b)
        if e in out:
            out[e].add(b)
    return out


def norm(text):
    """A name reduced to its words, so "Phase 4 · server and sync" and "Phase 4
    epic" can be compared without either side having to spell the other."""
    return " ".join(tokens(str(text).lower()))


def epic_index(rows):
    """{normalised epic title -> bead id}, with a trailing "epic" also indexed.

    A phase lane is called "Phase 4 · server and sync" and its epic is titled
    "Phase 4 epic", so the join is by name and needs both spellings. First writer
    wins on a collision, which keeps the mapping stable as beads are added.
    """
    kids, _ = bead_edges(rows)
    idx = {}
    for r in rows:
        if not isinstance(r, dict):
            continue
        bid = str(pick(r, "id", "issue_id", "key"))
        if not bid or not (bid in kids or str(pick(r, "issue_type", "type")) == "epic"):
            continue
        title = norm(pick(r, "title", "summary", "name") or bid)
        idx.setdefault(title, bid)
        if title.endswith(" epic"):
            idx.setdefault(title[:-5].strip(), bid)
    return idx


# ---------------------------------------------------------------- phase gates
#
# A phase's gate is a different bead from the phase's epic, and it closes on a
# different day. Phase 3's gate closed on 2026-08-08 with PRO-rsd still at 6 of
# 10, and Phase 2's gate is closed while two of its eight clause beads were
# superseded rather than met. A rail with one fraction per phase can state
# neither fact, so the gate is projected beside the epic and never folded into
# it.
#
# Which bead is the gate is DERIVED, and the derivation is the point. This graph
# titles them "Phase <n> gate: <clauses>" and the epics "Phase <n> epic", so the
# ordinal joins them with no table in this file — a ninth phase named the same
# way is picked up with no edit. A hand-kept list of gate ids is the single most
# recurring defect in this repo, and it would be a particularly bad one here:
# the list would be right on the day it was written and wrong on the day a phase
# was added, which is the one day anybody looks.
GATE_WORD = "gate"


def is_gate(title):
    """The phase ordinal this title is the GATE of, or "".

    The shape is `phase <n> gate ...`, matched on adjacent words rather than on a
    bare `"gate" in title`: PRO-767 is titled "Phase 1 follow-ups: findings from
    the run, none blocking the gate" and a substring test hands it Phase 1's gate
    seat. Adjacency is what the tracker's own naming convention actually encodes.

    Returns the ordinal as a string ("0" is a real phase here and is truthy as
    written), so a caller gets the identity and the answer in one read.
    """
    tk = tokens(str(title).lower())
    for i in range(max(0, len(tk) - 2)):
        if tk[i] == "phase" and tk[i + 2] == GATE_WORD:
            return tk[i + 1]
    return ""


def phase_ord(title):
    """The phase ordinal a title names, gate or epic alike, or ""."""
    tk = tokens(str(title).lower())
    for i, w in enumerate(tk[:-1]):
        if w == "phase":
            return tk[i + 1]
    return ""


def gate_index(rows):
    """{phase ordinal -> [every bead titled as that phase's gate]}, id-sorted.

    EVERY candidate, never one. This returned a single id chosen by `setdefault`
    over string-sorted ids until a decoy proved what that means: alphabetical
    order encodes no authority, so the winner of a tie was whichever id happened
    to sort first, and the page went on printing "matched on phase 4" in full
    confidence while resolving a follow-up bug report as the gate. Phase 4's
    clause fraction silently became "no clause beads" — the one number the whole
    projection exists to state.

    It is not a hypothetical tie. Four of the eight ordinals in this graph
    already collide, and Phase 5's alphabetical winner is `PRO-46gn`, a bug
    report titled "A Phase-5 gate bead exists with no clause in the recorded
    gate" — it beats the real gate `PRO-iws` and is only not used because an edge
    resolves Phase 5 first. Handing the list back lets the caller refuse.
    """
    out = {}
    for r in sorted((x for x in rows if isinstance(x, dict)),
                    key=lambda x: str(pick(x, "id", "issue_id", "key"))):
        bid = str(pick(r, "id", "issue_id", "key"))
        n = is_gate(pick(r, "title", "summary", "name"))
        if bid and n:
            out.setdefault(n, []).append(bid)
    return out


def gate_of(epic, by, needs, rneeds, gidx):
    """(gate bead id, how it was found) for a phase epic — always both.

    Three rules, in the order of how much the tracker is actually asserting, and
    a refusal rather than a guess when none of them speaks:

      the epic's edge   — the epic `blocks`-depends on a bead titled as this
                          phase's gate. bd is stating the relationship.
      the gate's edge   — the same relationship recorded the OTHER WAY: the gate
                          depends on the epic. Reading only the epic's outgoing
                          edges is what made Phase 4 look edgeless, and the board
                          then blamed the tracker for a gap that was this
                          function's own half-blindness. A relationship is a
                          relationship whichever end recorded it.
      by ordinal        — no edge either way, but exactly one bead is titled as
                          this phase's gate. Epic-typed candidates are preferred
                          when there are any, because a gate is an epic here and
                          the clause beads that cite it are not.

    Ambiguity REFUSES. Two candidates and no edge is a question the graph has not
    answered, and answering it by sort order is worse than saying so: a wrong
    gate is indistinguishable from a right one on the page, while a refusal names
    every candidate and asks for an edge.
    """
    def title(b):
        return str(pick(by[b], "title", "summary", "name") or "") if b in by else ""

    # Every `how` here is PLAIN TEXT and every caller escapes it, matching
    # lane_epic. Markup in a provenance string is how one escaped field and one
    # unescaped field end up side by side in the same sentence.
    for dep in needs.get(epic, ()):
        if dep in by and is_gate(title(dep)):
            return dep, "the epic's own blocks edge onto the gate"
    for dep in rneeds.get(epic, ()):
        if dep in by and is_gate(title(dep)):
            return dep, "the gate's own blocks edge onto the epic"
    n = phase_ord(title(epic))
    if not n:
        return "", "this pin names no phase, so it has no gate to find"
    cand = [b for b in gidx.get(n, ()) if b != epic and b in by]
    epics = [b for b in cand if str(pick(by[b], "issue_type", "type")) == "epic"]
    pick_from = epics or cand
    if len(pick_from) == 1:
        return pick_from[0], (
            f"the only {'epic ' if epics else ''}bead titled as phase {n}'s gate; "
            f"no blocks edge joins it to the epic in either direction")
    if not pick_from:
        return "", f"no bead is titled as phase {n}'s gate"
    return "", (f"REFUSED — {len(pick_from)} beads are titled as phase {n}'s gate "
                f"({', '.join(pick_from)}) and no blocks edge picks one. Add the "
                f"edge rather than letting the board choose by sort order")


def gate_stat(g, how, kids, by):
    """A gate's own state and its clause fraction, kept apart on purpose.

    The gate bead's status is the human's verdict; the clause children are the
    evidence. They disagree in both directions here and both disagreements are
    real: Phase 2's gate is CLOSED at 6 of 8 because two clauses were superseded
    rather than met, and Phase 4's gate is OPEN at 1 of 9. A board that showed
    only the fraction would report Phase 2 unfinished; one that showed only the
    status would report Phase 4's nine clauses as a single open checkbox.
    """
    if not g or g not in by:
        return {"id": g, "how": how, "clauses": 0, "met": 0, "closed_bead": None,
                "title": "", "missing": bool(g)}
    kid = (subtree(g, kids) - {g}) & set(by)
    met = sum(1 for b in kid if str(pick(by[b], "status", "state")) == "closed")
    return {"id": g, "how": how, "clauses": len(kid), "met": met,
            "closed_bead": str(pick(by[g], "status", "state")) == "closed",
            # The verdict's own reasoning. Phase 2 reads `closed, 6/8` and the
            # only thing that makes those two numbers compatible is this text —
            # two clauses superseded rather than met. Without it the page states
            # a contradiction and leaves the reader to assume a bug.
            "reason": str(pick(by[g], "close_reason", "resolution", "reason")),
            "title": str(pick(by[g], "title", "summary", "name") or g), "missing": False}


def lane_epic(w, idx, live):
    """(epic id, how it was resolved) for a lane — always both, never just the id.

    A pin that silently guessed its epic would be the same defect one level down:
    a number whose provenance the page does not state. So every outcome names
    itself, including the failures, and a lane with no epic keeps its pin and
    says it is counting seat rows instead.
    """
    want = str(w.get("epic") or "").strip()
    if want:
        return (want, "pinned by lane --epic") if want in live else (
            "", f"--epic {want} names no bead")
    if w["id"] in live:
        return w["id"], "the lane is the epic"
    name = str(w.get("name") or w["id"])
    head = name.split("·")[0].split("—")[0]
    for cand, how in ((norm(name), "lane name"), (norm(head), "lane name head")):
        if cand and cand in idx:
            return idx[cand], f"matched on {how}"
    return "", "no epic carries this name"


_STATUS_CACHE = {}


def bd_totals(timeout=DEP_TIMEOUT):
    """`bd status --json` — the tracker's own totals, to check the listing against.

    This exists because of a trap that reads as a working board: `bd list --json`
    without `--all` silently excludes closed beads. It returns 368 rows here, all
    open or in progress, while the tracker holds 569 of which 201 are closed. Any
    outstanding/total computed off that listing shows every phase at 0% closed
    forever, and nothing on the page looks wrong.

    So the count is cross-checked against a query that comes at the number from
    the other side, and the JSON reporter is used rather than the human-readable
    summary — a total parsed out of prose is one release note away from silently
    becoming zero.

    Returns {} when the check cannot run. Unverified is not a synonym for wrong,
    and the caller says which of the two it is.
    """
    key = ("status", timeout)
    if key in _STATUS_CACHE:
        return _STATUS_CACHE[key]
    out = {}
    try:
        p = subprocess.run([BD, "--readonly", "status", "--json", "--no-activity"],
                           capture_output=True, text=True, timeout=timeout)
        if p.returncode == 0:
            got = json.loads(p.stdout or "{}")
            out = got.get("summary", got) if isinstance(got, dict) else {}
    except (OSError, ValueError, subprocess.TimeoutExpired):
        out = {}
    _STATUS_CACHE[key] = out if isinstance(out, dict) else {}
    return _STATUS_CACHE[key]


def dep_graph(rows):
    """The `blocks` subgraph, kept to edges with at least one unclosed endpoint.

    Scoped on purpose. Open work plus its immediate closed deps is 124 beads of
    which 87 carry no edge at all — a wall of loose boxes that buries the one
    thing this section adds, and those beads are already task rows above. Parent
    -child is left out for the same reason rather than because it is dirty (it is
    clean: 62 children, one parent each, all agreeing with the `parent` field):
    the lanes above already draw containment, and folding it in here takes 37
    nodes to 94. `related` is not a dependency.

    Blocked is computed, never read. bd stores PRO-3i4 as `open` while printing
    it [BLOCKED] itself, so a raw status read would paint 8 held beads as free
    work. Unclosed-with-an-unclosed-blocker matches `bd ready` on every node.
    """
    st, title = {}, {}
    for r in rows:
        bid = str(pick(r, "id", "issue_id", "key")) if isinstance(r, dict) else ""
        if bid:
            st[bid] = str(pick(r, "status", "state"))
            title[bid] = str(pick(r, "title", "summary", "name") or bid)
    edges = set()
    for r in rows:
        own = str(pick(r, "id", "issue_id", "key")) if isinstance(r, dict) else ""
        for d in (r.get("dependencies") or []) if own else []:
            # depends_on_id is the blocker: `bd dep tree` prints a bead [BLOCKED]
            # and hangs these underneath it, so arrows run blocker -> blocked.
            if not isinstance(d, dict) or d.get("type") != "blocks":
                continue
            a, b = str(d.get("depends_on_id") or ""), str(d.get("issue_id") or own)
            if a in st and b in st and a != b and (st[a] != "closed" or st[b] != "closed"):
                edges.add((a, b))
    held = {}
    for a, b in edges:
        held.setdefault(b, []).append(a)
    state = {}
    for n in {x for e in edges for x in e}:
        if st[n] == "closed":
            state[n] = DONE
        elif any(st[x] != "closed" for x in held.get(n, ())):
            state[n] = BLOCK
        else:
            state[n] = BEAD_ST.get(st[n], "queued")
    return state, {n: title[n] for n in state}, sorted(edges)


def mm_id(bead, taken):
    """`-` and `.` end a mermaid id early, so bead ids fold into [A-Za-z0-9_]."""
    base = "".join(c if c.isascii() and (c.isalnum() or c == "_") else "_" for c in bead)
    base = base if base[:1].isalpha() or base[:1] == "_" else "n" + base
    ident, i = base, 2
    while taken.get(ident, bead) != bead:  # folding can collide; suffix until it does not
        ident, i = f"{base}_{i}", i + 1
    taken[ident] = bead
    return ident


def mm_text(text, limit=DEP_LABEL):
    """Collapse, truncate, then escape — that order, so no entity is cut in half.

    Two parsers have to be survived in turn. The browser reads the <pre> first,
    so a bare `&` must reach mermaid as an HTML entity; mermaid reads the label
    second, so its own `#nn;` codes stand in for the characters that would end
    the label early. `#` is rewritten first or it re-escapes the hash of every
    code emitted after it.
    """
    t = " ".join(str(text).split())
    if len(t) > limit:
        t = t[:limit].rstrip() + "…"
    for a, b in (("#", "#35;"), ('"', "#quot;"), ("<", "#60;"), (">", "#62;")):
        t = t.replace(a, b)
    return esc(t, quote=False)


# Line break in a node label, spelled to survive either way the host may lift the
# source out of the <pre>. mermaid.run reads innerHTML and entity-decodes, so a
# literal <br> element and this entity both arrive as a break; a host reading
# textContent instead loses a real <br> element outright and would run the id
# into the title. mermaid's own #60;br/#62; is no good either way — it comes back
# out as the four visible characters. The entity is the only spelling that holds
# under all three, and a title's own angle brackets cannot reach this form: they
# are already #60;/#62; by the time they are concatenated.
MM_BR = "&lt;br/&gt;"


def dep_mermaid(state, title, edges):
    """Flowchart source. Left-to-right: these are orderings, and time reads across."""
    taken, ident = {}, {}
    out = ["flowchart LR"]
    out += [f"  classDef {k} fill:{v},stroke:{v},color:#fff"
            for k, v in DEP_FILL.items()]
    for n in sorted(state):
        ident[n] = mm_id(n, taken)
        out.append(f'  {ident[n]}["{mm_text(n, 24)}{MM_BR}{mm_text(title[n])}"]')
    out += [f"  {ident[a]} --> {ident[b]}" for a, b in edges]
    for k in DEP_FILL:
        members = ",".join(ident[n] for n in sorted(state) if state[n] == k)
        if members:
            out.append(f"  class {members} {k}")
    return "\n".join(out)


def dep_section():
    """Re-read bd and redraw on every render. The board is meant to be live.

    Nearly all of the cost is `bd` process start rather than the query, so a
    cache would trade away the liveness that was asked for to buy speed that was
    not. Nothing here can raise: the graph is one card, not the page.
    """
    try:
        rows, note = bd_fetch()
        state, title, edges = ({}, {}, []) if note else dep_graph(rows)
        if not note and not edges:
            note = "bd records no unfinished blocking dependency"
    except Exception as e:  # a tracker read must never be able to eat the board
        state, edges, note = {}, [], f"{type(e).__name__}: {e}"
    if note:
        return (f"<div class=card><h2>Dependency graph</h2>"
                f"<div class=muted>not drawn — {esc(note)}</div></div>")
    shown = set(state.values())
    legend = "".join(f"<span class=chip><i class=sw style='background:{DEP_FILL[k]}'></i>"
                     f"{esc(DEP_WORD[k])}</span>" for k in DEP_FILL if k in shown)
    return (f"<div class=card><h2>Dependency graph &middot; {len(state)} beads, "
            f"{len(edges)} edges</h2>"
            f"<div class='muted dep-note'>Arrows read <b>A &rarr; B means A blocks B</b>. "
            f"Only beads on a <b>blocks</b> edge are drawn, and only where one end is "
            f"still open — everything else is a lane row above. Blocked is computed "
            f"from the edges, not copied from the bead's status.</div>"
            f"<div class=row style='margin:0 0 12px'>{legend}</div>"
            f"<pre class=mermaid>{dep_mermaid(state, title, edges)}</pre></div>")


def scan_range(s, base):
    """The commit range these numbers describe, and one line saying which it is.

    `base..HEAD` is the branch's drift and the range the board has always meant.
    It is also empty for most of a run's life, because the orchestrator publishes
    from a checkout sitting on the default branch with everything already merged
    — which is how a live board can be correct and still read zero on every tile.
    So when there is no drift, the window becomes what the run itself landed on
    `base` since it started. Both are honest; the board says which one it drew.
    """
    ok, out, why = git("rev-list", "--count", f"{base}..HEAD")
    if not ok:
        return "", "", f"`git rev-list {base}..HEAD` failed — {why}"
    if out.strip() not in ("", "0"):
        return base, f"{base}..HEAD", ""
    since = s.get("started") or ""
    if not since:
        return base, f"{base}..HEAD", ""
    ok, out, why = git("log", "--format=%H", f"--since={since}", base)
    if not ok or not out:
        return base, f"{base}..HEAD", ""
    oldest = out.splitlines()[-1]
    ok, parent, _ = git("rev-parse", "--verify", f"{oldest}^")
    start = parent if ok and parent else oldest
    return start, f"{start[:9]}..{base}", ""


def scan(s, base):
    """Read the real diff and commit list out of git so numbers stay honest.

    Returns "" on success or a one-line reason. Nothing is written into `s`
    until every git call has succeeded, so a bad base ref leaves the last good
    numbers standing rather than replacing them with an empty diff that reads
    as a clean tree (PRO-jy0).
    """
    frm, span, why = scan_range(s, base)
    if why:
        return why
    head = span.split("..")[1]
    ok, out, why = git("diff", "--numstat", frm, *([] if head == "HEAD" else [head]))
    if not ok:
        return f"`git diff {frm}` failed — {why}"
    rows = []
    for line in out.splitlines():
        p = line.split("\t")
        if len(p) == 3:
            rows.append({"path": p[2], "added": int(p[0]) if p[0] != "-" else 0,
                         "removed": int(p[1]) if p[1] != "-" else 0, "new": False})
    ok, out, why = git("ls-files", "--others", "--exclude-standard")
    if not ok:
        return f"`git ls-files` failed — {why}"
    for path in out.splitlines():
        try:
            with open(path, "rb") as f:
                n = sum(1 for _ in f)
        except OSError:
            n = 0
        rows.append({"path": path, "added": n, "removed": 0, "new": True})
    ok, out, why = git("log", "--format=%h\x1f%s\x1f%ad", "--date=short", span)
    if not ok:
        return f"`git log {span}` failed — {why}"
    commits = []
    for line in out.splitlines():
        p = line.split("\x1f")
        if len(p) == 3:
            commits.append({"sha": p[0], "title": p[1], "date": p[2]})
    s["diff"] = sorted(rows, key=lambda r: -(r["added"] + r["removed"]))
    s["commits"] = commits
    s["span"] = span
    # Which of scan_range's two windows this is, recorded rather than re-derived
    # by sniffing the span string later. They mean opposite things to anything
    # asking "should this merged work be in here": `landed` is the base's own
    # history and must contain it, `drift` is a branch measured against a base
    # that already has it, and so must not. reconcile() runs on one and not the
    # other, and guessing wrong turns it into a klaxon.
    s["span_mode"] = "drift" if head == "HEAD" else "landed"
    return ""


# Lockfiles are tracked, textual, machine-written and enormous — Cargo.lock alone
# outweighs several crates. Excluded by pathspec so the exclusion is one line the
# page can print, rather than an extension allow-list that silently stops
# recognising a language the day somebody adds one.
SRC_SKIP = (":(exclude)*.lock", ":(exclude)*-lock.json", ":(exclude)*.lockb")


def src_lines(base):
    """Tracked text lines at `base`, grouped by top-level path. (areas, note).

    How big the thing actually is, which no bead can answer and which the rest of
    this board — a diff, a commit range, a PR — measures only the movement of.

    Read at a REV, not from the worktree. Every other number here describes drift
    and is allowed to; this one is the project's size, and a seat mid-edit two
    directories over must not be able to move it. `git grep -c ""` counts every
    line of every tracked file at a rev in one process, and `-I` decides what is
    text by asking git rather than by a hand-kept list of extensions — the same
    enumerate-by-hand defect this file keeps finding one directory over.

    Areas are top-level paths, which is a fact about the repository rather than a
    mapping kept here. `server/` reads as server because it is named that, not
    because a table in a Python file says so; the day a directory is added it
    appears with no edit, which a curated server/client/frontend table could not
    do.
    """
    ok, out, why = git("grep", "-c", "-I", "", base, "--", *SRC_SKIP)
    if not ok:
        return [], f"`git grep -c -I '' {base}` failed — {why}"
    tally = {}
    for line in out.splitlines():
        # `<rev>:<path>:<count>`. The path is taken from the right so a filename
        # holding a colon cannot shift the count into it.
        _, _, rest = line.partition(":")
        path, _, num = rest.rpartition(":")
        if not path or not num.isdigit():
            continue
        top = path.split("/")[0] if "/" in path else "(repo root)"
        name = path.rsplit("/", 1)[-1]
        ext = "." + name.rsplit(".", 1)[1] if "." in name[1:] else "(no suffix)"
        a = tally.setdefault(top, {"area": top, "lines": 0, "files": 0, "ext": {}})
        a["lines"] += int(num)
        a["files"] += 1
        a["ext"][ext] = a["ext"].get(ext, 0) + 1
    if not tally:
        return [], (f"`git grep -c -I '' {base}` matched no tracked text file — "
                    f"an empty tree and an unreadable one are not the same thing")
    areas = sorted(tally.values(), key=lambda a: (-a["lines"], a["area"]))
    for a in areas:
        a["ext"] = sorted(a["ext"].items(), key=lambda kv: (-kv[1], kv[0]))[:2]
    return areas, ""


def pr_in_subject(subject):
    """The PR number a commit subject claims to carry, or "".

    Two spellings, because the repo's merge style decides which one exists: a
    merge commit's `Merge pull request #7 from ...`, and a squash's `title (#7)`.
    """
    t = subject.strip()
    tag = ""
    if t.startswith("Merge pull request #"):
        tag = t[len("Merge pull request #"):].split()[0]
    elif t.endswith(")") and " (#" in t:
        tag = t[t.rfind(" (#") + 3:-1]
    return tag if tag.isdigit() else ""


def landed_prs(s, base):
    """PR numbers whose work is actually reachable from the tracked base.

    A PR's state is a claim about a branch; this is the answer about the base,
    and they can differ. Merging a stack, then rebasing and force-pushing the
    base from a worktree that predated the merge, discards the merge — while the
    forge goes on reporting MERGED, truthfully, about a branch that no longer
    carries it. 259 verified lines missed the default branch that way, and every
    status field on every dashboard agreed they had not.

    So the board reads git rather than the claim. Cheap: one `log` on a base the
    scan is already reading. Returns (numbers, ok) and `ok` matters — a base we
    could not read means *unverified*, never *did not land*, because accusing a
    good PR is its own kind of wrong answer.
    """
    since = s.get("started") or ""
    args = ["log", "--format=%s"] + ([f"--since={since}"] if since else ["-n", "400"])
    ok, out, _ = git(*args, base)
    if not ok:
        return [], False
    # git log is newest first, so this order is also the answer to "what merged
    # last" — which the commit scan cannot give on a feature branch, where the
    # range holds the branch's own commits and no merge at all.
    return [n for n in (pr_in_subject(l) for l in out.splitlines()) if n], True


def refresh(s, base):
    """Re-read git on every command, because a statistic with a second command
    in front of it is a statistic that is permanently wrong.

    `scan` has existed since the board did and was never once run: this ledger
    reached 34 tasks and 115 events still holding commits:[] and diff:[], so
    `files touched`, `lines added/removed`, and `commits` all read zero for the
    whole of a run. Anything nobody has to remember is the only kind that stays
    true, so the refresh is part of publishing rather than a step beside it.

    A failure keeps the previous numbers and says so on the board. The error
    event fires only when the reason changes, so a repo that is simply absent
    does not write one line of log per publish.
    """
    prev = s.get("scan") or {}
    note = scan(s, base)
    # Same contract as the scan above and for the same reason: a failed read
    # keeps the last good areas and says when they were last good, so a git that
    # cannot answer never renders as a repository that has no source in it.
    psrc = s.get("src") or {}
    areas, snote = src_lines(base)
    s["src"] = {"base": base, "at": now(), "note": snote,
                "areas": (psrc.get("areas") or []) if snote else areas,
                "ok_at": psrc.get("ok_at", "") if snote else now()}
    nums, seen = landed_prs(s, base)
    s["landed"] = {"base": base, "checked": seen, "prs": sorted(set(nums), key=int),
                   "latest": nums[0] if nums else "", "since": s.get("started") or ""}
    s["scan"] = {"base": base, "at": now(), "note": note,
                 "ok_at": prev.get("ok_at", "") if note else now()}
    if note and note != prev.get("note"):
        s["events"].append({"t": now(), "kind": "err",
                            "text": f"git numbers not refreshed — {note}"})
    return note


# ---------------------------------------------------------------- rendering

LIGHT = ("--bg:#faf9f7;--panel:#fff;--ink:#1c1b19;--dim:#6d6862;--line:#e6e2dc;"
         "--acc:#c96442;--ok:#3f8f5f;--run:#c08019;--err:#c0392b;--idle:#b3ada6;"
         "--shadow:0 1px 2px rgba(0,0,0,.06),0 8px 24px rgba(0,0,0,.04)")
DARK = ("--bg:#18100c;--panel:#221a16;--ink:#f4efea;--dim:#a49a92;--line:#372c25;"
        "--acc:#e08160;--ok:#63b585;--run:#e0ac4b;--err:#e3776a;--idle:#5f554e;"
        "--shadow:0 1px 2px rgba(0,0,0,.4)")
CSS = (f":root{{{LIGHT}}}@media(prefers-color-scheme:dark){{:root{{{DARK}}}}}"
       f":root[data-theme=dark]{{{DARK}}}:root[data-theme=light]{{{LIGHT}}}" + """
*{box-sizing:border-box}body{margin:0;padding:28px 20px 64px;background:var(--bg);color:var(--ink);
font:15px/1.55 ui-sans-serif,-apple-system,"Segoe UI",Inter,sans-serif}
.wrap{max-width:1120px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
h1{font-size:26px;line-height:1.25;margin:0;letter-spacing:-.02em}
h2{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--dim);margin:0 0 12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 20px;box-shadow:var(--shadow)}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;
padding:3px 11px;font-size:12px;color:var(--dim);white-space:nowrap}
.chip b{color:var(--ink);font-weight:600}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
.bar{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--line);margin:14px 0 8px}
.bar span{display:block;transition:width .4s ease}
.tl{position:relative;margin:26px 0 6px;padding:0 2px}
/* The road. One absolutely-positioned strip could not hold nine phases without
   stacking the labels on each other, so segments are flex items that wrap like
   words: `flex-grow` is the beads behind a phase, so width is weight, and
   `min-width` is the floor below which a label stops being readable. No script
   measures anything — the artifact CSP blocks scripts outright — so the browser
   does the wrapping and the same markup reads at 375px and at 1280px. */
.road{display:flex;flex-wrap:wrap;gap:16px 10px;margin:16px 0 10px}
/* flex-GROW is deliberately 0. With grow, the last line of the road stretches to
   fill itself and a 26-bead phase alone on a line draws wider than a 50-bead
   phase sharing one — the widths would then contradict the caption that says
   width is weight. A fixed basis of the phase's share of all phased beads keeps
   every segment the same width wherever it lands, and the leftover space at the
   end of a line reads as the ragged right edge of a wrapped paragraph, which is
   exactly what it is. */
.seg{flex:0 1 calc(var(--w) - 10px);min-width:132px;display:flex;flex-direction:column;
gap:7px;min-height:0}
.seg .st{height:7px;border-radius:999px;background:var(--line);overflow:hidden}
.seg .st i{display:block;height:100%;background:var(--c);border-radius:999px;
transition:width .5s ease}
.seg .sl{display:flex;flex-wrap:wrap;align-items:baseline;gap:1px 6px;
font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dim)}
.seg .sl b{color:var(--ink);font-weight:600;font-size:12px}
/* The measured values in a segment, as against the words between them. `sv` was
   a marker class with no rule behind it until the gate line put four more
   numbers onto the same three lines, and four fractions set in proportional
   digits stop reading as fractions. */
.seg .sl b.sv{font-variant-numeric:tabular-nums;font-size:12.5px}
/* The ordinal, not decoration: where a line breaks depends on the viewport, and
   the order of the road must not. */
.seg .sn{flex:none;min-width:15px;height:15px;border-radius:999px;background:var(--c);
color:var(--bg);font-weight:700;font-size:9.5px;display:inline-flex;align-items:center;
justify-content:center;padding:0 4px}
.seg .sc,.seg .sp,.seg .sg{flex-basis:100%;min-width:0;overflow-wrap:anywhere}
.seg .sc b{font-size:11.5px}
.seg .sp{opacity:.85}
.hl{gap:0 8px;font-size:12px;margin-top:2px}
.hl code{font-size:11px}
.railnote{font-size:11.5px;line-height:1.5;margin-top:2px;max-width:80ch}
.railwhy{margin-top:8px}
/* Its own class, not .lr: a lane-roster row and a provenance row look alike and
   a count that cannot tell them apart is how a dropped row hides. */
.rw{display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline;padding:4px 0;
font-size:12px;border-bottom:1px solid var(--line)}
.rw:last-child{border-bottom:0}
@media(max-width:760px){.seg{min-width:132px}.seg .sl{font-size:10.5px}}
/* At phone width the board scrolled sideways, which hides the right-hand end of
   every card and every log line — measured at 375px: 427px of content, before
   any of this section existed. The cause was never the layout; it was four
   places where a bead id, a path, a charter or a log line is one unbreakable
   run. They are told to break, rather than the page being told to scroll. */
.task .t,.log div>span,.lr>span,.f>span,.rw>span{min-width:0;overflow-wrap:anywhere}
.log div,.lr{flex-wrap:wrap}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:12px}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px;min-width:0}
.tile .n{font-size:24px;font-weight:650;letter-spacing:-.02em}
.tile .k{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-top:2px;overflow-wrap:anywhere}
/* A tile with no sub-line is a number with nowhere to say where it came from,
   which is the one thing no number on this board is allowed to be. */
.tile .sub{font-size:10.5px;line-height:1.4;color:var(--dim);margin-top:5px;overflow-wrap:anywhere}
/* Digits that sit in a column have to line up, or the eye compares glyph widths
   instead of magnitudes — every count, fraction and line total goes through one
   of these. */
.mono,.tile .n,.seg .sl,td,th,.num{font-variant-numeric:tabular-nums}
th{text-align:left;padding:5px 8px 5px 0;font-size:10.5px;letter-spacing:.07em;
text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);font-weight:600;
white-space:nowrap}
td{padding-right:8px}
.cav{border:1px solid var(--line);border-left:3px solid var(--c);border-radius:10px;
padding:12px 14px;margin-top:10px}
.cav h3{margin:0 0 5px;font-size:14px;font-weight:650;line-height:1.35}
.cav p{margin:0 0 8px;font-size:12.5px;color:var(--dim);max-width:80ch}
.vd{font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700}
.lane{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:12px}
.task{border:1px solid var(--line);border-left:3px solid var(--c);border-radius:10px;padding:12px 14px;background:var(--panel)}
.task .t{font-weight:600;font-size:14px;margin:2px 0 6px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--c);flex:none}
.pulse{animation:p 1.4s ease-in-out infinite}@keyframes p{50%{opacity:.25}}
.wave{margin-bottom:20px}.wave:last-child{margin-bottom:0}
.charter{font-size:12.5px;margin:-4px 0 10px 18px;max-width:70ch}
.seats{display:flex;flex-wrap:wrap;gap:2px 12px;font-size:11.5px;color:var(--dim);margin:0 0 6px}
.seats span{white-space:nowrap}.seats b{color:var(--ink);font-weight:600}
.wh{display:flex;align-items:center;gap:10px;margin:0 0 10px}
.wh .n{font-weight:650;font-size:14px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media(max-width:760px){.grid2{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse}td{padding:5px 0;vertical-align:middle;border-bottom:1px solid var(--line)}
tr:last-child td{border-bottom:0}
.dbar{display:flex;gap:2px;justify-content:flex-end}.dbar i{display:block;width:7px;height:9px;border-radius:2px}
.scroll{overflow-x:auto}
.log{max-height:260px;overflow-y:auto;display:flex;flex-direction:column-reverse;gap:2px}
.log div{display:flex;gap:10px;padding:3px 0}.log .ts{color:var(--dim);flex:none}
.f{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);align-items:baseline}
.f:last-child{border-bottom:0}
.sev{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;flex:none;width:56px}
.muted{color:var(--dim)}.big{font-size:17px;font-weight:600}
a{color:var(--acc)}
details{border:0}
summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:9px;padding:2px 0}
summary::-webkit-details-marker{display:none}
/* Literal glyphs rather than CSS codepoint escapes: this stylesheet is a plain
   Python string, so a backslash-digit escape is read as octal by Python first
   and reaches the page as a control character. */
summary::before{content:"▸";color:var(--dim);font-size:11px;width:9px;flex:none}
details[open]>summary::before{content:"▾"}
summary:hover{color:var(--acc)}
.tl{margin-top:2px}
.band{border-left:2px solid var(--line);margin-left:5px;padding:0 0 18px 20px;position:relative}
.band:last-child{padding-bottom:0;border-left-color:transparent}
.band>summary{margin-left:-20px;padding-left:20px}
.band .mk{position:absolute;left:-6px;top:7px;width:10px;height:10px;border-radius:50%;
background:var(--c);border:2px solid var(--panel)}
.bn{font-weight:650;font-size:13.5px}
.strands{display:grid;grid-template-columns:repeat(auto-fit,minmax(238px,1fr));
gap:12px;margin-top:10px}
.strand{display:flex;flex-direction:column;gap:8px;min-width:0}
/* A band that is one lane wide would stack its cards, and a vertical stack reads
   as a sequence — the one thing this layout must not say about work that is all
   at the same stage. Alone in its row, a lane spreads across it instead. */
.strand:only-child{display:grid;grid-template-columns:repeat(auto-fit,minmax(238px,1fr))}
.strand:only-child .sh{grid-column:1/-1}
.sh{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);
border-bottom:1px solid var(--line);padding-bottom:4px;display:flex;gap:6px;align-items:center}
.sh b{color:var(--ink);font-weight:600;letter-spacing:0;text-transform:none;font-size:12.5px}
.pr{font-size:11.5px;margin-top:7px;padding-top:7px;border-top:1px dashed var(--line);
display:flex;flex-wrap:wrap;gap:2px 10px;color:var(--dim)}
.pr b{color:var(--ink);font-weight:600}
.pr .on{color:var(--ok)}.pr .off{color:var(--err);font-weight:600}
.warnbox{border:1px solid var(--err);border-left-width:3px;border-radius:10px;
padding:11px 14px;background:var(--panel)}
.lr{display:flex;gap:10px;align-items:baseline;padding:4px 0;font-size:13px}
.lr .lc{color:var(--dim);font-size:12.5px;flex:1;min-width:0}
.dep-note{font-size:12.5px;max-width:78ch;margin:-4px 0 10px}
.sw{width:9px;height:9px;border-radius:3px;display:inline-block}
pre.mermaid{margin:0;overflow-x:auto;text-align:center;font:12px/1.5 ui-monospace,
SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word}
""")
CLR = {DONE: "var(--ok)", RUN: "var(--run)", REVIEW: "var(--acc)", FAIL: "var(--err)",
       BLOCK: "var(--err)", "queued": "var(--idle)"}
# Down the page is time. The order is the order a task moves through: landed work
# is behind the run, queued work is in front of it, and everything between is now.
# `review` used to be missing from this list entirely, so rows sitting in it fell
# out of the progress bar and the bar's segments stopped summing to the whole.
STAGES = [(DONE, "Landed", "merged or graded complete — behind the run"),
          (REVIEW, "In review", "built; a verifier is grading it adversarially"),
          (RUN, "Running", "a seat has its hands on this right now"),
          (BLOCK, "Held", "waiting on something outside the seat"),
          (FAIL, "Failed", "stopped with a cause; needs a decision"),
          ("queued", "Queued", "the road ahead — dispatchable, not started")]


def chip(label, value=""):
    return f"<span class=chip>{esc(label)}{f' <b>{esc(str(value))}</b>' if value else ''}</span>"


def tile(n, k, color=None, sub=""):
    st = f" style='color:{color}'" if color else ""
    return (f"<div class=tile><div class=n{st}>{esc(str(n))}</div>"
            f"<div class=k>{esc(k)}</div>"
            + (f"<div class=sub>{sub}</div>" if sub else "") + "</div>")


def source_strip(s):
    """How big the thing is, by area, measured at the tracked base.

    Every other size on this page is a delta — a diff, a range, a PR. This is the
    standing quantity those deltas move, and without it a run that added 80,000
    lines and a run that added 80 read the same.

    Areas are whatever top-level directories the repository has. No mapping table
    turns `server/` into "Server": the path is the label, so the strip cannot go
    stale against a rename it does not know about.
    """
    src = s.get("src") or {}
    areas, note = src.get("areas") or [], src.get("note") or ""
    if not areas and not note:
        return ""
    tot = sum(a["lines"] for a in areas)
    strip = "".join(
        tile(f"{a['lines']:,}", a["area"],
             sub=f"{a['files']:,} file{'s' if a['files'] != 1 else ''} &middot; "
                 + ", ".join(f"{esc(e)}&times;{c}" for e, c in a["ext"]))
        for a in areas)
    if note:
        # A blank strip and a clean tree must not look alike: the failure is
        # named, and whichever earlier read is still standing is dated.
        prov = f"<span style='color:var(--err)'>not re-read — {esc(note)}</span>"
        prov += (" &middot; the numbers above are the last good read ("
                 + esc(src.get("ok_at") or "date unknown") + ")" if areas
                 else " &middot; and no earlier read exists to fall back to")
    else:
        prov = (f"<code>git grep -c -I '' {esc(src.get('base') or '—')}</code> "
                f"at {esc(src.get('at') or '—')}, lockfiles excluded "
                f"(<code>{esc(' '.join(SRC_SKIP))}</code>) &middot; tracked text "
                f"lines, so tests and fixtures are in it and generated files are not")
    head = (f"{tot:,} tracked lines across {len(areas)} "
            f"area{'s' if len(areas) != 1 else ''}" if areas else "not measured")
    return (f"<div class=card><h2>Source &middot; {head}</h2>"
            f"<div class=tiles>{strip or '<div class=muted>no area measured</div>'}</div>"
            f"<div class='muted mono' style='font-size:11.5px;margin-top:12px'>"
            f"{prov}</div></div>")


def pr_verdict(pr, land):
    """What the tracked base says about this PR, which outranks what the PR says.

    Three outcomes and they are deliberately distinct: `on <base>` when the
    number is reachable from the base, `NOT ON <base>` only when the row claims
    merged, the base was readable, and the PR is young enough to be inside the
    window that was searched — and otherwise nothing, because unverified is not
    a synonym for missing.
    """
    num = str(pr.get("number", "")).lstrip("#")
    claim = (pr.get("state") or "").lower()
    if not num or not land.get("checked"):
        return ""
    if num in (land.get("prs") or []):
        return f"<span class=on>on {esc(land.get('base') or 'base')}</span>"
    merged = claim in ("merged", "closed") or pr.get("merged")
    # A PR opened before the window we read cannot be judged by it.
    if merged and (pr.get("created") or "") >= (land.get("since") or ""):
        return f"<span class=off>NOT ON {esc(land.get('base') or 'base')}</span>"
    return ""


def task_pr(t, land):
    """Branch, PR link, the PR's own diff, when it opened, and its CI — per task.

    Schema 2 held one `pr` for the whole board, which answered "what is the run's
    PR" and never "where does this row live". A row with neither a branch nor a
    PR says so in one muted line rather than printing five empty labels: absence
    is a real state on a queued row, and it should read as one.
    """
    pr = t.get("pr") or {}
    branch = t.get("branch") or ""
    if not branch and not pr:
        return "<div class='pr mono'>no branch yet</div>"
    if not pr:  # cut, not yet pushed — one fact known, so print one fact
        return (f"<div class='pr mono'><span>branch <b>{esc(branch)}</b></span>"
                f"<span>no pr yet</span></div>")
    num = str(pr.get("number", "")).lstrip("#")
    link = (f"<a href='{esc(pr['url'])}' target=_blank>#{esc(num or '?')}</a>"
            if pr.get("url") else (f"#{esc(num)}" if num else "—"))
    a, r = pr.get("added"), pr.get("removed")
    delta = (f"<span style='color:var(--ok)'>+{esc(str(a or 0))}</span> "
             f"<span style='color:var(--err)'>-{esc(str(r or 0))}</span>"
             if a is not None or r is not None else "—")
    state = pr.get("state") or ("merged" if pr.get("merged") else "")
    verdict = pr_verdict(pr, land)
    return (f"<div class='pr mono'>"
            f"<span>branch <b>{esc(branch or '—')}</b></span>"
            f"<span>pr <b>{link}</b>{f' {esc(state)}' if state else ''}"
            f"{' ' + verdict if verdict else ''}</span>"
            f"<span>{delta}</span>"
            f"<span>opened <b>{esc(pr.get('created') or '—')}</b></span>"
            f"<span>ci <b>{esc(pr.get('checks') or '—')}</b></span></div>")


def merge_banner(s):
    """Rows claiming a merge the tracked base does not have."""
    land = s.get("landed") or {}
    bad = [(t, pr_verdict(t.get("pr") or {}, land)) for t in s["tasks"]]
    bad = [t for t, v in bad if "NOT ON" in v]
    if not bad:
        return ""
    return ("<div class=warnbox><b style='color:var(--err)'>Merged, but not on "
            f"{esc(land.get('base') or 'base')}</b>"
            "<div class=muted style='font-size:12.5px;margin-top:4px'>"
            "These rows report a merge that the tracked base does not contain. A forge "
            "reports the state of a branch; this is the state of the base, and a rebase "
            "or force-push over a merge separates the two. Check before believing the "
            "row.</div>"
            + "".join(f"<div class='mono' style='margin-top:6px'>{esc(t['id'])} &middot; "
                      f"#{esc(str((t.get('pr') or {}).get('number', '?')))} &middot; "
                      f"{esc(t.get('title', ''))[:70]}</div>" for t in bad)
            + "</div>")


# ------------------------------------------------- claimed against measured
#
# The board has held both halves of this for a long time and never joined them.
# `--files` is what a seat says it touched; `scan()` is what git says the range
# contains. Rendered apart, a seat that declared five files and landed three is
# two panels that each look right.
#
# That gap is not hypothetical. A rebase dropped two commits off a branch on this
# run: it exited 0, the branch stayed MERGEABLE, the commit count stayed
# plausible, and every commit still in the range passed every per-commit check —
# because a range that lost two commits is a shorter list whose every member is
# valid. The only surviving signal was that the file list was short by three.


def diff_paths(s):
    """Every path the measured diff touches, renames counted under both names.

    `git diff --numstat` reports a detected rename as a single row spelled
    `a/b/{old.txt => new.txt}`, or `old.txt => new.txt` when the two share no
    prefix. Read literally, a task that landed `a/b/old.txt` perfectly well —
    and then saw it renamed — reads as a file that never landed. Expanding both
    sides costs a few lines and retires the whole class of false accusation.
    """
    out = set()
    for r in s.get("diff") or []:
        p = (r.get("path") or "").strip()
        if "=>" not in p:
            out.add(p)
            continue
        pre, brace, rest = p.partition("{")
        if brace and "}" in rest:
            mid, _, post = rest.partition("}")
            old, _, new = mid.partition("=>")
            for half in (old, new):
                out.add((pre + half.strip() + post).replace("//", "/"))
        else:
            old, _, new = p.partition("=>")
            out.add(old.strip())
            out.add(new.strip())
    return {x for x in out if x}


def claim_gap(files, paths):
    """Claimed entries the measured range does not account for.

    A claim counts as honoured by an exact path, by a trailing-slash directory
    some landed path sits under, or by a glob some landed path matches. Those
    are the three shapes seats actually write, and reading them literally would
    accuse work that landed perfectly — the one failure this must not have.
    Whitespace is stripped because `--files a.ts, b.ts` is stored with the space
    still attached, which is nobody's mistake worth a banner.
    """
    gap = []
    for raw in files:
        c = (raw or "").strip()
        if c.startswith("./"):
            c = c[2:]
        if not c:
            continue
        if c in paths:
            continue
        if c.endswith("/") and any(p.startswith(c) for p in paths):
            continue
        if any(ch in c for ch in "*?[") and any(fnmatch.fnmatch(p, c) for p in paths):
            continue
        gap.append(raw)
    return gap


def reconcile(s):
    """Rows whose claimed files the measured range does not contain.

    Returns `(rows, checked, why)` — the discrepancies, how many rows were
    actually compared, and, when nothing could be, one line saying so. That last
    one matters: this exists because absence of signal got read as presence of
    safety, and a check that quietly declines to run would rebuild exactly that.

    What is compared, and what deliberately is not:

    * **Claimed minus landed, never the reverse.** Files in the diff that no row
      claims are the run's own commits, docs, board state and the 787 rows that
      never passed `--files` at all. Flagging those would flag nearly the whole
      diff. The hazard is work that vanished, not work that arrived.
    * **Against the union diff, with no attempt to attribute a file to a row.**
      The board tracks many tasks against one range and cannot know which commit
      belonged to which seat. This is what keeps it quiet: the union is a
      superset of every row's contribution, so a file claimed by A and landed by
      B is present and A stays silent. Cross-task overlap can only *suppress* a
      finding, never invent one — which is the property that makes a banner here
      worth believing. The cost is a drop masked when another row touched the
      same file, accepted because seats are file-disjoint by charter.
    * **Only rows whose merge the base corroborates.** `--files` is written at
      report-back (SKILL.md line 280), while the PR opens and merges two rows
      later, so `done` on its own does not mean the work is on the base yet. The
      gate is the PR number appearing in `landed`, read out of git by the same
      `--since` window the diff was drawn over — so the two are aligned by
      construction rather than by hope. Queued, running, in review, and merged-
      but-unverified rows are all silent, because for them the range structurally
      cannot hold the files and a banner would carry no information.

    Suppressing those is not shading a real signal — it is declining to fire
    where firing is uniform across every row and therefore says nothing. Inside
    the domain where the comparison means something the bias runs the other way,
    hard: a false alarm costs a human thirty seconds, and a missed drop costs a
    bad merge. So a row is reported on any unexplained file, and a range that
    nets a file back to zero — landed, then reverted — is reported too rather
    than excused, because that is a thing worth being told.
    """
    land = s.get("landed") or {}
    if not (s.get("scan") or {}).get("ok_at"):
        return [], 0, "no git scan has succeeded yet, so there is nothing to compare against"
    if s.get("span_mode") != "landed":
        return [], 0, ("the drawn range is this checkout's own drift, which by construction "
                       "excludes work already merged to the base")
    if not land.get("checked"):
        return [], 0, "the tracked base could not be read, and unverified is not missing"
    paths, rows, checked = diff_paths(s), [], 0
    for t in s["tasks"]:
        files = t.get("files") or []
        num = str((t.get("pr") or {}).get("number", "")).lstrip("#")
        if not files or not num or num not in (land.get("prs") or []):
            continue
        checked += 1
        gap = claim_gap(files, paths)
        if gap:
            rows.append((t, gap))
    return rows, checked, ""


def gap_map(s):
    """`{task id: [unaccounted file]}`, so a card can mark what the banner names."""
    return {t["id"]: gap for t, gap in reconcile(s)[0]}


def claim_banner(s):
    """The reconcile, said where it cannot be missed — or why it could not run.

    Clean states print one quiet line rather than nothing. On this board the
    absence of a banner has already been misread as a verified tree once, and a
    check whose success and whose non-execution look identical is not a check.
    """
    rows, checked, why = reconcile(s)
    if rows:
        n = sum(len(g) for _, g in rows)
        return ("<div class=warnbox><b style='color:var(--err)'>Claimed, but not in the "
                f"measured range</b>"
                "<div class=muted style='font-size:12.5px;margin-top:4px'>"
                f"<b>{n}</b> file(s) across <b>{len(rows)}</b> row(s) were reported by a "
                "seat, and the diff the board just read out of the base these PRs merged "
                "into does not contain them. A rebase that drops a commit exits 0, leaves "
                "the branch mergeable, and leaves a commit list whose every entry is still "
                "valid — the file list is where it shows. Check the branch before believing "
                "the row.</div>"
                + "".join(f"<div class='mono' style='margin-top:6px'>{esc(t['id'])} &middot; "
                          f"#{esc(str((t.get('pr') or {}).get('number', '?')))} &middot; "
                          f"{esc(t.get('title', ''))[:60]}"
                          f"<div style='color:var(--err);margin-left:14px'>"
                          f"{esc(', '.join(g))}</div></div>" for t, g in rows)
                + "</div>")
    say = (f"reconciled {checked} row(s) against the measured range &mdash; every claimed "
           "file accounted for" if not why else f"not reconciled &mdash; {esc(why)}")
    return (f"<div class='muted mono' style='font-size:12px;margin:0 0 14px'>"
            f"Claimed files &middot; {say}</div>")


def task_card(t, land, gap=()):
    st = t.get("status", "queued")
    c = CLR.get(st, "var(--idle)")
    # `[:4]` silently dropped the fifth name, which is precisely the entry a
    # human comparing a card against a diffstat by eye is looking for. The cap
    # stays — a card is not a file list — but what it hides is now counted out
    # loud, and anything the range could not account for is shown in full and in
    # red however long the list is, because that is the load-bearing part.
    claimed = t.get("files") or []
    miss = [f for f in claimed if f in set(gap)]
    rest = [f for f in claimed if f not in set(gap)]
    bits = [f"<span style='color:var(--err)'>{esc(f)}</span>" for f in miss]
    bits += [esc(f) for f in rest[:4]]
    if len(rest) > 4:
        bits.append(f"+{len(rest) - 4} more")
    files = ", ".join(bits) or "—"
    if miss:
        files += (f" <span style='color:var(--err)'>&middot; {len(miss)} not in the "
                  f"measured range</span>")
    a, r = t.get("added", 0), t.get("removed", 0)
    delta = (f"<span class=mono style='color:var(--ok)'>+{a}</span> "
             f"<span class=mono style='color:var(--err)'>-{r}</span>") if a or r else ""
    note = f"<div class='muted mono' style='margin-top:6px'>{esc(t['note'])}</div>" if t.get("note") else ""
    pulse = " pulse" if st == RUN else ""
    seats = (f"<div class='seats mono'><span>impl <b>{esc(t.get('owner') or '—')}</b></span>"
             f"<span>verify <b>{esc(t.get('verifier') or '—')}</b></span></div>")
    return (f"<div class=task style='--c:{c}'><div class=row>"
            f"<span class='dot{pulse}'></span>"
            f"<span class=mono style='color:{c}'>{esc(st)}</span>"
            f"<span class='chip mono' style='margin-left:auto'>"
            f"{esc(t['bead']) if t.get('bead') else 'tier ' + esc(str(t.get('tier', 1)))}"
            f"</span></div>"
            f"<div class=t>{esc(t.get('title', t['id']))}</div>"
            f"{seats}"
            f"<div class='muted mono' style='word-break:break-all'>{files}</div>"
            f"<div style='margin-top:6px'>{delta}</div>{note}{task_pr(t, land)}</div>")


def pr_num(t):
    try:
        return int(str((t.get("pr") or {}).get("number", "")).lstrip("#"))
    except (TypeError, ValueError):
        return None


def merge_order(rows):
    """Merge order where the rows know it, ledger order everywhere else.

    A band ordered by PR number *is* the sequence things merged in, which is the
    sub-order the time axis wants. Rows predating per-task PR data are not
    shuffled into a fake one: the PR-bearing rows are permuted into the slots
    they already occupy, so adding PR data to one row cannot move another.
    """
    slots = [i for i, t in enumerate(rows) if pr_num(t) is not None]
    out = list(rows)
    for i, t in zip(slots, sorted((rows[i] for i in slots), key=pr_num)):
        out[i] = t
    return out


def timeline(s):
    """Down is time, across is parallelism.

    A row is a **stage of the run** — landed, in review, running, held, queued —
    and a column inside it is a lane. Reading down is reading forward in time;
    reading across a row is reading what ran beside what, because SKILL.md's own
    concurrency unit is the lane and two lanes run at once exactly when their
    charters do not intersect.

    A merge would be the better row and a dispatch batch the next best, but
    neither is derivable: no task row in any existing ledger carries a timestamp,
    and the event log's timestamps attach to narration rather than to tasks, so
    either choice would render an empty timeline for the board that is live right
    now. Status is the clock every ledger already keeps — queued is ahead,
    running is now, done is behind — and it costs no schema change to read. The
    landed band then sub-orders by PR number where a row has one, so it fills in
    as merge order without a second migration.

    Anything with an unrecognised status lands in a trailing band instead of
    vanishing: a board that silently drops rows is worse than an ugly one.
    """
    ts = s["tasks"]
    land = s.get("landed") or {}
    gaps = gap_map(s)
    lane_name = {w["id"]: w.get("name") or w["id"] for w in s["waves"]}
    known = {st for st, _, _ in STAGES}
    bands, out = [(st, lab, why) for st, lab, why in STAGES], ""
    bands += [(k, k, "status this board does not know") for k in
              sorted({t.get("status", "queued") for t in ts} - known)]
    for st, label, why in bands:
        rows = merge_order([t for t in ts if t.get("status", "queued") == st])
        if not rows:
            continue
        lanes, order = {}, []
        for t in rows:
            w = t.get("wave") or "—"
            if w not in lanes:
                lanes[w] = []
                order.append(w)
            lanes[w].append(t)
        strands = "".join(
            f"<div class=strand><div class=sh><b>{esc(lane_name.get(w, w))}</b>"
            f"<span>{esc(w) if w in lane_name else 'unassigned'}</span></div>"
            + "".join(task_card(t, land, gaps.get(t["id"], ())) for t in lanes[w])
            + "</div>" for w in order)
        shut = "" if st == DONE else " open"
        out += (f"<details class=band style='--c:{CLR.get(st, 'var(--idle)')}'{shut}>"
                f"<span class=mk></span>"
                f"<summary><span class=bn>{esc(label)}</span>"
                f"<span class='chip mono'>{len(rows)} row{'s' if len(rows) != 1 else ''}</span>"
                f"<span class='muted' style='font-size:12px'>{esc(why)}</span>"
                f"<span class='muted mono' style='margin-left:auto;font-size:11.5px'>"
                f"{len(order)} lane{'s' if len(order) != 1 else ''} wide</span></summary>"
                f"<div class=strands>{strands}</div></details>")
    return (f"<div class=card><h2>Timeline &middot; down is time, across is parallel</h2>"
            f"<div class='muted dep-note'>Each row is a <b>stage of the run</b>, ordered "
            f"the way work moves through it — landed at the top, not-yet-started at the "
            f"bottom. Each column inside a row is a <b>lane</b>, so two cards side by side "
            f"are two seats running at once on charters that do not intersect. Landed work "
            f"is folded shut; open it to see what got the run here.</div>"
            f"<div class=tl>{out or '<div class=muted>not dispatched yet</div>'}</div></div>")


def capacity_banner(s):
    """Idle capacity, said out loud, because remembering to look has never worked.

    The throughput rule used to trigger on *merges*: "re-scan at every merge, a
    merge unlocks work." That is true and it is not enough, because the run's
    longest idle stretches are exactly the ones with no merges in them — a
    verification round, a blocked branch, a seat waiting on a human answer.
    Trigger on merges and you re-scan precisely when you least need to.

    So this counts what is running against what is queued and says so on every
    publish. One seat with fifty rows behind it is the shape of a run that has
    quietly become a queue, and it renders identically to a healthy one unless
    something prints the ratio.

    The floor is deliberately low. Two is not a target; it is the point below
    which "no disjoint work exists" stops being plausible and needs saying out
    loud instead of assuming.
    """
    run = [t for t in s["tasks"] if t.get("status") in (RUN, REVIEW)]
    queued = [t for t in s["tasks"] if t.get("status") == "queued"]
    blocked = [t for t in s["tasks"] if t.get("status") == BLOCK]
    if len(run) >= 2 or not queued:
        return ""
    return ("<div class=warnbox><b style='color:var(--warn)'>Idle capacity</b>"
            "<div class=muted style='font-size:12.5px;margin-top:4px'>"
            f"<b>{len(run)}</b> seat(s) working, <b>{len(queued)}</b> queued and "
            f"<b>{len(blocked)}</b> held. Re-scan for a disjoint file set now — "
            "the trigger is a seat going quiet, not a merge landing, because the "
            "longest idle stretches contain no merges at all. If nothing is "
            "genuinely startable, say which dependency blocks each queued row "
            "rather than leaving the ratio unexplained.</div></div>")


def seat_banner(ts):
    """Tier-0 seatings that render() tolerates get said out loud instead."""
    bad = [f for f in seat_faults(ts) if (f[2] not in ORCH)]
    if not bad:
        return ""
    return ("<div class=warnbox><b style='color:var(--err)'>Tier-0 seat</b>"
            "<div class=muted style='font-size:12.5px;margin-top:4px'>"
            "The orchestrator owns no task and grades no task. These rows seat it "
            "anyway — fix them with a dispatch, never by widening the guard.</div>"
            + "".join(f"<div class='mono' style='margin-top:6px'>{esc(i)} &middot; "
                      f"{esc(seat)} = <b>{esc(who)}</b></div>" for i, seat, who in bad)
            + "</div>")


# ------------------------------------------------------------ standing caveats
#
# Some of what a reader most needs is true of the code and of nothing in the
# tracker. "The server is built and the app cannot reach it" is not a bead: no
# bead is open for it, every bead that would have been is closed, and every
# fraction on this page reads healthy while it holds. A board that cannot say it
# is a board that is accurate and misleading at once.
#
# So the orchestrator records it — and records a FALSIFIER with it. That second
# half is the whole design. A paragraph of prose, hard-coded here or typed into
# the ledger, is a claim with no expiry: the morning somebody adds the sync
# dependency, the paragraph goes on saying the app cannot reach the server, and a
# board that states yesterday's truth confidently is worse than one that omits
# it. A caveat here carries a one-line predicate over a file at the tracked base,
# re-run on every publish, and it has exactly three outcomes — it re-proves
# itself, it announces that it no longer reproduces and asks to be retired, or it
# says it could not be checked and why. That is the same rule the rest of this
# file already lives under: `scan` re-reads git because a statistic with a second
# command in front of it is permanently wrong, and `landed_prs` reads the base
# instead of believing the claim. A standing caveat gets no exemption from it.
#
# A caveat with no predicate is still accepted, and still rendered — some true
# things are not machine-checkable — but it is labelled `unchecked` rather than
# being allowed to look like the ones that re-proved themselves this minute.


def caveat_clauses(argv):
    """[{path, needle, expect}] from --file/--absent/--present, in argv ORDER.

    Read off the raw argv rather than the parsed flag dict, because the dict
    loses the pairing the moment a caveat has two conditions of different senses:
    `{file: [a, b], absent: [X], present: [Y]}` cannot say which needle belongs
    to which path. Each `--absent`/`--present` binds to the most recent `--file`,
    which is how the flags read left to right anyway.
    """
    out, path, i = [], "", 0
    while i < len(argv):
        a = argv[i]
        nxt = argv[i + 1] if i + 1 < len(argv) else None
        if a == "--file" and nxt is not None:
            path, i = nxt, i + 2
        elif a in ("--absent", "--present") and nxt is not None:
            out.append({"path": path, "needle": nxt, "expect": a[2:]})
            i += 2
        else:
            i += 1
    return out


def grep_at(base, path, needle):
    """(found, where, why) for `needle` anywhere under `path` at `base`.

    A PATHSPEC, not a file. A claim about the code is rarely a claim about one
    file: "the app cannot reach the relay" rests on a missing dependency in a
    manifest AND on no socket being opened anywhere in the app's source, and a
    single-file substring can only ever check the first. `git grep` takes a
    directory as happily as a filename, so one clause form covers both.

    `found` is True, False, or None for "could not tell", and the three are kept
    apart because a pathspec that matches nothing returns the same exit code as a
    pathspec whose files simply lack the needle — which would let a typo'd path
    prove absence, forever, in exactly the confident voice this whole mechanism
    exists to avoid. The path is checked for existence before absence is
    believed.
    """
    def grep(args):
        try:
            p = subprocess.run(["git", "grep", "-I", "-l", "--fixed-strings", *args],
                               capture_output=True, text=True, timeout=30)
        except (OSError, subprocess.TimeoutExpired) as e:
            return None, f"cannot run git grep: {e}"
        if p.returncode == 0:
            return True, ""
        if p.returncode == 1 and not (p.stderr or "").strip():
            return False, ""
        return None, " ".join((p.stderr or "").split())[:140] or f"exited {p.returncode}"

    why = ""
    for rev, where in ((base, f"{base}:{path}"), ("", f"{path} (worktree; {base} unreadable)")):
        args = (["-e", needle] + ([rev] if rev else []) + ["--", path])
        hit, why = grep(args)
        if hit is None:
            continue
        if hit is False:  # absence is only believable if the pathspec exists
            seen, _ = grep(["-e", ""] + ([rev] if rev else []) + ["--", path])
            if seen is not True:
                return None, where, "the pathspec matches no tracked text file there"
        return hit, where, ""
    return None, f"{base}:{path}", why or "git could not read it"


def probe(c, base):
    """Re-check a caveat's conditions against `base`. (verdict, colour, evidence).

    A caveat may rest on SEVERAL conditions and this treats them as the
    conjunction they are. The one that prompted the mechanism has two — no sync
    dependency declared, and no socket opened in app source — and checking only
    the first leaves the caveat reporting "still holds" the day someone opens a
    raw `WebSocket`, which needs no dependency entry at all. That is the stale-
    but-passing case, and it is the likely one: the manifest is the easy half to
    check and the wrong half to rely on.

    So one failed condition demotes the verdict rather than being averaged away,
    and every condition prints its own line. The colours read backwards on
    purpose: a caveat that still holds is bad news and draws in the error colour,
    one that has expired is good news and draws green. The verdict is about the
    project, not about the caveat's health.
    """
    cl = list(c.get("probes") or [])
    if not cl and c.get("path") and c.get("needle"):  # the single-clause form
        cl = [{"path": c["path"], "needle": c["needle"], "expect": c.get("expect")}]
    cl = [x for x in cl if x.get("path") and x.get("needle")
          and x.get("expect") in ("absent", "present")]
    if not cl:
        return ("unchecked", "var(--run)",
                "no falsifier attached &mdash; this claim cannot expire on its own. "
                "Re-record it with <code>--file &lt;pathspec&gt;</code> and "
                "<code>--absent</code> or <code>--present</code>.")
    held, gone, unk, lines = 0, 0, 0, []
    for x in cl:
        want, needle = x["expect"], x["needle"]
        found, where, why = grep_at(base, x["path"], needle)
        verb = "absent from" if want == "absent" else "present in"
        if found is None:
            unk += 1
            lines.append(f"<div><b>?</b> could not check <code>{esc(needle)}</code> in "
                         f"<code>{esc(where)}</code> &mdash; {esc(why)}</div>")
            continue
        ok = (not found) if want == "absent" else found
        if ok:
            held += 1
            lines.append(f"<div><b>&check;</b> <code>{esc(needle)}</code> is {verb} "
                         f"<code>{esc(where)}</code></div>")
        else:
            gone += 1
            lines.append(f"<div><b>&times;</b> <code>{esc(needle)}</code> is NO LONGER "
                         f"{verb} <code>{esc(where)}</code></div>")
    body = ("<div class='muted mono' style='font-size:11.5px'>re-checked this publish, "
            f"{len(cl)} condition{'s' if len(cl) != 1 else ''}, all of which the claim "
            f"needs:</div>{''.join(lines)}")
    drop = (f"<div style='margin-top:4px'>Retire it: <code>caveat "
            f"{esc(c.get('id', ''))} --drop</code></div>")
    if gone and held:
        return ("PARTLY EXPIRED", "var(--run)",
                body + "<div style='margin-top:4px'>One leg of the claim has gone. It is "
                       "no longer the thing it was recorded as; re-read it before "
                       "believing it.</div>")
    if gone:
        return ("EXPIRED", "var(--ok)", body + drop)
    if unk and not held:
        return ("unverified", "var(--run)",
                body + "<div style='margin-top:4px'>Unverified is not a synonym for "
                       "false.</div>")
    return ("still holds", "var(--err)", body)


def caveats(s, base):
    """The standing caveats, each with the verdict of its own falsifier.

    Renders nothing when none are recorded. An empty set is an empty set, not a
    missing measurement — the command that records one is in this file's usage
    line, and an empty card every publish would train the eye to skip the place
    the real ones appear.
    """
    cav = s.get("caveats") or []
    if not cav:
        return ""
    body = ""
    for c in cav:
        verdict, col, why = probe(c, base)
        body += (f"<div class=cav style='--c:{col}'>"
                 f"<h3>{esc(c.get('title') or c.get('id', ''))}</h3>"
                 f"<p>{esc(c.get('body') or '')}</p>"
                 f"<div class='mono vd' style='color:{col}'>{esc(verdict)}</div>"
                 f"<div class='muted mono' style='font-size:11.5px'>{why}</div>"
                 f"<div class='muted mono' style='font-size:11px;margin-top:4px'>"
                 f"<code>{esc(c.get('id', ''))}</code> &middot; recorded "
                 f"{esc(c.get('since') or '—')}</div></div>")
    return (f"<div class=card><h2>Standing caveats &middot; {len(cav)} "
            f"&middot; true of the code, invisible to the tracker</h2>"
            f"<div class='muted dep-note'>These are the things every fraction on "
            f"this page is compatible with and none of them can say. Each carries "
            f"falsifiers that are re-run against <code>{esc(base)}</code> on every "
            f"publish, so a caveat either re-proves itself here or announces that "
            f"it has expired. <b>A predicate is a proxy for the claim above it, "
            f"never the claim itself</b> — it can only test what a string search "
            f"can reach, so read the body for what is actually being asserted and "
            f"treat a passing check as evidence rather than as proof.</div>"
            f"{body}</div>")


def lane_roster(s):
    """Lane ids, charters, status. The cards themselves live in the timeline now —
    printing them twice was most of the board's length and none of its meaning.
    Done lanes fold away; a lane with no rows yet still shows, because the road
    ahead is part of what this board is for."""
    live, past = "", ""
    for w in s["waves"]:
        st = w.get("status", "queued")
        c = CLR.get(st, "var(--idle)")
        line = (f"<div class=lr><span class='dot{' pulse' if st == RUN else ''}' "
                f"style='--c:{c};margin-top:6px'></span>"
                f"<span style='font-weight:600'>{esc(w.get('name') or w['id'])}</span>"
                f"<span class='chip mono'>{esc(w['id'])}</span>"
                f"<span class=lc>{esc(w.get('charter') or '')}</span></div>")
        if st == DONE:
            past += line
        else:
            live += line
    ndone = past.count("<div class=lr>")
    fold = (f"<details><summary><span class=bn>Complete</span>"
            f"<span class='chip mono'>{ndone} lane{'s' if ndone != 1 else ''}</span>"
            f"</summary>{past}</details>"
            if past else "")
    return (f"<div class=card><h2>Lanes &amp; charters</h2>"
            f"{live or '<div class=muted>nothing in flight</div>'}{fold}</div>")


# ------------------------------------------------------- P0 queue and decisions

def urgent(row):
    """True when bd calls this bead priority 0. `0` and `P0` both occur."""
    p = str(pick(row, "priority", "prio", "pri")).strip().lower()
    return p in ("0", "p0")


# What the tracker's own vocabulary uses to mark a bead as a question rather than
# a piece of work. `decision` is bd's issue_type; the rest are this repository's
# title conventions, and they are gathered here rather than sprinkled through the
# renderer so the page can print the rule it applied. A bead that is genuinely a
# decision and matches none of these is simply not in the log — which is a miss
# the reader can see, unlike a rule that silently widened.
DECISION_HEAD = ("ask", "decide", "decision", "question", "decided")
DECISION_RULE = ("issue_type <code>decision</code>, or a title opening "
                 "<code>ASK</code> / <code>DECIDE</code> / <code>OQ-n</code>, or "
                 "one marked <code>owner: human</code> — closed, with a reason")


def is_decision(row):
    """A question somebody had to answer, as against work somebody had to do."""
    if str(pick(row, "issue_type", "type")) == "decision":
        return True
    tk = tokens(str(pick(row, "title", "summary", "name")).lower())
    if not tk:
        return False
    if tk[0] in DECISION_HEAD:
        return True
    if tk[0] == "oq" and len(tk) > 1 and tk[1].isdigit():
        return True
    return "owner human" in " ".join(tk)


def gate_owner(rows):
    """{bead id -> the gate it answers to}, gates included as their own.

    A gate epic maps to ITSELF rather than to nothing. Four of them sit at
    priority 0 in this graph, and leaving them unmapped filed them under "answers
    to no gate" — printing the four loudest gates on the road as though the road
    were not already showing them, in the same table whose whole purpose is to
    separate the two.
    """
    kids = bead_edges(rows)[0]
    out = {}
    for r in rows:
        if not isinstance(r, dict):
            continue
        bid = str(pick(r, "id", "issue_id", "key"))
        if bid and is_gate(pick(r, "title", "summary", "name")):
            for b in subtree(bid, kids):
                out.setdefault(b, bid)
    return out


def p0_section():
    """Everything bd calls priority 0 and does not call closed.

    Whole, not filtered. Two thirds of this queue are gate clauses, and the
    temptation is to drop them because the road already counts them — but the
    road counts them as a fraction and this names them, which is a different
    fact, and a queue that quietly omits the majority of itself is the failure
    this board keeps being written to avoid. They are marked with the gate they
    answer to instead, so the reader can follow the row back to the segment.
    """
    rows, note = bd_fetch()
    if note:
        return (f"<div class=card><h2>Open at P0</h2>"
                f"<div class=muted>not read — {esc(note)}</div></div>")
    under = gate_owner(rows)
    q = [r for r in rows if isinstance(r, dict) and urgent(r)
         and str(pick(r, "status", "state")) != "closed"]
    # Beads answering to no gate first: they are the ones nothing else on this
    # page is already tracking.
    q.sort(key=lambda r: (under.get(str(pick(r, "id", "issue_id", "key")), ""),
                          str(pick(r, "id", "issue_id", "key"))))
    free = sum(1 for r in q if str(pick(r, "id", "issue_id", "key")) not in under)
    body = ""
    for r in q:
        bid = str(pick(r, "id", "issue_id", "key"))
        g = under.get(bid, "")
        gcell = "the gate itself" if g == bid else (esc(g) or "—")
        body += (f"<tr><td class='mono' style='white-space:nowrap'>{esc(bid)}</td>"
                 f"<td class=mono>{esc(str(pick(r, 'status', 'state')))}</td>"
                 f"<td class=mono style='white-space:nowrap'>{gcell}</td>"
                 f"<td>{esc(str(pick(r, 'title', 'summary', 'name') or bid))}</td></tr>")
    return (f"<div class=card><h2>Open at P0 &middot; {len(q)}</h2>"
            f"<div class='muted dep-note'>Every bead <code>bd list --all</code> "
            f"reports at priority 0 and not closed &mdash; the queue whole, not a "
            f"selection from it. <b>{free}</b> answer to no gate, and those are "
            f"the ones no segment above is already carrying as a fraction. The "
            f"other <b>{len(q) - free}</b> are a gate or one of its clauses and "
            f"name it, so a row here reads back to its phase.</div>"
            f"<div class=scroll><table><tr><th>Bead</th><th>Status</th><th>Gate</th>"
            f"<th>What</th></tr>"
            f"{body or '<tr><td class=muted>nothing at P0</td></tr>'}"
            f"</table></div></div>")


def decisions():
    """Questions the human answered, with the answer, out of bead close reasons.

    Gate closures are deliberately absent even though they match every test here:
    a gate closing is already the loudest thing on the road, and printing it
    again as a decision is the duplication this board was rebuilt to remove.

    Grouped by the day the answer landed, most recent day open and the rest
    folded, because a decision log is read as "what changed since I last looked"
    far more often than as an archive.
    """
    rows, note = bd_fetch()
    if note:
        return (f"<div class=card><h2>Decisions</h2>"
                f"<div class=muted>not read — {esc(note)}</div></div>")
    got = [r for r in rows if isinstance(r, dict)
           and str(pick(r, "status", "state")) == "closed"
           and pick(r, "close_reason", "resolution", "reason")
           and is_decision(r) and not is_gate(pick(r, "title", "summary", "name"))]
    got.sort(key=lambda r: str(pick(r, "closed_at", "updated_at")), reverse=True)
    days, order = {}, []
    for r in got:
        d = str(pick(r, "closed_at", "updated_at"))[:10] or "undated"
        if d not in days:
            days[d] = []
            order.append(d)
        days[d].append(r)

    def table(rs):
        return ("<div class=scroll><table><tr><th>Question</th><th>Answer</th></tr>"
                + "".join(
                    f"<tr><td><span class=mono>{esc(str(pick(r, 'id', 'issue_id', 'key')))}"
                    f"</span> {esc(str(pick(r, 'title', 'summary', 'name')))}</td>"
                    f"<td>{esc(str(pick(r, 'close_reason', 'resolution', 'reason')))}</td>"
                    f"</tr>" for r in rs)
                + "</table></div>")

    if not order:
        inner = "<div class=muted>bd records no answered question</div>"
    else:
        rest = sum(len(days[d]) for d in order[1:])
        inner = (f"<div class='muted mono' style='font-size:11.5px;margin:0 0 6px'>"
                 f"decided {esc(order[0])}</div>{table(days[order[0]])}"
                 + (f"<details style='margin-top:10px'><summary>"
                    f"<span class=bn>Earlier</span><span class='chip mono'>{rest} "
                    f"decision{'s' if rest != 1 else ''} over "
                    f"{len(order) - 1} day{'s' if len(order) != 2 else ''}</span>"
                    f"</summary>"
                    + "".join(f"<div class='muted mono' style='font-size:11.5px;"
                              f"margin:10px 0 6px'>decided {esc(d)}</div>{table(days[d])}"
                              for d in order[1:])
                    + "</details>" if rest else ""))
    return (f"<div class=card><h2>Decisions &middot; {len(got)} answered</h2>"
            f"<div class='muted dep-note'>The answer is the bead's close reason, "
            f"which is where these already live — nothing is retyped here. A bead "
            f"is a decision when it matches the tracker's own marking: "
            f"{DECISION_RULE}. Gate closures match too and are left out: the road "
            f"above already states every one of them.</div>{inner}</div>")


def milestones(s):
    """The major steps of the road, left to right, with the work behind each.

    A wave is a milestone when it is marked one (`wave <id> --milestone yes`).
    Nothing is marked by default and that is deliberate: a run has many waves
    and only a few are steps a human tracks — marking every wave produces a
    rail of unreadable pins, which is the same failure as marking none.

    When nothing is marked at all the rail falls back to every wave that has
    rows and says so on the page, because a blank strip and a strip nobody has
    configured must not look the same.

    Returns (rows, auto) where each row is
    (wave, done, total, merged_prs) and `auto` is True when the fallback ran.

    These three numbers are the board's own dispatch record — seats seated, seats
    finished, PRs those seats merged. They are NOT the phase's progress and the
    rail no longer reads them as such: see bead_rail, and PRO-86ju for the run
    where "Phase 4 · 25/38" meant twenty-five sweep rows under a lane with that
    name while Phase 4's epic sat in a different lane on the same board.
    """
    marked = [w for w in s["waves"] if str(w.get("milestone", "")).lower()
              in ("1", "yes", "true", "y")]
    auto = not marked
    if auto:
        marked = [w for w in s["waves"]
                  if any(t.get("wave") == w["id"] for t in s["tasks"])]
    land = s.get("landed") or {}
    out = []
    for w in marked:
        rows = [t for t in s["tasks"] if t.get("wave") == w["id"]]
        done = sum(1 for t in rows if t.get("status") == DONE)
        # A PR counts as merged for the rail only if the tracked base agrees, or
        # the row says merged and the base could not be read. The rail is a
        # progress claim, and a claim the base contradicts is the one thing it
        # must never make — see pr_verdict for the same rule one level down.
        prs = set()
        for t in rows:
            pr = t.get("pr") or {}
            num = str(pr.get("number", "")).lstrip("#")
            if not num:
                continue
            if land.get("checked"):
                if num in (land.get("prs") or []):
                    prs.add(num)
            elif pr.get("merged") or (pr.get("state") or "").lower() == "merged":
                prs.add(num)
        out.append((w, done, len(rows), len(prs)))
    return out, auto


def bead_rail(ms):
    """Every milestone lane's beads, from bd, with the provenance of each number.

    The board is a projection of the tracker, so a phase's progress is a property
    of the bead graph and nothing else. What a lane holds is seat rows — charters,
    owners, verifiers — which bd has no home for and which are not units of work:
    a sweep finishing is not a phase advancing, and adding the two sets is how
    "389/801" came to reconcile with nothing at all (PRO-86ju).

    A lane is joined to its epic by NAME, not by a table kept in this file. Lanes
    read "Phase 4 · server and sync" and the epic is titled "Phase 4 epic", so the
    join is derivable and survives a phase being added. `lane <id> --epic PRO-x`
    pins it explicitly when a rename breaks the match, and every pin prints which
    of the two got it there.

    Returns a dict whose `note` is the only thing set when bd cannot be read —
    the rail then falls back to seat rows and says on the page that it has, so a
    tracker outage degrades the number's meaning rather than blanking the board.

    `gaps` carries the counted roots this listing does not contain, and it is
    reported rather than quietly dropped for the reason phase_beads gives about
    phantoms: see the parts loop below.
    """
    rows, note = bd_fetch()
    out = {"note": note, "pins": {}, "total": 0, "closed": 0, "held": 0,
           "rule": COUNT_RULE, "check": "", "gaps": [], "gates": {}}
    if note or not rows:
        out["note"] = note or "`bd list --all` returned no beads"
        return out
    # The second half of phase_beads' `isinstance` guard, and it has to be the
    # same predicate: `by` is the index every count below is looked up in, and a
    # key set that disagreed with `live` would put the phantom back by the other
    # door.
    by = {str(pick(r, "id", "issue_id", "key")): r for r in rows if isinstance(r, dict)}
    by.pop("", None)
    idx, kids = epic_index(rows), bead_edges(rows)[0]
    needs = bead_edges(rows)[1]
    lanes = [(w, *lane_epic(w, idx, set(by))) for w, _, _, _ in ms]
    roots = [e for _, e, _ in lanes if e]
    # Gates first, because a gate no edge reaches is a counting root and the sets
    # have to be built with it in them. Resolved once per pin and reused below,
    # so the road, the breakdown and the strip cannot disagree about which bead a
    # phase's gate is.
    gidx = gate_index(rows)
    # The same `blocks` edges indexed by their other end, so a gate that records
    # the relationship itself is as visible as an epic that records it.
    rneeds = {}
    for issue, deps in needs.items():
        for dep in deps:
            rneeds.setdefault(dep, []).append(issue)
    gates = {e: gate_of(e, by, needs, rneeds, gidx) for e in roots}
    extra = {e: [g] for e, (g, _) in gates.items()
             if g and g not in needs.get(e, ())}
    sets = phase_beads(rows, roots, extra)
    held = set()
    for w, e, how in lanes:
        if not e:
            out["pins"][w["id"]] = {"epic": "", "how": how}
            continue
        mine = sets.get(e, set())
        held |= mine
        # Which sub-root contributed what, kept disjoint in the order the rule
        # walks them, so the parts sum to the total instead of overlapping it.
        claimed, parts = set(), []
        for root in [e] + list(needs.get(e, ())) + extra.get(e, []):
            got = (subtree(root, kids) & mine) - claimed
            if not got:
                continue
            claimed |= got
            # Every root after `e` is a `blocks` target, and an edge target need
            # not be a bead the listing returned. `by[root]` assumed it was and
            # raised KeyError, which killed render() outright — no board.html
            # written, the published page frozen at its last good publish while
            # the ledger kept updating underneath it. Two real ways in: the
            # tracker already carries `PRO-znp.14 -> discovered-from:PRO-znp.13`
            # from a `--deps` typo, and `bd prune` deletes closed issues, which
            # takes a gate epic while `kids` still reaches its surviving children.
            #
            # The part is KEPT AND FLAGGED rather than skipped, and the choice is
            # the difference between two wrong pages. Skipping would leave the
            # total alone — phase_beads already intersects with the listing, so
            # those children are counted either way — and silently drop them from
            # the breakdown, so "PRO-x 24 = 32 beads" would print a sum that does
            # not add up, in the one element on the page whose entire job is to
            # show that it does. That is the same unreproducible number the rest
            # of this file exists to prevent, one step quieter than the crash. So
            # the root is named, its beads stay in the sum, and the page says the
            # graph is incomplete — the way it already says `bd status` DISAGREES
            # instead of hiding a disagreement.
            parts.append((root, len(got), root in by))
            if root not in by:
                out["gaps"].append((str(w.get("name") or w["id"]), root))
        closed = sum(1 for b in mine if str(pick(by[b], "status", "state")) == "closed")
        # The epic's OWN subtree, kept separate from the pin's total. The pin is
        # the phase's whole weight on the road — epic, gate and the decisions it
        # waited on — and the epic fraction is the one the tracker would print
        # for that bead alone. Phase 3 is the case that needs both: gate closed,
        # epic 6 of 10.
        own = subtree(e, kids) & mine
        out["pins"][w["id"]] = {
            "epic": e, "how": how, "total": len(mine), "closed": closed,
            "open": len(mine) - closed, "parts": parts,
            "own": len(own),
            "own_closed": sum(1 for b in own
                              if str(pick(by[b], "status", "state")) == "closed"),
            "gate": gate_stat(gates[e][0], gates[e][1], kids, by),
            "title": str(pick(by[e], "title", "summary", "name") or e)}
    out["total"] = len(by)
    out["closed"] = sum(1 for r in by.values()
                        if str(pick(r, "status", "state")) == "closed")
    out["held"] = len(held)
    # Gates closed of gates found — the denominator is what the graph turned out
    # to hold, not a number typed here. A pin with no gate is left out of both
    # halves and says so in its own row, rather than being counted as a gate that
    # happens to be open.
    seen = [p["gate"] for p in out["pins"].values() if (p.get("gate") or {}).get("id")]
    out["gates"] = {"total": len(seen),
                    "closed": sum(1 for g in seen if g["closed_bead"]),
                    "nogate": [w for w, p in out["pins"].items()
                               if p.get("epic") and not (p.get("gate") or {}).get("id")]}
    # The listing is checked against a query that reaches the number from the
    # other side. `bd list` without `--all` drops closed beads silently — 368 rows
    # where the tracker holds 569 — and a rail built on that reads 0% closed for
    # every phase, forever, with nothing on the page looking wrong.
    sm = bd_totals()
    tot, cl = sm.get("total_issues"), sm.get("closed_issues")
    if tot is None:
        out["check"] = "not cross-checked — `bd status --json` did not answer"
    elif tot == out["total"] and cl == out["closed"]:
        out["check"] = f"agrees with <code>bd status</code> ({tot} total, {cl} closed)"
    else:
        out["check"] = (f"DISAGREES with <code>bd status</code>: it reports {tot} total "
                        f"/ {cl} closed, this listing has {out['total']} / {out['closed']}")
    return out


def rail_state(w, br, done, n):
    """A pin's colour: bead progress where there are beads, seat rows otherwise.

    The lane's own status is consulted last and only to distinguish held and
    failed, which the counts cannot express — a phase can be stopped at any
    fraction and the fraction alone reads as healthy.
    """
    st = (w.get("status") or "").lower()
    if st in (FAIL, BLOCK):
        return st
    if br and br.get("epic"):
        if br["total"] and br["closed"] == br["total"]:
            return DONE
        return RUN if br["closed"] or st in (RUN, REVIEW) else "queued"
    if n and done == n:
        return DONE
    if st in (RUN, REVIEW) or 0 < done < n:
        return RUN
    return "queued"


def gate_line(b):
    """A phase's gate and its epic, on one line of the road segment.

    Three facts, and they are three because two of them collapse into a lie: the
    gate's own verdict (a human closed it, or did not), the clause evidence
    behind that verdict, and the epic's own fraction. Phase 3 reads `gate closed
    · 2/2 · epic 6/11` while Phase 2 reads `gate closed · 6/8` — a gate can close
    over clauses that were superseded rather than met, and the pair says so
    without either number having to be adjusted to fit the other.

    A pin with no epic prints nothing here: it is already saying, one line down,
    that it is counting seat rows and why.
    """
    if not b.get("epic"):
        return ""
    g = b.get("gate") or {}
    epic = (f"epic <b class=sv>{b.get('own_closed', 0)}</b>/"
            f"<b class=sv>{b.get('own', 0)}</b>")
    if not g.get("id"):
        return (f"{epic} &middot; <span style='color:var(--run)'>no gate &mdash; "
                f"{esc(g.get('how') or 'not looked for')}</span>")
    if g.get("missing"):
        return (f"{epic} &middot; <span style='color:var(--err)'>gate "
                f"<code>{esc(g['id'])}</code> is not in this listing</span>")
    shut = g.get("closed_bead")
    word = ("<b style='color:var(--ok)'>closed</b>" if shut
            else "<b style='color:var(--err)'>open</b>")
    ev = (f"<b class=sv>{g['met']}</b>/<b class=sv>{g['clauses']}</b> clause"
          f"{'s' if g['clauses'] != 1 else ''}" if g["clauses"]
          else "no clause beads")
    return f"{epic} &middot; gate {word} &middot; {ev}"


def gate_detail(b):
    """How this pin's gate was found, in the same breakdown as the bead counts.

    A gate resolved by ordinal rather than by edge is a statement about the
    tracker, not about the phase, and it belongs where the other provenance is
    rather than in a footnote nobody opens.
    """
    g = b.get("gate") or {}
    if not g.get("id"):
        return f" &middot; no gate ({esc(g.get('how') or 'not looked for')})"
    tail = (f", {g['met']}/{g['clauses']} clauses met" if g.get("clauses")
            else ", no clause beads under it")
    # A gate closed over clauses that are not met is the page's one internal
    # contradiction, and it is a real one: Phase 2 closed at 6 of 8 because two
    # clauses were superseded rather than completed. The board can see the
    # discrepancy without being able to see the cause — bd records the verdict
    # and the reason, not the disposition of each unmet clause — so it names what
    # it can and points at the reason for what it cannot.
    if g.get("closed_bead") and g.get("clauses") and g["met"] < g["clauses"]:
        tail += (f" — <b>closed with {g['clauses'] - g['met']} clause"
                 f"{'s' if g['clauses'] - g['met'] != 1 else ''} still open</b>; the "
                 f"verdict is the human's and the reason below is the whole of what "
                 f"the tracker records about the gap")
    if g.get("missing"):
        tail = " — <span style='color:var(--err)'>not in this listing</span>"
    # The close reason belongs HERE and not in the decisions log, which excludes
    # gates on the grounds that the road already states them. That exclusion is
    # only honest if the road states the reasoning too — a gate closed at 6 of 8
    # is a contradiction until the text that reconciles it is on the same line.
    why = (f"<div class='muted' style='margin-top:3px'>&ldquo;{esc(g['reason'])}"
           f"&rdquo;</div>" if g.get("reason") else "")
    return (f" &middot; gate <b>{esc(g['id'])}</b> ({esc(g.get('how') or '')}), "
            f"{'closed' if g.get('closed_bead') else 'open'}{tail}{why}")


def milestone_rail(s):
    """The road to done, wrapped like a paragraph of text.

    **A segment is a phase, and its number is beads.** Outstanding over total for
    that phase's epic, out of the tracker, recomputed every publish. The seat
    rows a lane holds are printed beside it as what they are — the board's own
    dispatch record — and never summed with the beads, because they count
    different things and the sum is a number no query can reproduce.

    **The road wraps instead of crowding.** Nine phases on one strip put the
    labels on top of each other, so segments flow like words in a paragraph: left
    to right, then down, and a new line is a continuation rather than a new point
    in time. Every segment carries its ordinal for exactly that reason — where
    the break lands depends on the viewport, and the reading must not.

    **Width is weight.** A segment grows in proportion to the beads behind it, so
    a phase holding fifty is not drawn as one hop beside a phase holding eight.
    Below a floor the label stops being readable, so the floor wins there and the
    caption says so rather than letting the widths quietly lie. All of it is
    flex-wrap and CSS variables: the artifact CSP blocks scripts, so a layout
    that needed measuring would not run at all.

    **A milestone with no epic still gets a segment.** It counts seat rows, says
    that it does, and says why no epic matched — a step vanishing from the road
    is worse than a step that has to explain itself.

    **A counted root the listing does not contain is named, not dropped.** Its
    beads are already in the total, so removing it from the breakdown would print
    a sum that does not add up — see the parts loop in bead_rail for why that is
    the worse of the two failures.
    """
    ms, auto = milestones(s)
    if not ms:
        return ""
    bead = bead_rail(ms)
    pins, live = bead["pins"], not bead["note"]

    def weight(w, n):
        b = pins.get(w["id"]) or {}
        return max(b.get("total") or 0, 1) if b.get("epic") else max(n, 1)

    # A segment's width is its share of the whole road, fixed, not its share of
    # whichever line it lands on. The wrap point moves with the viewport; what a
    # width means must not.
    span = sum(weight(w, n) for w, _, n, _ in ms) or 1
    body, i = "", 0
    for w, done, n, prs in ms:
        i += 1
        b = pins.get(w["id"]) or {}
        c = CLR[rail_state(w, b, done, n)]
        full = (w.get("name") or w["id"]).strip()
        # "Phase 4 · server and sync" pins as "Phase 4". But "v1 · definition of
        # done" has a head of "v1", which pins the run's end state as two
        # characters — so a head this short keeps its tail.
        short = full.split("·")[0].split("—")[0].strip()
        if len(short) < 6:
            short = full.replace("·", "").replace("  ", " ")[:24].strip()
        if b.get("epic"):
            pct = b["closed"] / b["total"] * 100 if b["total"] else 0
            count = (f"<b class=sv>{b['open']}</b> open of <b class=sv>{b['total']}</b> "
                     f"bead{'s' if b['total'] != 1 else ''}")
            src = f"{esc(b['epic'])} &middot; bd"
        else:
            pct = done / n * 100 if n else 0
            count = (f"<b class=sv>{done}</b> of <b class=sv>{n or 0}</b> seat row"
                     f"{'s' if n != 1 else ''} done")
            src = "no epic &middot; board"
        seat = f"{done}/{n} seat row{'s' if n != 1 else ''}" + (
            f" &middot; {prs} PR{'s' if prs != 1 else ''}" if prs else "")
        body += (f"<div class=seg style='--w:{weight(w, n) / span * 100:.2f}%;--c:{c}'>"
                 f"<div class=st><i style='width:{pct:.1f}%'></i></div>"
                 f"<div class=sl><span class=sn>{i}</span><b>{esc(short)}</b>"
                 f"<span class=sc>{count}</span>"
                 f"<span class=sg>{gate_line(b)}</span>"
                 f"<span class=sp>{src} &middot; {seat}</span></div></div>")

    off, gap = bead["total"] - bead["held"], ""
    if live:
        lead = (f"road to done: <b>{bead['held'] - sum(p.get('closed', 0) for p in pins.values())}"
                f"</b> beads outstanding under a phase, of <b>{bead['held']}</b> the "
                f"phases hold")
        recon = (f"{bead['held']} on the road + {off} under no phase = "
                 f"<b>{bead['total']}</b> beads in <code>bd list --all --no-pager</code>"
                 f" &middot; {bead['check']}")
        rule = (f"counting rule: <b>{esc(bead['rule'])}</b> &middot; "
                f"the {off} beads behind no phase are rows in the timeline below, "
                f"not weight on the road")
        # Beside the `bd status` cross-check, at the same always-visible level and
        # in the same voice: a graph this page could not fully resolve is said out
        # loud rather than absorbed into a number.
        if bead["gaps"]:
            gap = ("<br><span style='color:var(--err)'>graph incomplete &mdash; "
                   f"{len(bead['gaps'])} counted root"
                   f"{'s are' if len(bead['gaps']) != 1 else ' is'} not in this "
                   "listing: "
                   + ", ".join(f"<code>{esc(r)}</code> under {esc(nm)}"
                               for nm, r in bead["gaps"])
                   + ". The beads under such a root are reached through parent "
                   "edges and are still counted, so the breakdown below still sums "
                   "to the total; the root itself resolves to nothing. A "
                   "<b>blocks</b> edge onto a pruned or mistyped id reads exactly "
                   "like this.</span>")
    else:
        lead = ("road to done: <b>counting seat rows</b> — the tracker could not be "
                f"read, so these are dispatch rows, not beads")
        recon = f"<span style='color:var(--err)'>{esc(bead['note'])}</span>"
        rule = "fix the tracker read and the pins go back to counting beads"

    detail = "".join(
        f"<div class=rw><span class='mono' style='font-weight:600'>{esc(w.get('name') or w['id'])}"
        f"</span><span class=lc>"
        + (f"epic <b>{esc((pins[w['id']] or {}).get('epic', ''))}</b> "
           f"({esc(pins[w['id']]['how'])}) = "
           + " + ".join(f"{esc(r)}&nbsp;{k}" + ("" if ok else
                        " <span style='color:var(--err)'>(no such bead)</span>")
                        for r, k, ok in pins[w["id"]]["parts"])
           + f" = {pins[w['id']]['total']} bead"
           + f"{'s' if pins[w['id']]['total'] != 1 else ''}, "
           + f"{pins[w['id']]['closed']} closed"
           + gate_detail(pins[w["id"]])
           if pins.get(w["id"], {}).get("epic") else
           f"<span style='color:var(--run)'>{esc((pins.get(w['id']) or {}).get('how', 'bd unread'))}"
           f"</span> — this segment counts the lane's {n} seat row"
           f"{'s' if n != 1 else ''} instead")
        + "</span></div>" for w, done, n, prs in ms)
    note = (" &middot; <span style='color:var(--run)'>steps auto-selected — mark them "
            "with <code>wave &lt;id&gt; --milestone yes</code></span>" if auto else "")
    return (f"<div class=road>{body}</div>"
            f"<div class='muted mono railnote'>{lead}{note}<br>{recon}{gap}<br>"
            f"the road wraps like text — read left to right, then down; a new line "
            f"continues the road, it does not restart it. Segment width is the beads "
            f"behind a phase, down to a floor that keeps the label readable.<br>{rule}"
            f"</div><details class=railwhy><summary><span class=bn>How each number "
            f"was counted</span><span class='chip mono'>{len(ms)} segments</span>"
            f"</summary>{detail}</details>")


def ledger(s):
    """The bead facts for this board, once per render. bd_fetch memoises the
    query, so asking twice costs a dict lookup rather than a second bd start."""
    ms, _ = milestones(s)
    return bead_rail(ms) if ms else {"note": "no milestone lane to hang beads on",
                                     "pins": {}, "total": 0, "closed": 0, "held": 0}


def headline(s, ndone, b):
    """The two numbers, kept apart and each told where it came from.

    They used to be one. `389/801 agents complete` was the board's 140 hand-made
    seat rows plus the 509 rows synced from bd, summed — a figure that matches no
    query, agrees with no plan, and moves when a sweep finishes. Beads are the
    system of record for what work exists; the seat ledger is the record of who
    was dispatched at it. Both are worth printing. Neither is the other's total.
    """
    seat = (f"<b>{ndone}</b>/{len(s['tasks'])} dispatch rows complete "
            f"<span class=muted>&mdash; this board's own seat ledger, one row per "
            f"seat dispatched; not a unit of work</span>")
    if b.get("note"):
        bead = (f"<span style='color:var(--run)'>beads unread &mdash; "
                f"{esc(b['note'])}</span>")
    else:
        bead = (f"<b>{b['total'] - b['closed']}</b>/{b['total']} beads outstanding "
                f"<span class=muted>&mdash; every bead in "
                f"<code>bd list --all</code>, the tracker of record</span>")
    return f"<div class='row muted mono hl'>{bead}</div><div class='row muted mono hl'>{seat}</div>"


def render(s, out):
    ts, pr = s["tasks"], s.get("pr") or {}
    guard(ts, strict=False)
    n = len(ts) or 1
    seg = [(sum(1 for t in ts if t.get("status") == k), CLR[k])
           for k in (DONE, REVIEW, RUN, FAIL, BLOCK, "queued")]
    bar = "".join(f"<span style='width:{c / n * 100:.1f}%;background:{col}'></span>"
                  for c, col in seg if c)
    add = sum(d["added"] for d in s["diff"])
    rem = sum(d["removed"] for d in s["diff"])
    ndone = sum(1 for t in ts if t.get("status") == DONE)
    bd = ledger(s)
    sc = s.get("scan") or {}
    # The base is the authority on what merged, not the scanned range: on a
    # feature branch the range is the branch's own commits and carries no merge
    # at all, which used to make this tile vanish exactly when work was in flight.
    land = s.get("landed") or {}
    last = land.get("latest") or ""
    if not last:
        merged = [c for c in s["commits"] if pr_in_subject(c["title"])]
        last = pr_in_subject(merged[0]["title"]) if merged else ""

    head = (f"<div class=card><div class=row style='gap:10px'>"
            + chip("repo", s.get("repo") or "—") + chip("branch", s.get("branch") or "—")
            + chip("updated", s.get("updated") or now()) + "</div>"
            f"<h1 style='margin-top:12px'>{esc(s.get('mission') or 'Orchestration')}</h1>"
            f"<div class=bar>{bar}</div>"
            f"{headline(s, ndone, bd)}"
            f"{milestone_rail(s)}</div>")

    # Every tile says what it counts, because the one that did not — "agents
    # done" over two projections summed — is what this file spent a run being
    # wrong about.
    #
    # `beads open` and `seat rows done` used to lead this strip. Both are printed
    # a card higher in headline(), with the sentence that says what each one is a
    # count OF, and a number restated four inches below its own provenance is
    # exactly the duplication this board was asked to stop having. They are gone
    # from here; the headline keeps them.
    #
    # Gates take the lead instead, because it is the one project-level fact the
    # rest of the page could not state: a gate is the thing that has to close for
    # a phase to be over, and eight phases at 60% is a different project from
    # three gates closed of eight.
    g = bd.get("gates") or {}
    # A scan that has never once succeeded is the difference between "nothing
    # changed" and "nobody looked", and the two rendered identically as `0`: a
    # fresh board reported 0 files, +0 lines and 0 commits, which is precisely
    # what a clean tree reports. `ok_at` is only ever set by a scan that worked,
    # so it is the one field that can tell them apart.
    span = s.get("span") or "the tracked range"
    measured = bool(sc.get("ok_at"))
    if not measured:
        prov = f"not measured &mdash; {esc(sc.get('note') or 'no scan has run yet')}"
    elif sc.get("note"):
        prov = f"last good read {esc(sc['ok_at'])}"
    else:
        prov = f"git <code>{esc(span)}</code>, read {esc(sc.get('at') or '—')}"

    def count(v, label, colour=None, fmt=str):
        """A measured count, or a dash that says why there is not one.

        Zero is never printed. On this board a zero count means either "the range
        is empty" or "nothing measured it", and both read better as the sentence
        they are than as a digit indistinguishable from a real measurement.
        """
        if not measured:
            return tile("—", label, sub=prov)
        if not v:
            return tile("—", label,
                        sub=f"none in <code>{esc(span)}</code> &middot; {prov}")
        return tile(fmt(v), label, colour, sub=prov)

    tiles = ("<div class=tiles>"
             + tile("—" if bd.get("note") or not g.get("total")
                    else f"{g['closed']}/{g['total']}", "phase gates closed",
                    "var(--acc)",
                    sub=("gates not resolved" if bd.get("note") or not g.get("total")
                         else f"{g['total'] - g['closed']} still open"
                              + (f" &middot; {len(g['nogate'])} pin(s) have no gate"
                                 if g.get("nogate") else "")))
             + count(len(s["diff"]), "files touched")
             + count(add, "lines added", "var(--ok)", lambda a: f"+{a}")
             + count(rem, "lines removed", "var(--err)", lambda r: f"-{r}")
             + count(len(s["commits"]), "commits")
             + tile(f"#{last}" if last else (pr.get("state") or "—"),
                    "latest merged pr" if last else f"pr {pr.get('number', '')}".strip(),
                    sub=(f"reachable from <code>{esc(land.get('base') or 'base')}</code>"
                         if last else "no merge seen on the tracked base"))
             + "</div>")
    # The provenance line is the difference between "no changes" and "not measured".
    tiles += (f"<div class='muted mono' style='font-size:11.5px;margin-top:-4px'>"
              + (f"git <b>{esc(span)}</b>, read {esc(sc.get('at') or '—')}"
                 if measured and not sc.get("note") else
                 f"<span style='color:var(--err)'>not refreshed — "
                 f"{esc(sc.get('note') or 'no scan has run yet')}</span>"
                 + (f" &middot; numbers above are the last good read "
                    f"({esc(sc['ok_at'])})" if measured else
                    " &middot; every git number above says it was not measured, "
                    "rather than showing a zero"))
              + "</div>")

    rows = ""
    for d in s["diff"][:40]:
        tot = max(d["added"] + d["removed"], 1)
        green = max(1, round(d["added"] / tot * 5)) if d["added"] else 0
        cells = ("".join("<i style='background:var(--ok)'></i>" for _ in range(green))
                 + "".join("<i style='background:var(--err)'></i>" for _ in range(5 - green)))
        rows += (f"<tr><td class=mono style='word-break:break-all'>{esc(d['path'])}"
                 f"{' <span class=chip>new</span>' if d.get('new') else ''}</td>"
                 f"<td class=mono style='text-align:right;white-space:nowrap'>"
                 f"<span style='color:var(--ok)'>+{d['added']}</span> "
                 f"<span style='color:var(--err)'>-{d['removed']}</span></td>"
                 f"<td style='width:52px'><div class=dbar>{cells}</div></td></tr>")
    # "Diff · 0 files" is the same bare zero the tiles just stopped printing, one
    # heading over — a heading is not exempt from the rule the number obeys.
    empty = "not measured" if not measured else "no file changed in the range"
    head_diff = f"{len(s['diff'])} files" if s["diff"] else empty
    diff = (f"<div class=card><h2>Diff &middot; {head_diff}</h2>"
            f"<div class=scroll><table>{rows or f'<tr><td class=muted>{empty}</td></tr>'}"
            f"</table></div></div>")

    cmts = "".join(f"<div class=f><span class='mono' style='color:var(--acc)'>{esc(c['sha'])}</span>"
                   f"<span>{esc(c['title'])}</span></div>" for c in s["commits"][:20])
    cempty = "not measured" if not measured else "no commit in the range"
    cmts = (f"<div class=card><h2>Commits &middot; "
            f"{len(s['commits']) if s['commits'] else cempty}</h2>"
            f"{cmts or f'<div class=muted>{cempty}</div>'}</div>")

    findings = ""
    for rv in s["reviews"]:
        ok = rv.get("verdict") == "pass"
        findings += (f"<div class=f><span class=sev style='color:{'var(--ok)' if ok else 'var(--err)'}'>"
                     f"{esc(rv.get('verdict', '?'))}</span><span><b>{esc(rv.get('by', 'reviewer'))}</b>"
                     + ("".join(f"<div class=muted>{esc(f)}</div>" for f in rv.get("findings", []))
                        or " <span class=muted>no blocking findings</span>") + "</span></div>")
    prlink = (f"<a href='{esc(pr['url'])}' target=_blank>#{esc(str(pr.get('number', '')))}</a>"
              if pr.get("url") else "—")
    prc = (f"<div class=card><h2>Pull request</h2><div class='row big'>{prlink} "
           f"<span class=muted>{esc(pr.get('title', ''))}</span></div>"
           f"<div class=row style='margin:10px 0 14px'>" + chip("state", pr.get("state", "—"))
           + chip("checks", pr.get("checks", "—"))
           + chip("merged", "yes" if pr.get("merged") else "no") + "</div>"
           f"{findings or '<div class=muted>review not run yet</div>'}</div>")

    log = "".join(f"<div><span class='ts mono'>{esc(e['t'])}</span>"
                  f"<span style='color:{ {'ok': 'var(--ok)', 'warn': 'var(--run)', 'err': 'var(--err)'}.get(e.get('kind'), 'inherit')}'>"
                  f"{esc(e['text'])}</span></div>" for e in s["events"][-120:])
    log = f"<div class=card><h2>Event log</h2><div class='log mono'>{log or '<div class=muted>—</div>'}</div></div>"

    base = s.get("base") or "origin/main"
    html = (f"<title>{esc(s.get('mission') or 'Orchestration board')}</title><style>{CSS}</style>"
            f"<div class=wrap>{head}{capacity_banner(s)}{seat_banner(ts)}{merge_banner(s)}"
            f"{claim_banner(s)}"
            f"{caveats(s, base)}{tiles}{source_strip(s)}{p0_section()}"
            f"{timeline(s)}{lane_roster(s)}{dep_section()}"
            f"<div class=grid2>{diff}{cmts}</div>{prc}{decisions()}{log}</div>")
    with open(out, "w") as f:
        f.write(html)
    return out


# ------------------------------------------------------------------ command

def main(argv):
    cmd = argv[0] if argv else "render"
    rest = argv[1:]
    pos = [a for a in rest if not a.startswith("--")]
    d = kv(rest)
    s = load()
    out = one(d, "out", os.path.join(os.path.dirname(STATE) or ".", "board.html"))

    if cmd == "init":
        s = json.loads(json.dumps(BLANK))
        s.update(mission=one(d, "mission"), repo=one(d, "repo"),
                 branch=one(d, "branch") or git_out("rev-parse", "--abbrev-ref", "HEAD"),
                 started=now())
    elif cmd in ("lane", "wave"):
        f = {k: one(d, k) for k in ("name", "status", "charter", "milestone", "epic")
             if k in d}
        upsert(s["waves"], pos[0], f).setdefault("status", "queued")
    elif cmd == "task":
        # `agent` was schema 1's single seat; the owner/verifier split replaced it
        # and nothing has read it since, so it is no longer accepted (PRO-ka8).
        f = {}
        for k in ("wave", "lane", "title", "status", "note", "owner", "verifier", "branch"):
            if k in d:
                f[k] = one(d, k)
        if "lane" in f:
            f["wave"] = f.pop("lane")
        for k in ("added", "removed", "tier"):
            if k in d:
                f[k] = int(one(d, k, "0"))
        if "files" in d:
            f["files"] = [x for x in one(d, "files").split(",") if x]
        if not any(t["id"] == pos[0] for t in s["tasks"]):
            # Defaults are for a row being created. Applying them to an update
            # made every partial edit a silent demotion: `task <id> --note ...`,
            # the line SKILL.md prescribes when a verifier's check lands, put a
            # `review` row back to `queued` — so a board could lose in-flight
            # work to the very command meant to annotate it.
            f.setdefault("status", "queued")
            f.setdefault("tier", 1)
        row = upsert(s["tasks"], pos[0], f)
        set_pr(row, d, "pr-")
        guard([row])
    elif cmd == "event":
        s["events"].append({"t": now(), "kind": pos[0] if pos else "info",
                            "text": " ".join(pos[1:])})
    elif cmd == "pr":
        set_pr(s, d, "")
        if "task" in d:  # same flags, also pinned to the row that owns the branch
            for t in s["tasks"]:
                if t["id"] == one(d, "task"):
                    set_pr(t, d, "")
    elif cmd == "review":
        s["reviews"].append({"by": one(d, "by", "reviewer"),
                             "verdict": one(d, "verdict", "pass"),
                             "findings": d.get("finding", [])})
    elif cmd == "beads":
        n = sync_beads(s, int(one(d, "limit", "500")), one(d, "status"))
        s["events"].append({"t": now(), "kind": "info", "text": f"synced {n} bead(s)"})
    elif cmd == "caveat":
        # `--absent NEEDLE` and `--present NEEDLE` are the same field with the
        # sense flipped, spelled as two flags because "expect absent" is the
        # thing being asserted and asking for it as a value invites `--expect no`.
        cav = s.setdefault("caveats", [])
        if "drop" in d:
            s["caveats"] = [c for c in cav if c["id"] != pos[0]]
        else:
            f = {k: one(d, k) for k in ("title", "body") if k in d}
            got = caveat_clauses(rest)
            if got:
                f["probes"] = got
            c = upsert(cav, pos[0], f)
            c.setdefault("since", now())
    elif cmd not in ("render", "scan"):
        sys.exit(f"unknown command: {cmd}\n{__doc__}")

    if "base" in d:
        s["base"] = one(d, "base")
    refresh(s, s.get("base") or "origin/main")
    save(s)
    print(render(s, out))


if __name__ == "__main__":
    main(sys.argv[1:])
