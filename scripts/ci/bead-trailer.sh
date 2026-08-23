#!/usr/bin/env bash
#
# bead-trailer — the `Bead:` trailer merge gate.
#
# Specification: docs/technical/11-work-tracking.md §6 (rules W-11.2, W-11.3;
# invariants INV-11.1, INV-11.3). This script is the whole gate; the workflow
# .github/workflows/bead-trailer.yml only invokes it.
#
#   usage: scripts/ci/bead-trailer.sh <base-ref> <head-sha>       (PR_BODY in env)
#
# It fails the PR if any of these is false:
#
#   1. Every commit in `git rev-list --no-merges <base>..<head>` carries exactly
#      one `Bead:` trailer, in the trailer block as `git interpret-trailers
#      --parse` sees it, matching ^Bead: gp-[a-z0-9]+(\.[0-9]+)*$ .
#      Merge commits are exempt; reverts are not.
#   2. Each id resolves against the *committed* export at the head commit,
#      `git show <head>:.beads/issues.jsonl`: the id exists, the bead is claimed
#      (non-empty `.assignee`, or `.status` of in_progress/closed — so a bead
#      assigned `human` is a valid target even while open), and `.assignee` is
#      not an orchestrator identity (board.py's ORCH_WORD, W-11.2 — the port in
#      `orchish` below is deliberately stricter than board.py's, see there).
#      The export is read rather than the tracker because CI has no Dolt and no
#      network to it (11 §6, "Why the committed export"); a missing export fails
#      closed — one re-export, never a wrong merge.
#   3. PR_BODY carries exactly one `Bead:` trailer, found by the same
#      `git interpret-trailers --parse` call check 1 uses, matching the same
#      regex and resolving by the same rule — and that trailer is in the body's
#      LAST paragraph. Squash-merge is the only merge mode, so that line is the
#      one the commit on `main` will carry (11 §5).
#
# Every offending commit is reported before the script exits non-zero.
# Dependencies: git and jq only (both present on ubuntu-latest). Never `bd`.

set -euo pipefail

BEAD_RE='^Bead: gp-[a-z0-9]+(\.[0-9]+)*$'
BEAD_KEY_RE='^[Bb][Ee][Aa][Dd]:'
# board.py's ORCH_WORD, quoted by W-11.2, which calls board.py authoritative.
ORCH_WORDS='orchestrator orchestrators orchestration tier0 self me you'
CLAIM_FIX='claim it, `bd export`, commit `.beads/issues.jsonl`'

# git only recognises a trailer block that is not the message's first paragraph,
# so a PR body of nothing but `Bead: gp-x` parses as no trailer at all. The
# squash commit GitHub writes is "<PR title>\n\n<PR body>", so the body is parsed
# under this stand-in subject: it models the commit the trailer has to survive
# into, and keeps the PR title — which can say anything, including `Bead:` — out
# of the grammar.
BODY_SUBJECT='bead-trailer: PR body, as the squash commit will carry it'

# Appended as the body's very last line to locate git's trailer block without
# splitting paragraphs by hand: if git still reports this line as a trailer, the
# block it parsed runs to the last line of the body, which is what "the last
# paragraph" means (11 §5). The key is one git neither generates nor treats
# specially, so its presence cannot promote a paragraph into a trailer block
# that was not one already — it can only reveal where the block is.
PROBE_TRAILER='X-Bead-Trailer-Gate-Probe: last-paragraph'

failures=0
bead_index=''
resolve_reason=''

die() {
  printf 'bead-trailer: %s\n' "$1" >&2
  exit 1
}

# report <label> <subject> <reason> — one offending commit (or the PR body).
report() {
  failures=$((failures + 1))
  printf 'bead-trailer: FAIL %s %s\n' "$1" "$2" >&2
  printf '                    %s\n' "$3" >&2
}

# orchish <name> — board.py's orchish(), tightened. Both tokenise on
# non-alphanumerics and refuse a name with an orchestrator word among its tokens
# (so `orchestrator-review` and `check-orchestration-notes` are both refused).
#
# This port is NOT a mirror of board.py, and the difference is deliberate: it
# case-folds first and board.py's orchish() does not, so it refuses names
# board.py's function accepts.
#
#   board.orchish('Tier-0 planner')      -> False   (tokens 'Tier','0','planner';
#                                                     ORCH_WORD is lower-case and
#                                                     the tier/0 test asks for a
#                                                     literal 'tier' token)
#   board.orchish('Orchestrator-Review') -> False
#   this function                        -> refuses both
#
# board.py gets away with it because its callers lower-case first
# (`seat_faults`: `(t.get("owner") or "").strip().lower()`). An export's
# `.assignee` reaches this script raw, with no such caller, so the fold has to
# happen here. If the two ever disagree on a name, neither is broken — this one
# is just the paranoid end, which is the bias W-11.2 asks for: a false refusal
# costs one rename and says so, a false accept is a wrong merge.
orchish() {
  _oi_toks=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/ /g')
  _oi_tier=0
  _oi_zero=0
  for _oi_w in $_oi_toks; do
    for _oi_bad in $ORCH_WORDS; do
      if [ "$_oi_w" = "$_oi_bad" ]; then
        return 0
      fi
    done
    if [ "$_oi_w" = 'tier' ]; then _oi_tier=1; fi
    if [ "$_oi_w" = '0' ]; then _oi_zero=1; fi
  done
  if [ "$_oi_tier" = 1 ] && [ "$_oi_zero" = 1 ]; then
    return 0
  fi
  return 1
}

# bead_line_of <text> — the single `Bead:` line in <text>, or one of the
# sentinels NONE / MANY:<n> / MALFORMED:<line>. Sets nothing else.
bead_line_of() {
  _bl_lines=$(printf '%s\n' "$1" | grep -E "$BEAD_KEY_RE" || true)
  if [ -z "$_bl_lines" ]; then
    printf 'NONE'
    return 0
  fi
  _bl_n=$(printf '%s\n' "$_bl_lines" | wc -l | tr -d '[:space:]')
  if [ "$_bl_n" -gt 1 ]; then
    printf 'MANY:%s' "$_bl_n"
    return 0
  fi
  if ! printf '%s\n' "$_bl_lines" | grep -Eq "$BEAD_RE"; then
    printf 'MALFORMED:%s' "$_bl_lines"
    return 0
  fi
  printf 'OK:%s' "${_bl_lines#Bead: }"
}

# reason_for <sentinel> — the human-readable reason for a non-OK sentinel.
reason_for() {
  case "$1" in
  NONE)
    printf 'no `Bead:` trailer in the trailer block — add `Bead: gp-<id>` as the last paragraph (W-11.3)'
    ;;
  MANY:*)
    printf '%s `Bead:` trailers, expected exactly one — a commit never carries several ids (W-11.3, 11 §5)' "${1#MANY:}"
    ;;
  MALFORMED:*)
    printf 'malformed trailer "%s" — expected `Bead: gp-<base>(.<n>)*`, e.g. `Bead: gp-dln.5` (W-11.3)' "${1#MALFORMED:}"
    ;;
  esac
}

# resolve_bead <id> — check <id> against the committed export. Sets
# resolve_reason and returns 1 when the bead does not resolve.
resolve_bead() {
  resolve_reason=''
  _rb_row=$(printf '%s\n' "$bead_index" | awk -F '\t' -v id="$1" '$1 == id { print; exit }')
  if [ -z "$_rb_row" ]; then
    resolve_reason="unknown or unclaimed bead $1 — $CLAIM_FIX"
    return 1
  fi
  _rb_assignee=$(printf '%s\n' "$_rb_row" | cut -f 2 | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  _rb_status=$(printf '%s\n' "$_rb_row" | cut -f 3 | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  if [ -z "$_rb_assignee" ] && [ "$_rb_status" != 'in_progress' ] && [ "$_rb_status" != 'closed' ]; then
    resolve_reason="unknown or unclaimed bead $1 — $CLAIM_FIX"
    return 1
  fi
  if [ -n "$_rb_assignee" ] && orchish "$_rb_assignee"; then
    resolve_reason="bead $1 is assigned to \"$_rb_assignee\", an orchestrator identity (board.py ORCH_WORD) — the seat is the assignee, the orchestrator never is (W-11.2, INV-11.3)"
    return 1
  fi
  return 0
}

# normalise <text> — the only two line-shape fixes this gate applies, before
# git ever sees the text:
#   * CR is dropped. GitHub delivers PR bodies with CRLF; a trailing CR would
#     otherwise sit inside the trailer's value and fail BEAD_RE as "malformed".
#   * trailing horizontal whitespace is dropped per line. Markdown writes a hard
#     line break as two trailing spaces, and a spaces-only line reads as a
#     paragraph break to whoever wrote it, though git wants a truly empty line.
# `git commit` already applies both to commit messages under its default
# cleanup, so this is a no-op for check 1 and only lets check 3 see the body the
# way its author wrote it.
normalise() {
  printf '%s\n' "$1" | tr -d '\r' | sed 's/[[:space:]]*$//'
}

# trailers_of <text> — the trailer block of <text>, as git parses it.
#
# This is the gate's one and only definition of "a trailer", and it is git's,
# not ours: both the commit check and the PR body check go through here, so a
# line that is a trailer in a commit is a trailer in the body and vice versa.
# `--parse` is `--only-trailers --only-input --unfold` — the trailer block only,
# nothing this script adds, folded continuation lines joined onto their key.
#
# Deliberately no `--no-divider`: a `---` line ends the message for git, and the
# gate takes git's answer as given rather than second-guessing it (git's own
# `%(trailers)` does disable the divider, so the two can disagree on a body that
# uses `---` as a markdown rule — that body fails closed here, with the hint
# printed at check 3a telling the author to drop the `---`).
trailers_of() {
  normalise "$1" | git interpret-trailers --parse
}

# --------------------------------------------------------------------------
# arguments and refs
# --------------------------------------------------------------------------

if [ "$#" -ne 2 ]; then
  printf 'usage: %s <base-ref> <head-sha>   (PR_BODY in the environment)\n' "$0" >&2
  exit 2
fi
base_ref=$1
head_ref=$2

base_sha=$(git rev-parse --verify --quiet "${base_ref}^{commit}" || true)
if [ -z "$base_sha" ]; then
  die "cannot resolve base ref '$base_ref' — check out with fetch-depth: 0 so the base is present"
fi
head_sha=$(git rev-parse --verify --quiet "${head_ref}^{commit}" || true)
if [ -z "$head_sha" ]; then
  die "cannot resolve head sha '$head_ref' — check out with fetch-depth: 0 so the head commit is present"
fi

# --------------------------------------------------------------------------
# check 1 — one well-formed `Bead:` trailer per non-merge commit
# --------------------------------------------------------------------------

commits=$(git rev-list --no-merges "$base_sha..$head_sha")
n_commits=0
ids=''

if [ -n "$commits" ]; then
  while IFS= read -r sha; do
    [ -n "$sha" ] || continue
    n_commits=$((n_commits + 1))
    subject=$(git log -1 --format=%s "$sha")
    trailers=$(trailers_of "$(git log -1 --format=%B "$sha")")
    sentinel=$(bead_line_of "$trailers")
    case "$sentinel" in
    OK:*)
      ids="${ids}${sentinel#OK:}$(printf '\t')$(git rev-parse --short "$sha")$(printf '\t')${subject}
"
      ;;
    *)
      report "$(git rev-parse --short "$sha")" "$subject" "$(reason_for "$sentinel")"
      ;;
    esac
  done <<EOF
$commits
EOF
else
  printf 'bead-trailer: note: no non-merge commits in %s..%s\n' "$base_ref" "$head_ref"
fi

# --------------------------------------------------------------------------
# check 3a — the PR body's trailer block, syntax and position, no id lookup yet
#
# Same parser as check 1, on the same terms: `trailers_of` is the only thing
# either check asks "is this a trailer?". A body whose last paragraph merely
# *looks* like a trailer block — prose plus a `Bead:` line, say — has no
# trailers at all as far as git is concerned, and so has none here either.
#
# On top of git's answer, 11 §5's position rule: the trailer must be in the
# body's LAST paragraph, because that is the line the squash commit inherits.
# That is read off the parse too, via PROBE_TRAILER — no paragraph splitting.
# It matters because git's trailer block is not always the body's last
# paragraph: git ignores `#` comment lines (markdown headings) and stops at a
# `---` divider, so `Bead: gp-x` above either of those is a trailer to git while
# the author's last paragraph is something else entirely.
# --------------------------------------------------------------------------

body=${PR_BODY-}
body_id=''
if [ -z "$(printf '%s' "$body" | tr -d '[:space:]')" ]; then
  report 'PR-body' '(empty)' 'the PR body is empty — it must end with a `Bead: gp-<id>` trailer, the line the squash commit inherits (11 §5)'
else
  # Normalise once, up front: the probe has to be appended to text that is
  # already CR-free and already free of trailing blank lines, or it would land
  # in a paragraph of its own and report a false "not in the last paragraph".
  body_msg=$(printf '%s\n\n%s\n' "$BODY_SUBJECT" "$(normalise "$body")")
  body_trailers=$(trailers_of "$body_msg")
  probe_trailers=$(trailers_of "$(printf '%s\n%s\n' "$body_msg" "$PROBE_TRAILER")")
  body_sentinel=$(bead_line_of "$body_trailers")
  probe_sentinel=$(bead_line_of "$probe_trailers")

  case "$body_sentinel" in
  OK:*)
    if printf '%s\n' "$probe_trailers" | grep -Fqx "$PROBE_TRAILER" &&
      [ "$probe_sentinel" = "$body_sentinel" ]; then
      body_id=${body_sentinel#OK:}
    else
      report 'PR-body' '(trailer block)' "\`${body_sentinel#OK:}\` is a trailer to git, but the PR body does not end there — git looks past the \`#\` heading or \`---\` rule that follows it, and the squash commit has to END with the trailer; move the \`Bead:\` line to the very bottom of the body (11 §5)"
    fi
    ;;
  NONE)
    # Advice only, never a verdict: if the same parse *without* the `---`
    # divider rule would have found a `Bead:` trailer, say so, because
    # "no trailer" is otherwise baffling for a body that plainly ends in one.
    body_hint=''
    if normalise "$body_msg" | git interpret-trailers --parse --no-divider |
      grep -Eq "$BEAD_KEY_RE"; then
      body_hint=' — a `---` line ends the message as far as git is concerned, so the `Bead:` line below it is invisible: drop the `---`'
    fi
    report 'PR-body' '(trailer block)' "the PR body does not end with a \`Bead:\` trailer — \`git interpret-trailers --parse\` finds none, which also rejects a last paragraph that mixes prose with the \`Bead:\` line; the body's last paragraph must be \`Bead: gp-<id>\` (optionally beside other trailers), the line the squash commit inherits (11 §5)${body_hint}"
    ;;
  *)
    report 'PR-body' '(trailer block)' "$(reason_for "$body_sentinel")"
    ;;
  esac
fi

# --------------------------------------------------------------------------
# the committed export — fail closed when it is missing or unreadable
# --------------------------------------------------------------------------

export_jsonl=$(git show "$head_sha:.beads/issues.jsonl" 2>/dev/null || true)
if [ -z "$export_jsonl" ]; then
  die ".beads/issues.jsonl is missing or empty at $head_ref — no id in this PR can be resolved, and the gate fails closed rather than guess (11 §6); run \`bd export -o .beads/issues.jsonl\` and commit it"
fi
if ! printf '%s\n' "$export_jsonl" | jq -e -s 'type == "array"' >/dev/null 2>&1; then
  die ".beads/issues.jsonl at $head_ref is not valid JSONL — regenerate it with \`bd export -o .beads/issues.jsonl\`, never hand-merge it (11 §5)"
fi
bead_index=$(printf '%s\n' "$export_jsonl" |
  jq -r 'select(type == "object" and has("id")) | [.id, (.assignee // "" | tostring), (.status // "" | tostring)] | @tsv')

# --------------------------------------------------------------------------
# check 2 — every commit id resolves; check 3b — so does the PR body's id
# --------------------------------------------------------------------------

if [ -n "$ids" ]; then
  while IFS=$'\t' read -r bid short subject; do
    [ -n "${bid:-}" ] || continue
    if ! resolve_bead "$bid"; then
      report "$short" "$subject" "$resolve_reason"
    fi
  done <<EOF
$ids
EOF
fi

if [ -n "$body_id" ]; then
  if ! resolve_bead "$body_id"; then
    report 'PR-body' '(trailer block)' "$resolve_reason"
  fi
fi

# --------------------------------------------------------------------------

if [ "$failures" -gt 0 ]; then
  printf 'bead-trailer: %s problem(s) — see above. Rules: docs/technical/11-work-tracking.md §6.\n' "$failures" >&2
  exit 1
fi

printf 'bead-trailer: OK — %s commit(s) and the PR body carry a resolving `Bead:` trailer.\n' "$n_commits"
