#!/usr/bin/env bash
#
# todo-grep — the work-marker gate.
#
# Specification: docs/technical/08-testing-quality.md §2 (the two commands),
# §10 (`static`'s `check:todo` step), §11 (`pnpm check:todo`, `pnpm verify`),
# TRAP-11.9 and INV-08.6. A comment is not tracked work: a marker word left in
# source text fails the pull request, and the fix is a bead, not a comment.
#
#   usage: scripts/ci/todo-grep.sh          (no arguments; run from anywhere
#                                            inside the work tree)
#
# ── Why this is a script and not four lines of YAML ──────────────────────────
#
# Until this file existed the two commands were an inlined shell body in
# `.github/workflows/ci.yml`'s `static` job, so the gate ran in CI and nowhere
# else: `pnpm verify` reported clean over a tree the pull request was about to
# go red on, and it did — that is how `main` broke. INV-08.6 is that CI and the
# local loop run **one** command set. One script, two callers — `ci.yml`'s
# `check:todo` step and `pnpm verify`, both by way of `pnpm run check:todo` —
# is what makes the two verdicts the same verdict rather than two that happen
# to agree.
#
# ── The gate is textual, not semantic — prose counts as source text ──────────
#
# The rule is "this word does not appear under these paths", which is trivially
# checkable and impossible to game. It is *not* "this word does not appear as a
# marker", which would need a reader of intent. So a comment that merely
# **describes** the rule trips it, exactly like a real marker would, and the fix
# is to reword the comment — never to teach the gate about backticks, prose or
# an allowlist. Every such exemption is cheaper to abuse than opening a bead is
# to do (`gp-dln.205` proved it by probe: a marker in backticks reads as prose
# and stands in for real work just as well). Two files reached this conclusion
# independently before it was written down here — `scripts/validate-content.ts`
# spells R2's vocabulary lower case on purpose, and `src/lib/seo/json-ld.ts` was
# reworded rather than exempted.
#
# `MARKER_WORDS` below is the same move, and the reason this file needs no
# pathspec exclusion for itself. `scripts/**` is one of the paths scanned, the
# gate is case-sensitive, and the words it looks for are shouted; storing them
# lower case and shouting them once at match time means this file states its own
# vocabulary in full while containing none of what it forbids. Nothing here is
# glued together out of fragments and nothing looks away: a genuine marker
# written anywhere in this file, comments included, fails the gate exactly as it
# would anywhere else in the tree. Do not "tidy" the list to upper case — it
# reds `static` and buys nothing, since the pattern is upper-cased below.
#
# ── `-w`, never `\b(…)\b` ────────────────────────────────────────────────────
#
# `\b` is a glibc regex extension, not POSIX ERE: git's engine honours it where
# glibc supplies it and silently matches **nothing** everywhere else (verified
# 2026-08-23 on Apple Git 2.50.1 — `git grep -E '\bexport\b' -- src` matches no
# line in a tree full of `export`). A word-boundary gate that matches nothing
# reports green over a tree full of markers, which is the one failure this check
# exists to prevent. `-w` is git's own flag, means the same thing, and behaves
# identically on every platform. (`-P` also works, but needs a git built with
# PCRE2 — no more guaranteed than glibc.) Word semantics are the point: a marker
# word embedded in a longer identifier is not a marker and must not fire.
#
# What `-w` counts as a boundary is every non-word character, punctuation
# included — so a marker inside a hyphenated name, in parentheses, or as a URL
# path segment all fire, because `-`, `(` and `/` end a word as surely as a
# space does. That is git's documented behaviour and it is the behaviour we
# want: a marker does not stop being one for being punctuated. Only letters,
# digits and `_` extend a word, which is why an identifier that merely starts
# with a marker word does not fire.
#
# ── `--untracked`, deliberately (`gp-dln.207`) ───────────────────────────────
#
# `git grep` reads tracked files only. On a CI checkout every file is tracked,
# so that costs nothing there; locally it means a brand-new file full of markers
# passes silently until someone runs `git add`. That is a local-only fail-open
# of the same class as the `\b` bug — the gate looks healthy and asserts less
# than it claims — and it would defeat the point of running the gate locally at
# all. `--untracked` closes it and changes no CI verdict, so the two callers
# still agree by construction. Ignored files stay out (no `--no-exclude-standard`),
# so build output and `node_modules` are not scanned.
#
# ── The two commands are separate on purpose ─────────────────────────────────
#
# `content/**` is deliberately absent from the word grep. A marker word as a
# JSON *value* under `content/` is the release gate's business (08 §3 R2,
# D-08.17) and must not red an ordinary pull request; what is banned there is a
# comment in disguise — a key named `_comment` or `todo`. This grep is a
# required per-PR check over source text; R2 runs only at release and only over
# parsed JSON values. The two do not overlap and neither replaces the other.
#
# ── A gate that cannot run must not report clean ────────────────────────────
#
# Every fail-open this file has ever had came from something that could not
# scan reporting the same thing as something that scanned and found nothing:
# `\b` compiling to a pattern that matched no line, tracked-only greps not
# seeing an untracked file. Two more doors were open until `gp-dln.206` was
# reviewed, and both are shut here.
#
#   * `cd "$(git rev-parse --show-toplevel)"` fails open. Command substitution
#     used as an argument hides its own exit status from `set -e`, so outside a
#     repository the substitution yields nothing, `cd ""` succeeds, and the
#     script sails on. The assignment below is checked instead.
#   * `if git grep …; then` cannot tell a failure from a clean tree. `git grep`
#     exits 0 on a match, 1 on none and >1 on a real error — a broken
#     repository, a pathspec it will not take, a pattern it cannot compile —
#     and the `if` shape reads every one of those as "no match". `grep_gate`
#     below discriminates, and anything above 1 is fatal.
#
# Exit codes: 0 clean, 1 the gate fired, 2 the gate could not run. Callers only
# need "non-zero is bad", but the third is deliberately not silence.
#
# Dependencies: bash and git only. Never `bd`.

set -euo pipefail

# The gate's vocabulary, stated once. Lower case on purpose — see the header.
MARKER_WORDS='todo fixme hack'

# Comment-in-disguise keys banned under `content/`. Lower case as written, which
# is also what the gate matches: these are JSON key names, not shouted markers.
DISGUISED_KEYS='_comment|todo'

# Pathspecs for the word grep. `content/**` is not here, and that is a decision.
SOURCE_PATHS=('src/**' 'tests/**' 'scripts/**')

# The alternation the grep runs: the words above, pipe-joined and shouted here
# rather than in the source text, which is the whole trick.
marker_pattern=$(printf '%s' "${MARKER_WORDS// /|}" | tr '[:lower:]' '[:upper:]')
# The same vocabulary as the reader should see it back, for the error message.
marker_label=$(printf '%s' "${MARKER_WORDS// /, }" | tr '[:lower:]' '[:upper:]')

# One line on stderr, annotated when GitHub Actions is the one reading it.
fail() {
  if [[ -n ${GITHUB_ACTIONS:-} ]]; then
    printf '::error::%s\n' "$1" >&2
  else
    printf 'check:todo: %s\n' "$1" >&2
  fi
}

# The gate could not run. Never silent, never exit 0 — see the header.
die() {
  fail "$1"
  exit 2
}

# `git grep`, with its third outcome kept distinct from its second: 0 match,
# 1 no match, anything else an error this script refuses to read as clean.
grep_gate() {
  local rc=0
  git grep "$@" || rc=$?
  case "$rc" in
    0) return 0 ;;
    1) return 1 ;;
    *) die "git grep exited $rc, which is an error and not a clean tree: git grep $*" ;;
  esac
}

# Pathspecs are resolved relative to the current directory, so anchor to the
# work tree root and the verdict is the same from any subdirectory. Assigned and
# checked rather than inlined into `cd`, which would swallow the failure.
toplevel=$(git rev-parse --show-toplevel) || toplevel=''
[[ -n $toplevel ]] || die 'not inside a git work tree, so nothing was scanned. This is not a clean tree.'
cd "$toplevel" || die "cannot enter the work tree root: $toplevel"

status=0

if grep_gate --untracked -nwE "$marker_pattern" -- "${SOURCE_PATHS[@]}"; then
  fail "TRAP-11.9: a comment is not tracked work ($marker_label in source text). Open a bead and cite its id. Prose describing the rule counts — reword it."
  status=1
fi

if grep_gate --untracked -nE "\"($DISGUISED_KEYS)\"[[:space:]]*:" -- 'content/**'; then
  fail '08 §2: no comment-in-disguise keys in content/ — use a bead.'
  status=1
fi

exit $status
