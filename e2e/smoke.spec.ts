import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { LOCALE_META, routing, type Locale } from "../src/i18n/routing";

/**
 * The route × locale smoke matrix (PR-3.6 · INV-02.5 · 08 §5 `@smoke`).
 *
 * INV-02.5 is the invariant "every route renders in every locale". This file is
 * the only place it is enforced, and the enforcement is worth exactly as much as
 * the matrix is honest — so **nothing here is a literal list**:
 *
 * - locales come from `routing.locales` (02 `D-02.1`), so PR-3.9 adding
 *   `zh-Hant` widens the matrix by half with no edit to this file, and the
 *   `D-10.12` fallback that removes it again narrows it the same way;
 * - routes come from `content/site.json` `routes[]` plus `/` — 08 §5's wording
 *   ("`/` plus the six detail pages in `site.json.routes[]`"), the home route
 *   being the one page that is not a `routes[]` entry because it has no path of
 *   its own.
 *
 * The count therefore falls out rather than being asserted: 7 × 3 = 21 pairs
 * since PR-3.9 enabled `zh-Hant`, 14 again if `D-10.12` withdraws it (06 §6.1).
 * The *route × locale matrix*
 * describe below fails if either source ever arrives empty, because a matrix of
 * zero tests is a green run that measured nothing.
 *
 * Per pair this asserts what INV-02.5 and 08 §5 name: HTTP 200, `<html lang>`
 * equal to the locale id verbatim, no `⟦…⟧` missing-key marker anywhere in the
 * rendered document, and the `hreflang` set 06 `D-06.10` specifies.
 *
 * Scope of the marker check (08 §5 note (a)): under `next start` the production
 * loader deep-merges a locale gap to `en`, so `⟦` can only ever mean a key
 * missing from **`en` itself**. Chinese gaps are the `content` job's business
 * (INV-02.2), not this one's — a `zh-Hant` page of fluent English passes here by
 * design.
 */

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

/** 02 §Loading's dev fallback: a key with no value renders `⟦namespace.key⟧`. */
const MISSING_KEY_MARKER = "⟦";

type SiteRoute = { readonly id: string; readonly path: string };
type SiteJson = { readonly routes: readonly SiteRoute[] };

const site = JSON.parse(readFileSync(join(REPO_ROOT, "content", "site.json"), "utf8")) as SiteJson;

/**
 * Every page path, locale-less. `/` is the home route; the rest are read from
 * the content tree, so a seventh detail page is one `site.json` entry and no
 * change here.
 */
const ROUTE_PATHS: readonly string[] = ["/", ...site.routes.map((route) => route.path)];

/** `/` → `/en`; `/menu` → `/en/menu`. `localePrefix: 'always'`, no trailing slash. */
const urlFor = (id: Locale, routePath: string): string =>
  routePath === "/" ? `/${id}` : `/${id}${routePath}`;

/**
 * Whether a route's page exists yet, read from the tree 06 `D-06.3` pins: one
 * explicit folder per detail page, `app/[locale]/<segment>/page.tsx`, never a
 * `[slug]`.
 *
 * Phase 3 has built `app/[locale]/page.tsx` and nothing else — PR-6.2…6.7 build
 * the six detail routes. Deriving the split from the filesystem rather than from
 * a list in this file means those PRs widen the live matrix by landing their
 * page, with no edit here and no chance of anyone forgetting to make one. The
 * routes that are not built yet are not dropped: the *routes not built yet*
 * describe below holds each of them to a 404, so a route that starts answering
 * some *other* way — a rewrite, a catch-all that renders instead of calling
 * `notFound()` — fails loudly instead of quietly leaving the matrix.
 */
const PAGE_FILE_EXTENSIONS = ["tsx", "ts", "jsx", "js"] as const;

const hasPageFile = (routePath: string): boolean =>
  PAGE_FILE_EXTENSIONS.some((extension) =>
    existsSync(
      join(
        REPO_ROOT,
        "src",
        "app",
        "[locale]",
        routePath === "/" ? "" : routePath,
        `page.${extension}`,
      ),
    ),
  );

type Pair = { readonly id: Locale; readonly routePath: string; readonly url: string };

const PAIRS: readonly Pair[] = routing.locales.flatMap((id) =>
  ROUTE_PATHS.map((routePath) => ({ id, routePath, url: urlFor(id, routePath) })),
);

const BUILT = PAIRS.filter((pair) => hasPageFile(pair.routePath));
const NOT_BUILT_YET = PAIRS.filter((pair) => !hasPageFile(pair.routePath));

/**
 * 06 `D-06.10`: every page's `alternates.languages` carries one entry per
 * enabled locale plus `x-default` → the default locale's URL, rendered as
 * `<link rel="alternate" hreflang="…">` tags and *only* as tags
 * (`alternateLinks: false`, `D-02.9` — one source, so the `Link` header and the
 * markup cannot disagree).
 *
 * That helper is PR-6.8's, which shipped it with no caller: every route emitted
 * zero alternates, and the pending half of the *hreflang set* describe below
 * held them to zero so the gap could not go unnoticed. The constant is `true`
 * from the commit that gave `app/[locale]/page.tsx` its `generateMetadata` —
 * the home page was the last built route emitting none, so the real assertion
 * now runs on every built pair and PR-6.2…6.7 arrive already satisfying it.
 *
 * It stays a constant rather than becoming the literal `BUILT`, because the two
 * halves are the two positions of one switch: withdrawing the alternates re-arms
 * the zero-tag guard in the same one-word edit that turned it off.
 */
const HREFLANG_ALTERNATES_LANDED: boolean = true;

const HREFLANG_ASSERTED = HREFLANG_ALTERNATES_LANDED ? BUILT : [];
const HREFLANG_PENDING = HREFLANG_ALTERNATES_LANDED ? [] : BUILT;

/** The `hreflang` → pathname map 06 §6.5 writes out, derived per route. */
const expectedAlternates = (routePath: string): Array<[string, string]> =>
  [
    ...routing.locales.map((id): [string, string] => [
      LOCALE_META[id].hreflang,
      urlFor(id, routePath),
    ]),
    ["x-default", urlFor(routing.defaultLocale, routePath)] as [string, string],
  ].sort(([a], [b]) => a.localeCompare(b));

test.describe("route × locale matrix", () => {
  test("is derived from routing.locales × site.json routes @smoke", () => {
    expect(routing.locales.length, "routing.locales is empty").toBeGreaterThan(0);
    expect(site.routes.length, "site.json routes[] is empty").toBeGreaterThan(0);
    expect(PAIRS).toHaveLength(ROUTE_PATHS.length * routing.locales.length);
    expect(BUILT.length + NOT_BUILT_YET.length).toBe(PAIRS.length);

    // Every enabled locale reaches the assertions above — `/` is always built,
    // so a locale that appears in no live pair means the matrix silently lost
    // it. This is the check PR-3.9 is aimed at.
    const covered = new Set(BUILT.map((pair) => pair.id));
    expect([...covered].sort()).toEqual([...routing.locales].sort());
  });

  test("declares <html lang> as the locale id verbatim @smoke", () => {
    // 02 `D-02.1`: the id, the URL segment, the `<html lang>` and the `hreflang`
    // are the same string. Every page assertion below leans on that, so it is
    // checked once here rather than inferred.
    const drift = routing.locales.filter(
      (id) => LOCALE_META[id].htmlLang !== id || LOCALE_META[id].hreflang !== id,
    );
    expect(drift).toEqual([]);
  });
});

test.describe("every route renders in every locale", () => {
  for (const pair of BUILT) {
    test(`${pair.url} @smoke`, async ({ page }) => {
      const response = await page.goto(pair.url);

      expect(response?.status(), `${pair.url} did not answer 200`).toBe(200);

      await expect(page.locator("html")).toHaveAttribute("lang", pair.id);

      // The whole document, not just `<body>`: a missing key in a `<title>` or a
      // meta description is the same defect and is invisible to a body scan.
      const renderedHtml = await page.content();
      expect(
        renderedHtml,
        `${pair.url} rendered a ⟦…⟧ missing-key marker — a key is missing from content/en`,
      ).not.toContain(MISSING_KEY_MARKER);

      // `alternateLinks: false` (`D-02.9`): hreflang lives in the markup and
      // nowhere else, so next-intl's `Link` header must never carry it.
      const linkHeader = response?.headers()["link"] ?? "";
      expect(linkHeader, `${pair.url} served hreflang in a Link header`).not.toContain("hreflang");
    });
  }
});

test.describe("hreflang set", () => {
  for (const pair of HREFLANG_ASSERTED) {
    test(`${pair.url} lists every enabled locale plus x-default @smoke`, async ({
      page,
      baseURL,
    }) => {
      await page.goto(pair.url);

      const alternates = page.locator('link[rel="alternate"][hreflang]');
      const found: Array<[string, string]> = [];

      for (const link of await alternates.all()) {
        const hreflang = await link.getAttribute("hreflang");
        const href = await link.getAttribute("href");
        found.push([hreflang ?? "", new URL(href ?? "", baseURL).pathname]);
      }

      expect(found.sort(([a], [b]) => a.localeCompare(b))).toEqual(
        expectedAlternates(pair.routePath),
      );
    });
  }

  for (const pair of HREFLANG_PENDING) {
    test(`${pair.url} emits no hreflang alternates @smoke`, async ({ page }) => {
      await page.goto(pair.url);

      // The `false` position of `HREFLANG_ALTERNATES_LANDED`, and empty while
      // the constant is `true`. It is the guard for the other direction: a
      // release that withdraws the alternates flips the constant back and this
      // half proves the tags are gone from every built route, rather than
      // leaving a page half-tagged.
      await expect(
        page.locator('link[rel="alternate"][hreflang]'),
        `${pair.url} emits hreflang alternates — flip HREFLANG_ALTERNATES_LANDED to true`,
      ).toHaveCount(0);
    });
  }
});

test.describe("routes not built yet", () => {
  for (const pair of NOT_BUILT_YET) {
    test(`${pair.url} 404s until its page.tsx lands @smoke`, async ({ request }) => {
      const response = await request.get(pair.url);

      // Not a skip: the pair stays in the matrix and stays measured. `hasPageFile`
      // moves it into the live half the moment the route's page exists, so this
      // failing means either the route was built (good — nothing to do, the live
      // half picked it up and this test disappears with it) or something is
      // serving the URL that should not be.
      expect(
        response.status(),
        `${pair.url} answered ${String(response.status())} — is its page built?`,
      ).toBe(404);
    });
  }
});
