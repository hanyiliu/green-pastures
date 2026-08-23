// @vitest-environment node
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * D-10.12's fallback, rehearsed — and 08 §3 rule 6's only live habitat.
 *
 * PR-3.9 enabled `zh-Hant`, which retired the state every pending-locale test
 * was written against: with the catalogue fully enabled, a *known but not
 * enabled* locale does not exist, rule 6 has nothing to exempt, and the cases
 * that used to state it would pass vacuously or not at all. They are not
 * obsolete — D-10.12 lets PR-8.8 take `zh-Hant` back out of `routing.locales`
 * at the Phase 8 gate, and rule 6 is what keeps `content` green on that day.
 *
 * So this file mocks `routing.locales` back to the two ids of the withdrawal
 * and states the rule there, where it fires. Everything else — `LOCALE_IDS`,
 * the schemas, the validator, the shipped `content/` tree — is the real thing.
 *
 * It also pins the property PR-3.9's row calls its acceptance: **reverting only
 * this PR's config half leaves a working two-locale site**. That revert is
 * bigger than the one line 10 §PR-8.8 lists, and the last two cases below are
 * why: INV-02.3 makes `brand.name["zh-Hant"]` legal only while the id is
 * enabled, so the two `site.json` brand values leave with the id, and only the
 * two `provisional` paths stay behind for rule 6 to carry.
 */

vi.mock("@/i18n/routing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/routing")>();
  return {
    ...actual,
    // The catalogue (`LOCALE_IDS`) is untouched: `zh-Hant` is still known, just
    // not enabled — which is exactly what rule 6 keys on.
    routing: { ...actual.routing, locales: ["en", "zh-Hans"] },
  };
});

const { SiteSchema, isPendingLocalePath } = await import("@/content/schemas/site");
const { LOCALE_IDS } = await import("@/i18n/routing");
const { LOCALES, RULES, run } = await import("../../../scripts/validate-content");

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const WORKSPACE = mkdtempSync(join(tmpdir(), "gp-locale-withdrawal-"));

afterAll(() => {
  rmSync(WORKSPACE, { recursive: true, force: true });
});

type Site = {
  brand: { name: Record<string, string>; shortName: Record<string, string> };
  nav: { primary: Array<{ id: string; routeId?: string; href?: string }> };
  provisional: string[];
} & Record<string, unknown>;

let caseIndex = 0;

/**
 * The repository as PR-8.8's withdrawal branch would leave it: the real
 * `content/` tree — `content/zh-Hant/` included, because the withdrawal keeps
 * the directory — with the two `zh-Hant` brand values gone from `site.json` and
 * their two `provisional` paths still in place.
 */
function withdrawn(mutate: (site: Site) => void = () => undefined): {
  readonly root: string;
  readonly site: Site;
} {
  caseIndex += 1;
  const root = join(WORKSPACE, `case-${String(caseIndex)}`);
  cpSync(join(REPO_ROOT, "content"), join(root, "content"), {
    recursive: true,
    // Generated, git-ignored next-intl declaration companions, not JSON.
    filter: (source) => !source.endsWith(".d.json.ts"),
  });
  const file = join(root, "content/site.json");
  const site = JSON.parse(readFileSync(file, "utf8")) as Site;
  delete site.brand.name["zh-Hant"];
  delete site.brand.shortName["zh-Hant"];
  mutate(site);
  writeFileSync(file, `${JSON.stringify(site, null, 2)}\n`);
  return { root, site };
}

/** `pnpm validate:content` with the flags CI passes after the withdrawal. */
function gate(root: string, ...args: string[]): { readonly code: number; readonly out: string } {
  const lines: string[] = [];
  const code = run(["--warn-locale", "zh-Hans", ...args], root, (line: string) => lines.push(line));
  return { code, out: lines.join("\n") };
}

/** `next build`'s half: the loader parses `site.json` through `SiteSchema`. */
function complaints(site: unknown): string {
  const result = SiteSchema.safeParse(site);
  if (result.success) return "";
  return result.error.issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n");
}

describe("the withdrawn world", () => {
  it("is two enabled ids and a three-id catalogue — the premise of every case below", () => {
    expect(LOCALES.enabled).toStrictEqual(["en", "zh-Hans"]);
    expect(LOCALES.known).toStrictEqual([...LOCALE_IDS]);
    expect(LOCALES.known).toContain("zh-Hant");
    // Without this the mock has not taken and everything below is vacuous.
    expect(isPendingLocalePath("brand.name.zh-Hant")).toBe(true);
  });
});

describe("rule 6 keeps both gates green on the day the escape hatch is used", () => {
  it("validate:content passes, listing the two seeded paths as pending locale", () => {
    const { root } = withdrawn();
    const outcome = gate(root);
    // The whole row, not the word "pending": "pending review" is the coverage
    // status of a held-back tree and must not be able to satisfy this.
    expect(outcome.out).toContain(
      "| `brand.name.zh-Hant` | — | — | `content/site.json` | pending locale |",
    );
    expect(outcome.out).toContain(
      "| `brand.shortName.zh-Hant` | — | — | `content/site.json` | pending locale |",
    );
    expect(outcome.out).not.toContain(`[${RULES.PROVISIONAL_UNRESOLVED}]`);
    expect(outcome.out).not.toContain(`[${RULES.SITE_SCHEMA}]`);
    expect(outcome.code).toBe(0);
  });

  it("the tree left behind is scanned reporting-only, never as a failure", () => {
    // `content/zh-Hant/` stays on disk through the withdrawal (D-10.12), so the
    // pass has to have somewhere to put it that is not the error list. The file
    // written here is deliberately broken twice over — an orphan key and an
    // empty string — and both breakages are named rules, so the assertions name
    // them rather than trusting the exit code to have the right cause.
    const { root } = withdrawn();
    writeFileSync(
      join(root, "content/zh-Hant/messages/common.json"),
      `${JSON.stringify({ nav: { nope: "" } }, null, 2)}\n`,
    );
    const outcome = gate(root);
    expect(outcome.out).toMatch(/zh-Hant\s+pending review\s+\d+\/\d+ keys/);
    expect(outcome.out).not.toContain(`[${RULES.PARITY_MISSING}] zh-Hant`);
    expect(outcome.out).not.toContain(`[${RULES.PARITY_EXTRA}]`);
    expect(outcome.out).not.toContain(`[${RULES.EMPTY_STRING}]`);
    expect(outcome.code).toBe(0);
  });

  it("keeps the parsed-file checks alive beside the exempted entries", () => {
    // A failed `site.json` parse yields no data, so an entry that wrongly reds
    // the schema also silences every check that reads the parsed file — assets,
    // collection schemas, alt text. That collateral is invisible in the exit
    // code, so it gets its own case.
    const { root } = withdrawn();
    const file = join(root, "content/en/collections/teachers.json");
    const teachers = JSON.parse(readFileSync(file, "utf8")) as {
      ping: Record<string, unknown>;
    };
    delete teachers.ping.photoAlt;
    writeFileSync(file, `${JSON.stringify(teachers, null, 2)}\n`);
    const outcome = gate(root);
    expect(outcome.out).toContain(`[${RULES.MISSING_ALT}]`);
    expect(outcome.code).toBe(1);
  });

  it("next build's half agrees — the loader parses the same file clean", () => {
    const { site } = withdrawn();
    expect(complaints(site)).toBe("");
  });

  it("keeps the exempt entries in the registry, so --release still sees them under R1", () => {
    const { site } = withdrawn();
    const parsed = SiteSchema.parse(site);
    expect(parsed.provisional).toContain("brand.name.zh-Hant");
    expect(parsed.provisional).toContain("brand.shortName.zh-Hant");
    expect(gate(withdrawn().root, "--release").code).toBe(1);
  });
});

describe("rule 6 exempts one thing and nothing else", () => {
  it("still rejects a path that genuinely resolves to nothing", () => {
    const { root, site } = withdrawn((value) => {
      value.provisional.push("contact.nope");
    });
    expect(gate(root).out).toContain(`[${RULES.PROVISIONAL_UNRESOLVED}]`);
    expect(gate(root).code).toBe(1);
    expect(complaints(site)).toContain("resolves to nothing in content/site.json");
  });

  it("still rejects a mistyped locale suffix, which rule 6 must not swallow", () => {
    const { root, site } = withdrawn((value) => {
      value.provisional.push("brand.name.zh-Hanx");
    });
    expect(gate(root).out).toContain(`[${RULES.PROVISIONAL_UNRESOLVED}]`);
    expect(gate(root).code).toBe(1);
    expect(complaints(site)).toContain("resolves to nothing in content/site.json");
  });

  it("still rejects a duplicate of a pending-locale entry (rule 1 outranks rule 6)", () => {
    const { site } = withdrawn((value) => {
      value.provisional.push("brand.name.zh-Hant");
    });
    expect(complaints(site)).toContain('Duplicate provisional entry "brand.name.zh-Hant"');
  });

  it("leaves every other cross-reference in force beside a pending-locale entry", () => {
    // An exemption that short-circuited the rest of the refinement would hide
    // real findings behind one held-back locale.
    const { site } = withdrawn((value) => {
      value.nav.primary[0] = { id: "philosophy", routeId: "nowhere" };
    });
    expect(complaints(site)).toContain('routeId "nowhere" is not an id in routes[]');
  });

  it("does not exempt a collections path whose last segment is the held locale", () => {
    // Rule 2 gives the first segment the deciding vote, so the locale id is an
    // ordinary key there and the collection still has to exist.
    const { site } = withdrawn((value) => {
      value.provisional.push("collections.recipes.soup.zh-Hant");
    });
    expect(complaints(site)).toContain("names no known collection");
  });

  it("does not exempt a messages path whose last segment is the held locale", () => {
    const { site } = withdrawn((value) => {
      value.provisional.push("messages.zh-Hant");
    });
    expect(complaints(site)).toContain("must be messages.<namespace>.<key>");
  });
});

describe("the withdrawal is not one line: INV-02.3 moves site.json with the id", () => {
  it("rejects the brand values PR-3.9 authored, the moment the id leaves routing.locales", () => {
    // The mirror image of the failure that made PR-3.9 add them: a localized
    // value carries an entry for every enabled id **and no others**, so the two
    // brand values are part of the same edit in both directions. Leave them
    // behind and the withdrawal reds `next build` — which is the failure
    // OQ-08.10 asked about, one layer up from the registry it answered for.
    const site = JSON.parse(
      readFileSync(join(REPO_ROOT, "content/site.json"), "utf8"),
    ) as unknown as Site;
    expect(site.brand.name["zh-Hant"]).toBeDefined();
    expect(complaints(site)).toContain("unrecognized_keys");
  });

  it("and passes once they leave with it — a working two-locale site", () => {
    const { root, site } = withdrawn();
    expect(complaints(site)).toBe("");
    expect(gate(root).code).toBe(0);
  });
});
