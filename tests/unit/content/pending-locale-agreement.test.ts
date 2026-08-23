// @vitest-environment node
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { SiteSchema, isPendingLocalePath } from "@/content/schemas/site";

import {
  LOCALES,
  RULES,
  isPendingLocalePath as validatorIsPendingLocalePath,
  run,
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
 * day 02's Phase 3 seed lands.
 */

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
    expect(PATHS.filter((path) => isPendingLocalePath(path)).length).toBeGreaterThan(0);
    expect(PATHS.filter((path) => !isPendingLocalePath(path)).length).toBeGreaterThan(0);
  });

  it.each(PATHS)("the schema and the validator agree on %o", (path) => {
    expect(isPendingLocalePath(path)).toBe(validatorIsPendingLocalePath(path, LOCALES));
  });

  it("reads the same locale lists — routing.ts, never a literal (INV-08.4)", () => {
    // The validator passes its `LocaleConfig` explicitly; the schema defaults to
    // the project's. Stating one against the other's config pins that the two
    // defaults are the same configuration and not two copies of a list.
    expect(isPendingLocalePath("brand.name.zh-Hant", LOCALES)).toBe(
      isPendingLocalePath("brand.name.zh-Hant"),
    );
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
  const code = run(["--warn-locale", "zh-Hans"], root, (line: string) => lines.push(line));
  return { code, out: lines.join("\n") };
}

/** `next build`'s half: the loader parses `site.json` through `SiteSchema`. */
function build(site: unknown): { readonly ok: boolean; readonly out: string } {
  const result = SiteSchema.safeParse(site);
  return { ok: result.success, out: result.success ? "" : JSON.stringify(result.error.issues) };
}

describe("validate:content and next build reach the same verdict", () => {
  it("both accept a pending-locale entry (08 §3 rule 6)", () => {
    const { root, site } = fixture("brand.name.zh-Hant");
    const gated = gate(root);
    expect(gated.code).toBe(0);
    expect(gated.out).toContain("pending locale");
    // The half that used to disagree: the loader's parse.
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
