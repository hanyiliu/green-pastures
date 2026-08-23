// @vitest-environment node
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import {
  LOCALES,
  R2_SENTINELS,
  R4_LITERALS,
  R4_PATHS,
  RULES,
  flatten,
  parseArgs,
  readContentTree,
  readIcu,
  renderProvisionalBlock,
  renderReport,
  resolveDotted,
  run,
  validateContent,
  type LocaleConfig,
  type Options,
  type RuleId,
} from "../../../scripts/validate-content";

/**
 * The gate's own tests (08 §3, §4 and D-08.16 — "the gate in §3 is only as good
 * as its own tests").
 *
 * Every rule is exercised against a **fixture tree**: the real `content/` copied
 * to a temporary directory and mutated in exactly one way, then run through the
 * real CLI entry point. A rule whose failure path is never exercised is the
 * vacuous gate this repository has shipped once already, so each `it` here
 * asserts both that the rule fires and — where the distinction matters — that
 * the process exit code follows.
 */

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const WORKSPACE = mkdtempSync(join(tmpdir(), "gp-validate-content-"));
const CLEAN = join(WORKSPACE, "clean");

cpSync(join(REPO_ROOT, "content"), join(CLEAN, "content"), {
  recursive: true,
  // The next-intl declaration companions are generated, git-ignored and not JSON.
  filter: (source) => !source.endsWith(".d.json.ts"),
});

afterAll(() => {
  rmSync(WORKSPACE, { recursive: true, force: true });
});

type Ctx = {
  readonly root: string;
  readonly site: string;
  en: (relative: string) => string;
  zh: (relative: string) => string;
};

let caseIndex = 0;

function readJson(file: string): Record<string, never> {
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, never>;
}

function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Every asset path `site.json` references, walked here rather than imported so
 * that a reference the validator learns to read and this file does not is a
 * loud fixture failure rather than a photograph nobody checks.
 */
function assetPaths(site: Record<string, never>): readonly string[] {
  const json = site as unknown as {
    images: Record<string, { src: string }>;
    programs: { photo: { src: string } }[];
    teachers: { photo?: { src: string } }[];
    gallery: { photos: { src: string }[] };
  };
  return [
    ...Object.values(json.images).map((image) => image.src),
    ...json.programs.map((program) => program.photo.src),
    ...json.teachers.flatMap((teacher) => (teacher.photo ? [teacher.photo.src] : [])),
    ...json.gallery.photos.map((photo) => photo.src),
  ];
}

/** PR-8.3's photography as a fixture: every referenced file, one byte each. */
function deliverAssets(ctx: Ctx): void {
  for (const src of assetPaths(readJson(ctx.site))) {
    const file = join(ctx.root, "public", src);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "x");
  }
}

/** A copy of the clean tree with one mutation applied. */
function fixture(mutate: (ctx: Ctx) => void = () => undefined): string {
  caseIndex += 1;
  const root = join(WORKSPACE, `case-${String(caseIndex)}`);
  cpSync(CLEAN, root, { recursive: true });
  mutate({
    root,
    site: join(root, "content/site.json"),
    en: (relative) => join(root, "content/en", relative),
    zh: (relative) => join(root, "content/zh-Hans", relative),
  });
  return root;
}

type Outcome = { readonly code: number; readonly out: string };

function gate(root: string, ...args: string[]): Outcome {
  const lines: string[] = [];
  const code = run(args, root, (line: string) => lines.push(line));
  return { code, out: lines.join("\n") };
}

function fired(outcome: Outcome, rule: RuleId): boolean {
  return outcome.out.includes(`[${rule}]`);
}

/**
 * The flags CI passes today: both Chinese trees are mid-translation for the
 * whole of Phase 3 — `zh-Hans` because PR-3.5 seeded 33 of its 323 keys, and
 * `zh-Hant` because PR-3.9 converted exactly those 33 across (D-02.21).
 */
const PHASE_3 = ["--warn-locale", "zh-Hans", "--warn-locale", "zh-Hant"];

/* -------------------------------------------------------------------------- *
 * The real repository
 * -------------------------------------------------------------------------- */

describe("the repository as it stands", () => {
  it("passes in PR mode with the Phase 3 warn flag", () => {
    const outcome = gate(REPO_ROOT, ...PHASE_3);
    expect(outcome.out).toContain("PASS");
    expect(outcome.code).toBe(0);
  });

  it("fails --release, because the provisional registry is not empty", () => {
    const outcome = gate(REPO_ROOT, "--release");
    expect(fired(outcome, RULES.R1_REGISTRY)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("keeps R4's literals in step with content/site.json (08 §3 spelling drift)", () => {
    // The one test on this page that reads the real file rather than a fixture:
    // a respelt sample would leave R4 matching nothing and failing open.
    const site = readJson(join(REPO_ROOT, "content/site.json"));
    const provisional = resolveDotted(site, "provisional");
    expect(Array.isArray(provisional)).toBe(true);
    for (const path of R4_PATHS) {
      if (!(provisional as string[]).includes(path)) continue;
      const value = resolveDotted(site, path);
      expect(R4_LITERALS, `${path} is still provisional, so R4 must recognise it`).toContain(value);
    }
  });
});

/* -------------------------------------------------------------------------- *
 * Structure
 * -------------------------------------------------------------------------- */

describe("structure", () => {
  it("reports a file that is not readable JSON", () => {
    const root = fixture(({ zh }) => {
      writeFileSync(zh("messages/menu.json"), "{ oops");
    });
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.JSON_UNREADABLE)).toBe(true);
    // Unparseable is not a parity gap: `--warn-locale` may not demote it.
    expect(outcome.code).toBe(1);
  });

  it("reports a namespace file that is missing from a locale", () => {
    const root = fixture(({ zh }) => {
      rmSync(zh("messages/menu.json"));
    });
    expect(fired(gate(root), RULES.FILE_MISSING)).toBe(true);
    expect(gate(root).code).toBe(1);
  });

  it("keeps an empty {} namespace file valid — it is how a lagging tree says 'present'", () => {
    const outcome = gate(fixture(), ...PHASE_3);
    expect(outcome.code).toBe(0);
  });

  it("reports a locale file with no reference counterpart", () => {
    const root = fixture(({ zh }) => {
      writeJson(zh("messages/extra.json"), { a: "b" });
    });
    // Deliberately no exit-code assertion: `file-orphan` is hard-coded to
    // `error` while its key-level sibling `parity-extra` is demotable, and
    // 08 §3 lists only the Zod checks, INV-02.4 and the provisional gate as
    // what `--warn-locale` may not touch. Which of the two is right is 08's
    // call, so this row pins the finding and not the severity.
    expect(fired(gate(root, ...PHASE_3), RULES.FILE_ORPHAN)).toBe(true);
  });

  it("reports an enabled locale with no content directory at all", () => {
    const root = fixture(({ root: base }) => {
      rmSync(join(base, "content/zh-Hans"), { recursive: true });
    });
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.FILE_MISSING)).toBe(true);
    // INV-02.11: an enabled locale with no tree is a configuration error, and
    // `--warn-locale zh-Hans` — passed here on purpose — cannot demote it.
    expect(outcome.code).toBe(1);
  });
});

/* -------------------------------------------------------------------------- *
 * Key shape — 02 *Key naming* rule 2
 * -------------------------------------------------------------------------- */

describe("key shape", () => {
  it("rejects a key segment that is not camelCase", () => {
    const root = fixture(({ en }) => {
      const file = en("messages/common.json");
      const json = readJson(file) as unknown as { nav: Record<string, string> };
      json.nav.Bad_Key = "x";
      writeJson(file, json);
    });
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.KEY_SHAPE)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("rejects a key deeper than six segments", () => {
    const root = fixture(({ en }) => {
      const file = en("messages/common.json");
      const json = readJson(file) as unknown as Record<string, unknown>;
      json.a = { b: { c: { d: { e: { f: "too deep" } } } } };
      writeJson(file, json);
    });
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.KEY_DEPTH)).toBe(true);
    expect(outcome.code).toBe(1);
  });
});

/* -------------------------------------------------------------------------- *
 * Parity — INV-02.2
 * -------------------------------------------------------------------------- */

describe("parity", () => {
  const editZh = (file: string, edit: (json: Record<string, never>) => void) => (ctx: Ctx) => {
    const target = ctx.zh(file);
    const json = readJson(target);
    edit(json);
    writeJson(target, json);
  };

  it("reports a key the locale is missing", () => {
    const root = fixture(
      editZh("messages/common.json", (json) => {
        delete (json as unknown as { nav: Record<string, string> }).nav.philosophy;
      }),
    );
    const strict = gate(root);
    expect(fired(strict, RULES.PARITY_MISSING)).toBe(true);
    expect(strict.code).toBe(1);
    // The other half of 08 §3: this is the finding `--warn-locale` demotes.
    const demoted = gate(root, ...PHASE_3);
    expect(demoted.out).toContain(`warn  [${RULES.PARITY_MISSING}] zh-Hans`);
    expect(demoted.code).toBe(0);
  });

  it("reports an orphan key the reference does not have", () => {
    const root = fixture(
      editZh("messages/common.json", (json) => {
        (json as unknown as { nav: Record<string, string> }).nav.nope = "多余";
      }),
    );
    const outcome = gate(root);
    expect(fired(outcome, RULES.PARITY_EXTRA)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("does not turn an orphan key into a Zod error — --warn-locale must be able to demote it", () => {
    const root = fixture(({ zh }) => {
      writeJson(zh("collections/teachers.json"), { ping: { nickname: "小平" } });
    });
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.PARITY_EXTRA)).toBe(true);
    expect(fired(outcome, RULES.COLLECTION_SCHEMA)).toBe(false);
    expect(outcome.code).toBe(0);
  });

  it("reports a value whose JSON kind differs from the reference", () => {
    const root = fixture(
      editZh("messages/common.json", (json) => {
        (json as unknown as { nav: Record<string, unknown> }).nav.philosophy = { deep: "x" };
      }),
    );
    const outcome = gate(root);
    expect(fired(outcome, RULES.PARITY_KIND)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("reports an array of a different length", () => {
    const root = fixture(({ zh }) => {
      writeJson(zh("collections/programs.json"), { infant: { highlights: ["一", "二", "三"] } });
    });
    const outcome = gate(root);
    expect(fired(outcome, RULES.PARITY_ARRAY_LENGTH)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("reports a rich-tag set that does not match", () => {
    const root = fixture(
      editZh("messages/home.json", (json) => {
        (json as unknown as { hero: Record<string, string> }).hero.title = "小小的手学大大的本领";
      }),
    );
    const outcome = gate(root);
    expect(fired(outcome, RULES.PARITY_TAGS)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("errors on an ICU argument the reference never declares", () => {
    const root = fixture(
      editZh("messages/home.json", (json) => {
        (json as unknown as { gallery: Record<string, string> }).gallery.title =
          "{brandShortName}的{nope}";
      }),
    );
    const outcome = gate(root);
    expect(fired(outcome, RULES.ICU_UNDECLARED)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("only warns on an ICU argument the translation omits, and never fails the gate", () => {
    const root = fixture(
      editZh("messages/home.json", (json) => {
        (json as unknown as { gallery: Record<string, string> }).gallery.title = "日常";
      }),
    );
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.ICU_OMITTED)).toBe(true);
    expect(outcome.out).toContain(`warn  [${RULES.ICU_OMITTED}]`);
    expect(outcome.code).toBe(0);
    // "never a gate failure" (08 §3) is not mode-qualified: it holds at the
    // launch gate too, where `--warn-locale` is ignored outright.
    expect(gate(root, "--release").out).toContain(`warn  [${RULES.ICU_OMITTED}]`);
  });

  it("counts a key missing from both Chinese trees twice, not once", () => {
    // Three-way parity, `en` against each locale independently (INV-02.2, 08 §3).
    const root = fixture(({ root: base, zh }) => {
      cpSync(join(base, "content/en"), join(base, "content/zh-Hant"), { recursive: true });
      for (const dir of ["zh-Hans", "zh-Hant"]) {
        const file = join(base, "content", dir, "messages/common.json");
        cpSync(join(base, "content/en/messages/common.json"), file);
        const json = readJson(file) as unknown as { nav: Record<string, string> };
        delete json.nav.philosophy;
        writeJson(file, json);
      }
      // The seed files are the ones that carry translations; the rest stay as en.
      void zh;
    });
    const threeWay: LocaleConfig = {
      reference: "en",
      enabled: ["en", "zh-Hans", "zh-Hant"],
      known: ["en", "zh-Hans", "zh-Hant"],
    };
    const options: Options = {
      root,
      report: false,
      release: false,
      warnLocales: new Set(),
      acceptSamples: new Set(),
    };
    const result = validateContent(readContentTree(root, threeWay), options, threeWay);
    const hits = result.findings.filter(
      (finding) => finding.rule === RULES.PARITY_MISSING && finding.key === "common.nav.philosophy",
    );
    expect(hits.map((finding) => finding.locale).sort()).toStrictEqual(["zh-Hans", "zh-Hant"]);
  });

  it("scans a locale that is not in routing.locales in a reporting-only pass", () => {
    // Every id the project knows is enabled today, so the reporting-only pass
    // has no locale to run on and this case is stated in
    // `locale-withdrawal.test.ts` instead, where `zh-Hant` is held back. What
    // is checkable here is the premise that moved it: `run()` reads the live
    // configuration, and the live configuration has nothing held back.
    expect(LOCALES.known.filter((id) => !LOCALES.enabled.includes(id))).toStrictEqual([]);
    expect(gate(fixture(), ...PHASE_3).out).not.toContain("pending review");
  });
});

/* -------------------------------------------------------------------------- *
 * Values — INV-02.8 and INV-02.4
 * -------------------------------------------------------------------------- */

describe("values", () => {
  const editEn = (file: string, value: string) => (ctx: Ctx) => {
    const target = ctx.en(file);
    const json = readJson(target) as unknown as { nav: Record<string, string> };
    json.nav.philosophy = value;
    writeJson(target, json);
  };

  it("rejects an empty string", () => {
    const outcome = gate(fixture(editEn("messages/common.json", "   ")), ...PHASE_3);
    expect(fired(outcome, RULES.EMPTY_STRING)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("rejects the banned `'{` escape", () => {
    const root = fixture(editEn("messages/common.json", "Philosophy '{literal}'"));
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.STRAY_QUOTE_BRACE)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("rejects an HTML tag outside D-02.5's allowlist", () => {
    const root = fixture(editEn("messages/common.json", "<b>Philosophy</b>"));
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.HTML_IN_VALUE)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  // One row per tag: the allowlist is closed and five-strong, and a row that
  // exercises `<em>` alone proves nothing about the other four.
  it.each([["em"], ["strong"], ["link"], ["count"], ["day"]])(
    "accepts <%s>, one of D-02.5's five rich tags",
    (tag) => {
      const root = fixture(editEn("messages/common.json", `<${tag}>Philosophy</${tag}>`));
      expect(fired(gate(root, ...PHASE_3), RULES.HTML_IN_VALUE)).toBe(false);
    },
  );

  it.each([
    ["a URL", "See https://example.com/x"],
    ["an image path", "/images/hero.jpg"],
    ["an e-mail address", "write to hi@school.org"],
    ["an E.164 phone number", "call +1 510 555 0142 today"],
    ["a printed phone number", "call (510) 555-0142"],
    ["a licence number", "License # 123456"],
  ])("rejects %s in a locale file (INV-02.4)", (_label, value) => {
    const root = fixture(editEn("messages/common.json", value));
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.LOCALE_AGNOSTIC)).toBe(true);
    // 08 §3: `--warn-locale` never demotes INV-02.4.
    expect(outcome.code).toBe(1);
  });

  it("rejects a brand name spelt out in a locale file", () => {
    const root = fixture(editEn("messages/common.json", "The Green Pastures way"));
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.LOCALE_AGNOSTIC)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("rejects the 绿茵园 name D-02.19 retired", () => {
    const root = fixture(({ zh }) => {
      const file = zh("messages/home.json");
      const json = readJson(file) as unknown as { gallery: Record<string, string> };
      json.gallery.title = "绿茵园的日常";
      writeJson(file, json);
    });
    // The mutation is in `zh-Hans`, the locale PHASE_3 warns on: INV-02.4 is
    // one of the three things 08 §3 says `--warn-locale` may not touch.
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.LOCALE_AGNOSTIC)).toBe(true);
    expect(outcome.code).toBe(1);
  });
});

/* -------------------------------------------------------------------------- *
 * Schemas, cross-references and assets — INV-02.3
 * -------------------------------------------------------------------------- */

describe("schemas and cross-references", () => {
  it("reports a localized value with a locale entry missing", () => {
    const root = fixture(({ site }) => {
      const json = readJson(site) as unknown as { brand: { name: Record<string, string> } };
      delete json.brand.name["zh-Hans"];
      writeJson(site, json);
    });
    // INV-02.3: a localized value carries an entry for every enabled locale,
    // and a Zod finding is never demoted (08 §3).
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.SITE_SCHEMA)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("reports an id declared in site.json with no text in the reference locale", () => {
    const root = fixture(({ en }) => {
      const file = en("collections/teachers.json");
      const json = readJson(file) as unknown as Record<string, unknown>;
      delete json.chen;
      writeJson(file, json);
    });
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.COLLECTION_SCHEMA)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("reports a value a lagging locale supplies that breaks the schema", () => {
    const root = fixture(({ zh }) => {
      writeJson(zh("collections/teachers.json"), { ping: { tags: ["一", "二", "三", "四"] } });
    });
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.COLLECTION_SCHEMA)).toBe(true);
    // --warn-locale never demotes a Zod finding (08 §3).
    expect(outcome.code).toBe(1);
  });

  it("reports a photo with no alt in the reference locale", () => {
    const root = fixture(({ en }) => {
      const file = en("collections/teachers.json");
      const json = readJson(file) as unknown as { ping: Record<string, unknown> };
      delete json.ping.photoAlt;
      writeJson(file, json);
    });
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.MISSING_ALT)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("reports a gallery photo with no alt in the reference locale", () => {
    const root = fixture(({ site, en }) => {
      const site_ = readJson(site) as unknown as {
        gallery: {
          photos: { id: string; src: string; width: number; height: number; category: string }[];
        };
      };
      site_.gallery.photos.push({
        id: "g09",
        src: "/images/gallery/g09.jpg",
        width: 1200,
        height: 900,
        category: "classroom",
      });
      writeJson(site, site_);
      // Give the new photo a caption but no alt, so the record stays exhaustive
      // and MISSING_ALT is what fires.
      const file = en("collections/gallery.json");
      const json = readJson(file) as unknown as { photos: Record<string, unknown> };
      json.photos.g09 = { caption: "New" };
      writeJson(file, json);
    });
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.MISSING_ALT)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("reports a referenced asset that is not under public/", () => {
    const root = fixture(({ root: base }) => {
      mkdirSync(join(base, "public/images"), { recursive: true });
      writeFileSync(join(base, "public/images/hero.jpg"), "x");
    });
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.ASSET_MISSING)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("wakes only the directory the delivery has started in", () => {
    const root = fixture(({ root: base, site }) => {
      const json = readJson(site) as unknown as { gallery: { photos: { src: string }[] } };
      mkdirSync(join(base, "public/images/gallery"), { recursive: true });
      // Every gallery photo but the last. The directory exists, so the absent
      // one is a defect — a broken path, a renamed file — and not a delivery
      // that has simply not happened yet.
      for (const photo of json.gallery.photos.slice(0, -1)) {
        writeFileSync(join(base, `public${photo.src}`), "x");
      }
    });
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.ASSET_MISSING)).toBe(true);
    expect(outcome.out).toContain("/images/gallery/g08.jpg");
    // …and the directories nobody has delivered into are still asleep, so the
    // photographs PR-8.3 owes are not errors in the same breath.
    expect(outcome.out).not.toContain("/images/programs/infant.jpg");
    // public/images itself now exists — `mkdir -p` made it on the way to the
    // gallery — and an existing-but-unfilled parent is not a delivery either.
    expect(outcome.out).not.toContain("/images/hero.jpg");
    expect(outcome.code).toBe(1);
  });

  it("says out loud that the asset check is asleep, and names the directories", () => {
    const outcome = gate(fixture(), ...PHASE_3);
    expect(fired(outcome, RULES.ASSET_DORMANT)).toBe(true);
    expect(outcome.out).toContain("public/images/gallery");
    expect(outcome.code).toBe(0);
  });

  it("is not woken by an asset nothing in site.json references", () => {
    // PR-4.5's public/brand/logo.png did exactly this: one file in a directory
    // no reference lives in, which under the old "does public/ exist" trigger
    // red the content job over sixteen photographs four phases early.
    const root = fixture(({ root: base }) => {
      mkdirSync(join(base, "public/brand"), { recursive: true });
      writeFileSync(join(base, "public/brand/logo.png"), "x");
    });
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.ASSET_MISSING)).toBe(false);
    expect(fired(outcome, RULES.ASSET_DORMANT)).toBe(true);
    expect(outcome.code).toBe(0);
  });

  it("never sleeps under --release, whatever public/ looks like", () => {
    // The launch gate refuses the demotion the way INV-02.11 refuses
    // --warn-locale's: no public/ at all is sixteen errors, not a warning, so
    // launch cannot go green over photography that never arrived.
    const outcome = gate(fixture(), "--release");
    expect(fired(outcome, RULES.ASSET_MISSING)).toBe(true);
    expect(fired(outcome, RULES.ASSET_DORMANT)).toBe(false);
    expect(outcome.code).toBe(1);
  });

  it("refuses a top-level site.json key that would make the registry grammar ambiguous", () => {
    const root = fixture(({ site }) => {
      const json = readJson(site) as unknown as Record<string, unknown>;
      json.collections = {};
      writeJson(site, json);
    });
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.RESERVED_PREFIX)).toBe(true);
    expect(outcome.code).toBe(1);
  });
});

/* -------------------------------------------------------------------------- *
 * The provisional registry — INV-02.10, 08 §3
 * -------------------------------------------------------------------------- */

describe("the provisional registry", () => {
  const addPath = (path: string) => (ctx: Ctx) => {
    const json = readJson(ctx.site) as unknown as { provisional: string[] };
    json.provisional.push(path);
    writeJson(ctx.site, json);
  };

  it("rejects a duplicate entry", () => {
    const outcome = gate(fixture(addPath("license")), ...PHASE_3);
    expect(fired(outcome, RULES.PROVISIONAL_DUPLICATE)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("rejects a duplicate of a pending-locale entry (rule 1 outranks rule 6)", () => {
    // Rule 6 exempts the entry from *resolution*, not from uniqueness — and the
    // exemption is applied to the schema's input, so this is where hiding an
    // entry from the schema could have hidden a duplicate with it.
    const root = fixture((ctx) => {
      addPath("brand.name.zh-Hant")(ctx);
      addPath("brand.name.zh-Hant")(ctx);
    });
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.PROVISIONAL_DUPLICATE)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("rejects a path that does not match the grammar", () => {
    const outcome = gate(fixture(addPath("messages.common")), ...PHASE_3);
    expect(fired(outcome, RULES.PROVISIONAL_GRAMMAR)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("rejects a site.json path that resolves to nothing, in every mode", () => {
    const root = fixture(addPath("contact.nope"));
    for (const args of [PHASE_3, ["--release"]]) {
      const outcome = gate(root, ...args);
      expect(fired(outcome, RULES.PROVISIONAL_UNRESOLVED)).toBe(true);
      expect(outcome.code).toBe(1);
    }
  });

  it("rejects a collection path whose field is absent from the reference locale", () => {
    const root = fixture(addPath("collections.teachers.ping.nickname"));
    const outcome = gate(root, ...PHASE_3);
    expect(fired(outcome, RULES.PROVISIONAL_UNRESOLVED)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("follows the locale's parity status for a gap in a lagging locale", () => {
    // `collections.teachers.*` are in the shipped registry and untranslated.
    const root = fixture();
    expect(gate(root, ...PHASE_3).code).toBe(0);
    const strict = gate(root);
    expect(fired(strict, RULES.PROVISIONAL_UNRESOLVED_LOCALE)).toBe(true);
    expect(strict.code).toBe(1);
  });

  it("resolves the seeded zh-Hant paths like any other, now that the locale is enabled", () => {
    // Rule 6's *exemption* has nothing to exempt while the catalogue is fully
    // enabled: `brand.name.zh-Hant` is an ordinary resolved row. The exemption
    // firing — and the two cases that used to live here, one for the row and
    // one for the parsed-file checks it must not silence — moved to
    // `locale-withdrawal.test.ts`, which mocks `routing.locales` back to
    // D-10.12's two ids so the rule has a locale to hold back.
    const outcome = gate(fixture(), ...PHASE_3);
    expect(outcome.out).toContain(
      '| `brand.name.zh-Hant` | — | "優朵幼兒園" | `content/site.json` | resolved |',
    );
    expect(fired(outcome, RULES.PROVISIONAL_UNRESOLVED)).toBe(false);
    expect(fired(outcome, RULES.SITE_SCHEMA)).toBe(false);
    expect(outcome.code).toBe(0);
  });

  it("still blocks --release on the seeded zh-Hant paths (R1)", () => {
    // The shipped registry already carries both, so nothing is appended here.
    const outcome = gate(fixture(), "--release");
    expect(fired(outcome, RULES.R1_REGISTRY)).toBe(true);
    expect(outcome.out).toContain("`brand.name.zh-Hant`");
    expect(outcome.code).toBe(1);
  });

  it("prints values of any JSON type distinguishably", () => {
    const block = renderProvisionalBlock([
      { path: "yelp.rating", file: "content/site.json", value: 5, state: "resolved" },
      { path: "contact.email", file: "content/site.json", value: "a@b.com", state: "resolved" },
    ]);
    expect(block).toContain("| 5 |");
    expect(block).toContain('| "a@b.com" |');
    expect(renderProvisionalBlock([])).toContain("the registry is empty");
  });
});

/* -------------------------------------------------------------------------- *
 * --release: R1 … R4
 * -------------------------------------------------------------------------- */

describe("--release", () => {
  const emptyRegistry = (ctx: Ctx) => {
    const json = readJson(ctx.site) as unknown as { provisional: string[] };
    json.provisional = [];
    writeJson(ctx.site, json);
  };

  /** An owner-facts edit that clears R1, R3 and R4 and completes `zh-Hans`. */
  const releaseReady = (ctx: Ctx) => {
    emptyRegistry(ctx);
    const json = readJson(ctx.site) as unknown as {
      brand: { url: string };
      contact: { phone: string; phoneDisplay: string; email: string };
      email: { sendingDomain: string; fromAddress: string };
      license: string;
      yelp: { url: string };
    };
    json.brand.url = "https://greenpasturesdaycare.com";
    json.contact.phone = "+15105102142";
    json.contact.phoneDisplay = "(510) 510-2142";
    json.contact.email = "office@greenpasturesdaycare.com";
    json.email.sendingDomain = "send.greenpasturesdaycare.com";
    json.email.fromAddress = "notifications@send.greenpasturesdaycare.com";
    json.license = "412803711";
    json.yelp.url = "https://www.yelp.com/biz/green-pastures-fremont";
    writeJson(ctx.site, json);
    // A stand-in for PR-8.3's photography. The asset check does not sleep at
    // the launch gate, so a release-ready tree is one whose photographs exist.
    deliverAssets(ctx);
    // A stand-in for PR-8.1's and PR-8.8's finished translations. Derived from
    // `LOCALES.enabled`, so a release-ready tree stays release-ready whichever
    // way D-10.12 goes with `zh-Hant`.
    for (const id of LOCALES.enabled) {
      if (id === LOCALES.reference) continue;
      cpSync(join(ctx.root, "content/en"), join(ctx.root, "content", id), {
        recursive: true,
        force: true,
      });
    }
  };

  it("R1 fails while the registry is non-empty", () => {
    const outcome = gate(fixture(), "--release");
    expect(fired(outcome, RULES.R1_REGISTRY)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("R2 fails on a sentinel value", () => {
    const root = fixture(({ en }) => {
      const file = en("messages/common.json");
      const json = readJson(file) as unknown as { nav: Record<string, string> };
      json.nav.philosophy = "TBD";
      writeJson(file, json);
    });
    const outcome = gate(root, "--release");
    expect(fired(outcome, RULES.R2_SENTINEL)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("R2 fires on every word of its vocabulary in either case, and only whole words", () => {
    // The spellings are derived from the export, never typed out. Two reasons:
    // a shouted work marker written literally on this page would trip CI's
    // `check:todo` (08 §2) — the very collision the gate's lower-case
    // vocabulary resolves — and iterating means a fifth sentinel is covered the
    // day it is added, not the day someone remembers to widen this test.
    //
    // Three properties are pinned, each with its own way of failing open: the
    // `i` flag (an editor shouts the sentinel, the gate stores it lower case),
    // the `\b` either side (dropped in a rewrite, R2 starts flagging ordinary
    // prose), and the message naming the vocabulary the pattern really matches.
    const sentinel = (value: string): Outcome =>
      gate(
        fixture(({ en }) => {
          const file = en("messages/common.json");
          const json = readJson(file) as unknown as { nav: Record<string, string> };
          json.nav.philosophy = value;
          writeJson(file, json);
        }),
        "--release",
      );

    for (const word of R2_SENTINELS) {
      const shouted = word.toUpperCase();

      for (const spelling of [word.toLowerCase(), shouted]) {
        const outcome = sentinel(spelling);
        expect(fired(outcome, RULES.R2_SENTINEL), `${spelling} must fire R2`).toBe(true);
        expect(outcome.out, `R2's message must name ${shouted}`).toContain(shouted);
      }

      const embedded = sentinel(`un${word}able`);
      expect(
        fired(embedded, RULES.R2_SENTINEL),
        `un${word}able is one word, not the sentinel ${shouted}`,
      ).toBe(false);
    }
  });

  it("R3 fails on a placeholder that can never be real, even with an empty registry", () => {
    const outcome = gate(fixture(emptyRegistry), "--release");
    expect(fired(outcome, RULES.R3_UNREAL)).toBe(true);
    expect(fired(outcome, RULES.R1_REGISTRY)).toBe(false);
    expect(outcome.code).toBe(1);
  });

  it("R4 fails on a sending-identity sample, even with an empty registry", () => {
    const outcome = gate(fixture(emptyRegistry), "--release");
    expect(fired(outcome, RULES.R4_SENDING_SAMPLE)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("--accept-sample clears exactly one R4 path and nothing else", () => {
    const withSample = (ctx: Ctx) => {
      releaseReady(ctx);
      const json = readJson(ctx.site) as unknown as { contact: Record<string, string> };
      json.contact.email = "hello@greenpasturesdaycare.com";
      writeJson(ctx.site, json);
    };
    expect(fired(gate(fixture(withSample), "--release"), RULES.R4_SENDING_SAMPLE)).toBe(true);
    const accepted = gate(fixture(withSample), "--release", "--accept-sample", "contact.email");
    expect(accepted.code).toBe(0);
    expect(accepted.out).toContain("PASS");
  });

  it("--accept-sample does not silence R3 — the flag is R4-only", () => {
    const outcome = gate(fixture(emptyRegistry), "--release", "--accept-sample", "brand.url");
    expect(fired(outcome, RULES.R3_UNREAL)).toBe(true);
    expect(fired(outcome, RULES.RELEASE_FLAG_MISUSE)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("ignores --warn-locale entirely (INV-02.11)", () => {
    const outcome = gate(fixture(), "--release", "--warn-locale", "zh-Hans");
    expect(fired(outcome, RULES.PARITY_MISSING)).toBe(true);
    expect(outcome.code).toBe(1);
  });

  it("fails on one photograph that never arrived, with everything else ready", () => {
    // The launch gate's half of INV-02.3, on the tree that is otherwise green:
    // delete a single delivered file and --release is the check that notices.
    const outcome = gate(
      fixture((ctx) => {
        releaseReady(ctx);
        rmSync(join(ctx.root, "public/images/gallery/g01.jpg"));
      }),
      "--release",
    );
    expect(fired(outcome, RULES.ASSET_MISSING)).toBe(true);
    expect(outcome.out).toContain("/images/gallery/g01.jpg");
    expect(outcome.code).toBe(1);
  });

  it("passes on a release-ready tree", () => {
    const outcome = gate(fixture(releaseReady), "--release");
    expect(outcome.out).toContain("PASS");
    expect(outcome.code).toBe(0);
  });
});

/* -------------------------------------------------------------------------- *
 * The report and the CLI
 * -------------------------------------------------------------------------- */

describe("the coverage report", () => {
  it("writes a column per locale plus the provisional block (INV-02.6)", () => {
    const root = fixture();
    const outcome = gate(root, "--report", ...PHASE_3);
    expect(outcome.code).toBe(0);
    const markdown = readFileSync(join(root, "reports/content-coverage.md"), "utf8");
    // A column per *known* locale, held-back ones included (INV-02.6): the
    // report is where a reviewer reads zh-Hant's number.
    for (const id of LOCALES.known) expect(markdown).toContain(`| ${id} `);
    expect(markdown).toContain("## Provisional values");
    expect(markdown).toContain("`--warn-locale zh-Hans`");
    // The rows themselves, not the word "coverage" — which the title, the file
    // name and the mode line all contain whatever the report says.
    expect(markdown).toContain("| status | reference | enabled | enabled |");
    expect(markdown).toMatch(/\| coverage \| 100\.0 % \| \d+\.\d % \| \d+\.\d % \|/);
    expect(markdown).toContain("| path | locale | current value | file | state |");
  });

  it("lists omitted ICU arguments, orphans and accepted samples", () => {
    const markdown = renderReport({
      findings: [
        { rule: RULES.ICU_OMITTED, severity: "warning", message: "omitted", locale: "zh-Hans" },
        { rule: RULES.PARITY_EXTRA, severity: "error", message: "orphan", file: "f", key: "k" },
      ],
      coverage: [
        {
          id: "zh-Hans",
          status: "enabled",
          referenceKeys: 2,
          present: 1,
          missing: ["a.b"],
          extra: ["c.d"],
          omittedArguments: ["a.b · {brandNameOther}"],
        },
      ],
      provisional: [],
      acceptedSamples: ["contact.email"],
      options: {
        root: ".",
        report: true,
        release: true,
        warnLocales: new Set(),
        acceptSamples: new Set(["contact.email"]),
      },
      ok: false,
    });
    expect(markdown).toContain("1 orphan key(s)");
    expect(markdown).toContain("{brandNameOther}");
    expect(markdown).toContain("Accepted samples");
    expect(markdown).toContain("`--release`");
    expect(markdown).toContain("## Findings");
  });
});

describe("the command line", () => {
  it("parses every documented flag", () => {
    const options = parseArgs(
      ["--report", "--release", "--warn-locale", "zh-Hans", "--accept-sample", "contact.email"],
      REPO_ROOT,
    );
    expect(options.report).toBe(true);
    expect(options.release).toBe(true);
    expect(options.warnLocales.has("zh-Hans")).toBe(true);
    expect(options.acceptSamples.has("contact.email")).toBe(true);
    expect(options.root).toBe(REPO_ROOT);
  });

  it("takes --root", () => {
    expect(parseArgs(["--root", WORKSPACE], REPO_ROOT).root).toBe(WORKSPACE);
  });

  it.each([
    ["an unknown flag", ["--nope"]],
    ["a flag with no value", ["--warn-locale"]],
    ["a locale id that names nothing", ["--warn-locale", "zh"]],
    ["a regional variant of an enabled id", ["--warn-locale", "zh-Hant-TW"]],
    // This row used to name `zh-Hant`: a held-back locale has no parity
    // findings to demote — its pass is reporting-only (08 §3) — so the flag is
    // refused rather than accepted and silently ignored. PR-3.9 put `zh-Hant`
    // in `routing.locales`, which turned that invocation into the valid one CI
    // now passes (see PHASE_3 above and `--warn-locale` in the `content` job).
    // The refusal itself is what the two ids above still state, and the
    // held-back case returns verbatim if D-10.12 withdraws the locale.
    ["--accept-sample outside --release", ["--accept-sample", "contact.email"]],
  ])("exits 2 with usage on %s", (_label, args) => {
    const outcome = gate(REPO_ROOT, ...args);
    expect(outcome.code).toBe(2);
    expect(outcome.out).toContain("pnpm validate:content");
  });
});

/* -------------------------------------------------------------------------- *
 * The ICU reader — the piece a regex cannot do
 * -------------------------------------------------------------------------- */

describe("readIcu", () => {
  it("takes the argument of a plural and not its category labels", () => {
    const shape = readIcu(
      "<count>{count, number}</count> {count, plural, one {review} other {reviews}}",
    );
    expect([...shape.args]).toStrictEqual(["count"]);
    expect([...shape.tags]).toStrictEqual(["count"]);
  });

  it("skips a format style", () => {
    expect([...readIcu("{rating, number, rating} on Yelp").args]).toStrictEqual(["rating"]);
  });

  it("reads nested arguments inside plural options", () => {
    const shape = readIcu("{n, plural, one {# {thing}} other {# {things}}}");
    expect([...shape.args].sort()).toStrictEqual(["n", "thing", "things"]);
  });

  it("handles select and nested selects", () => {
    expect(
      [...readIcu("{g, select, f {{name} she} other {{name} they}}").args].sort(),
    ).toStrictEqual(["g", "name"]);
  });

  it("flags the banned `'{` escape and treats the quoted run as literal", () => {
    const shape = readIcu("a '{notAnArg}' b {real}");
    expect(shape.strayQuoteBrace).toBe(true);
    expect([...shape.args]).toStrictEqual(["real"]);
  });

  it("treats '' as a literal apostrophe", () => {
    expect([...readIcu("it''s {here}").args]).toStrictEqual(["here"]);
  });

  it("separates allowed rich tags from HTML", () => {
    const shape = readIcu("<em>a</em> <b class='x'>b</b> <img/>");
    expect([...shape.tags]).toStrictEqual(["em"]);
    expect(shape.htmlTokens).toStrictEqual(["<b class='x'>", "</b>", "<img/>"]);
  });

  it("leaves a bare less-than alone", () => {
    expect(readIcu("2 < 3 and 4 > 1").htmlTokens).toHaveLength(0);
  });
});

describe("path and tree helpers", () => {
  it("resolves array indices and reports an absent segment", () => {
    const root = { a: [{ b: "x" }] };
    expect(resolveDotted(root, "a.0.b")).toBe("x");
    expect(resolveDotted(root, "a.1.b")).toBeUndefined();
    expect(resolveDotted(root, "a.nope")).toBeUndefined();
    expect(resolveDotted(root, "z")).toBeUndefined();
  });

  it("flattens leaves, kinds and array lengths", () => {
    const flat = flatten({ a: { b: "x", c: [1, 2] }, d: null, e: true });
    expect([...flat.leaves.keys()].sort()).toStrictEqual(["a.b", "a.c.0", "a.c.1", "d", "e"]);
    expect(flat.arrays.get("a.c")).toBe(2);
    expect(flat.kinds.get("a")).toBe("object");
    expect(flat.kinds.get("d")).toBe("null");
    expect(flat.kinds.get("e")).toBe("boolean");
  });

  it("reports a content root that has no site.json", () => {
    const root = join(WORKSPACE, "bare");
    mkdirSync(join(root, "content"), { recursive: true });
    const tree = readContentTree(root);
    expect(tree.unreadable.map((entry) => entry.file)).toContain("content/site.json");
    expect(tree.assets).toBeUndefined();
    expect(tree.assetDirs).toBeUndefined();
    expect(gate(root).code).toBe(1);
  });
});
