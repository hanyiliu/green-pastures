// @vitest-environment node
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { SiteSchema, isPendingLocalePath, type LocaleSets } from "@/content/schemas/site";
import { routing } from "@/i18n/routing";

import {
  LOCALES,
  RULES,
  isPendingLocalePath as validatorIsPendingLocalePath,
  run,
  type LocaleConfig,
} from "../../../scripts/validate-content";

/**
 * One rule, two enforcers — 08 §3 rule 6 (INV-02.10, OQ-08.10).
 *
 * A pending-locale entry is exempted from resolution in two places that run at
 * two different times: `pnpm validate:content` on the PR, and
 * `src/content/schemas/site.ts` inside the loader, on every `next build`. While
 * only the validator carried the rule the two disagreed, and the disagreement
 * had exactly one shape: `validate:content` green and `next build` red on the
 * same registry entry.
 *
 * The rule now lives in the schema, which the validator can import. This file
 * is the guard against the two spellings drifting apart again while both exist:
 * every path below must get the same verdict from both, so a change to either
 * predicate that is not made to the other fails here rather than in CI on the
 * day D-10.12's escape hatch is used.
 *
 * PR-3.9 enabled `zh-Hant`, so the project's own configuration now holds back
 * nothing and its verdict is *false* for every path here. That would make a
 * comparison of two defaults vacuous, so each case is stated twice: once
 * against the live configuration, and once against a synthetic pair that does
 * hold a locale back. The rule firing end to end through both gates is
 * `locale-withdrawal.test.ts`.
 */

/** A pair that holds a locale back, so the *true* verdict has cases too. */
const HELD: LocaleSets = { known: ["en", "zh-Hans", "zh-Hant"], enabled: ["en", "zh-Hans"] };
const HELD_CONFIG: LocaleConfig = { reference: "en", ...HELD };

/** Paths chosen to straddle every boundary the rule draws. */
const PATHS = [
  // The seed entries the rule exists for.
  "brand.name.zh-Hant",
  "brand.shortName.zh-Hant",
  // Enabled locales resolve normally.
  "brand.name.en",
  "brand.name.zh-Hans",
  // Not locale suffixes at all.
  "license",
  "contact.address.street",
  "routes.0.path",
  "yelp.rating",
  // Near-misses: a locale id nobody knows is a typo, not a held-back locale.
  "brand.name.zh",
  "brand.name.zh-Hanx",
  "brand.name.ZH-HANT",
  // Rule 2 gives these first segments the deciding vote.
  "collections.teachers.ping.zh-Hant",
  "messages.common.footer.zh-Hant",
  "collections.zh-Hant",
  "messages.zh-Hant",
  // Degenerate shapes both must treat alike.
  "zh-Hant",
  "provisional.zh-Hant",
  "",
  ".",
  "brand.name.",
];

describe("08 §3 rule 6 is one rule in two places", () => {
  it("has a case of each verdict, so the comparison below cannot pass vacuously", () => {
    expect(PATHS.filter((path) => isPendingLocalePath(path, HELD)).length).toBeGreaterThan(0);
    expect(PATHS.filter((path) => !isPendingLocalePath(path, HELD)).length).toBeGreaterThan(0);
  });

  it.each(PATHS)("the schema and the validator agree on %o, live", (path) => {
    expect(isPendingLocalePath(path)).toBe(validatorIsPendingLocalePath(path, LOCALES));
  });

  it.each(PATHS)("the schema and the validator agree on %o, with a locale held back", (path) => {
    expect(isPendingLocalePath(path, HELD)).toBe(validatorIsPendingLocalePath(path, HELD_CONFIG));
  });

  it("reads the same locale lists — routing.ts, never a literal (INV-08.4)", () => {
    // The validator passes its `LocaleConfig` explicitly; the schema defaults to
    // the project's. Stating one against the other's config pins that the two
    // defaults are the same configuration and not two copies of a list.
    expect(isPendingLocalePath("brand.name.zh-Hant", LOCALES)).toBe(
      isPendingLocalePath("brand.name.zh-Hant"),
    );
    expect(LOCALES.enabled).toStrictEqual([...routing.locales]);
  });
});

/* -------------------------------------------------------------------------- *
 * The seam itself: one file, both gates
 * -------------------------------------------------------------------------- */

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const WORKSPACE = mkdtempSync(join(tmpdir(), "gp-pending-locale-"));

afterAll(() => {
  rmSync(WORKSPACE, { recursive: true, force: true });
});

let caseIndex = 0;

/** The real `content/` with one registry entry appended. */
function fixture(path: string): { readonly root: string; readonly site: unknown } {
  caseIndex += 1;
  const root = join(WORKSPACE, `case-${String(caseIndex)}`);
  cpSync(join(REPO_ROOT, "content"), join(root, "content"), {
    recursive: true,
    // Generated, git-ignored next-intl declaration companions, not JSON.
    filter: (source) => !source.endsWith(".d.json.ts"),
  });
  const file = join(root, "content/site.json");
  const site = JSON.parse(readFileSync(file, "utf8")) as { provisional: string[] };
  site.provisional.push(path);
  writeFileSync(file, `${JSON.stringify(site, null, 2)}\n`);
  return { root, site };
}

/** `pnpm validate:content` with the flags CI passes through Phase 3. */
function gate(root: string): { readonly code: number; readonly out: string } {
  const lines: string[] = [];
  const code = run(["--warn-locale", "zh-Hans", "--warn-locale", "zh-Hant"], root, (line: string) =>
    lines.push(line),
  );
  return { code, out: lines.join("\n") };
}

/** `next build`'s half: the loader parses `site.json` through `SiteSchema`. */
function build(site: unknown): { readonly ok: boolean; readonly out: string } {
  const result = SiteSchema.safeParse(site);
  return { ok: result.success, out: result.success ? "" : JSON.stringify(result.error.issues) };
}

describe("validate:content and next build reach the same verdict", () => {
  it("both accept the entry rule 6 exempts, in the configuration that exempts it", () => {
    // The acceptance case needs a locale that is held back, which the project
    // no longer has: `locale-withdrawal.test.ts` runs this same pair of gates
    // against `routing.locales` mocked back to D-10.12's two ids. What is left
    // here is the half that needs no mock — the seeded path resolves like any
    // other now that PR-3.9 enabled the locale, and both gates say so.
    const { root, site } = fixture("contact.address.city");
    const gated = gate(root);
    expect(gated.out).toContain("| `brand.name.zh-Hant` |");
    expect(gated.out).not.toContain("pending locale");
    expect(gated.code).toBe(0);
    expect(build(site).out).toBe("");
  });

  it("both reject a path that genuinely resolves to nothing (rule 4)", () => {
    const { root, site } = fixture("contact.nope");
    const gated = gate(root);
    expect(gated.out).toContain(`[${RULES.PROVISIONAL_UNRESOLVED}]`);
    expect(gated.code).toBe(1);
    expect(build(site).out).toContain("resolves to nothing in content/site.json");
  });

  it("both reject a mistyped locale suffix, which rule 6 must not swallow", () => {
    const { root, site } = fixture("brand.name.zh-Hanx");
    const gated = gate(root);
    expect(gated.out).toContain(`[${RULES.PROVISIONAL_UNRESOLVED}]`);
    expect(gated.code).toBe(1);
    expect(build(site).out).toContain("resolves to nothing in content/site.json");
  });
});
