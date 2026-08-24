#!/usr/bin/env bash
#
# coverage-report — the gate on `reports/content-coverage.md`.
#
# Specification: docs/technical/08-testing-quality.md D-08.20, §3 (the content
# gates), §10 (`content`'s `check:coverage-report` step), §11 (`pnpm verify`)
# and INV-02.6. Run it *after* `pnpm validate:content --report`; it asserts that
# the run produced a report and that the report is CI output rather than a file
# in the repository.
#
#   usage: scripts/ci/coverage-report.sh    (no arguments; run from anywhere
#                                            inside the work tree)
#
# ── Why the report is not committed ──────────────────────────────────────────
#
# It was, until `gp-dln.224`, and it lied. Two commits ever touched it against
# eight that touched `content/`: PRs #41, #60, #64 and #65 each added `en` keys
# and each left the committed counts behind. Every seat that ran `pnpm verify`
# watched the file change under it and reverted the change to keep its own diff
# clean — six times, independently. That is not a discipline anybody failed; it
# is a file nobody can maintain.
#
# The reason is arithmetic, not diligence. The report is a **derived aggregate**
# — key totals, missing-key counts, a warning tally — over the whole of
# `content/**`. A three-way text merge cannot add. Two branches that each add
# one `en` key each rewrite `keys present` from 325 to **326**, and git merges
# two identical edits without a murmur:
#
#     branch A (one new key under philosophy)  →  326 keys · 595 warnings
#     branch B (one new key under team)        →  326 keys · 595 warnings
#     A squash-merged, then B merged           →  326 keys · 595 warnings, exit 0
#     the truth on that tree                   →  327 keys · 597 warnings
#
# The merged file carried `<details><summary>291 missing key(s)</summary>`
# directly above 292 bullets — self-contradicting, on one line, with no conflict
# marker and a clean exit. Where the two branches touch the *same* region of the
# key list the merge conflicts instead, which is the outcome the three reverting
# seats hit and by far the kinder of the two. A committed derived aggregate has
# no third behaviour available to it: conflict, or merge to a wrong number.
#
# So the file is generated and published, never stored. CI writes it to the job
# summary, posts it as the sticky PR comment and uploads it as an artifact —
# three copies, each generated from the commit under test, none able to go
# stale. Locally `pnpm verify` regenerates it in about two seconds. What is
# gone is the fourth copy, the one on `main`, which was the only one that could
# ever be wrong.
#
# `reports/section-heights.json` stays tracked and is not a counter-example: a
# baseline is an *expectation* that a human reviews when it moves (INV-08.8),
# and a report is a *description* of the tree it was generated from. The first
# belongs in the repository; the second is output.
#
# ── What this gate asserts ───────────────────────────────────────────────────
#
#   1. the report exists, is a regular file, and carries the heading its
#      generator writes — so a missing, empty or truncated write fails here
#      instead of reaching the summary, the comment and the artifact as
#      three-way silence;
#   2. the report is **untracked** — the direct statement of D-08.20, and the
#      check that makes the decision hold. Re-committing the file reds the
#      `content` job on the pull request that does it, rather than starting the
#      drift over on `main`;
#   3. failing that, the report is **ignored** — the ignore rule is what stops
#      the next `git add -A` putting it back. Reported only when 2 passes; see
#      the note beside the check for why the two are not tested together.
#
# ── A gate that cannot run must not report clean ────────────────────────────
#
# Same discipline as `scripts/ci/todo-grep.sh`, for the same reason and by the
# same two doors it names.
#
#   * `cd "$(git rev-parse --show-toplevel)"` fails open: command substitution
#     used as an argument hides its exit status from `set -e`, so outside a
#     repository `cd ""` succeeds and the script sails on. The path below is
#     assigned and checked instead.
#   * `if git check-ignore …; then` cannot tell a failure from a clean answer.
#     `git check-ignore -q` exits 0 when the path is ignored, 1 when it is not
#     and >1 on a real error; `git ls-files --error-unmatch` exits 0 when the
#     path is tracked, 1 when it is not and >1 on an error. The `if` shape
#     reads every error as the second case. `git_query` below discriminates and
#     anything above 1 is fatal.
#
# Exit codes: 0 clean, 1 the gate fired, 2 the gate could not run. Callers only
# need "non-zero is bad", but the third is deliberately not silence.
#
# Dependencies: bash and git only. Never `bd`.

set -euo pipefail

# The one path this gate is about, repo-relative. INV-02.6 names it; the
# validator writes it under `--report` and creates `reports/` on the way.
REPORT='reports/content-coverage.md'

# The first line the generator emits (`renderReport` in
# `scripts/validate-content.ts`). A file that does not start with it is not the
# report — it is a stub, a stray, or half a write.
REPORT_HEADING='# Content coverage'

# One line on stderr, annotated when GitHub Actions is the one reading it.
fail() {
  if [[ -n ${GITHUB_ACTIONS:-} ]]; then
    printf '::error::%s\n' "$1" >&2
  else
    printf 'check:coverage-report: %s\n' "$1" >&2
  fi
}

# The gate could not run. Never silent, never exit 0 — see the header.
die() {
  fail "$1"
  exit 2
}

# A git predicate with its third outcome kept distinct from its second: 0 yes,
# 1 no, anything else an error this script refuses to read as an answer.
git_query() {
  local rc=0
  git "$@" >/dev/null 2>&1 || rc=$?
  case "$rc" in
    0) return 0 ;;
    1) return 1 ;;
    *) die "git $* exited $rc, which is an error and not an answer" ;;
  esac
}

# Pathspecs and ignore rules resolve relative to the current directory, so
# anchor to the work tree root and the verdict is the same from any
# subdirectory. Assigned and checked rather than inlined into `cd`, which would
# swallow the failure.
toplevel=$(git rev-parse --show-toplevel) || toplevel=''
[[ -n $toplevel ]] || die 'not inside a git work tree, so nothing was checked. This is not a clean tree.'
cd "$toplevel" || die "cannot enter the work tree root: $toplevel"

status=0

# 1 · The run produced a report.
if [[ ! -f $REPORT ]]; then
  fail "$REPORT is missing. It is written by \`pnpm validate:content --report\`, which has to run before this gate (08 §3, INV-02.6)."
  status=1
elif [[ ! -s $REPORT ]]; then
  fail "$REPORT is empty, which is not a coverage report (08 §3, INV-02.6)."
  status=1
elif [[ $(head -n 1 "$REPORT") != "$REPORT_HEADING" ]]; then
  fail "$REPORT does not begin with '$REPORT_HEADING', so it is not what \`--report\` writes — a truncated or overwritten file, not a report (08 §3)."
  status=1
fi

# 2 · It is not tracked — D-08.20 itself — and 3 · the ignore rule that keeps it
# out of the next `git add -A` is in place.
#
# Tested in that order and never both, because `git check-ignore` consults the
# index: a **tracked** path is reported as not-ignored whatever `.gitignore`
# says, since tracking wins. Running both on a tracked file therefore prints a
# true message ("is tracked") beside a misleading one ("without the .gitignore
# entry…") when the entry is present and doing its job. Tracking is the larger
# fault and subsumes the other, so it is reported alone; the ignore rule is
# checked on the file the decision leaves behind.
if git_query ls-files --error-unmatch -- "$REPORT"; then
  fail "$REPORT is tracked. D-08.20: it is a derived aggregate, a three-way merge cannot add, and two content branches merge it to a number that is wrong with no conflict to warn anyone. Run \`git rm --cached $REPORT\`."
  status=1
elif ! git_query check-ignore -q -- "$REPORT"; then
  fail "$REPORT is untracked but not ignored. D-08.20 makes it CI output; without the .gitignore entry the next \`git add -A\` commits it again."
  status=1
fi

exit $status
