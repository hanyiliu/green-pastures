import { expect, test } from "@playwright/test";

import { routing } from "../src/i18n/routing";

import {
  alternateLinks,
  BUILT_PAIRS,
  BUILT_ROUTE_PATHS,
  canonicalHref,
  copy,
  DETAIL_ROUTES,
  expectedAlternatePaths,
  HOME_PATH,
  homeUrlFor,
  localeMessages,
  metaProperty,
  pngDimensions,
  ROUTE_PATHS,
  STANDALONE_ROUTES,
  parseSitemap,
  SHARE_IMAGE,
  statusOf,
  toPathPairs,
  urlFor,
} from "./routes-support";

/**
 * Canonicals, `hreflang` reciprocity, `sitemap.xml`, `robots.txt` and the
 * localised 404 (PR-6.10 · 08 §5 `@seo` and `@smoke` · 06 §6.5–6.7, `D-06.10`,
 * `D-06.12`, INV-06.4).
 *
 * ── What this file is for, given `e2e/smoke.spec.ts` already exists ──────
 *
 * 10 §7: `e2e/routes*` **extends, never edits** `e2e/smoke*`. `@smoke` proves
 * each page answers 200, declares its locale and carries the `hreflang` set
 * `D-06.10` specifies. Everything here is a property of the site that no single
 * page can be asked about:
 *
 *  - the **canonical** is the page's own URL, which `@smoke` does not read at
 *    all — a page can carry a perfect alternate set and point its canonical at
 *    another locale;
 *  - the alternate set is the **same** on every locale's copy of a route and
 *    every entry in it **resolves**. 06 §6.5 makes reciprocity the property, and
 *    reciprocity is only visible with all three documents side by side;
 *  - `sitemap.xml` enumerates that matrix and **nothing that 404s**. This is the
 *    assertion with the shortest history: until PR-6.2…6.7 landed, the sitemap
 *    advertised six routes per locale that did not exist, and nothing in the
 *    suite said so.
 *
 * ── Everything is derived (INV-02.5, INV-06.2, `D-06.12`) ────────────────
 *
 * Seven page routes × three locales = 21 URLs today. That number is written in
 * this docstring and nowhere in the code: the route list is `site.json`
 * `routes[]` plus the home page and the locale list is `routing.locales`, so
 * `D-10.12` withdrawing `zh-Hant` leaves 14 and a seventh detail route makes 24,
 * in both cases with no edit here. The first test below fails if either source
 * arrives empty, because a matrix of zero URLs is a green run that measured
 * nothing.
 *
 * ── Why the assertions use `request` and the 404 uses a browser ──────────
 *
 * Every `@seo` assertion reads the *served* document through `request`: it is
 * the document a crawler gets, it needs no engine, and it is the form
 * `lighthouse-prod` re-runs this tag in against the production base URL (08
 * §10). The 404 is the exception and the reason is a finding rather than a
 * preference — Next serves the not-found boundary as an empty streamed shell
 * (`<html id="__next_error__">`, no `lang`, no body) and fills it on the
 * client, so a `request.get` there would assert nothing about the page anyone
 * sees. Those three tests load it in a browser and read the hydrated result.
 */

/** The path used to reach the `[...rest]` catch-all. Nothing links to it. */
const UNKNOWN_PATH = "/no-such-page";

/** Metadata routes, and the one route handler `robots.txt` excludes. */
const SITEMAP_PATH = "/sitemap.xml";
const ROBOTS_PATH = "/robots.txt";
const INQUIRY_PATH = "/api/inquiry";

/** The Open Graph property naming the share image (06 §6.5). */
const OG_IMAGE = "og:image";

test.describe("the route matrix this file asserts over", () => {
  test("is derived from routing.locales × site.json routes[] @seo", () => {
    expect(routing.locales.length, "routing.locales is empty").toBeGreaterThan(0);
    expect(DETAIL_ROUTES.length, "site.json routes[] is empty").toBeGreaterThan(0);
    expect(ROUTE_PATHS).toContain(HOME_PATH);

    // A standalone route (`/privacy`) is out of the *slide* matrix, because it
    // expands no home section — and it is emphatically **in** this one, which
    // is about what a crawler sees. The two lists diverging silently is how a
    // page ends up served, linked and absent from `sitemap.xml`.
    for (const route of STANDALONE_ROUTES) {
      expect(ROUTE_PATHS, `${route.path} is not in the crawled matrix`).toContain(route.path);
      expect(DETAIL_ROUTES.map((detail) => detail.id)).not.toContain(route.id);
    }
    expect(BUILT_ROUTE_PATHS.length, "no route has a page.tsx").toBeGreaterThan(0);

    // Every enabled locale reaches the assertions below. `/` is always built,
    // so a locale in `routing.locales` and in no pair means the matrix lost it.
    const covered = new Set(BUILT_PAIRS.map((pair) => pair.locale));
    expect([...covered].sort()).toEqual([...routing.locales].sort());
    expect(BUILT_PAIRS).toHaveLength(BUILT_ROUTE_PATHS.length * routing.locales.length);
  });
});

test.describe("canonical URL", () => {
  for (const pair of BUILT_PAIRS) {
    test(`${pair.url} names itself canonical @seo`, async ({ request, baseURL }) => {
      const response = await request.get(pair.url);
      expect(response.status(), `${pair.url} did not answer 200`).toBe(200);

      const href = canonicalHref(await response.text());
      expect(href, `${pair.url} declares no <link rel="canonical">`).not.toBeNull();

      const canonical = new URL(href ?? "", baseURL ?? undefined);

      // Self, and in the locale's own casing: `pair.url` is built from the
      // locale id verbatim (`D-02.1`), so `/zh-hant/menu` fails here even
      // though a request for it would 308 to the right place.
      expect(canonical.pathname, `${pair.url} points its canonical elsewhere`).toBe(pair.url);

      // 06 `D-06.11`: one origin per environment, and it is the one serving
      // this run. A canonical that escaped to another host would still have
      // the right path.
      expect(canonical.origin).toBe(new URL(baseURL ?? "").origin);

      // `trailingSlash: false` (06 §6.9) and no query or fragment: three ways
      // to name the same page that a crawler treats as three pages.
      expect(canonical.search).toBe("");
      expect(canonical.hash).toBe("");
    });
  }
});

test.describe("hreflang reciprocity", () => {
  for (const routePath of BUILT_ROUTE_PATHS) {
    test(`${routePath} advertises one alternate set from every locale @seo`, async ({
      request,
      baseURL,
    }) => {
      const origin = new URL(baseURL ?? "").origin;
      const expected = expectedAlternatePaths(routePath);

      // Every locale's copy of the page, read at once: 06 §6.5's property is
      // that the *set* does not move between them and only the canonical does,
      // which one document cannot show.
      const perLocale = await Promise.all(
        routing.locales.map(async (locale) => {
          const url = urlFor(locale, routePath);
          const html = await (await request.get(url)).text();
          return { url, tags: alternateLinks(html) };
        }),
      );

      for (const { url, tags } of perLocale) {
        expect(toPathPairs(tags, origin), `${url} advertises the wrong alternate set`).toEqual(
          expected,
        );

        // Absolute, and on this environment's origin. Next resolves the
        // relative form in `alternates.languages` against `metadataBase`, so a
        // relative href in the served markup means `metadataBase` is missing.
        for (const [hreflang, href] of tags) {
          expect(new URL(href, origin).origin, `${url} · ${hreflang} left the origin`).toBe(origin);
          expect(href.startsWith(origin), `${url} · ${hreflang} is not absolute`).toBe(true);
        }
      }

      // Every advertised alternate is a page that exists. An `hreflang` set is
      // a promise to a crawler; one entry of it 404ing is the defect this row
      // is here to make impossible.
      const statuses = await Promise.all(
        expected.map(
          async ([hreflang, path]) => `${hreflang} ${path} → ${await statusOf(request, path)}`,
        ),
      );
      expect(statuses.filter((line) => !line.endsWith("→ 200"))).toEqual([]);
    });
  }
});

test.describe("sitemap.xml", () => {
  test("enumerates every page route in every locale, and nothing else @seo", async ({
    request,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? "").origin;
    const response = await request.get(SITEMAP_PATH);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");

    const entries = parseSitemap(await response.text());

    // `sitemap.ts` iterates `site.json` `routes[]`, built or not — so the
    // comparison is against the full route list rather than the built one, and
    // an unbuilt route shows up as a 404 in the test below instead of as a
    // missing entry here. That keeps the two defects distinguishable.
    const expectedLocs = routing.locales
      .flatMap((locale) => ROUTE_PATHS.map((routePath) => `${origin}${urlFor(locale, routePath)}`))
      .sort();

    expect(entries.map((entry) => entry.loc).sort()).toEqual(expectedLocs);

    // INV-06.4: no `/api`, no metadata route, no 404, no query or hash variant.
    // Asserted as a property of every entry rather than as four absences, so a
    // fifth kind of non-page cannot slip in unnamed.
    const strays = entries
      .map((entry) => entry.loc)
      .filter((loc) => !expectedLocs.includes(loc))
      .concat(entries.map((entry) => entry.loc).filter((loc) => /[?#]/.test(loc)));
    expect(strays).toEqual([]);
  });

  test("gives each entry the same hreflang set as the page itself @seo", async ({
    request,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? "").origin;
    const entries = parseSitemap(await (await request.get(SITEMAP_PATH)).text());
    expect(entries.length, "the sitemap is empty").toBeGreaterThan(0);

    // The set a page carries is a property of the *route*, not of the locale
    // (06 §6.5), so the expected value for every one of a route's three
    // entries is the same string — which is what makes a per-entry comparison
    // meaningful rather than three restatements of one fact.
    const expectedByLoc = new Map<string, string>(
      routing.locales.flatMap((locale) =>
        ROUTE_PATHS.map((routePath): [string, string] => [
          `${origin}${urlFor(locale, routePath)}`,
          JSON.stringify(expectedAlternatePaths(routePath)),
        ]),
      ),
    );

    const mismatched = entries
      .map((entry) => ({
        loc: entry.loc,
        found: JSON.stringify(toPathPairs(entry.alternates, origin)),
        expected: expectedByLoc.get(entry.loc),
      }))
      .filter((entry) => entry.found !== entry.expected)
      .map((entry) => `${entry.loc} carries ${entry.found}, not ${String(entry.expected)}`);

    expect(mismatched).toEqual([]);
  });

  test("advertises no URL that fails to answer 200 @seo", async ({ request, baseURL }) => {
    const origin = new URL(baseURL ?? "").origin;
    const entries = parseSitemap(await (await request.get(SITEMAP_PATH)).text());

    // The guard against a vacuous pass: an empty sitemap would satisfy "no URL
    // 404s" and prove nothing. The floor is derived — one entry per locale at
    // the very least, because `/` is always a route.
    expect(entries.length, "the sitemap advertises nothing").toBeGreaterThanOrEqual(
      routing.locales.length,
    );

    const broken = await Promise.all(
      entries.map(async (entry) => {
        const status = await statusOf(request, new URL(entry.loc, origin).pathname);
        return { loc: entry.loc, status };
      }),
    );

    expect(broken.filter((entry) => entry.status !== 200)).toEqual([]);
  });
});

test.describe("the share image", () => {
  test("every locale advertises the same og:image @seo", async ({ request, baseURL }) => {
    const origin = new URL(baseURL ?? "").origin;
    const advertised = new Set<string>();

    for (const locale of routing.locales) {
      const url = homeUrlFor(locale);
      const response = await request.get(url);
      expect(response.status(), `${url} did not answer 200`).toBe(200);

      const content = metaProperty(await response.text(), OG_IMAGE);
      expect(content, `${url} declares no og:image`).not.toBeNull();
      advertised.add(new URL(content ?? "", origin).pathname);
    }

    // 06 §6.5: the image comes from `site.json` `images.og`, which is not a
    // localized value, so all three locales point at one file. `og:image:alt`
    // and `og:locale` are what differ per locale.
    expect(advertised.size, "the locales advertise different share images").toBe(1);
    expect([...advertised]).toEqual([SHARE_IMAGE.src]);
  });

  test("og:image answers 200 with a PNG of the size it promises @seo", async ({
    request,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? "").origin;
    const response = await request.get(homeUrlFor(routing.defaultLocale));
    const content = metaProperty(await response.text(), OG_IMAGE);
    expect(content, "the home page declares no og:image").not.toBeNull();

    // The path, not the URL Next printed. Every page here is prerendered, so
    // the absolute form is baked from whatever origin the *build* resolved
    // (`gp-dln.267`); the path is the part this run can hold it to.
    const path = new URL(content ?? "", origin).pathname;
    const image = await request.get(path, { failOnStatusCode: false });

    // This is the assertion the block exists for: until the placeholder route
    // landed, `images.og.src` named a file that had never been in `public/`,
    // and every share of this site fetched a 404 (`gp-dln.196`).
    expect(image.status(), `${path} did not answer 200`).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");

    const bytes = await image.body();
    expect(pngDimensions(bytes), `${path} is not a PNG`).toEqual({
      width: SHARE_IMAGE.width,
      height: SHARE_IMAGE.height,
    });
  });
});

test.describe("robots.txt", () => {
  test("disallows /api/ and names a sitemap that answers @seo", async ({ request, baseURL }) => {
    const origin = new URL(baseURL ?? "").origin;
    const response = await request.get(ROBOTS_PATH);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");

    const body = await response.text();
    expect(body).toContain("Disallow: /api/");

    // The `Sitemap:` line is absolute (`robots.txt` has no base to resolve
    // against) and points at this environment's own sitemap, not at another
    // deployment's.
    const advertised = /^Sitemap:\s*(\S+)$/m.exec(body)?.[1];
    expect(advertised, "robots.txt names no sitemap").toBeDefined();
    expect(advertised).toBe(`${origin}${SITEMAP_PATH}`);
    expect(await statusOf(request, SITEMAP_PATH)).toBe(200);
  });

  test("the route handler robots.txt excludes answers 405 to a GET @seo", async ({ request }) => {
    // 07 §2: `/api/inquiry` is POST-only. Asserted here rather than in the form
    // family because it is the same fact `robots.txt` is built on — a crawler
    // that ignored the `Disallow` would get this.
    const response = await request.get(INQUIRY_PATH, { failOnStatusCode: false });
    expect(response.status()).toBe(405);
  });
});

test.describe("the localised 404", () => {
  for (const locale of routing.locales) {
    const url = `${urlFor(locale, HOME_PATH)}${UNKNOWN_PATH}`;

    test(`${url} is the reader's own 404, not English and not indexable @smoke`, async ({
      page,
    }) => {
      const response = await page.goto(url);
      expect(response?.status(), `${url} did not answer 404`).toBe(404);

      // Read from the content tree, deep-merged the way the production loader
      // merges it (INV-08.5, 02 `D-02.8`): `zh-Hant` has no `errors.notFound`
      // of its own yet, so the expected string is the English one *because the
      // server would render the English one*, and it moves by itself the day
      // the file is translated.
      const expectedTitle = copy(localeMessages(locale, "errors"), "notFound.title");
      await expect(page.locator("h1")).toHaveText(expectedTitle);

      // `[...rest]` is what makes this the locale layout's 404 rather than the
      // root one (06 `D-06.3`): the reader's own `<html lang>`, and a CTA that
      // goes to *their* home page rather than to `/en`.
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator(`main a[href="${urlFor(locale, HOME_PATH)}"]`)).toHaveCount(1);

      // 06 §6.7: a 404 carries no canonical and no alternates. It is not a
      // page, and telling a crawler it has three locale variants would be
      // three more URLs to not index.
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
    });
  }
});
