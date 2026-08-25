import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, posix, relative, resolve, sep } from "node:path";
import process from "node:process";

import { z } from "zod";

import { faqCollectionSchema } from "@/content/schemas/faq";
import { galleryCollectionSchema } from "@/content/schemas/gallery";
import { menuCollectionSchema } from "@/content/schemas/menu";
import { programsCollectionSchema } from "@/content/schemas/programs";
import { SiteSchema, type Site } from "@/content/schemas/site";
import { teachersCollectionSchema } from "@/content/schemas/teachers";
import { testimonialsCollectionSchema } from "@/content/schemas/testimonials";
import { LOCALE_IDS, routing } from "@/i18n/routing";

/**
 * `pnpm validate:content` — the content gate (02 *Loading, typing, validation*
 * and INV-02.2 … INV-02.11; 08 §3, D-08.17).
 *
 * This file is the machine half of the content contract. Everything 02 states
 * as an invariant is a named rule below, every rule produces a {@link Finding}
 * with a severity, and the process exits non-zero if any finding is an error.
 * No Next.js runtime is involved: the tree is read from disk, the Zod schemas
 * come from `src/content/schemas/**`, and the enabled locales come from
 * `src/i18n/routing.ts` — never from a literal list here (INV-08.4).
 *
 * ## Modes
 *
 * | Invocation | What it is for |
 * |---|---|
 * | `validate:content` | the PR gate: parity, values, schemas, cross-refs, the provisional registry *resolved and reported* |
 * | `--report` | additionally writes `reports/content-coverage.md` (INV-02.6) |
 * | `--warn-locale <id>` | demotes that locale's **parity** findings to warnings while its tree is filled in (08 §3, HD-12) |
 * | `--release` | the launch gate: ignores `--warn-locale` (INV-02.11) and adds R1–R4 (08 §3, D-08.17) |
 * | `--accept-sample <path>` | `--release`-only, repeatable, R4-only: one path a human has confirmed is real |
 * | `--root <dir>` | the tree to validate — `<dir>/content`, `<dir>/public`, `<dir>/reports`. Defaults to the repo root; the validator's own fixture tests point it at a temporary tree |
 *
 * ## Three places this file interprets a rule, all deliberate
 *
 * 1. **Per-locale resolution of a `provisional` path follows the locale's own
 *    parity status.** 08 §3 rule 4 makes an unresolvable path "an error in
 *    every mode"; its stated purpose is to stop "a deleted value from leaving a
 *    stale marker and a mistyped path from silently disabling the gate". Both
 *    of those are properties of the *reference* locale, and that is where this
 *    file makes resolution unconditional. A path that resolves in `en` but not
 *    in a lagging locale is not a stale marker — it is an untranslated field,
 *    which is exactly what `--warn-locale` exists to demote, and 08 §3 rule 6
 *    already carves the analogous exception for a pending locale. Without this
 *    the six `collections.teachers.*` entries 02 ships would red the `content`
 *    job for the whole of Phase 3, when `content/zh-Hans/collections/` is `{}`.
 * 2. **The asset-existence check sleeps per directory, and never under
 *    `--release`.** PR-8.3 delivers the photography, so in PR mode a referenced
 *    file is exempt while **nothing has been delivered into the directory it
 *    belongs in** — reported as one loud warning naming the rule that is asleep
 *    and every directory it is waiting on, not as silence and not as an error
 *    over a folder nobody has filled. Every other reference is checked as
 *    written and `asset-missing` is an error. `--release` is the launch gate
 *    and refuses the demotion the way INV-02.11 refuses `--warn-locale`'s: at
 *    release there is no dormancy at all and every referenced file must exist.
 *    The unit suite pins both halves so the rule cannot rot into the vacuous
 *    gate this project has shipped once already.
 *
 *    The trigger used to be "does `public/` exist", and PR-4.5's
 *    `public/brand/logo.png` — then one file nothing in `site.json` referenced —
 *    woke the whole Phase 8 check four phases early and red the `content` job
 *    over sixteen photographs the owner has said arrive later. "A file has
 *    landed in the folder this one belongs in" is the narrowest fact on disk
 *    that means *this* delivery has started: an unrelated asset cannot flip it,
 *    and neither can the empty parent directory `mkdir -p` leaves behind on its
 *    way to a subdirectory ({@link ContentTree.assetDirs}).
 *
 *    `images.logo` now declares that file, so `public/brand/` is a delivered
 *    directory and the logo *is* checked — which is the point: this gate cannot
 *    see a `public/` asset nothing references, and the logo went missing for a
 *    day once with nothing to catch it. The per-directory trigger is what keeps
 *    that from waking `public/images/` with it.
 * 3. **08 §3 rule 6 is applied to `SiteSchema`'s input.** `SiteSchema` enforces
 *    INV-02.10 for the loader as well and has no notion of a held-back locale,
 *    so it reads `brand.name.zh-Hant` as a stale marker. Left alone it would
 *    reinstate — as a `site-schema` finding — the very error rule 6 removes, and
 *    a failed parse would take the asset, collection-schema and alt-text checks
 *    with it. Pending-locale entries are therefore withheld from the copy this
 *    file parses ({@link siteForSchema}); rules 1–5 still run over the raw list.
 *    The loader itself is not fixed by this — `src/content/schemas/site.ts` owns
 *    that half, and until it carries rule 6 the same entry reds `next build`.
 */

/* -------------------------------------------------------------------------- *
 * Rules
 * -------------------------------------------------------------------------- */

/**
 * Every rule this file can report, with the invariant it enforces. The ids are
 * printed with each finding and are what the fixture tests assert on, so a rule
 * that is renamed breaks its own test rather than going quiet.
 */
export const RULES = {
  JSON_UNREADABLE: "json-unreadable",
  FILE_MISSING: "file-missing",
  FILE_ORPHAN: "file-orphan",
  KEY_SHAPE: "key-shape",
  KEY_DEPTH: "key-depth",
  PARITY_MISSING: "parity-missing-key",
  PARITY_EXTRA: "parity-extra-key",
  PARITY_KIND: "parity-kind",
  PARITY_ARRAY_LENGTH: "parity-array-length",
  PARITY_TAGS: "parity-rich-tags",
  ICU_UNDECLARED: "icu-argument-undeclared",
  ICU_OMITTED: "icu-argument-omitted",
  EMPTY_STRING: "empty-string",
  STRAY_QUOTE_BRACE: "stray-quote-brace",
  HTML_IN_VALUE: "html-in-value",
  LOCALE_AGNOSTIC: "locale-agnostic-value",
  SITE_SCHEMA: "site-schema",
  COLLECTION_SCHEMA: "collection-schema",
  RESERVED_PREFIX: "reserved-top-level-key",
  ASSET_MISSING: "asset-missing",
  ASSET_DORMANT: "asset-check-dormant",
  MISSING_ALT: "missing-alt",
  PROVISIONAL_DUPLICATE: "provisional-duplicate",
  PROVISIONAL_GRAMMAR: "provisional-grammar",
  PROVISIONAL_UNRESOLVED: "provisional-unresolved",
  PROVISIONAL_UNRESOLVED_LOCALE: "provisional-unresolved-in-locale",
  R1_REGISTRY: "release-r1-registry-non-empty",
  R2_SENTINEL: "release-r2-sentinel-value",
  R3_UNREAL: "release-r3-unreal-placeholder",
  R4_SENDING_SAMPLE: "release-r4-sending-identity-sample",
  RELEASE_FLAG_MISUSE: "release-flag-misuse",
} as const;

export type RuleId = (typeof RULES)[keyof typeof RULES];

export type Severity = "error" | "warning";

export type Finding = {
  readonly rule: RuleId;
  readonly severity: Severity;
  readonly message: string;
  readonly locale?: string;
  readonly file?: string;
  readonly key?: string;
};

/* -------------------------------------------------------------------------- *
 * The tree, as data
 * -------------------------------------------------------------------------- */

/** One locale's two namespace groups, each `namespace -> parsed JSON`. */
export type LocaleTree = {
  readonly messages: ReadonlyMap<string, unknown>;
  readonly collections: ReadonlyMap<string, unknown>;
  /** `namespace -> repo-relative file path`, for both groups, keyed as flattened. */
  readonly files: ReadonlyMap<string, string>;
};

export type ContentTree = {
  /** `content/site.json`, parsed but not yet validated. */
  readonly site: unknown;
  readonly siteFile: string;
  /** Locale id → its tree. Only directories whose name is a known locale id. */
  readonly locales: ReadonlyMap<string, LocaleTree>;
  /**
   * Every file under `public/`, rooted the way an `AssetPath` is written
   * (`/images/hero.jpg`), or `undefined` when `public/` does not exist at all.
   */
  readonly assets: ReadonlySet<string> | undefined;
  /**
   * Every directory under `public/` that **holds at least one file**, rooted
   * the same way (`/images`, `/images/gallery`, and `/` for files sitting
   * directly in `public/`) — what the asset check reads to decide whether a
   * given file's delivery has started. A directory that exists only as the
   * parent of another is not in here: `mkdir -p public/images/gallery` makes
   * `public/images` on the way past, and that is not a delivery. `undefined`
   * exactly when {@link ContentTree.assets} is.
   */
  readonly assetDirs: ReadonlySet<string> | undefined;
  /** Files that exist but are not readable JSON. */
  readonly unreadable: readonly { readonly file: string; readonly message: string }[];
};

/** Which locales are enabled, and which ids the project knows about at all. */
export type LocaleConfig = {
  readonly reference: string;
  readonly enabled: readonly string[];
  readonly known: readonly string[];
};

/** The project's real locale configuration — `src/i18n/routing.ts`, never a literal. */
export const LOCALES: LocaleConfig = {
  reference: routing.defaultLocale,
  enabled: [...routing.locales],
  known: [...LOCALE_IDS],
};

export type Options = {
  readonly root: string;
  readonly report: boolean;
  readonly release: boolean;
  readonly warnLocales: ReadonlySet<string>;
  readonly acceptSamples: ReadonlySet<string>;
};

/* -------------------------------------------------------------------------- *
 * Small JSON helpers
 * -------------------------------------------------------------------------- */

type JsonKind = "object" | "array" | "string" | "number" | "boolean" | "null";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function kindOf(value: unknown): JsonKind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  return "boolean";
}

/** Every node of a JSON tree, addressed by its dotted path. */
type Flat = {
  readonly kinds: Map<string, JsonKind>;
  /** Scalar leaves only — the key set parity compares. */
  readonly leaves: Map<string, unknown>;
  readonly arrays: Map<string, number>;
};

function emptyFlat(): Flat {
  return { kinds: new Map(), leaves: new Map(), arrays: new Map() };
}

function flattenInto(value: unknown, prefix: string, flat: Flat): void {
  if (prefix !== "") flat.kinds.set(prefix, kindOf(value));
  if (Array.isArray(value)) {
    flat.arrays.set(prefix, value.length);
    value.forEach((entry, index) => {
      flattenInto(entry, `${prefix}.${String(index)}`, flat);
    });
    return;
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      flattenInto(entry, prefix === "" ? key : `${prefix}.${key}`, flat);
    }
    return;
  }
  if (prefix !== "") flat.leaves.set(prefix, value);
}

export function flatten(value: unknown): Flat {
  const flat = emptyFlat();
  flattenInto(value, "", flat);
  return flat;
}

/** Walk a dotted path into parsed JSON; `undefined` when any segment is absent. */
export function resolveDotted(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const segment of path.split(".")) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
      continue;
    }
    if (!isRecord(current) || !Object.hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}

/**
 * Deep-merge `override` over `base`, keeping **only** the keys `base` declares.
 *
 * This is `src/content/collections.ts`'s `mergeWithGaps` with the orphan branch
 * removed: extra keys are a parity finding, and `--warn-locale` is allowed to
 * demote them, so they must not reach the Zod parse where nothing may demote
 * them (08 §3: `--warn-locale` "never the Zod checks"). What the merged tree
 * proves is that every value the locale *does* supply is schema-valid.
 */
function mergeOverReference(base: unknown, override: unknown): unknown {
  // A namespace the locale has not started is `undefined`, not `{}`; it keeps
  // the reference value so the parse sees a complete tree either way.
  if (override === undefined) return base;
  if (!isRecord(base) || !isRecord(override)) return override;
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    merged[key] = Object.hasOwn(override, key) ? mergeOverReference(value, override[key]) : value;
  }
  return merged;
}

/* -------------------------------------------------------------------------- *
 * ICU messages: arguments, rich tags, and the `'{` escape 02 bans
 * -------------------------------------------------------------------------- */

/** Anything tag-shaped, the same token `src/content/schemas/primitives.ts` uses. */
const TAG_TOKEN = /<\/?[A-Za-z][^>]*>/g;

/** 02 `D-02.5`'s closed allowlist, as the exact tokens a value may contain. */
const ALLOWED_TAG_TOKEN = /^<\/?(?:em|strong|link|count|day)>$/;

const PLURAL_TYPES = new Set(["plural", "select", "selectordinal"]);

export type IcuShape = {
  /** ICU argument names, `{count, plural, …}` counted once and its options not at all. */
  readonly args: ReadonlySet<string>;
  /** Rich-tag names, `<em>` and `</em>` both contributing `em`. */
  readonly tags: ReadonlySet<string>;
  /** The literal two-character sequence `'{` — INV-02.8's banned escape. */
  readonly strayQuoteBrace: boolean;
  /** Tag-shaped tokens outside 02 `D-02.5`'s allowlist. */
  readonly htmlTokens: readonly string[];
};

/**
 * A minimal ICU MessageFormat reader.
 *
 * A regex cannot do this job: `{count, plural, one {review} other {reviews}}`
 * would hand back `review` and `reviews` as arguments, and a translation that
 * legitimately spells its plural categories differently would then look like an
 * argument mismatch on every key with a plural in it. So this walks the string:
 * it takes the name of each argument, recurses into plural/select options
 * without counting their selectors, and skips a format style whole.
 */
export function readIcu(message: string): IcuShape {
  const args = new Set<string>();
  let strayQuoteBrace = false;
  let position = 0;

  const skipQuoted = (): void => {
    // ICU apostrophe rules: `''` is a literal apostrophe; `'` before one of
    // `{}<#` opens a quoted literal that runs to the next lone `'`.
    if (message[position + 1] === "'") {
      position += 2;
      return;
    }
    const next = message[position + 1];
    if (next !== undefined && "{}<#".includes(next)) {
      if (next === "{") strayQuoteBrace = true;
      const close = message.indexOf("'", position + 2);
      position = close === -1 ? message.length : close + 1;
      return;
    }
    position += 1;
  };

  const skipBalanced = (): void => {
    let depth = 1;
    while (position < message.length && depth > 0) {
      const char = message[position];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      position += 1;
    }
  };

  const readArgument = (): void => {
    position += 1; // past `{`
    while (position < message.length && /\s/.test(message[position] ?? "")) position += 1;
    const nameStart = position;
    while (position < message.length && !",}".includes(message[position] ?? "")) position += 1;
    const name = message.slice(nameStart, position).trim();
    if (name !== "") args.add(name);

    if (message[position] === "}") {
      position += 1;
      return;
    }
    position += 1; // past the first `,`
    const typeStart = position;
    while (position < message.length && !",}".includes(message[position] ?? "")) position += 1;
    const type = message.slice(typeStart, position).trim();

    if (message[position] === "}") {
      position += 1;
      return;
    }
    position += 1; // past the second `,`

    if (!PLURAL_TYPES.has(type)) {
      // A format style — `{rating, number, rating}`. Braces inside a style are
      // balanced, so stepping to the matching `}` is enough.
      skipBalanced();
      return;
    }

    // `one {…} other {…}` — selectors are literals, sub-messages are messages.
    for (;;) {
      while (position < message.length && /\s/.test(message[position] ?? "")) position += 1;
      if (position >= message.length || message[position] === "}") {
        position += 1;
        return;
      }
      while (
        position < message.length &&
        message[position] !== "{" &&
        !/\s/.test(message[position] ?? "")
      ) {
        position += 1;
      }
      while (position < message.length && /\s/.test(message[position] ?? "")) position += 1;
      if (message[position] !== "{") continue;
      position += 1;
      walk(1);
    }
  };

  function walk(depth: number): void {
    while (position < message.length) {
      const char = message[position];
      if (char === "'") {
        skipQuoted();
        continue;
      }
      if (char === "{") {
        readArgument();
        continue;
      }
      if (char === "}") {
        position += 1;
        if (depth > 0) return;
        continue;
      }
      position += 1;
    }
  }

  walk(0);

  const tags = new Set<string>();
  const htmlTokens: string[] = [];
  for (const token of message.match(TAG_TOKEN) ?? []) {
    if (ALLOWED_TAG_TOKEN.test(token)) {
      tags.add(token.replace(/[</>]/g, ""));
    } else {
      htmlTokens.push(token);
    }
  }

  return { args, tags, strayQuoteBrace, htmlTokens };
}

/* -------------------------------------------------------------------------- *
 * INV-02.4 — no locale-agnostic data in locale files
 * -------------------------------------------------------------------------- */

/**
 * The fixed half of INV-02.4's pattern set. The brand names are added at run
 * time from `site.json` so that renaming the daycare cannot leave the scan
 * matching a name nobody uses any more (02 *Brand names*, HD-6).
 */
const DATA_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ["a URL", /\bhttps?:\/\/\S/i],
  ["a URL", /\bwww\.[a-z0-9-]+\.[a-z]{2,}/i],
  ["an image path", /\/images\//],
  ["an e-mail address", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ["a phone number", /\+\d[\d\s().-]{7,}\d/],
  ["a phone number", /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/],
  ["a licence number", /\blicen[cs]e\s*(?:number|no\.?|#)?\s*[:#]?\s*\d{4,}/i],
];

/** 02 `D-02.19`: the rejected Chinese name may never come back via a translation. */
const REJECTED_BRAND_NAME = "绿茵园";

function brandLiterals(site: unknown): readonly string[] {
  const literals = new Set<string>([REJECTED_BRAND_NAME]);
  for (const field of ["name", "shortName"]) {
    const value = resolveDotted(site, `brand.${field}`);
    if (!isRecord(value)) continue;
    for (const entry of Object.values(value)) {
      if (typeof entry === "string" && entry.trim() !== "") literals.add(entry.trim());
    }
  }
  return [...literals];
}

/* -------------------------------------------------------------------------- *
 * 08 §3 — the four release rules
 * -------------------------------------------------------------------------- */

/**
 * R2: a sentinel that is a *value*. Keys and raw file text are 08 §2's grep.
 *
 * The vocabulary is listed once here and both the pattern and the message the
 * editor reads are derived from it, so a fifth sentinel cannot be added to one
 * and forgotten in the other.
 *
 * It is spelt **lower case on purpose**, and that is not cosmetic. CI's
 * `check:todo` step (08 §2) greps tracked source under `src/`, `tests/` and
 * `scripts/` for work markers, which are written shouted — and `git grep` is
 * case-sensitive unless asked otherwise. Lower case is therefore how the file
 * that *implements* R2 gets to name what R2 looks for without the sibling gate
 * having to look away: no pathspec exclusion for this file, no allowlist, no
 * pattern glued together out of fragments, and a genuine work marker written
 * on any of these 1,700 lines still fails the PR exactly as it would anywhere
 * else in the tree. That holds for the prose in these comments too, which is
 * why none of them shouts a marker either.
 *
 * Do not "tidy" the spelling to upper case. It reds `static` and buys nothing:
 * the pattern below is built with `i`, so the case written here has never been
 * part of what R2 matches.
 */
export const R2_SENTINELS: readonly string[] = ["todo", "tbd", "fixme", "xxx"];

/** Case-insensitive by construction: `TBD`, `TbD` and `tbd` all match. */
const R2_SENTINEL = new RegExp(String.raw`\b(${R2_SENTINELS.join("|")})\b`, "i");

/** The vocabulary as the editor should read it back — shouted, slash-joined. */
const R2_SENTINEL_LABEL = R2_SENTINELS.map((word) => word.toUpperCase()).join("/");

/** R3: the placeholders that can never be real. */
const R3_PATTERNS: readonly RegExp[] = [
  /[a-z0-9-]+\.example\b/i,
  /\+1\d{3}55501\d{2}\b/,
  /\b555-01\d{2}\b/,
];

/** R3's one path-specific clause: the design mock's licence number. */
const R3_LICENSE = "000000000";

/**
 * R4: the three ADJ-24 sending-identity samples, matched as **exact strings**
 * (trimmed, ASCII-case-insensitive). No pattern over the domain — that would
 * flag the real inbox the day it is typed (08 §3).
 */
export const R4_LITERALS: readonly string[] = [
  "mail.greenpasturesdaycare.com",
  "no-reply@mail.greenpasturesdaycare.com",
  "hello@greenpasturesdaycare.com",
];

/** The three paths R4 guards — the ones 02's *Provisional values* table ships. */
export const R4_PATHS: readonly string[] = [
  "email.sendingDomain",
  "email.fromAddress",
  "contact.email",
];

function isR4Literal(value: string): boolean {
  const normalised = value.trim().toLowerCase();
  return R4_LITERALS.some((literal) => literal.toLowerCase() === normalised);
}

/* -------------------------------------------------------------------------- *
 * Reading the tree from disk
 * -------------------------------------------------------------------------- */

function readJson(
  file: string,
  relPath: string,
  unreadable: { file: string; message: string }[],
): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    unreadable.push({ file: relPath, message: error instanceof Error ? error.message : "unknown" });
    return undefined;
  }
}

function listJson(dir: string): readonly string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
}

function walkAssets(dir: string, prefix: string, files: Set<string>, dirs: Set<string>): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkAssets(full, `${prefix}/${entry}`, files, dirs);
      continue;
    }
    files.add(`${prefix}/${entry}`);
    dirs.add(prefix === "" ? "/" : prefix);
  }
}

/** Read `<root>/content` and `<root>/public` into the in-memory {@link ContentTree}. */
export function readContentTree(root: string, config: LocaleConfig = LOCALES): ContentTree {
  const contentDir = join(root, "content");
  const unreadable: { file: string; message: string }[] = [];
  const rel = (file: string) => relative(root, file).split(sep).join(posix.sep);

  const siteFile = join(contentDir, "site.json");
  const site = existsSync(siteFile) ? readJson(siteFile, rel(siteFile), unreadable) : undefined;
  if (site === undefined && !existsSync(siteFile)) {
    unreadable.push({ file: rel(siteFile), message: "the file does not exist" });
  }

  const locales = new Map<string, LocaleTree>();
  for (const id of config.known) {
    const localeDir = join(contentDir, id);
    if (!existsSync(localeDir)) continue;
    const messages = new Map<string, unknown>();
    const collections = new Map<string, unknown>();
    const files = new Map<string, string>();
    for (const [group, target] of [
      ["messages", messages],
      ["collections", collections],
    ] as const) {
      const groupDir = join(localeDir, group);
      for (const name of listJson(groupDir)) {
        const namespace = basename(name, ".json");
        const file = join(groupDir, name);
        target.set(namespace, readJson(file, rel(file), unreadable));
        files.set(group === "messages" ? namespace : `collections.${namespace}`, rel(file));
      }
    }
    locales.set(id, { messages, collections, files });
  }

  const publicDir = join(root, "public");
  let assets: Set<string> | undefined;
  let assetDirs: Set<string> | undefined;
  if (existsSync(publicDir)) {
    assets = new Set<string>();
    assetDirs = new Set<string>();
    walkAssets(publicDir, "", assets, assetDirs);
  }

  return { site, siteFile: rel(siteFile), locales, assets, assetDirs, unreadable };
}

/* -------------------------------------------------------------------------- *
 * Per-locale views
 * -------------------------------------------------------------------------- */

type LocaleView = {
  readonly id: string;
  readonly tree: LocaleTree;
  /** The whole locale as one object, shaped like `src/i18n/messages.ts`'s `reference`. */
  readonly root: Record<string, unknown>;
  readonly flat: Flat;
};

function buildView(id: string, tree: LocaleTree): LocaleView {
  const collections: Record<string, unknown> = {};
  for (const [namespace, value] of tree.collections) collections[namespace] = value;
  const root: Record<string, unknown> = {};
  for (const [namespace, value] of tree.messages) root[namespace] = value;
  root.collections = collections;
  return { id, tree, root, flat: flatten(root) };
}

/** Which file a full key lives in — `collections.teachers.ping.name` → its file. */
function fileForKey(view: LocaleView, key: string): string | undefined {
  const segments = key.split(".");
  const namespace =
    segments[0] === "collections" ? `collections.${String(segments[1])}` : String(segments[0]);
  return view.tree.files.get(namespace);
}

/* -------------------------------------------------------------------------- *
 * The result
 * -------------------------------------------------------------------------- */

export type LocaleCoverage = {
  readonly id: string;
  readonly status: "reference" | "enabled" | "pending review" | "no tree";
  readonly referenceKeys: number;
  readonly present: number;
  readonly missing: readonly string[];
  readonly extra: readonly string[];
  /** Arguments `en` declares that this locale omits — a warning, never a gate failure. */
  readonly omittedArguments: readonly string[];
};

export type ProvisionalRow = {
  readonly path: string;
  readonly locale?: string;
  readonly file: string;
  readonly value: unknown;
  readonly state: "resolved" | "unresolved" | "pending locale";
};

export type ValidationResult = {
  readonly findings: readonly Finding[];
  readonly coverage: readonly LocaleCoverage[];
  readonly provisional: readonly ProvisionalRow[];
  readonly acceptedSamples: readonly string[];
  readonly options: Options;
  readonly ok: boolean;
};

/* -------------------------------------------------------------------------- *
 * The checks
 * -------------------------------------------------------------------------- */

const KEY_SEGMENT = /^[a-z][A-Za-z0-9]*$/;
const MAX_KEY_DEPTH = 6;

class Report {
  readonly findings: Finding[] = [];

  add(finding: Finding): void {
    this.findings.push(finding);
  }

  /**
   * A **parity** finding — the only class `--warn-locale` may demote (08 §3),
   * and `--release` never demotes at all (INV-02.11).
   */
  parity(demoted: boolean, finding: Omit<Finding, "severity">): void {
    this.findings.push({ ...finding, severity: demoted ? "warning" : "error" });
  }
}

function checkKeyShape(report: Report, view: LocaleView): void {
  for (const key of view.flat.leaves.keys()) {
    const segments = key.split(".");
    if (segments.length > MAX_KEY_DEPTH) {
      report.add({
        rule: RULES.KEY_DEPTH,
        severity: "error",
        locale: view.id,
        file: fileForKey(view, key),
        key,
        message: `Key is ${String(segments.length)} segments deep; 02 *Key naming* rule 2 allows at most ${String(MAX_KEY_DEPTH)}.`,
      });
    }
    for (const segment of segments) {
      if (/^\d+$/.test(segment)) continue; // an array index, not a key
      if (KEY_SEGMENT.test(segment)) continue;
      report.add({
        rule: RULES.KEY_SHAPE,
        severity: "error",
        locale: view.id,
        file: fileForKey(view, key),
        key,
        message: `Key segment "${segment}" is not camelCase (02 *Key naming* rule 2).`,
      });
    }
  }
}

function checkValues(report: Report, view: LocaleView, brands: readonly string[]): void {
  for (const [key, value] of view.flat.leaves) {
    if (typeof value !== "string") continue;
    const file = fileForKey(view, key);
    if (value.trim() === "") {
      report.add({
        rule: RULES.EMPTY_STRING,
        severity: "error",
        locale: view.id,
        file,
        key,
        message:
          "Empty (or whitespace-only) values are invalid everywhere — delete the key instead (INV-02.8, D-02.8).",
      });
      continue;
    }
    const icu = readIcu(value);
    if (icu.strayQuoteBrace) {
      report.add({
        rule: RULES.STRAY_QUOTE_BRACE,
        severity: "error",
        locale: view.id,
        file,
        key,
        message: "The ICU escape `'{` is banned in content values (INV-02.8).",
      });
    }
    for (const token of icu.htmlTokens) {
      report.add({
        rule: RULES.HTML_IN_VALUE,
        severity: "error",
        locale: view.id,
        file,
        key,
        message: `${token} is not one of 02 D-02.5's rich tags <em> <strong> <link> <count> <day> (INV-02.8).`,
      });
    }
    for (const [what, pattern] of DATA_PATTERNS) {
      if (!pattern.test(value)) continue;
      report.add({
        rule: RULES.LOCALE_AGNOSTIC,
        severity: "error",
        locale: view.id,
        file,
        key,
        message: `Value contains ${what}; locale-agnostic data lives in content/site.json and reaches copy as an ICU argument (INV-02.4, D-02.3).`,
      });
    }
    for (const brand of brands) {
      if (!value.includes(brand)) continue;
      report.add({
        rule: RULES.LOCALE_AGNOSTIC,
        severity: "error",
        locale: view.id,
        file,
        key,
        message: `Value spells the brand name "${brand}" out; use {brandName} / {brandShortName} so renaming the daycare is one line in site.json (INV-02.4, D-02.19).`,
      });
    }
  }
}

type ParityOutcome = {
  readonly missing: string[];
  readonly extra: string[];
  readonly omittedArguments: string[];
};

/**
 * INV-02.2, three-way and independent: `en` against each other locale on its
 * own, so a key missing from both Chinese trees is two findings, not one.
 */
function checkParity(
  report: Report,
  reference: LocaleView,
  view: LocaleView,
  demoted: boolean,
  emit: boolean,
): ParityOutcome {
  const missing: string[] = [];
  const extra: string[] = [];
  const omittedArguments: string[] = [];
  const file = (key: string) => fileForKey(view, key) ?? fileForKey(reference, key);

  for (const [namespace, referenceFile] of reference.tree.files) {
    if (view.tree.files.has(namespace)) continue;
    if (emit) {
      report.parity(demoted, {
        rule: RULES.FILE_MISSING,
        locale: view.id,
        file: referenceFile,
        message: `Namespace "${namespace}" has no file in ${view.id}. An empty {} file is how a namespace is present-but-untranslated; a missing file throws at load (02 *Fallback*).`,
      });
    }
  }
  for (const [namespace, localeFile] of view.tree.files) {
    if (reference.tree.files.has(namespace)) continue;
    if (emit) {
      report.add({
        rule: RULES.FILE_ORPHAN,
        severity: "error",
        locale: view.id,
        file: localeFile,
        message: `Namespace "${namespace}" exists in ${view.id} but not in the reference locale — an orphan file.`,
      });
    }
  }

  for (const key of reference.flat.leaves.keys()) {
    if (view.flat.leaves.has(key)) continue;
    missing.push(key);
    if (emit) {
      report.parity(demoted, {
        rule: RULES.PARITY_MISSING,
        locale: view.id,
        file: file(key),
        key,
        message: `Key is in ${reference.id} and missing from ${view.id} (INV-02.2).`,
      });
    }
  }

  for (const key of view.flat.leaves.keys()) {
    if (reference.flat.leaves.has(key)) continue;
    extra.push(key);
    if (emit) {
      report.parity(demoted, {
        rule: RULES.PARITY_EXTRA,
        locale: view.id,
        file: file(key),
        key,
        message: `Key is in ${view.id} and not in ${reference.id} — an orphan (INV-02.2).`,
      });
    }
  }

  for (const [path, referenceKind] of reference.flat.kinds) {
    const localeKind = view.flat.kinds.get(path);
    if (localeKind === undefined || localeKind === referenceKind) continue;
    if (emit) {
      report.parity(demoted, {
        rule: RULES.PARITY_KIND,
        locale: view.id,
        file: file(path),
        key: path,
        message: `Value is ${referenceKind} in ${reference.id} and ${localeKind} in ${view.id} (INV-02.2).`,
      });
    }
  }

  for (const [path, length] of reference.flat.arrays) {
    if (path === "") continue;
    const localeLength = view.flat.arrays.get(path);
    if (localeLength === undefined || localeLength === length) continue;
    if (emit) {
      report.parity(demoted, {
        rule: RULES.PARITY_ARRAY_LENGTH,
        locale: view.id,
        file: file(path),
        key: path,
        message: `Array has ${String(length)} entries in ${reference.id} and ${String(localeLength)} in ${view.id} (INV-02.2).`,
      });
    }
  }

  for (const [key, referenceValue] of reference.flat.leaves) {
    const localeValue = view.flat.leaves.get(key);
    if (typeof referenceValue !== "string" || typeof localeValue !== "string") continue;
    const referenceIcu = readIcu(referenceValue);
    const localeIcu = readIcu(localeValue);

    const missingTags = [...referenceIcu.tags].filter((tag) => !localeIcu.tags.has(tag));
    const extraTags = [...localeIcu.tags].filter((tag) => !referenceIcu.tags.has(tag));
    if ((missingTags.length > 0 || extraTags.length > 0) && emit) {
      report.parity(demoted, {
        rule: RULES.PARITY_TAGS,
        locale: view.id,
        file: file(key),
        key,
        message: `Rich-tag sets differ: ${reference.id} has {${[...referenceIcu.tags].sort().join(", ")}}, ${view.id} has {${[...localeIcu.tags].sort().join(", ")}} (INV-02.2).`,
      });
    }

    // INV-02.2's subset rule. An argument `en` never declares can only ever
    // render as literal braces, so it is an error; one the translation omits is
    // a warning listed in the coverage report and never a gate failure.
    for (const argument of localeIcu.args) {
      if (referenceIcu.args.has(argument)) continue;
      if (emit) {
        report.parity(demoted, {
          rule: RULES.ICU_UNDECLARED,
          locale: view.id,
          file: file(key),
          key,
          message: `ICU argument {${argument}} is used in ${view.id} and never declared in ${reference.id}; it can only render as literal braces (INV-02.2).`,
        });
      }
    }
    for (const argument of referenceIcu.args) {
      if (localeIcu.args.has(argument)) continue;
      omittedArguments.push(`${key} · {${argument}}`);
      if (emit) {
        report.add({
          rule: RULES.ICU_OMITTED,
          severity: "warning",
          locale: view.id,
          file: file(key),
          key,
          message: `ICU argument {${argument}} is declared in ${reference.id} and omitted in ${view.id} — legitimate (the bilingual footer's {brandNameOther}), reported not failed (INV-02.2).`,
        });
      }
    }
  }

  return { missing, extra, omittedArguments };
}

/* -------------------------------------------------------------------------- *
 * Schemas (INV-02.3)
 * -------------------------------------------------------------------------- */

function collectionSchemas(site: Site): ReadonlyMap<string, z.ZodType> {
  const ids = (entries: ReadonlyArray<{ readonly id: string }>) => entries.map((e) => e.id);
  return new Map<string, z.ZodType>([
    ["programs", programsCollectionSchema(ids(site.programs))],
    ["teachers", teachersCollectionSchema(ids(site.teachers))],
    ["testimonials", testimonialsCollectionSchema(ids(site.testimonials))],
    ["faq", faqCollectionSchema(ids(site.faq))],
    ["gallery", galleryCollectionSchema(site.gallery)],
    ["menu", menuCollectionSchema(site.menu)],
  ]);
}

function checkCollectionSchemas(
  report: Report,
  site: Site,
  reference: LocaleView,
  views: readonly LocaleView[],
): void {
  const schemas = collectionSchemas(site);
  let referenceValid = true;

  for (const [namespace, schema] of schemas) {
    const value = reference.tree.collections.get(namespace);
    const result = schema.safeParse(value);
    if (result.success) continue;
    referenceValid = false;
    report.add({
      rule: RULES.COLLECTION_SCHEMA,
      severity: "error",
      locale: reference.id,
      file: reference.tree.files.get(`collections.${namespace}`),
      message: `Collection does not match its schema (02 D-02.7):\n${z.prettifyError(result.error)}`,
    });
  }
  // A broken reference tree would repeat itself once per locale below.
  if (!referenceValid) return;

  for (const view of views) {
    if (view.id === reference.id) continue;
    for (const [namespace, schema] of schemas) {
      const merged = mergeOverReference(
        reference.tree.collections.get(namespace),
        view.tree.collections.get(namespace),
      );
      const result = schema.safeParse(merged);
      if (result.success) continue;
      report.add({
        rule: RULES.COLLECTION_SCHEMA,
        severity: "error",
        locale: view.id,
        file: view.tree.files.get(`collections.${namespace}`),
        message: `A value this locale supplies does not match the collection schema (02 D-02.7):\n${z.prettifyError(result.error)}`,
      });
    }
  }
}

/* -------------------------------------------------------------------------- *
 * Assets and alt text (INV-02.3)
 * -------------------------------------------------------------------------- */

type AssetRef = { readonly path: string; readonly where: string };

function assetReferences(site: Site): readonly AssetRef[] {
  const refs: AssetRef[] = [];
  for (const [name, image] of Object.entries(site.images)) {
    refs.push({ path: image.src, where: `images.${name}` });
  }
  site.programs.forEach((program, index) => {
    refs.push({ path: program.photo.src, where: `programs[${String(index)}].photo` });
  });
  site.teachers.forEach((teacher, index) => {
    if (teacher.photo)
      refs.push({ path: teacher.photo.src, where: `teachers[${String(index)}].photo` });
  });
  site.gallery.photos.forEach((photo) => {
    refs.push({ path: photo.src, where: `gallery.photos.${photo.id}` });
  });
  return refs;
}

/** The directory an `AssetPath` names, rooted like {@link ContentTree.assetDirs}. */
function assetDirOf(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut <= 0 ? "/" : path.slice(0, cut);
}

/**
 * INV-02.3's existence half, with the phased-delivery carve-out of note 2.
 *
 * A reference sleeps only while nothing has been delivered into the directory
 * that would hold it, only in PR mode, and only loudly: the dormant set is
 * reported as one warning that names every directory being waited on. A file
 * missing from a directory that *has* been delivered into is an error, and
 * under `--release` nothing sleeps at all.
 */
function checkAssets(report: Report, site: Site, tree: ContentTree, options: Options): void {
  const dormant: AssetRef[] = [];
  for (const ref of assetReferences(site)) {
    if (tree.assets?.has(ref.path) === true) continue;
    if (!options.release && tree.assetDirs?.has(assetDirOf(ref.path)) !== true) {
      dormant.push(ref);
      continue;
    }
    report.add({
      rule: RULES.ASSET_MISSING,
      severity: "error",
      file: tree.siteFile,
      key: ref.where,
      message: `${ref.path} is referenced by site.json and does not exist under public/ (INV-02.3).`,
    });
  }
  if (dormant.length === 0) return;
  const directories = [...new Set(dormant.map((ref) => `public${assetDirOf(ref.path)}`))].sort();
  report.add({
    rule: RULES.ASSET_DORMANT,
    severity: "warning",
    file: tree.siteFile,
    message: `Nothing has been delivered into ${directories.join(", ")}, so the asset-existence check is asleep over ${String(dormant.length)} referenced file(s) that belong there. PR-8.3 delivers the photography; each directory wakes its own references the moment a file lands in it, and --release never sleeps (INV-02.3).`,
  });
}

/**
 * INV-02.3's alt half, on the reference locale.
 *
 * Every other locale reaches the same requirement through parity: a photo whose
 * `alt` is absent from `zh-Hans` is a missing key, which is the finding
 * `--warn-locale` is allowed to demote while that tree is filled in. In `en` it
 * is an unlabelled image, which nothing may demote.
 */
function checkAltText(report: Report, site: Site, reference: LocaleView): void {
  const file = reference.tree.files.get("collections.gallery");
  for (const photo of site.gallery.photos) {
    const alt = resolveDotted(reference.tree.collections.get("gallery"), `photos.${photo.id}.alt`);
    if (typeof alt === "string" && alt.trim() !== "") continue;
    report.add({
      rule: RULES.MISSING_ALT,
      severity: "error",
      locale: reference.id,
      file,
      key: `photos.${photo.id}.alt`,
      message: `Gallery photo "${photo.id}" has no alt text in ${reference.id} (INV-02.3).`,
    });
  }
  const teachersFile = reference.tree.files.get("collections.teachers");
  for (const teacher of site.teachers) {
    if (!teacher.photo) continue;
    const alt = resolveDotted(reference.tree.collections.get("teachers"), `${teacher.id}.photoAlt`);
    if (typeof alt === "string" && alt.trim() !== "") continue;
    report.add({
      rule: RULES.MISSING_ALT,
      severity: "error",
      locale: reference.id,
      file: teachersFile,
      key: `${teacher.id}.photoAlt`,
      message: `Teacher "${teacher.id}" has a photo in site.json but no photoAlt in ${reference.id} (INV-02.3).`,
    });
  }
}

/* -------------------------------------------------------------------------- *
 * The provisional registry (INV-02.10, 08 §3)
 * -------------------------------------------------------------------------- */

const RESERVED_TOP_LEVEL = ["collections", "messages"] as const;

/**
 * 08 §3 rule 6 — is this a **pending-locale** entry?
 *
 * A `site.json` path whose final segment is a locale id the project knows
 * (`LOCALE_IDS`) but has not enabled yet (`routing.locales`): `brand.name.zh-Hant`
 * while `zh-Hant` is under review. Such an entry is "neither resolved nor an
 * error"; it is listed as *pending locale* and still blocks `--release` under
 * R1. The path cannot resolve by construction — INV-02.3 forbids `brand.name`
 * from carrying an entry for a locale that is not enabled — which is precisely
 * why the rule exists.
 *
 * The `collections.` / `messages.` forms are excluded: rule 2 gives their first
 * segment the deciding vote, so a final segment that happens to spell a locale
 * id is an ordinary key there, not a locale suffix.
 *
 * One predicate, two callers ({@link resolveProvisional} and the schema input
 * below), so the two cannot drift apart.
 */
export function isPendingLocalePath(path: string, config: LocaleConfig): boolean {
  const segments = path.split(".");
  const head = segments[0];
  if (head === "collections" || head === "messages") return false;
  const last = String(segments[segments.length - 1]);
  return config.known.includes(last) && !config.enabled.includes(last);
}

/**
 * `content/site.json` as `SiteSchema` should see it: without the pending-locale
 * entries of 08 §3 rule 6.
 *
 * `SiteSchema` enforces INV-02.10 for the loader too — every registry path must
 * resolve — and it knows nothing about held-back locales, so it reports
 * `brand.name.zh-Hant` as a stale marker and reinstates, as a `site-schema`
 * finding, exactly the error rule 6 removes. Worse, a failed parse yields no
 * `data`, so one exempt entry would also silence the asset, collection-schema
 * and alt-text checks that run off the parsed file.
 *
 * Withholding those entries from the schema's copy is the narrowest fix inside
 * this file: rules 1–5 still run over the raw list in {@link resolveProvisional}
 * — duplicates included, so hiding an entry here cannot hide a duplicate — and
 * every other schema rule sees the file unchanged. The loader
 * (`src/content/site.ts` → `src/content/schemas/site.ts`) still lacks rule 6 and
 * will red `next build` on the same entry; that fix belongs to that file's owner.
 */
function siteForSchema(site: unknown, config: LocaleConfig): unknown {
  if (!isRecord(site) || !Array.isArray(site.provisional)) return site;
  const kept = site.provisional.filter(
    (entry) => typeof entry !== "string" || !isPendingLocalePath(entry, config),
  );
  return kept.length === site.provisional.length ? site : { ...site, provisional: kept };
}

function checkReservedPrefixes(report: Report, tree: ContentTree): void {
  if (!isRecord(tree.site)) return;
  for (const reserved of RESERVED_TOP_LEVEL) {
    if (!Object.hasOwn(tree.site, reserved)) continue;
    report.add({
      rule: RULES.RESERVED_PREFIX,
      severity: "error",
      file: tree.siteFile,
      key: reserved,
      message: `"${reserved}" is a reserved first segment of a provisional path (08 §3 rule 3); site.json may not carry a top-level key with that name or the grammar becomes ambiguous.`,
    });
  }
}

function resolveProvisional(
  report: Report,
  paths: readonly string[],
  tree: ContentTree,
  views: ReadonlyMap<string, LocaleView>,
  config: LocaleConfig,
  options: Options,
): readonly ProvisionalRow[] {
  const rows: ProvisionalRow[] = [];
  const seen = new Set<string>();

  for (const path of paths) {
    if (seen.has(path)) {
      report.add({
        rule: RULES.PROVISIONAL_DUPLICATE,
        severity: "error",
        file: tree.siteFile,
        key: path,
        message: `Provisional entry "${path}" appears more than once; entries are unique (08 §3 rule 1).`,
      });
      continue;
    }
    seen.add(path);

    const segments = path.split(".");
    const head = segments[0];

    if (head === "collections" || head === "messages") {
      const minimum = head === "collections" ? 4 : 3;
      if (segments.length < minimum) {
        report.add({
          rule: RULES.PROVISIONAL_GRAMMAR,
          severity: "error",
          file: tree.siteFile,
          key: path,
          message:
            head === "collections"
              ? `"${path}" must be collections.<name>.<id>.<field> (08 §3 rule 2).`
              : `"${path}" must be messages.<namespace>.<key> (08 §3 rule 2).`,
        });
        continue;
      }
      const namespace = String(segments[1]);
      const inner = segments.slice(2).join(".");
      const fullKey =
        head === "collections" ? `collections.${namespace}.${inner}` : `${namespace}.${inner}`;

      for (const id of config.enabled) {
        const view = views.get(id);
        const file =
          view?.tree.files.get(head === "collections" ? `collections.${namespace}` : namespace) ??
          `content/${id}/${head}/${namespace}.json`;
        const value = view?.flat.leaves.get(fullKey);
        if (value !== undefined) {
          rows.push({ path, locale: id, file, value, state: "resolved" });
          continue;
        }
        rows.push({ path, locale: id, file, value: undefined, state: "unresolved" });
        // The reference locale is where an unresolvable path means what 08 §3
        // rule 4 says it means: a stale marker or a typo. A gap in a lagging
        // locale is a parity gap and follows that locale's parity status.
        const isReference = id === config.reference;
        const demoted = !isReference && !options.release && options.warnLocales.has(id);
        report.add({
          rule: isReference ? RULES.PROVISIONAL_UNRESOLVED : RULES.PROVISIONAL_UNRESOLVED_LOCALE,
          severity: demoted ? "warning" : "error",
          locale: id,
          file,
          key: path,
          message: isReference
            ? `Provisional path "${path}" resolves to nothing in ${id} — replace the value and delete this line, or fix the path (INV-02.10).`
            : `Provisional path "${path}" is not yet translated in ${id}.`,
        });
      }
      continue;
    }

    // Anything else is a dotted path into site.json. A final segment that is a
    // known locale id addresses one entry of a localized value (08 §3 rule 2).
    if (isPendingLocalePath(path, config)) {
      rows.push({ path, file: tree.siteFile, value: undefined, state: "pending locale" });
      continue; // 08 §3 rule 6: not resolved, not an error, still blocks R1.
    }
    const value = resolveDotted(tree.site, path);
    if (value === undefined) {
      rows.push({ path, file: tree.siteFile, value: undefined, state: "unresolved" });
      report.add({
        rule: RULES.PROVISIONAL_UNRESOLVED,
        severity: "error",
        file: tree.siteFile,
        key: path,
        message: `Provisional path "${path}" resolves to nothing in content/site.json — replace the value and delete this line, or fix the path (INV-02.10).`,
      });
      continue;
    }
    rows.push({ path, file: tree.siteFile, value, state: "resolved" });
  }

  return rows;
}

/* -------------------------------------------------------------------------- *
 * Release rules R1–R4
 * -------------------------------------------------------------------------- */

type StringValue = { readonly path: string; readonly file: string; readonly locale?: string };

function everyStringValue(
  tree: ContentTree,
  views: readonly LocaleView[],
): ReadonlyMap<string, StringValue[]> {
  // Grouped by value so one sample spelt in two files reports both homes.
  const byValue = new Map<string, StringValue[]>();
  const push = (value: unknown, entry: StringValue) => {
    if (typeof value !== "string") return;
    const bucket = byValue.get(value) ?? [];
    bucket.push(entry);
    byValue.set(value, bucket);
  };
  for (const [path, value] of flatten(tree.site).leaves) {
    push(value, { path, file: tree.siteFile });
  }
  for (const view of views) {
    for (const [key, value] of view.flat.leaves) {
      push(value, {
        path: key.startsWith("collections.") ? key : `messages.${key}`,
        file: fileForKey(view, key) ?? `content/${view.id}`,
        locale: view.id,
      });
    }
  }
  return byValue;
}

function checkRelease(
  report: Report,
  tree: ContentTree,
  views: readonly LocaleView[],
  provisional: readonly ProvisionalRow[],
  options: Options,
): void {
  // R1 — the registry itself.
  const paths = [...new Set(provisional.map((row) => row.path))];
  if (paths.length > 0) {
    report.add({
      rule: RULES.R1_REGISTRY,
      severity: "error",
      file: tree.siteFile,
      message: `R1: ${String(paths.length)} provisional value(s) remain; every one is a sample default that must be replaced before launch (INV-02.10). See the provisional block above.`,
    });
  }

  const licenseValue = resolveDotted(tree.site, "license");

  for (const [value, homes] of everyStringValue(tree, views)) {
    const where = homes.map((home) => `${home.file}:${home.path}`).join(", ");

    if (R2_SENTINEL.test(value)) {
      report.add({
        rule: RULES.R2_SENTINEL,
        severity: "error",
        file: homes[0]?.file,
        key: homes[0]?.path,
        message: `R2: the value ${JSON.stringify(value)} is a sentinel (${R2_SENTINEL_LABEL}) — ${where}.`,
      });
    }

    const unreal = R3_PATTERNS.some((pattern) => pattern.test(value));
    if (unreal) {
      report.add({
        rule: RULES.R3_UNREAL,
        severity: "error",
        file: homes[0]?.file,
        key: homes[0]?.path,
        message: `R3: ${JSON.stringify(value)} is a placeholder that can never be real (RFC 2606 .example, the 555-01xx reserved range) — ${where}.`,
      });
    }

    if (isR4Literal(value)) {
      const unaccepted = homes.filter((home) => !options.acceptSamples.has(home.path));
      if (unaccepted.length > 0) {
        report.add({
          rule: RULES.R4_SENDING_SAMPLE,
          severity: "error",
          file: unaccepted[0]?.file,
          key: unaccepted[0]?.path,
          message: `R4: ${JSON.stringify(value)} is one of the three ADJ-24 sending-identity samples — ${unaccepted.map((home) => `${home.file}:${home.path}`).join(", ")}. If the owner has adopted it verbatim, a human clears it once with --release --accept-sample <path>.`,
        });
      }
    }
  }

  if (licenseValue === R3_LICENSE) {
    report.add({
      rule: RULES.R3_UNREAL,
      severity: "error",
      file: tree.siteFile,
      key: "license",
      message: `R3: license is exactly ${R3_LICENSE}, the design mock's number.`,
    });
  }
}

/* -------------------------------------------------------------------------- *
 * The whole gate
 * -------------------------------------------------------------------------- */

export function validateContent(
  tree: ContentTree,
  options: Options,
  config: LocaleConfig = LOCALES,
): ValidationResult {
  const report = new Report();

  for (const bad of tree.unreadable) {
    report.add({
      rule: RULES.JSON_UNREADABLE,
      severity: "error",
      file: bad.file,
      message: `Not readable as JSON: ${bad.message}`,
    });
  }

  const views = new Map<string, LocaleView>();
  for (const [id, localeTree] of tree.locales) views.set(id, buildView(id, localeTree));

  for (const id of config.enabled) {
    if (views.has(id)) continue;
    report.add({
      rule: RULES.FILE_MISSING,
      severity: "error",
      locale: id,
      message: `content/${id}/ does not exist, but ${id} is enabled in routing.locales (INV-02.11).`,
    });
  }

  const reference = views.get(config.reference);
  const coverage: LocaleCoverage[] = [];
  let provisional: readonly ProvisionalRow[] = [];
  const acceptedSamples = [...options.acceptSamples].sort();

  checkReservedPrefixes(report, tree);

  if (reference !== undefined) {
    const brands = brandLiterals(tree.site);
    checkKeyShape(report, reference);
    checkValues(report, reference, brands);

    coverage.push({
      id: reference.id,
      status: "reference",
      referenceKeys: reference.flat.leaves.size,
      present: reference.flat.leaves.size,
      missing: [],
      extra: [],
      omittedArguments: [],
    });

    for (const id of config.known) {
      if (id === reference.id) continue;
      const view = views.get(id);
      if (view === undefined) {
        coverage.push({
          id,
          status: "no tree",
          referenceKeys: reference.flat.leaves.size,
          present: 0,
          missing: [],
          extra: [],
          omittedArguments: [],
        });
        continue;
      }
      // 08 §3: a tree that is not in `routing.locales` is scanned in a
      // reporting-only pass — its percentage appears, nothing in it can fail.
      const enabled = config.enabled.includes(id);
      if (enabled) {
        checkKeyShape(report, view);
        checkValues(report, view, brands);
      }
      const demoted = !options.release && options.warnLocales.has(id);
      const outcome = checkParity(report, reference, view, demoted, enabled);
      coverage.push({
        id,
        status: enabled ? "enabled" : "pending review",
        referenceKeys: reference.flat.leaves.size,
        present: reference.flat.leaves.size - outcome.missing.length,
        missing: outcome.missing,
        extra: outcome.extra,
        omittedArguments: outcome.omittedArguments,
      });
    }
  }

  // 08 §3 rule 6 is applied to the schema's input, not to its output: see
  // {@link siteForSchema}. Everything else about the file is parsed as written.
  const siteResult = SiteSchema.safeParse(siteForSchema(tree.site, config));
  if (!siteResult.success) {
    report.add({
      rule: RULES.SITE_SCHEMA,
      severity: "error",
      file: tree.siteFile,
      message: `content/site.json does not match its schema (02 D-02.7, INV-02.3):\n${z.prettifyError(siteResult.error)}`,
    });
  } else {
    const site = siteResult.data;
    checkAssets(report, site, tree, options);
    if (reference !== undefined) {
      checkCollectionSchemas(
        report,
        site,
        reference,
        config.enabled.flatMap((id) => {
          const view = views.get(id);
          return view === undefined ? [] : [view];
        }),
      );
      checkAltText(report, site, reference);
    }
  }

  // The registry is read from the raw file rather than from the parsed one, so
  // that an unrelated schema failure cannot take the provisional gate down with
  // it — INV-02.10 is "an error in every mode", and a mode where site.json is
  // broken is exactly when a stale marker would slip through. `SiteSchema`
  // checks the same grammar during `next build`; the two agreeing is the point.
  const rawProvisional = resolveDotted(tree.site, "provisional");
  provisional = resolveProvisional(
    report,
    Array.isArray(rawProvisional)
      ? rawProvisional.filter((entry): entry is string => typeof entry === "string")
      : [],
    tree,
    views,
    config,
    options,
  );

  if (options.release) {
    checkRelease(report, tree, [...views.values()], provisional, options);
    for (const path of acceptedSamples) {
      const guarded = R4_PATHS.includes(path);
      if (guarded) continue;
      report.add({
        rule: RULES.RELEASE_FLAG_MISUSE,
        severity: "warning",
        key: path,
        message: `--accept-sample ${path} names a path R4 does not guard; the flag is R4-only and silences nothing else (08 §3).`,
      });
    }
  }

  const findings = report.findings;
  return {
    findings,
    coverage,
    provisional,
    acceptedSamples,
    options,
    ok: !findings.some((finding) => finding.severity === "error"),
  };
}

/* -------------------------------------------------------------------------- *
 * Output
 * -------------------------------------------------------------------------- */

/**
 * Row caps for `reports/content-coverage.md`.
 *
 * The report is not only a file: CI posts it as one sticky PR comment (08 §3),
 * and GitHub rejects a comment over 65 536 characters outright. An uncapped
 * findings transcript passed that limit at 288 missing keys — the gate would
 * have gone quiet on exactly the trees it exists to describe. The caps are set
 * well above the reference tree's real size, so nothing is trimmed in practice,
 * and every finding is in the job log regardless.
 */
const FINDING_ROWS = 50;
const KEY_ROWS = 500;

/** `items` as markdown bullets, capped, with a line saying what was left out. */
function bounded(items: readonly string[], limit: number): string[] {
  const lines = items.slice(0, limit).map((item) => `- \`${item}\``);
  if (items.length > limit) {
    lines.push(`- …and ${String(items.length - limit)} more — run \`pnpm validate:content\`.`);
  }
  return lines;
}

function percent(present: number, total: number): string {
  if (total === 0) return "—";
  return `${((present / total) * 100).toFixed(1)} %`;
}

function shortValue(value: unknown): string {
  if (value === undefined) return "—";
  const text = JSON.stringify(value);
  return text.length > 72 ? `${text.slice(0, 69)}…` : text;
}

/** The provisional block 08 §3 requires on stdout and in the report. */
export function renderProvisionalBlock(rows: readonly ProvisionalRow[]): string {
  if (rows.length === 0) return "Provisional values: none — the registry is empty.\n";
  const lines = ["| path | locale | current value | file | state |", "|---|---|---|---|---|"];
  for (const row of rows) {
    lines.push(
      `| \`${row.path}\` | ${row.locale ?? "—"} | ${shortValue(row.value)} | \`${row.file}\` | ${row.state} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

/** `reports/content-coverage.md` — INV-02.6: a column per locale plus the registry. */
export function renderReport(result: ValidationResult): string {
  const locales = result.coverage;
  const head = `| metric | ${locales.map((entry) => entry.id).join(" | ")} |`;
  const rule = `|---|${locales.map(() => "---").join("|")}|`;
  const row = (label: string, cell: (entry: LocaleCoverage) => string) =>
    `| ${label} | ${locales.map(cell).join(" | ")} |`;

  const errors = result.findings.filter((finding) => finding.severity === "error");
  const warnings = result.findings.filter((finding) => finding.severity === "warning");
  const mode = [
    result.options.release ? "`--release`" : "PR mode",
    ...[...result.options.warnLocales].sort().map((id) => `\`--warn-locale ${id}\``),
  ].join(" · ");

  const lines: string[] = [
    "# Content coverage",
    "",
    "Generated by `pnpm validate:content --report` (02 INV-02.6, 08 §3). Do not edit by hand.",
    "",
    `- mode: ${mode}`,
    `- reference locale: \`${LOCALES.reference}\``,
    `- enabled locales (\`routing.locales\`): ${LOCALES.enabled.map((id) => `\`${id}\``).join(", ")}`,
    `- errors: **${String(errors.length)}** · warnings: ${String(warnings.length)}`,
    "",
    "## Key coverage",
    "",
    head,
    rule,
    row("status", (entry) => entry.status),
    row("keys present", (entry) => String(entry.present)),
    row("keys in reference", (entry) => String(entry.referenceKeys)),
    row("missing", (entry) => String(entry.missing.length)),
    row("extra (orphans)", (entry) => String(entry.extra.length)),
    row("coverage", (entry) => percent(entry.present, entry.referenceKeys)),
    "",
  ];

  for (const entry of locales) {
    if (
      entry.missing.length === 0 &&
      entry.extra.length === 0 &&
      entry.omittedArguments.length === 0
    ) {
      continue;
    }
    lines.push(`### ${entry.id}`, "");
    if (entry.missing.length > 0) {
      lines.push(`<details><summary>${String(entry.missing.length)} missing key(s)</summary>`, "");
      lines.push(...bounded(entry.missing, KEY_ROWS));
      lines.push("", "</details>", "");
    }
    if (entry.extra.length > 0) {
      lines.push(`**${String(entry.extra.length)} orphan key(s)**`, "");
      lines.push(...bounded(entry.extra, KEY_ROWS));
      lines.push("");
    }
    if (entry.omittedArguments.length > 0) {
      lines.push(
        `**${String(entry.omittedArguments.length)} ICU argument(s) omitted** — a warning, never a gate failure (INV-02.2)`,
        "",
      );
      lines.push(...bounded(entry.omittedArguments, KEY_ROWS));
      lines.push("");
    }
  }

  lines.push("## Provisional values", "", renderProvisionalBlock(result.provisional));

  if (result.acceptedSamples.length > 0) {
    lines.push(
      "## Accepted samples (`--release --accept-sample`)",
      "",
      ...result.acceptedSamples.map(
        (path) => `- \`${path}\` — a human confirmed this value is real (08 §3, R4).`,
      ),
      "",
    );
  }

  if (result.findings.length > 0) {
    // A tally rather than a transcript. The per-locale sections above already
    // itemise the parity work; the full log lives in the job output and the
    // uploaded artifact, and a comment over GitHub's 65 536-character limit is
    // rejected outright — the sticky comment (08 §3) is what this file feeds.
    const tally = new Map<RuleId, { errors: number; warnings: number }>();
    for (const finding of result.findings) {
      const entry = tally.get(finding.rule) ?? { errors: 0, warnings: 0 };
      if (finding.severity === "error") entry.errors += 1;
      else entry.warnings += 1;
      tally.set(finding.rule, entry);
    }
    lines.push("## Findings", "", "| rule | errors | warnings |", "|---|---|---|");
    for (const [rule, counts] of tally) {
      lines.push(`| \`${rule}\` | ${String(counts.errors)} | ${String(counts.warnings)} |`);
    }
    lines.push("");

    if (errors.length > 0) {
      lines.push(
        `### Errors (${String(Math.min(errors.length, FINDING_ROWS))} of ${String(errors.length)})`,
        "",
        "| rule | locale | where | message |",
        "|---|---|---|---|",
      );
      for (const finding of errors.slice(0, FINDING_ROWS)) {
        const where = [finding.file, finding.key].filter(Boolean).join(" · ");
        lines.push(
          `| \`${finding.rule}\` | ${finding.locale ?? "—"} | ${where === "" ? "—" : `\`${where}\``} | ${finding.message.replace(/\n/g, "<br>")} |`,
        );
      }
      if (errors.length > FINDING_ROWS) {
        lines.push(
          "",
          `…and ${String(errors.length - FINDING_ROWS)} more. Every finding is in the job log.`,
        );
      }
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

/** What the terminal sees. */
export function renderConsole(result: ValidationResult): string {
  const lines: string[] = [];
  const errors = result.findings.filter((finding) => finding.severity === "error");
  const warnings = result.findings.filter((finding) => finding.severity === "warning");

  for (const finding of result.findings) {
    const where = [finding.locale, finding.file, finding.key].filter(Boolean).join(" · ");
    lines.push(
      `${finding.severity === "error" ? "ERROR" : "warn "} [${finding.rule}] ${where}\n        ${finding.message.replace(/\n/g, "\n        ")}`,
    );
  }
  if (result.findings.length > 0) lines.push("");

  lines.push("Coverage");
  for (const entry of result.coverage) {
    lines.push(
      `  ${entry.id.padEnd(8)} ${entry.status.padEnd(14)} ${String(entry.present)}/${String(entry.referenceKeys)} keys  ${percent(entry.present, entry.referenceKeys)}` +
        (entry.extra.length > 0 ? `  (+${String(entry.extra.length)} orphan)` : ""),
    );
  }
  lines.push("", "Provisional values", renderProvisionalBlock(result.provisional));
  lines.push(
    `${String(errors.length)} error(s), ${String(warnings.length)} warning(s) — ${result.ok ? "PASS" : "FAIL"}`,
  );
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- *
 * CLI
 * -------------------------------------------------------------------------- */

export const USAGE = `pnpm validate:content [--report] [--warn-locale <id>] [--release [--accept-sample <path>]] [--root <dir>]

  --report               write reports/content-coverage.md (INV-02.6)
  --warn-locale <id>     demote that locale's parity findings to warnings (repeatable, 08 §3)
  --release              the launch gate: ignores --warn-locale and adds R1-R4 (D-08.17)
  --accept-sample <path> --release only, repeatable, R4 only: one path a human has confirmed
  --root <dir>           the tree to validate (default: the repository root)`;

export class UsageError extends Error {}

export function parseArgs(argv: readonly string[], defaultRoot: string): Options {
  let root = defaultRoot;
  let report = false;
  let release = false;
  const warnLocales = new Set<string>();
  const acceptSamples = new Set<string>();

  const take = (index: number, flag: string): string => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new UsageError(`${flag} needs a value.`);
    }
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    switch (flag) {
      case "--report":
        report = true;
        break;
      case "--release":
        release = true;
        break;
      case "--warn-locale":
        warnLocales.add(take(index, flag));
        index += 1;
        break;
      case "--accept-sample":
        acceptSamples.add(take(index, flag));
        index += 1;
        break;
      case "--root":
        root = resolve(take(index, flag));
        index += 1;
        break;
      default:
        throw new UsageError(`Unknown argument "${String(flag)}".`);
    }
  }

  for (const id of warnLocales) {
    if (LOCALES.enabled.includes(id)) continue;
    throw new UsageError(
      `--warn-locale ${id} names a locale that is not in routing.locales (${LOCALES.enabled.join(", ")}).`,
    );
  }
  if (acceptSamples.size > 0 && !release) {
    throw new UsageError("--accept-sample is --release-only (08 §3).");
  }

  return { root, report, release, warnLocales, acceptSamples };
}

/** Run the gate. Returns the process exit code. */
export function run(argv: readonly string[], defaultRoot: string, log = console.log): number {
  let options: Options;
  try {
    options = parseArgs(argv, defaultRoot);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    log(`${error.message}\n\n${USAGE}`);
    return 2;
  }

  const tree = readContentTree(options.root);
  const result = validateContent(tree, options);
  log(renderConsole(result));

  if (options.report) {
    const target = join(options.root, "reports", "content-coverage.md");
    mkdirSync(join(options.root, "reports"), { recursive: true });
    writeFileSync(target, renderReport(result), "utf8");
    log(`\nWrote ${relative(options.root, target).split(sep).join(posix.sep)}`);
  }

  return result.ok ? 0 : 1;
}

/* c8 ignore start — the process shell; `run` above is what the suite drives. */
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === `file://${resolve(process.argv[1])}`;

if (invokedDirectly) {
  process.exitCode = run(process.argv.slice(2), process.cwd());
}
/* c8 ignore stop */
