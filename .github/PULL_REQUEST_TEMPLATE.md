## What and why

<!-- One paragraph. Name the plan row this serves (e.g. 10 §2 PR-2.9) and the decision
     ids it implements. Link the preview deployment once Vercel has posted it. -->

## Seats

- Implementer:
- Verifier:

They must be different people (INV-11.3).

## Done (08 §12.1)

Tick what applies. Strike a line through with `~~…~~` when it does not apply rather than
deleting it, so a reviewer can see the question was asked.

- [ ] The five checks that exist today are green: `static`, `unit`, `build`, `e2e-ok`, `bead-trailer` — D-08.12's six names less `content`, which arrives with PR-3.4; nothing is ruleset-enforced yet (D-08.19), so this box is the gate
- [ ] No new `@flaky-known` test without an open bead
- [ ] Content coverage shows no missing key in any enabled locale, or this PR names the `--warn-locale` it ran under (INV-02.11) — the coverage report and that flag arrive with PR-3.4
- [ ] A new sample default adds its path to `content/site.json`'s `provisional`; a replaced real value deletes its path (INV-02.10) — `content/site.json` arrives with PR-3.2
- [ ] Visual change → Playwright diff images attached, design file and line cited — baselines arrive with PR-8.6; the design files are under `docs/design/` today
- [ ] Token change → `docs/technical/03-design-system-tokens.md` edited in this same PR (INV-03.5)
- [ ] New or changed `INV-*` in 02, 03, 05, 07 or 11 → a row added to 08 §9 (INV-08.1)
- [ ] New environment variable → `.env.example`, 07 §5 and 09 all updated
- [ ] Every commit carries its own single `Bead:` trailer, and this body ends with one (W-11.3, 11 §5)

## Beads

<!-- Any SECONDARY bead ids this PR serves, one plain id per line, no `Bead:` prefix.
     The primary id is the trailer at the bottom of this body. -->

Below is the last line of this pull request. Squash-merge is the only merge mode here, so
that line is the one the commit on `main` inherits and the one the `bead-trailer` check
reads (11 §5). Replace `gp-unset` with the bead this PR serves, keep it as the very last
line, and put nothing after it — not a heading, not a horizontal rule, not a signature.

Bead: gp-unset
