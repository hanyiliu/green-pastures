import { expect, test, type APIRequestContext } from "@playwright/test";

import { routing } from "../src/i18n/routing";

import {
  anchorHrefs,
  BUILT_PAIRS,
  classifyLink,
  hasElementId,
  statusOf,
  type LinkVerdict,
} from "./routes-support";

/**
 * The internal-link crawl (PR-6.10 · 10 §7 · Phase 6 exit gate: "no broken
 * links").
 *
 * Every `<a href>` on every built page in every enabled locale is followed one
 * hop and has to answer 200. The seeds are the whole route × locale matrix, so
 * one hop is total coverage: there is nowhere on this site a reader can be that
 * is not itself a seed.
 *
 * ── Why this row exists at all ───────────────────────────────────────────
 *
 * For most of Phase 6 the site advertised six routes per locale that did not
 * exist. `sitemap.xml` listed them because `sitemap.ts` reads `site.json`
 * `routes[]`, the home page's "learn more →" links pointed at them because
 * `LearnMoreLink` reads the same list, and nothing anywhere said the
 * destinations 404ed — `@smoke` held the unbuilt half of its matrix *to* a 404,
 * which was right for Phase 3 and says nothing about a link. This spec and the
 * sitemap tests in `routes.spec.ts` are what make that permanently untrue.
 *
 * ── What counts as broken ────────────────────────────────────────────────
 *
 * Three things, and each is a separate failure list so the message names the
 * defect rather than a count:
 *
 *  1. **A status other than 200.** Followed with `maxRedirects: 0` on purpose —
 *     an internal href in this codebase is built from `site.json.routes[]` and
 *     is already the canonical form, so a 308 means someone wrote `/en/` and
 *     06 `D-06.6` rules that out. Following the redirect would hide it.
 *  2. **A fragment with no element.** `/en#philosophy` from a subpage is a
 *     cross-document fragment: the target has to have the id, or the reader
 *     lands at the top of a page they did not ask for. Same-page fragments
 *     (`#main`, the skip link) are checked against their own document.
 *  3. **A page with no links at all.** Not a broken link — a broken crawl. Every
 *     page carries the header nav, so a seed that yields nothing means the
 *     extractor stopped working and the run would otherwise be 21 green tests
 *     that fetched nothing.
 *
 * ── What is deliberately not followed ────────────────────────────────────
 *
 * `mailto:` and `tel:` are real links with nothing to request. Off-origin links
 * — the Yelp page, the Google Maps address — are not requested either: making a
 * pull request depend on Yelp being reachable from the runner is exactly the
 * hermetic-run failure INV-08.7 exists to prevent, and Yelp being down is not a
 * defect in this repository. Their *presence* is 04's business and their
 * attributes are `@a11y`'s (PR-8.4).
 *
 * ── One finding this crawl surfaced, since fixed ─────────────────────────
 *
 * For a while nothing on the site linked to `/{locale}/reviews`: 04 §3.5 sent
 * the home Testimonials link to Yelp rather than to the subpage, overruling the
 * design's own `data-subpage="reviews"`, and the page was reachable by URL and
 * from `sitemap.xml` and from no anchor anywhere. A crawl is where someone
 * would expect to find that out, and this file is where it was written down.
 * 04 §3.5 now sends that link to the subpage — Yelp is the reviews page's own
 * button, one hop on — so the reviews route is an ordinary seed with ordinary
 * inbound links, and `routes-transitions.spec.ts` is what holds the home page
 * to still carrying them (`UNLINKED_ROUTE_IDS`, now empty).
 */

/** A link that failed, in the shape the failure message prints. */
type BrokenLink = { readonly from: string; readonly href: string; readonly why: string };

/**
 * Per-worker memo of `path → status`.
 *
 * The header and footer are on all 21 pages, so the same dozen targets would
 * otherwise be requested 21 times each. Scoped to the module, which in
 * Playwright means one per worker process — enough to matter, and never shared
 * across workers in a way that could make one test's result depend on another's
 * having run.
 */
const STATUS_CACHE = new Map<string, Promise<number>>();

function cachedStatus(request: APIRequestContext, path: string): Promise<number> {
  const hit = STATUS_CACHE.get(path);
  if (hit !== undefined) return hit;
  const pending = statusOf(request, path);
  STATUS_CACHE.set(path, pending);
  return pending;
}

/** Per-worker memo of `path → served HTML`, for the fragment checks. */
const BODY_CACHE = new Map<string, Promise<string>>();

function cachedBody(request: APIRequestContext, path: string): Promise<string> {
  const hit = BODY_CACHE.get(path);
  if (hit !== undefined) return hit;
  const pending = request
    .get(path, { failOnStatusCode: false, maxRedirects: 0 })
    .then((response) => response.text());
  BODY_CACHE.set(path, pending);
  return pending;
}

/** Every internal link on one page, de-duplicated, with its verdict. */
function internalTargets(html: string, pageUrl: string, origin: string) {
  const seen = new Map<string, Extract<LinkVerdict, { kind: "internal" }>>();
  for (const href of anchorHrefs(html)) {
    const verdict = classifyLink(href, pageUrl, origin);
    if (verdict.kind !== "internal") continue;
    seen.set(`${verdict.path}#${verdict.fragment}`, verdict);
  }
  return [...seen.values()];
}

/** Check one page's internal links and return everything wrong with them. */
async function brokenLinksOn(
  request: APIRequestContext,
  pageUrl: string,
  origin: string,
): Promise<{ readonly checked: number; readonly broken: BrokenLink[] }> {
  const html = await cachedBody(request, pageUrl);
  const targets = internalTargets(html, pageUrl, origin);
  const broken: BrokenLink[] = [];

  for (const target of targets) {
    const status = await cachedStatus(request, target.path);
    if (status !== 200) {
      broken.push({ from: pageUrl, href: target.path, why: `answered ${String(status)}` });
      continue;
    }
    if (target.fragment === "") continue;

    const body = await cachedBody(request, target.path);
    if (!hasElementId(body, target.fragment)) {
      broken.push({
        from: pageUrl,
        href: `${target.path}#${target.fragment}`,
        why: `no element with id "${target.fragment}"`,
      });
    }
  }

  return { checked: targets.length, broken };
}

test.describe("internal links", () => {
  test("has a page matrix to crawl @seo", () => {
    // 21 seeds today — derived from `routing.locales` × the built route list,
    // never written down. Zero seeds would make every test below vacuous.
    expect(routing.locales.length, "routing.locales is empty").toBeGreaterThan(0);
    expect(BUILT_PAIRS.length, "no page is built").toBeGreaterThan(0);
    expect(new Set(BUILT_PAIRS.map((pair) => pair.locale)).size).toBe(routing.locales.length);
  });

  for (const pair of BUILT_PAIRS) {
    test(`${pair.url} links only to pages that exist @seo`, async ({ request, baseURL }) => {
      const origin = new URL(baseURL ?? "").origin;
      const { checked, broken } = await brokenLinksOn(request, pair.url, origin);

      // The crawl guard. Every page carries the header nav, so a page that
      // yields no internal link means the extractor is broken, not that the
      // page is link-free — and 21 tests that each followed nothing would all
      // be green.
      expect(checked, `${pair.url} yielded no internal links to follow`).toBeGreaterThan(0);

      expect(broken).toEqual([]);
    });
  }
});
