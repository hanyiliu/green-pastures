import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { LOCALE_META, routing, type Locale } from "../src/i18n/routing";

/**
 * Shared rig for the routes end-to-end family (PR-6.10 · 10 §7 · 08 §5).
 *
 * Three specs sit on this file — `routes.spec.ts` (`@seo`, the localised 404),
 * `routes-links.spec.ts` (the internal-link crawl) and
 * `routes-transitions.spec.ts` (`@motion-vt`, `@nav-instant`) — and everything
 * they share that is not an assertion lives here: the route × locale matrix,
 * the URL builders, the link extractor, and the View-Transition spy.
 *
 * ── Why the matrix is derived here and not imported ──────────────────────
 *
 * `e2e/smoke.spec.ts` derives the same matrix from the same two sources, and
 * 10 §7's rule for this family is that it **extends, never edits** `e2e/smoke*`.
 * A spec file cannot export to another spec file without registering its tests
 * twice, so the derivation is written a second time rather than shared — and it
 * is written the same way, from `routing.locales` and `content/site.json`
 * `routes[]`, so the two cannot disagree about what the site is. Nothing in
 * this family is a literal list of routes or locales (INV-02.5, INV-06.2); the
 * counts fall out, which is what lets `D-10.12` withdraw `zh-Hant` or a seventh
 * `routes[]` entry appear with no edit here.
 *
 * ── What this family adds that `@smoke` does not have ────────────────────
 *
 * `@smoke` asserts, per page, that it answers 200, declares its locale and
 * carries the right `hreflang` set. This family asserts the things that are
 * only visible *across* pages and documents: that every locale's copy of a
 * route advertises the **same** alternate set and that each alternate resolves;
 * that `sitemap.xml` enumerates exactly the built matrix and that every URL it
 * advertises answers 200; that no `<a href>` anywhere on the site points at a
 * 404; and that the subpage slide of 05 §5.7 does what 05 §5.14 says it does.
 */

/* -------------------------------------------------------------------------- *
 * The route × locale matrix
 * -------------------------------------------------------------------------- */

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

/** One `content/site.json` `routes[]` entry (02 `D-02.12`). */
export type SiteRoute = {
  readonly id: string;
  readonly path: string;
  /** The home section this detail page was opened from (06 `D-06.8`). */
  readonly homeAnchor: string;
};

type SiteJson = { readonly routes: readonly SiteRoute[] };

const site = JSON.parse(readFileSync(join(REPO_ROOT, "content", "site.json"), "utf8")) as SiteJson;

/** The home page's locale-less path. The one route with no `routes[]` entry. */
export const HOME_PATH = "/";

/** `x-default`, the sentinel `hreflang` for readers no locale claims (`D-02.9`). */
export const X_DEFAULT = "x-default";

/** The six detail routes, in the order the owner wrote them. */
export const DETAIL_ROUTES: readonly SiteRoute[] = site.routes;

/** Every page path, locale-less: the home page plus `site.json` `routes[]`. */
export const ROUTE_PATHS: readonly string[] = [HOME_PATH, ...site.routes.map((r) => r.path)];

/**
 * Whether a route's page exists yet, read from the tree 06 `D-06.3` pins —
 * `app/[locale]/<segment>/page.tsx`, one explicit folder per detail page.
 *
 * The same derivation `e2e/smoke.spec.ts` uses, and for the same reason: a
 * route enters or leaves this family's matrix by its page file landing or
 * going, with no edit here. All six are built as of PR-6.2…6.7, so the filter
 * removes nothing today; it is what stops the transition suite trying to click
 * a "learn more →" link into a route that does not exist.
 */
const PAGE_FILE_EXTENSIONS = ["tsx", "ts", "jsx", "js"] as const;

export function hasPageFile(routePath: string): boolean {
  return PAGE_FILE_EXTENSIONS.some((extension) =>
    existsSync(
      join(
        REPO_ROOT,
        "src",
        "app",
        "[locale]",
        routePath === HOME_PATH ? "" : routePath,
        `page.${extension}`,
      ),
    ),
  );
}

/** Every page path whose `page.tsx` exists. */
export const BUILT_ROUTE_PATHS: readonly string[] = ROUTE_PATHS.filter(hasPageFile);

/** Every detail route whose `page.tsx` exists — the subpage list of 05 §5.14. */
export const BUILT_DETAIL_ROUTES: readonly SiteRoute[] = DETAIL_ROUTES.filter((route) =>
  hasPageFile(route.path),
);

export type RoutePair = {
  readonly locale: Locale;
  readonly routePath: string;
  /** The locale-prefixed path, e.g. `/zh-Hant/menu`. */
  readonly url: string;
};

/** `/` → `/en`; `/menu` → `/en/menu`. `localePrefix: 'always'`, no trailing slash. */
export function urlFor(locale: Locale, routePath: string): string {
  return routePath === HOME_PATH ? `/${locale}` : `/${locale}${routePath}`;
}

/** The home page's path in a locale — the target of every "← Back" pill. */
export function homeUrlFor(locale: Locale): string {
  return urlFor(locale, HOME_PATH);
}

/** Every built page in every enabled locale. 7 × 3 = 21 today; derived. */
export const BUILT_PAIRS: readonly RoutePair[] = routing.locales.flatMap((locale) =>
  BUILT_ROUTE_PATHS.map((routePath) => ({ locale, routePath, url: urlFor(locale, routePath) })),
);

/**
 * The `hreflang` → path map 06 §6.5 specifies for a route: one entry per
 * enabled locale plus `x-default` → the default locale's URL, sorted so two
 * sets can be compared without caring about emission order.
 *
 * It deliberately does not take the current locale: 06 §6.5 makes the alternate
 * set identical on every locale's copy of a page, and a function that cannot
 * see the locale cannot make it otherwise.
 */
export function expectedAlternatePaths(routePath: string): Array<[string, string]> {
  const entries: Array<[string, string]> = routing.locales.map((locale) => [
    LOCALE_META[locale].hreflang,
    urlFor(locale, routePath),
  ]);
  entries.push([X_DEFAULT, urlFor(routing.defaultLocale, routePath)]);
  return entries.sort(([a], [b]) => a.localeCompare(b));
}

/* -------------------------------------------------------------------------- *
 * Copy, read from the content tree (INV-08.5)
 * -------------------------------------------------------------------------- */

type Tree = Record<string, unknown>;

function isTree(value: unknown): value is Tree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 02 `D-02.8`'s production deep-merge, the one `pnpm start` serves. */
function deepMerge(base: Tree, override: Tree): Tree {
  const merged: Tree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = merged[key];
    merged[key] = isTree(existing) && isTree(value) ? deepMerge(existing, value) : value;
  }
  return merged;
}

function readNamespace(locale: Locale, namespace: string): Tree {
  const path = join(REPO_ROOT, "content", locale, "messages", `${namespace}.json`);
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  return isTree(parsed) ? parsed : {};
}

const NAMESPACE_CACHE = new Map<string, Tree>();

/**
 * A message namespace as the running server resolves it for `locale`.
 *
 * The merge is not a nicety: `content/zh-Hant/messages/errors.json` may hold
 * none of `notFound.*` yet, so a `zh-Hant` assertion reading only the Chinese
 * file would compare the page against `undefined`, and one that spelled the
 * English out would go stale the day it is translated.
 */
export function localeMessages(locale: Locale, namespace: string): Tree {
  const key = `${locale}/${namespace}`;
  const cached = NAMESPACE_CACHE.get(key);
  if (cached !== undefined) return cached;

  const reference = readNamespace(routing.defaultLocale, namespace);
  const tree =
    locale === routing.defaultLocale
      ? reference
      : deepMerge(reference, readNamespace(locale, namespace));
  NAMESPACE_CACHE.set(key, tree);
  return tree;
}

/**
 * One string out of a message tree, by dotted path.
 *
 * Throws rather than returning `undefined`, so a key renamed in 02 fails at the
 * assertion that reads it and not three lines later with an "expected
 * undefined" that names nothing.
 */
export function copy(tree: Tree, path: string): string {
  let node: unknown = tree;
  for (const segment of path.split(".")) {
    node = isTree(node) ? node[segment] : undefined;
  }
  if (typeof node !== "string") {
    throw new Error(`No string at "${path}" in the message tree (02 rule 10).`);
  }
  return node;
}

/* -------------------------------------------------------------------------- *
 * HTML: the pieces the `@seo` and link assertions read
 * -------------------------------------------------------------------------- */

/** `&amp;` is the only entity Next writes into an href it generates. */
function decodeEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

/**
 * Every `href` on an `<a>` element in a served document.
 *
 * `<a>` only, and matched on the served markup rather than in a browser: a
 * `<link rel=…>`, a `<script src=…>` and the hrefs inside the RSC flight
 * payload are not links a reader can follow, and pulling them into the crawl
 * would turn every stylesheet into a "broken link" candidate. Elements are
 * matched with the tag boundary spelled out (`<a` followed by whitespace or
 * `>`), so `<abbr>` and `<article>` cannot masquerade as anchors.
 */
export function anchorHrefs(html: string): string[] {
  const hrefs: string[] = [];
  const pattern = /<a(?=[\s>])[^>]*?\shref="([^"]*)"/gi;
  let match = pattern.exec(html);
  while (match !== null) {
    hrefs.push(decodeEntities(match[1] ?? ""));
    match = pattern.exec(html);
  }
  return hrefs;
}

/** One `rel="alternate"` tag: its `hreflang` and its `href` as written. */
export type AlternateLink = readonly [hreflang: string, href: string];

/**
 * The `hreflang` set a document declares, as `[hreflang, href]` pairs sorted by
 * tag.
 *
 * Two spellings have to be read. Next writes the attribute as `hrefLang` in the
 * markup it streams — the same attribute to a parser and a different string to
 * a regex — so the pattern is case-insensitive; and `sitemap.xml` writes the
 * element as `<xhtml:link>`, so the tag name takes an optional namespace
 * prefix. One reader for both is what lets a page and its sitemap entry be
 * compared without a second parser.
 */
export function alternateLinks(html: string): AlternateLink[] {
  const pairs: AlternateLink[] = [];
  const pattern = /<(?:[a-z]+:)?link\b[^>]*\brel="alternate"[^>]*>/gi;
  let match = pattern.exec(html);
  while (match !== null) {
    const tag = match[0];
    const hreflang = /\bhreflang="([^"]*)"/i.exec(tag)?.[1];
    const href = /\bhref="([^"]*)"/i.exec(tag)?.[1];
    if (hreflang !== undefined && href !== undefined) {
      pairs.push([hreflang, decodeEntities(href)]);
    }
    match = pattern.exec(html);
  }
  return pairs.sort(([a], [b]) => a.localeCompare(b));
}

/** The same pairs with each href reduced to its path, for matrix comparison. */
export function toPathPairs(pairs: readonly AlternateLink[], origin: string): AlternateLink[] {
  return pairs.map(([hreflang, href]) => [hreflang, new URL(href, origin).pathname] as const);
}

/** The `<link rel="canonical">` href, or `null` if the document declares none. */
export function canonicalHref(html: string): string | null {
  const tag = /<link\b[^>]*\brel="canonical"[^>]*>/i.exec(html)?.[0];
  const href = tag === undefined ? undefined : /\bhref="([^"]*)"/i.exec(tag)?.[1];
  return href === undefined ? null : decodeEntities(href);
}

/* -------------------------------------------------------------------------- *
 * The internal-link crawl
 * -------------------------------------------------------------------------- */

/** What a crawler does with one `href`. */
export type LinkVerdict =
  | { readonly kind: "internal"; readonly path: string; readonly fragment: string }
  | { readonly kind: "external"; readonly href: string }
  | { readonly kind: "non-http"; readonly href: string };

/**
 * Classify one `href` found on `pageUrl`.
 *
 * `mailto:` and `tel:` are `non-http` — real links, but nothing a crawler can
 * request. Anything resolving to another origin is `external`: this suite must
 * not make Yelp or Google Maps a dependency of a pull request (INV-08.7's
 * hermetic-run goal), and their availability is not this repository's defect.
 * Everything else is `internal` and is split into the path a request can be
 * made against and the fragment that has to exist in the answer.
 */
export function classifyLink(href: string, pageUrl: string, origin: string): LinkVerdict {
  const trimmed = href.trim();

  // `pageUrl` arrives in the path form the matrix uses (`/en/menu`), and a
  // *relative* base makes `new URL` throw for every input — absolute ones
  // included, since the base is validated before the input is examined. Left
  // unresolved, every link on the site classifies as `non-http` and every page
  // reports zero links to follow: a suite that fetches nothing and passes. It
  // did exactly that until the per-page "yielded no internal links" guard in
  // `routes-links.spec.ts` said so, which is the reason that guard exists.
  const base = safeResolve(pageUrl, origin);
  if (base === null) return { kind: "non-http", href: trimmed };

  const resolved = safeResolve(trimmed, base.toString());
  if (resolved === null) return { kind: "non-http", href: trimmed };
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    return { kind: "non-http", href: trimmed };
  }
  if (resolved.origin !== new URL(origin).origin) return { kind: "external", href: trimmed };
  return {
    kind: "internal",
    path: `${resolved.pathname}${resolved.search}`,
    fragment: decodeURIComponent(resolved.hash.replace(/^#/, "")),
  };
}

function safeResolve(href: string, base: string): URL | null {
  try {
    return new URL(href, base);
  } catch {
    return null;
  }
}

/**
 * Fetch one internal path and report its status, following nothing.
 *
 * `maxRedirects: 0` is the point rather than a detail. Following redirects
 * would let `/en/` — the trailing-slash form 06 `D-06.6` rules out — pass as a
 * healthy link, because a 308 to `/en` and a direct 200 are the same thing to a
 * follower. An internal href in this codebase is written from
 * `site.json.routes[]` and should already be the canonical form, so anything
 * other than 200 is a finding.
 */
export async function statusOf(request: APIRequestContext, path: string): Promise<number> {
  const response = await request.get(path, { failOnStatusCode: false, maxRedirects: 0 });
  return response.status();
}

/** Whether a document contains an element with `id`. */
export function hasElementId(html: string, id: string): boolean {
  return new RegExp(`\\sid="${escapeForRegExp(id)}"`).test(html);
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* -------------------------------------------------------------------------- *
 * `sitemap.xml`
 * -------------------------------------------------------------------------- */

export type SitemapEntry = {
  readonly loc: string;
  readonly alternates: AlternateLink[];
};

/**
 * Parse `sitemap.xml` into `<loc>` plus its `xhtml:link` alternates.
 *
 * A regex rather than an XML parser because the shape is Next's own
 * `MetadataRoute.Sitemap` serialisation and the repository has no XML
 * dependency to add for one file. The `<url>` blocks are split first so an
 * alternate can never be attributed to the wrong `<loc>`.
 */
export function parseSitemap(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const blocks = /<url>([\s\S]*?)<\/url>/g;
  let block = blocks.exec(xml);
  while (block !== null) {
    const body = block[1] ?? "";
    const loc = /<loc>([^<]*)<\/loc>/.exec(body)?.[1];
    if (loc !== undefined) {
      entries.push({ loc: decodeEntities(loc), alternates: alternateLinks(body) });
    }
    block = blocks.exec(xml);
  }
  return entries;
}

/* -------------------------------------------------------------------------- *
 * Locators the transition suite drives
 * -------------------------------------------------------------------------- */

/**
 * The "learn more →" link on the home page that opens `routePath`.
 *
 * Located by its `href` rather than by its words: the label is a translated
 * string per section and per locale (`home.<section>.link`), and INV-08.5 keeps
 * English literals out of assertions. The href is what 06 `D-06.2` fixes —
 * the same slug in every locale, prefixed by the locale segment.
 */
export function learnMoreLink(page: Page, locale: Locale, routePath: string): Locator {
  return page.locator(`a[href="${urlFor(locale, routePath)}"]`).first();
}

/**
 * The "← Back" pill in a detail page's subpage bar.
 *
 * Scoped to `[data-subpage="<id>"]`, the attribute `SubpageBar` puts on the
 * panel, because the site header on the same page carries a nav anchor to the
 * *same* href — `/en#philosophy` is both the Back target and the nav's
 * Philosophy link — and an unscoped locator would be ambiguous on four of the
 * six routes.
 */
export function backPill(page: Page, route: SiteRoute, locale: Locale): Locator {
  return page.locator(
    `[data-subpage="${route.id}"] a[href="${homeUrlFor(locale)}#${route.homeAnchor}"]`,
  );
}

/** The id of a detail page's `h1`, and of its origin section's heading on home. */
export function headingId(anchor: string): string {
  return `${anchor}-title`;
}

/* -------------------------------------------------------------------------- *
 * The View-Transition spy (05 §5.7, 08 §5 `@motion-vt` / `@nav-instant`)
 * -------------------------------------------------------------------------- */

/** One `gp-slide-*` animation, as the browser reports it mid-transition. */
export type SlideAnimation = {
  readonly name: string;
  readonly pseudoElement: string;
  readonly durationMs: number | null;
  readonly keyframes: readonly {
    readonly offset: number;
    readonly easing: string;
    readonly translate: string;
  }[];
};

/**
 * Everything one view transition was observed to be, sampled at `ready` — the
 * moment the pseudo-element tree exists and the animations are about to run.
 */
export type TransitionRecord = {
  /** The `transitionTypes` the navigation carried. Empty for an untyped one. */
  readonly types: readonly string[];
  readonly slides: readonly SlideAnimation[];
  /** Computed opacity of `::view-transition-group(root)` — 05 §5.7's one line. */
  readonly groupRootOpacity: string;
  readonly oldRootOpacity: string;
  readonly newRootOpacity: string;
  /** Computed `pointer-events` of the `::view-transition` overlay. */
  readonly overlayPointerEvents: string;
  /** `--ease-soft` and `--dur-subpage` as `:root` resolves them, for comparison. */
  readonly easeSoftToken: string;
  readonly durSubpageToken: string;
};

type ViewTransitionSpy = {
  records: TransitionRecord[];
  /** Set before a navigation to hold the next transition still (see below). */
  freeze: boolean;
  /** How many transitions have been frozen — the signal a test waits on. */
  frozen: number;
};

declare global {
  var __gpViewTransitions: ViewTransitionSpy | undefined;
}

/**
 * Where a frozen transition is held, in milliseconds.
 *
 * The figure the OQ-05.2 spike used, and for its reason: 150 ms into a 500 ms
 * `--ease-soft` slide the panel is part-way across, so both pages are on
 * screen and the two §5.7 regressions are observable. It is not a design token
 * and nothing animates over it — it is where the clock is stopped to take a
 * reading.
 */
const FREEZE_AT_MS = 150;

/**
 * Install the spy before any bundle runs.
 *
 * It wraps `document.startViewTransition` rather than watching for
 * pseudo-elements, because the two things `@motion-vt` needs are only knowable
 * at the call: the **types** the navigation carried, which no later observation
 * recovers, and the state at `ready`, which is over in 500 ms. Recording at
 * `ready` and *not* pausing is what lets one test drive a whole
 * forward-then-Back cycle; the pause is opt-in through {@link armFreeze} for
 * the two tests that have to hold the slide still to look at it.
 */
export async function spyOnViewTransitions(page: Page): Promise<void> {
  await page.addInitScript((freezeAt: number) => {
    const spy: ViewTransitionSpy = { records: [], freeze: false, frozen: 0 };
    globalThis.__gpViewTransitions = spy;

    const start = document.startViewTransition?.bind(document);
    if (start === undefined) return;

    document.startViewTransition = (options) => {
      const types =
        typeof options === "object" && options !== null && "types" in options
          ? [...(options.types ?? [])]
          : [];

      const transition = start(options);

      void transition.ready.then(
        () => {
          const root = document.documentElement;
          const styleOf = (pseudo: string) => getComputedStyle(root, pseudo);
          const rootStyle = getComputedStyle(root);

          const slides = document
            .getAnimations()
            .map((animation) => {
              const effect = animation.effect;
              const name = (animation as { animationName?: unknown }).animationName;
              if (!(effect instanceof KeyframeEffect)) return null;
              if (typeof name !== "string" || !name.startsWith("gp-slide")) return null;
              const duration = effect.getTiming().duration;
              return {
                name,
                pseudoElement: effect.pseudoElement ?? "",
                durationMs: typeof duration === "number" ? duration : null,
                keyframes: effect.getKeyframes().map((frame) => ({
                  offset: frame.computedOffset,
                  easing: frame.easing,
                  translate: String(frame["translate"] ?? ""),
                })),
              };
            })
            .filter((slide) => slide !== null);

          spy.records.push({
            types,
            slides,
            groupRootOpacity: styleOf("::view-transition-group(root)").opacity,
            oldRootOpacity: styleOf("::view-transition-old(root)").opacity,
            newRootOpacity: styleOf("::view-transition-new(root)").opacity,
            overlayPointerEvents: styleOf("::view-transition").pointerEvents,
            easeSoftToken: rootStyle.getPropertyValue("--ease-soft").trim(),
            durSubpageToken: rootStyle.getPropertyValue("--dur-subpage").trim(),
          });

          if (!spy.freeze) return;
          for (const animation of document.getAnimations()) {
            animation.pause();
            animation.currentTime = freezeAt;
          }
          spy.frozen += 1;
        },
        () => {
          // A skipped transition rejects `ready`. Nothing to record: the
          // navigation still happened and the URL/focus assertions cover it.
        },
      );

      return transition;
    };
  }, FREEZE_AT_MS);
}

/**
 * Remove `startViewTransition` before any bundle runs — the unsupported-browser
 * path of 05 §5.7, and the whole of `@nav-instant`.
 *
 * The property is deleted from `Document.prototype` as well as from the
 * instance: it lives on the prototype in Chromium, so deleting only the own
 * property would leave the method reachable and the test would measure the
 * supported path while claiming to measure the other one.
 */
export async function removeViewTransitions(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Reflect.deleteProperty(Document.prototype, "startViewTransition");
    Reflect.deleteProperty(document, "startViewTransition");
  });
}

/** Arm the spy so the next transition is paused at {@link FREEZE_AT_MS}. */
export async function armFreeze(page: Page): Promise<void> {
  await page.evaluate(() => {
    const spy = globalThis.__gpViewTransitions;
    if (spy !== undefined) spy.freeze = true;
  });
}

/** Wait until `count` transitions have been recorded, then return them all. */
export async function transitionRecords(
  page: Page,
  count: number,
): Promise<readonly TransitionRecord[]> {
  await page.waitForFunction(
    (expected: number) => (globalThis.__gpViewTransitions?.records.length ?? 0) >= expected,
    count,
  );
  return page.evaluate(() => globalThis.__gpViewTransitions?.records ?? []);
}

/** Wait until a transition has been frozen mid-slide. */
export async function waitForFrozenSlide(page: Page): Promise<void> {
  await page.waitForFunction(() => (globalThis.__gpViewTransitions?.frozen ?? 0) >= 1);
}

/** What the snapshot tree computes to, read live rather than from a record. */
export type FrozenSlide = {
  readonly groupRootOpacity: string;
  readonly oldRootOpacity: string;
  readonly overlayPointerEvents: string;
  /** How far the arriving panel has travelled, as a computed `translate`. */
  readonly slideCount: number;
};

/**
 * Read the held-still snapshot tree.
 *
 * Separate from {@link TransitionRecord}, which samples at `ready`: this runs
 * while the animations are paused part-way, which is the only moment both
 * pages are on screen and the two 05 §5.7 regressions are observable.
 */
export function frozenSlide(page: Page): Promise<FrozenSlide> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return {
      groupRootOpacity: getComputedStyle(root, "::view-transition-group(root)").opacity,
      oldRootOpacity: getComputedStyle(root, "::view-transition-old(root)").opacity,
      overlayPointerEvents: getComputedStyle(root, "::view-transition").pointerEvents,
      slideCount: document.getAnimations().filter((animation) => {
        const name = (animation as { animationName?: unknown }).animationName;
        return typeof name === "string" && name.startsWith("gp-slide");
      }).length,
    };
  });
}

/** The page's vertical scroll offset, rounded. */
export function scrollY(page: Page): Promise<number> {
  return page.evaluate(() => Math.round(window.scrollY));
}

/** `history.length`, the only observable that separates a push from a replace. */
export function historyLength(page: Page): Promise<number> {
  return page.evaluate(() => history.length);
}

/** Whether `document.startViewTransition` is callable in this page. */
export function hasViewTransitions(page: Page): Promise<boolean> {
  return page.evaluate(() => typeof document.startViewTransition === "function");
}

/** How many `::view-transition` pseudo-element animations are running now. */
export function liveViewTransitionAnimations(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((animation) =>
          (animation.effect instanceof KeyframeEffect
            ? (animation.effect.pseudoElement ?? "")
            : ""
          ).includes("view-transition"),
        ).length,
  );
}

/**
 * Wait two animation frames.
 *
 * The one place a wait is not a timeout in disguise (`D-08.13`): asserting that
 * something did **not** happen needs a defined "by now", and "the browser has
 * painted twice since the navigation committed" is that, in the units the
 * behaviour under test is written in. Frames, not milliseconds — a slower
 * machine gets the same two frames.
 */
export async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

/** The id of the focused element, or its tag name when it has none. */
export function focusedId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement;
    return active === null ? "" : active.id || active.tagName;
  });
}

/** What the pointer would hit at a viewport point, as a tag name. */
export function hitTestTagAt(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(
    ([px, py]: readonly [number, number]) => document.elementFromPoint(px, py)?.tagName ?? "",
    [x, y] as const,
  );
}

/* -------------------------------------------------------------------------- *
 * Comparing what the browser reports with what 05 fixes
 * -------------------------------------------------------------------------- */

/**
 * The four control points of a `cubic-bezier(…)`, or `null`.
 *
 * A string comparison is not available here and the reason is worth stating:
 * `--ease-soft` reaches the page minified to `cubic-bezier(.2, .8, .25, 1)`
 * while the keyframe reports `cubic-bezier(0.2, 0.8, 0.25, 1)`. Same curve,
 * different text. Comparing numbers is what lets the assertion read the token
 * out of `:root` — so it stays a comparison against 03's value and never
 * becomes the animation compared with itself.
 */
export function bezierPoints(value: string): number[] | null {
  const inner = /cubic-bezier\(([^)]*)\)/i.exec(value)?.[1];
  if (inner === undefined) return null;
  const points = inner.split(",").map((part) => Number.parseFloat(part.trim()));
  return points.length === 4 && points.every((n) => Number.isFinite(n)) ? points : null;
}

/** A CSS `<time>` in milliseconds — `500ms` and `.5s` are the same number. */
export function timeToMs(value: string): number | null {
  const match = /^([\d.]+)(ms|s)$/.exec(value.trim());
  const amount = Number.parseFloat(match?.[1] ?? "");
  if (!Number.isFinite(amount)) return null;
  return match?.[2] === "s" ? amount * 1000 : amount;
}
