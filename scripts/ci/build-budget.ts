import { appendFileSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import process from "node:process";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

import { routing } from "@/i18n/routing";

/**
 * `pnpm check:budget` — the build-side half of the performance budgets
 * (PR-8.5; 08 §7, 09 §4.9).
 *
 * ## The division of labour, and why it is not arbitrary
 *
 * 08 §7 is explicit about where bundle weight is measured: "**Bundle weight is
 * measured where it is real — the preview's transfer sizes — not
 * re-implemented locally**". Transfer size depends on the compressor the CDN
 * runs, its quality setting and the negotiated encoding, none of which exist on
 * a build machine; a locally invented gzip number asserted against a budget
 * written for a real CDN is a guess dressed as a gate. So the transfer budgets
 * — `resource-summary:script:size` (230400 on home, 184320 on every detail
 * page), `largest-contentful-paint`, `total-blocking-time` and the rest — live
 * in `lighthouserc.cjs` and are asserted by `lighthouse-preview` /
 * `lighthouse-prod` against a deployment.
 *
 * What is left is everything the build output settles on its own, and this file
 * is all of it:
 *
 * | Check | Number from | Why it is decidable here |
 * |---|---|---|
 * | fonts are preloaded, `woff2`, same-origin | 03 §3.1, §3.4 | it is a property of the emitted HTML |
 * | preloaded font bytes <= 120 KiB | 08 §7 `resource-summary:font:size` | `woff2` is already compressed, so bytes on disk **are** transfer bytes |
 * | third-party origins <= 3 | 08 §7 `resource-summary:third-party:count` | a count of origins in the emitted HTML |
 * | one image <= 400 KB, named and typed per the editor guide | 09 §4.9 | a property of the file in `public/` |
 * | a page's local image bytes <= 500 KiB | 08 §7 `resource-summary:image:size` | JPEG/WebP/PNG are already compressed, same argument as fonts |
 * | first-load JS does not grow | measured, see *The ratchet* | Next states it itself, exactly, in `route-bundle-stats.json` |
 *
 * Every threshold above is quoted from a document. Not one is this file's
 * invention, and the one that is a ratchet says so.
 *
 * ## The ratchet
 *
 * `FIRST_LOAD_CEILINGS` is **not** a budget. It is a baseline in the sense
 * D-08.20 draws the line — "a baseline is an *expectation* that a human reviews
 * when it moves (INV-08.8), and a report is a *description* of the tree it was
 * generated from" — the same standing as `reports/section-heights.json`, and
 * the opposite of `reports/content-coverage.md`. It records what the tree
 * weighs today so that growth has to be argued for in the pull request that
 * causes it.
 *
 * Two properties keep it from rusting into a number nothing can fail.
 *
 *   * Each ceiling is the measurement **rounded up to the next 16 KiB**, and
 *     that granularity is calibrated rather than picked. Two numbers bracket
 *     it, both measured on this tree on 2026-08-24. Below: PRs #89 and #90
 *     together moved every route by ≈ 1.2 KiB, which is what ordinary feature
 *     work costs, and a ceiling that reds on *that* is not a gate but a chore —
 *     it would be re-recorded reflexively in every pull request until nobody
 *     read it, which is how a ratchet rusts. Above: swapping `domAnimation` for
 *     `domMax` in `LazyMotion` adds **49.0 KiB** to every route, and that is the
 *     class of regression this exists to catch — a feature bundle or a library
 *     arriving in the client graph. 16 KiB sits an order of magnitude above the
 *     first and a third of the way to the second: roughly a dozen ordinary pull
 *     requests fit inside a ceiling before it needs re-recording, and not one
 *     library-sized regression does. It also puts byte-level differences between
 *     one machine's build and another's far out of range, which is what lets
 *     `pnpm verify` and CI reach the same verdict (INV-08.6).
 *   * A route the map does not name is still checked, against the largest
 *     recorded ceiling, and reported as unrecorded. A new route can therefore
 *     never be heavier than the heaviest thing already here, and a lane that
 *     adds a page is not red for the crime of adding it.
 *
 * The number is uncompressed because Next computes it and this file only reads
 * it back: `firstLoadUncompressedJsBytes` in `.next/diagnostics/route-bundle-stats.json`
 * is the exact sum of the chunk files the route's first load pulls. There is no
 * second opinion to disagree with. The transfer figure is printed beside it for
 * the reader, and 08 §7's script budget is printed beside *that*, but neither
 * is asserted here — see the paragraph above.
 *
 * ## A gate that cannot run must not report clean
 *
 * The discipline `scripts/ci/todo-grep.sh` and `scripts/ci/coverage-report.sh`
 * arrived at, applied to a checker whose input is a build directory rather than
 * a work tree. Every fail-open this repository has catalogued had the same
 * shape: something that could not scan reported what something that scanned and
 * found nothing reports. So:
 *
 *   * no `.next/`, no route stats, no prerendered home page -> exit **2**, never 0;
 *   * fewer home pages found than `routing.locales` has entries -> exit 2. A
 *     locale added to the routing table and missing from the build is the state
 *     where a per-page check silently stops covering a third of the site;
 *   * an empty `public/images/` is **reported as empty**, with the count, rather
 *     than passing silently. It is empty today and PR-8.3 fills it; a reader of
 *     the summary can see which of those two they are looking at.
 *
 * Exit codes: 0 clean, 1 the gate fired, 2 the gate could not run.
 *
 * Dependencies: Node and the build output. Never `bd`.
 *
 *   usage: pnpm check:budget      (after `pnpm build`, or after downloading the
 *                                  `next-build` artifact into `.next/`)
 */

/* ------------------------------------------------------------------------- *
 * The numbers
 * ------------------------------------------------------------------------- */

/**
 * 08 §7, verbatim. LHCI's `resource-summary:*:size` assertions take
 * `maxNumericValue` in bytes, and these are the same bytes: `lighthouserc.cjs`
 * asserts them against a deployment, and the two that a build machine can
 * decide on its own are asserted here as well.
 */
const DOC_08_7 = {
  /** `resource-summary:font:size <= 122880` — 120 KiB, Fredoka + Nunito latin. */
  fontBytes: 122_880,
  /** `resource-summary:image:size <= 512000` — 500 KiB, mobile home. */
  imageBytes: 512_000,
  /** `resource-summary:third-party:count <= 3`. */
  thirdPartyCount: 3,
  /**
   * `resource-summary:script:size`, which since the Zod patch
   * (`patches/zod@4.4.3.patch`) is **per route**: 225 KiB transfer on
   * `/{locale}`, the only page that renders the inquiry form and so the only
   * one that ships Zod, and 08 §7's original 180 KiB on every detail page.
   * `lighthouserc.cjs` holds the same two numbers and the patterns that decide
   * which URL is held to which.
   *
   * Printed, never asserted here: transfer size is `lighthouserc.cjs`'s to
   * assert against a real CDN, per the header. This file measures home pages
   * only, so `home` is the number the summary row prints against.
   */
  scriptTransferBytes: { home: 230_400, detail: 184_320 },
} as const;

/** 09 §4.9, the editor guide's own rule: "JPEG or WebP, <= 400 KB each". */
const DOC_09_4_9 = {
  maxImageBytes: 400_000,
  /** The formats §4.9 names, plus the two `public/` already carries. */
  allowedExtensions: [".jpg", ".jpeg", ".webp", ".avif", ".png", ".svg"] as readonly string[],
  /** "file names lowercase with hyphens" — one shape, stated once. */
  namePattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
} as const;

/**
 * The ratchet: each route's measurement rounded up to the next
 * {@link CEILING_GRANULARITY_KIB}. Recorded on 2026-08-24 from a `next build`
 * of `origin/main` at 481d193 with `patches/zod@4.4.3.patch` applied — nine
 * routes, three locales, and no photography (`public/images/` does not exist
 * until PR-8.3). The measurement each ceiling was rounded up from is in the
 * comment beside it.
 *
 * Two rows move with this recording, and both move down. `/[locale]` was 960
 * against 945.7 KiB and is 800 against 789.5 KiB: the Zod patch takes 161,266
 * bytes of unreachable locale tables and JSON-Schema conversion out of the one
 * route that renders the inquiry form. `/[locale]/privacy` was the page "in
 * flight in this wave" that the 947bdf6 recording deliberately left out; it has
 * landed, it measures 632.5 KiB like its five siblings, and it is recorded here
 * rather than left to be measured against the largest ceiling — an unrecorded
 * route is a route whose real number nobody is watching, which is the state
 * this file exists to avoid.
 *
 * Read the header before changing a number here. Lowering one is ordinary
 * housekeeping after a real improvement; raising one is a claim that the site
 * should be heavier, and the pull request that raises it says why.
 */
const CEILING_GRANULARITY_KIB = 16;

const FIRST_LOAD_CEILINGS: ReadonlyMap<string, number> = new Map([
  ["/[locale]", 800], // 789.5 KiB
  ["/[locale]/gallery", 656], // 641.7 KiB
  ["/[locale]/menu", 640], // 632.5 KiB
  ["/[locale]/philosophy", 640], // 632.5 KiB
  ["/[locale]/privacy", 640], // 632.5 KiB
  ["/[locale]/programs", 640], // 632.5 KiB
  ["/[locale]/reviews", 640], // 632.5 KiB
  ["/[locale]/team", 640], // 632.5 KiB
  ["/_not-found", 496], // 495.2 KiB — the 404's own route since `gp-dln.266`
]);

/* ------------------------------------------------------------------------- *
 * Reporting
 * ------------------------------------------------------------------------- */

type Severity = "error" | "note";

type Finding = {
  readonly severity: Severity;
  readonly check: string;
  readonly message: string;
};

const findings: Finding[] = [];
const summaryRows: string[] = [];

const fail = (check: string, message: string): void => {
  findings.push({ severity: "error", check, message });
};

const note = (check: string, message: string): void => {
  findings.push({ severity: "note", check, message });
};

/** The gate could not run. Never silent, never exit 0 — see the header. */
const die = (message: string): never => {
  if (process.env.GITHUB_ACTIONS) {
    process.stderr.write(`::error::check:budget: ${message}\n`);
  } else {
    process.stderr.write(`check:budget: ${message}\n`);
  }
  process.exit(2);
};

const kib = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KiB`;

/**
 * Decimal KB, because 09 §4.9 is written for content editors and says "400 KB".
 * The 08 §7 numbers are KiB and stay KiB; silently converting one document's
 * unit into the other's would be worse than printing both.
 */
const kb = (bytes: number): string => `${(bytes / 1000).toFixed(1)} KB`;

/* ------------------------------------------------------------------------- *
 * Reading the build output
 * ------------------------------------------------------------------------- */

const repoRoot = resolve(import.meta.dirname, "..", "..");
const nextDir = join(repoRoot, ".next");
const publicDir = join(repoRoot, "public");

if (!existsSync(nextDir)) {
  die(
    `no build output at ${relative(repoRoot, nextDir)}. Run \`pnpm build\` first, or download the \`next-build\` artifact (08 §10). Nothing was measured, which is not a clean tree.`,
  );
}

/** One row of `.next/diagnostics/route-bundle-stats.json`, as Next writes it. */
type RouteStat = { readonly route: string; readonly firstLoadUncompressedJsBytes: number };

const readRouteStats = (): readonly RouteStat[] => {
  const path = join(nextDir, "diagnostics", "route-bundle-stats.json");
  if (!existsSync(path)) {
    die(
      `${relative(repoRoot, path)} is missing. Next writes it on every \`next build\`; without it the first-load figures cannot be read and nothing was measured.`,
    );
  }
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const rows: readonly unknown[] = Array.isArray(parsed)
    ? parsed
    : die(`${relative(repoRoot, path)} is not an array of routes, so nothing was measured.`);
  if (rows.length === 0) {
    die(
      `${relative(repoRoot, path)} holds no routes, so nothing was measured. This is not a clean tree.`,
    );
  }
  return rows.map((row: unknown): RouteStat => {
    if (typeof row !== "object" || row === null) {
      return die(`${relative(repoRoot, path)} has a row that is not an object.`);
    }
    const { route, firstLoadUncompressedJsBytes } = row as Record<string, unknown>;
    if (typeof route !== "string" || typeof firstLoadUncompressedJsBytes !== "number") {
      return die(
        `${relative(repoRoot, path)} has a row without a string \`route\` and a numeric \`firstLoadUncompressedJsBytes\`. Next's format has changed and this gate is reading nothing it understands.`,
      );
    }
    return { route, firstLoadUncompressedJsBytes };
  });
};

/**
 * The prerendered home page per enabled locale. The locales come from
 * `src/i18n/routing.ts` and never from a list here (INV-08.4), so enabling or
 * withdrawing one (D-10.12) changes what this gate covers without editing it.
 */
const readHomePages = (): ReadonlyMap<string, string> => {
  const pages = new Map<string, string>();
  for (const locale of routing.locales) {
    const path = join(nextDir, "server", "app", `${locale}.html`);
    if (!existsSync(path)) {
      die(
        `${relative(repoRoot, path)} is missing, so \`/${locale}\` was not measured. \`routing.locales\` names ${String(routing.locales.length)} locales (INV-08.4) and the build produced fewer home pages than that.`,
      );
    }
    pages.set(locale, readFileSync(path, "utf8"));
  }
  return pages;
};

/** `/_next/static/x.js` -> the file on disk that Next serves for it. */
const assetPath = (url: string): string => join(nextDir, url.replace(/^\/_next\//, ""));

const assetBytes = (url: string): number => {
  const path = assetPath(url);
  return existsSync(path) ? statSync(path).size : 0;
};

/* ------------------------------------------------------------------------- *
 * Parsing the emitted HTML
 *
 * A regex over prerendered markup rather than a DOM: the shapes below are
 * emitted by Next, not authored, so they are uniform, and adding a parser to
 * the dependency tree to read four tag kinds would cost more than it buys. Each
 * matcher takes whole tags and reads attributes out of them, so attribute
 * order — `rel` before `href` on one link and after it on the next — cannot
 * change a verdict.
 * ------------------------------------------------------------------------- */

const tagsOf = (html: string, name: string): readonly string[] =>
  [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map((m) => m[0]);

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\b${name}="([^"]*)"`, "i").exec(tag)?.[1];

const hasAttr = (tag: string, name: string): boolean => new RegExp(`\\b${name}\\b`, "i").test(tag);

/**
 * The scripts a modern browser actually fetches. Next emits one legacy
 * polyfill bundle behind `noModule`, which no engine that supports ES modules
 * downloads and which Lighthouse therefore never counts; including it here
 * would make this file's figures disagree with `lighthouse-preview`'s over a
 * file nobody receives.
 */
const moduleScripts = (html: string): readonly string[] =>
  tagsOf(html, "script")
    .filter((t) => !hasAttr(t, "noModule"))
    .map((t) => attr(t, "src"))
    .filter((src): src is string => typeof src === "string");

const preloadedFonts = (html: string): readonly string[] =>
  tagsOf(html, "link")
    .filter((t) => attr(t, "rel") === "preload" && attr(t, "as") === "font")
    .map((t) => attr(t, "href"))
    .filter((href): href is string => typeof href === "string");

const localImages = (html: string): readonly string[] => [
  ...new Set(
    tagsOf(html, "img")
      .map((t) => attr(t, "src"))
      .filter((src): src is string => typeof src === "string" && src.startsWith("/")),
  ),
];

/** Every external origin the document references, whatever the tag. */
const thirdPartyOrigins = (html: string): readonly string[] => {
  const origins = new Set<string>();
  for (const tag of [...tagsOf(html, "script"), ...tagsOf(html, "link"), ...tagsOf(html, "img")]) {
    const url = attr(tag, "src") ?? attr(tag, "href");
    if (url === undefined || !/^https?:\/\//i.test(url)) continue;
    origins.add(new URL(url).origin);
  }
  return [...origins];
};

/* ------------------------------------------------------------------------- *
 * The checks
 * ------------------------------------------------------------------------- */

const routeStats = readRouteStats();
const homePages = readHomePages();

/* 1 · First-load JS — the ratchet. */

const largestCeiling = Math.max(...FIRST_LOAD_CEILINGS.values());

summaryRows.push("| Route | First-load JS | Ceiling | |", "|---|---:|---:|---|");
for (const { route, firstLoadUncompressedJsBytes: bytes } of [...routeStats].sort((a, b) =>
  a.route.localeCompare(b.route),
)) {
  const recorded = FIRST_LOAD_CEILINGS.get(route);
  const ceiling = recorded ?? largestCeiling;
  const over = bytes > ceiling * 1024;
  summaryRows.push(
    `| \`${route}\` | ${kib(bytes)} | ${String(ceiling)} KiB${recorded === undefined ? " (unrecorded)" : ""} | ${over ? "over" : "ok"} |`,
  );
  if (over) {
    const suggested = Math.ceil(bytes / 1024 / CEILING_GRANULARITY_KIB) * CEILING_GRANULARITY_KIB;
    fail(
      "first-load-js",
      `${route} first-load JS is ${kib(bytes)}, over its ${String(ceiling)} KiB ceiling${
        recorded === undefined
          ? " — this route has no recorded ceiling, so it is measured against the largest one"
          : ""
      }. Either the growth is wrong, or it is right — in which case record \`["${route}", ${String(suggested)}]\` in \`FIRST_LOAD_CEILINGS\` (\`scripts/ci/build-budget.ts\`) and say in the pull request why the site should be heavier.`,
    );
  }
  if (recorded === undefined) {
    note(
      "first-load-js",
      `${route} has no recorded ceiling; measured against the largest (${String(largestCeiling)} KiB).`,
    );
  }
}

/* 2 · Fonts — preloaded, local, `woff2`, and within 08 §7's transfer budget. */

for (const [locale, html] of homePages) {
  const fonts = preloadedFonts(html);
  if (fonts.length === 0) {
    fail(
      "font-preload",
      `/${locale} preloads no font. 03 §3.4 rests on next/font preloading Fredoka and Nunito — "the cascade can never trigger FOUT" — and a page that preloads none has lost that property.`,
    );
    continue;
  }

  let bytes = 0;
  for (const href of fonts) {
    if (/^https?:\/\//i.test(href)) {
      fail(
        "font-preload",
        `/${locale} preloads a font from ${new URL(href).origin}. 03 D-03.5 ships no external font: every CJK face is a system face and the two Latin faces are self-hosted by next/font.`,
      );
      continue;
    }
    if (extname(href) !== ".woff2") {
      fail("font-preload", `/${locale} preloads ${href}, which is not woff2 (03 §3.1).`);
    }
    bytes += assetBytes(href);
  }

  summaryRows.push(
    `| fonts \`/${locale}\` | ${kib(bytes)} (${String(fonts.length)} files) | ${kib(DOC_08_7.fontBytes)} | ${bytes > DOC_08_7.fontBytes ? "over" : "ok"} |`,
  );
  if (bytes > DOC_08_7.fontBytes) {
    fail(
      "font-size",
      `/${locale} preloads ${kib(bytes)} of font, over 08 §7's \`resource-summary:font:size <= ${String(DOC_08_7.fontBytes)}\`.`,
    );
  }
}

/* 3 · Third-party origins — 08 §7's count, decided from the emitted HTML. */

for (const [locale, html] of homePages) {
  const origins = thirdPartyOrigins(html);
  if (origins.length > DOC_08_7.thirdPartyCount) {
    fail(
      "third-party",
      `/${locale} references ${String(origins.length)} third-party origins (${origins.join(", ")}), over 08 §7's \`resource-summary:third-party:count <= ${String(DOC_08_7.thirdPartyCount)}\`.`,
    );
  }
}

/* 4 · Images — the editor guide's per-file rule, and the per-page total. */

const imagesDir = join(publicDir, "images");

const walk = (dir: string): readonly string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

if (!existsSync(imagesDir)) {
  note(
    "images",
    `${relative(repoRoot, imagesDir)} does not exist, so 0 files were checked against 09 §4.9. PR-8.3 creates it; until then this line is the evidence that the check scanned nothing rather than passed over something.`,
  );
  summaryRows.push("| images | 0 files | 09 §4.9 | none present |");
} else {
  const files = walk(imagesDir);
  summaryRows.push(
    `| images | ${String(files.length)} files | ${kb(DOC_09_4_9.maxImageBytes)} each | ${files.length === 0 ? "none present" : "checked"} |`,
  );
  if (files.length === 0) {
    note(
      "images",
      `${relative(repoRoot, imagesDir)} is empty, so 0 files were checked against 09 §4.9.`,
    );
  }
  for (const file of files) {
    const shown = relative(repoRoot, file);
    const extension = extname(file).toLowerCase();
    const size = statSync(file).size;
    if (size > DOC_09_4_9.maxImageBytes) {
      fail(
        "image-size",
        `${shown} is ${kb(size)}, over 09 §4.9's ${kb(DOC_09_4_9.maxImageBytes)} per file. Re-export it smaller — hero and philosophy <= 1,600 px wide, gallery <= 1,200 px on the long edge, portraits 800 x 800.`,
      );
    }
    if (!DOC_09_4_9.allowedExtensions.includes(extension)) {
      fail(
        "image-format",
        `${shown} is ${extension || "extensionless"}; 09 §4.9 asks for ${DOC_09_4_9.allowedExtensions.join(", ")}.`,
      );
    }
    if (!DOC_09_4_9.namePattern.test(basename(file, extname(file)))) {
      fail("image-name", `${shown} is not lowercase-with-hyphens (09 §4.9).`);
    }
  }
}

for (const [locale, html] of homePages) {
  const images = localImages(html);
  const bytes = images.reduce((total, src) => {
    const path = join(publicDir, src);
    return total + (existsSync(path) ? statSync(path).size : 0);
  }, 0);
  if (bytes > DOC_08_7.imageBytes) {
    fail(
      "image-total",
      `/${locale} carries ${kib(bytes)} of image in its markup, over 08 §7's \`resource-summary:image:size <= ${String(DOC_08_7.imageBytes)}\`.`,
    );
  }
}

/* ------------------------------------------------------------------------- *
 * What the reader sees
 * ------------------------------------------------------------------------- */

/**
 * The transfer figure, printed and never asserted (see the header).
 *
 * **Both encodings, and the verdict reads brotli.** 08 §7's `230400` is stated
 * against a brotli-11 measurement of exactly these files, because brotli is
 * what the CDN negotiates with every browser this site supports and so is what
 * `lighthouse-preview` will report. Printing gzip alone and calling it "over"
 * would compare one encoding's bytes to another encoding's budget and red a
 * summary that Lighthouse is about to pass — the wrong kind of wrong, since
 * this row exists to tell a reader where they stand before the deployment does.
 * gzip stays beside it as the worst case: it is what a client that cannot take
 * brotli receives, and its output does not move between library versions the
 * way brotli's does, so it is the more stable of the two to eyeball across
 * builds.
 */
const homeTransfer = ():
  { readonly locale: string; readonly gzip: number; readonly brotli: number } | undefined => {
  const first = [...homePages.entries()][0];
  if (first === undefined) return undefined;
  const [locale, html] = first;
  const seen = new Set<string>();
  let gzip = 0;
  let brotli = 0;
  for (const src of moduleScripts(html)) {
    if (seen.has(src)) continue;
    seen.add(src);
    const path = assetPath(src);
    if (!existsSync(path)) continue;
    const bytes = readFileSync(path);
    gzip += gzipSync(bytes, { level: 9 }).length;
    brotli += brotliCompressSync(bytes, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
      },
    }).length;
  }
  return { locale, gzip, brotli };
};

const transfer = homeTransfer();
if (transfer !== undefined) {
  summaryRows.push(
    `| script transfer \`/${transfer.locale}\` | ${kib(transfer.brotli)} brotli-11 (${kib(transfer.gzip)} gzip) | ${kib(DOC_08_7.scriptTransferBytes.home)} | ${
      transfer.brotli > DOC_08_7.scriptTransferBytes.home
        ? "over — asserted by `lighthouse-preview`, not here"
        : "ok"
    } |`,
  );
}

const errors = findings.filter((f) => f.severity === "error");
const notes = findings.filter((f) => f.severity === "note");

const report = [
  "## Performance budgets (`pnpm check:budget`)",
  "",
  ...summaryRows,
  "",
  ...notes.map((n) => `- note · \`${n.check}\` — ${n.message}`),
  ...errors.map((e) => `- **error · \`${e.check}\`** — ${e.message}`),
  "",
  errors.length === 0
    ? `Clean: ${String(routeStats.length)} routes and ${String(homePages.size)} home pages measured.`
    : `${String(errors.length)} budget failure(s).`,
  "",
].join("\n");

process.stdout.write(`${report}\n`);

const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile !== undefined && summaryFile !== "") {
  appendFileSync(summaryFile, `${report}\n`);
}

for (const error of errors) {
  if (process.env.GITHUB_ACTIONS) {
    process.stderr.write(`::error::check:budget ${error.check}: ${error.message}\n`);
  } else {
    process.stderr.write(`check:budget ${error.check}: ${error.message}\n`);
  }
}

process.exit(errors.length === 0 ? 0 : 1);
