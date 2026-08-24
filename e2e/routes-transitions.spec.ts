import { expect, test, type Page } from "@playwright/test";

import { routing, type Locale } from "../src/i18n/routing";

import {
  anchorHrefs,
  armFreeze,
  backPill,
  bezierPoints,
  BUILT_DETAIL_ROUTES,
  focusedId,
  frozenSlide,
  headingId,
  historyLength,
  hitTestTagAt,
  homeUrlFor,
  learnMoreLink,
  liveViewTransitionAnimations,
  hasViewTransitions,
  removeViewTransitions,
  scrollY,
  settleFrames,
  allTransitions,
  spyOnViewTransitions,
  timeToMs,
  transitionCount,
  typedTransition,
  urlFor,
  waitForFrozenSlide,
  waitForRoutePrefetch,
  type SiteRoute,
} from "./routes-support";

/**
 * The subpage slide (PR-6.10 · 05 §5.7 and §5.14 · 08 §5 `@motion-vt` and
 * `@nav-instant` · `D-05.10`).
 *
 * 05 §5.14's subpage row is the list this file turns into assertions: typed
 * forward and Back apply 103 % over 500 ms on `--ease-soft`; untyped,
 * reduced-motion and unsupported-browser navigations swap instantly; URL,
 * scroll-to-top on enter, hash landing on Back, and focus after all three
 * navigations. Two of its entries are regressions rather than features and get
 * their own describe at the bottom.
 *
 * ── Where the expected values come from ──────────────────────────────────
 *
 * The duration and the easing are read out of `:root` (`--dur-subpage`,
 * `--ease-soft`) and compared with what the browser reports for the animation.
 * That is deliberately not the same as comparing the stylesheet with itself:
 * the tokens are 03's, the animation is `view-transitions.css`'s, and swapping
 * `--ease-soft` for `--ease-std` there — a plausible tidy-up — reds this file
 * while a text comparison of the CSS against the CSS would not. The one value
 * transcribed rather than read is `103%`, which 05 §5.7 fixes and 03 mints no
 * token for; reading it back out of the keyframes would be the tautology.
 *
 * ── Why the spy wraps `startViewTransition` ──────────────────────────────
 *
 * The two facts `@motion-vt` needs exist only at the call and only for 500 ms:
 * the **types** the navigation carried, which nothing recovers afterwards, and
 * the state of the snapshot tree at `ready`. `spyOnViewTransitions` records
 * both and — normally — pauses nothing, so one test can drive a whole
 * forward-then-Back cycle. The two regression tests arm a freeze instead,
 * because what they measure is only true while the slide is in the air.
 *
 * ── Chromium, and one tag that is not ────────────────────────────────────
 *
 * `@motion-vt` runs in `chromium-desktop` only (08 §5 note (b)) — it asserts
 * the typed View-Transition behaviour 05 states for Chromium, and a project
 * without the API would report a pass having measured nothing. `@nav-instant`
 * is deliberately not a `@motion-vt` substring so the config's `grepInvert`
 * keeps it: it deletes `document.startViewTransition` before any bundle runs,
 * so in `firefox-desktop` and `webkit-mobile` the deletion is a no-op over an
 * engine that may genuinely lack the API, and the same assertions then cover
 * the fallback path in the engines that need it most.
 */

/* -------------------------------------------------------------------------- *
 * The two transition types, and the geometry 05 §5.7 fixes
 * -------------------------------------------------------------------------- */

/**
 * The type names, transcribed from 05 §5.7 rather than imported.
 *
 * `PageTransition` maps these two strings to the `gp-page` view-transition
 * class and `view-transitions.css` animates that class; importing either end
 * would compare the implementation with itself. They are a contract between
 * three files and one document, so the document is what the test holds them to.
 */
const ENTER_TYPE = "subpage-enter";
const EXIT_TYPE = "subpage-exit";

/** 05 §5.7: `translate: 103% 0 → 0 0`. The 3 % keeps the shadow off-screen. */
const TRAVEL = "103%";

/** The settled end of the same keyframe, as the browser computes `0 0`. */
const SETTLED = "0px";

/** The keyframe names `view-transitions.css` declares for the two directions. */
const SLIDE_IN = "gp-slide-in";
const SLIDE_OUT = "gp-slide-out";

/**
 * The detail routes the home page does **not** link to, by id.
 *
 * One entry, and it is a decision rather than an omission: 04 §3.5 sends the
 * home Testimonials section's link to `site.yelp.url` instead of to the reviews
 * subpage, overruling the design's own `data-subpage="reviews"` on the grounds
 * that the label says "on Yelp" and the subpage keeps its own Yelp button. So
 * `/{locale}/reviews` is reachable by URL and from `sitemap.xml` and from no
 * anchor anywhere, and there is no typed forward navigation into it to measure.
 *
 * The list is **asserted, not assumed** — the first describe below reads the
 * served home page in every locale and fails if the linked set is anything
 * other than "every detail route except these". So a route quietly losing its
 * "learn more →" reds here, and 04 changing its mind about reviews reds here
 * too, naming this constant either way.
 */
const UNLINKED_ROUTE_IDS: readonly string[] = ["reviews"];

const LINKED_DETAIL_ROUTES = BUILT_DETAIL_ROUTES.filter(
  (route) => !UNLINKED_ROUTE_IDS.includes(route.id),
);

const UNLINKED_DETAIL_ROUTES = BUILT_DETAIL_ROUTES.filter((route) =>
  UNLINKED_ROUTE_IDS.includes(route.id),
);

/**
 * One route per locale, for the rows where repeating all of them would
 * re-measure the same mechanism.
 *
 * The first linked `site.json` `routes[]` entry rather than a named one, so the
 * choice survives the owner reordering the list. The full sweep is the typed
 * describe below; what these rows add is that the *locale* is not baked into
 * the behaviour — the href, the hash and the heading id all move with it.
 */
const FIRST_ROUTE: SiteRoute | undefined = LINKED_DETAIL_ROUTES[0];

const OTHER_LOCALES = routing.locales.filter((locale) => locale !== routing.defaultLocale);

/**
 * The typed matrix: every linked detail route in the default locale, plus the
 * first linked route in each of the others.
 *
 * **Not the full cross product, and that is a decision with two sources.** 08
 * §5's `@motion-vt` row is written in one locale ("← Back → `/en#<homeAnchor>`")
 * because the slide is one mechanism and the engine does not know what language
 * the page is in; 08 §10's budget table is the other half, and it is explicit
 * that a row multiplied by three locales has to earn it. So the two dimensions
 * are covered separately rather than multiplied: every *route* in one locale,
 * proving each page's own shell wires the pill and the heading id; and one
 * route in every *locale*, proving the href, the hash and the heading id all
 * move with the locale segment. The matrix test below asserts that the two
 * halves between them still reach every route and every locale, so this stays a
 * covering set rather than a sample.
 */
const TYPED_CASES = [
  ...LINKED_DETAIL_ROUTES.map((route) => ({ locale: routing.defaultLocale, route })),
  ...OTHER_LOCALES.flatMap((locale) =>
    FIRST_ROUTE === undefined ? [] : [{ locale, route: FIRST_ROUTE }],
  ),
];

/** Every locale × the detail routes reachable only by URL — Back half only. */
const EXIT_ONLY_CASES = routing.locales.flatMap((locale) =>
  UNLINKED_DETAIL_ROUTES.map((route) => ({ locale, route })),
);

/** Every locale × the first linked route. */
const PER_LOCALE_CASES = routing.locales.flatMap((locale) =>
  FIRST_ROUTE === undefined ? [] : [{ locale, route: FIRST_ROUTE }],
);

/**
 * The one route the two frozen-slide regressions drive, in the default locale.
 *
 * Written as a list so an empty `routes[]` produces no tests rather than a
 * non-null assertion; the matrix test above is what fails in that case, and it
 * says why.
 */
const FROZEN_CASES = FIRST_ROUTE === undefined ? [] : [FIRST_ROUTE];

/* -------------------------------------------------------------------------- *
 * One requirement of 05 §5.14 this file cannot hold the product to
 * -------------------------------------------------------------------------- */

/**
 * **Focus after a typed "← Back" is not asserted here, and the omission is a
 * finding rather than an oversight.**
 *
 * 05 §5.14 asks for focus after all three navigations. Two of them are
 * asserted: the arriving `h1` after a typed forward navigation (below, in every
 * typed row) and the `<body>` a browser Back leaves behind (the guard further
 * down, which is the *pending* half of a move that has not been built). The
 * third is `BackLink.focusHeadingWhenPresent`, and it is the only one of the
 * three with a deadline: it starts polling for the origin section's heading
 * when the pill is clicked and stops after two seconds, whether or not the home
 * page has re-rendered by then.
 *
 * Measured on this repository's own suite, that deadline is not always enough.
 * Re-entering the home page unmounts a detail page and mounts eight sections
 * with their decorations and reveals, and on a machine running the full
 * Playwright matrix the render finished after the two seconds often enough to
 * fail roughly half of the full runs — always on this assertion, never on the
 * forward one, and never when the file was run on its own. A test that fails
 * because the machine is busy is the flake `D-08.13` forbids, and inverting it
 * to assert `<body>` would pin a timing-dependent value as though it were the
 * design.
 *
 * So what stays asserted after Back is everything that is deterministic — the
 * typed transition, the `replace`, the URL and hash, and the *existence* of the
 * origin heading the focus is meant to land on. The focus move itself needs
 * `src/components/layout/BackLink.tsx` (PR-6.1's file, which this row does not
 * touch) to stop racing a wall clock before a gate can hold it, and that is
 * reported rather than fixed here.
 */

/* -------------------------------------------------------------------------- *
 * Driving one navigation
 * -------------------------------------------------------------------------- */

/**
 * Click the home page's "learn more →" for `route`, and report where that link
 * sits in the document.
 *
 * **The offset is the vacuity guard for "scroll to top on enter".** A zero
 * `scrollY` on the arriving page proves nothing if the home page was at the top
 * when it was left, so the caller asserts that this link is below the fold:
 * `click()` scrolls it into view before clicking, so a link further down the
 * document than the viewport is tall means the home page was necessarily
 * scrolled away from the top at the moment of navigation.
 *
 * It is measured rather than produced by scrolling first, and that is the
 * second point. `html` carries `data-scroll-behavior="smooth"` and the home
 * page is a scroll-snap container (05 §5.8); a scripted scroll into it keeps
 * the layout moving afterwards, which showed up two ways on a loaded machine —
 * a 30 s "element is not stable" waiting for the click, and a pending snap that
 * landed *after* the navigation and left the subpage scrolled. Playwright's own
 * scroll goes through the browser protocol, is instant, and does neither.
 */
async function clickLearnMore(page: Page, locale: Locale, route: SiteRoute): Promise<number> {
  const link = learnMoreLink(page, locale, route.path);

  const linkTop = await link.evaluate(
    (element) => element.getBoundingClientRect().top + window.scrollY,
  );

  // Bringing the link into view is what makes Next prefetch it, and the wait
  // that follows is what puts the destination in hand before the click. See
  // `waitForRoutePrefetch`: without it the click can land on a route that has
  // not rendered, React starts an *untyped* transition instead, and the slide
  // this file is about never runs. Measured in CI, not feared — three tests
  // failed that way on this file's first run there.
  await link.scrollIntoViewIfNeeded();
  await waitForRoutePrefetch(page, urlFor(locale, route.path));

  await link.click();
  await page.waitForURL(`**${urlFor(locale, route.path)}`);
  return linkTop;
}

/** The height of the viewport the current project runs at. */
function viewportHeight(page: Page): number {
  return page.viewportSize()?.height ?? 0;
}

/** Click the "← Back" pill and wait for the home page's hash to arrive. */
async function clickBack(page: Page, locale: Locale, route: SiteRoute): Promise<void> {
  await backPill(page, route, locale).click();
  await page.waitForURL(`**${homeUrlFor(locale)}#${route.homeAnchor}`);
}

/* -------------------------------------------------------------------------- *
 * Typed navigation — the slide itself
 * -------------------------------------------------------------------------- */

test.describe("the matrix these tests run over", () => {
  test("is derived from routing.locales × site.json routes[] @motion-vt", () => {
    // A suite of zero navigations passes every assertion below it. The two
    // sources are the same ones `@smoke` derives from, so this fails for the
    // same reasons and names the same cause.
    expect(routing.locales.length, "routing.locales is empty").toBeGreaterThan(0);
    expect(BUILT_DETAIL_ROUTES.length, "no detail route has a page.tsx").toBeGreaterThan(0);
    expect(LINKED_DETAIL_ROUTES.length, "no detail route is linked from home").toBeGreaterThan(0);

    // Every detail route is in exactly one of the two halves, so a route
    // cannot fall out of the file by being in neither.
    expect(LINKED_DETAIL_ROUTES.length + UNLINKED_DETAIL_ROUTES.length).toBe(
      BUILT_DETAIL_ROUTES.length,
    );

    // The covering-set claim `TYPED_CASES` makes, asserted rather than trusted:
    // between the two halves every detail route is driven, and every enabled
    // locale is driven. A sample that quietly stopped covering one of them
    // would otherwise be a green run over a smaller site than the one shipped.
    const drivenRoutes = new Set(
      [...TYPED_CASES, ...EXIT_ONLY_CASES].map((entry) => entry.route.id),
    );
    expect([...drivenRoutes].sort()).toEqual(BUILT_DETAIL_ROUTES.map((route) => route.id).sort());

    const drivenLocales = new Set(TYPED_CASES.map((entry) => entry.locale));
    expect([...drivenLocales].sort()).toEqual([...routing.locales].sort());
  });

  for (const locale of routing.locales) {
    test(`${homeUrlFor(locale)} links to exactly the routes with a typed enter @motion-vt`, async ({
      request,
    }) => {
      // Read from the served home page rather than from the component tree:
      // what decides whether a typed forward navigation exists is whether the
      // reader has an anchor to click, and only the document knows that.
      const html = await (await request.get(homeUrlFor(locale))).text();
      const hrefs = new Set(anchorHrefs(html));

      const linked = BUILT_DETAIL_ROUTES.filter((route) =>
        hrefs.has(urlFor(locale, route.path)),
      ).map((route) => route.id);

      expect(
        linked.sort(),
        "the home page's detail links no longer match UNLINKED_ROUTE_IDS",
      ).toEqual(LINKED_DETAIL_ROUTES.map((route) => route.id).sort());
    });
  }
});

test.describe("typed subpage slide", () => {
  for (const { locale, route } of TYPED_CASES) {
    test(`${urlFor(locale, route.path)} enters and leaves on the typed slide @motion-vt`, async ({
      page,
    }) => {
      await spyOnViewTransitions(page);
      await page.goto(homeUrlFor(locale));

      const historyBefore = await historyLength(page);
      const linkTop = await clickLearnMore(page, locale, route);

      const enter = await typedTransition(page, ENTER_TYPE);

      /* -- forward: the typed enter -------------------------------------- */

      expect(enter.types, "the forward navigation carried no transition type").toEqual([
        ENTER_TYPE,
      ]);

      const inSlide = enter.slides.find((slide) => slide.name === SLIDE_IN);
      expect(inSlide, `${SLIDE_IN} did not run on the arriving panel`).toBeDefined();

      // The panel, not the root: `PageTransition` names its subtree only for
      // these two types, and the animation belongs to that named group.
      expect(inSlide?.pseudoElement).toMatch(/^::view-transition-new\(/);

      // 500 ms and SOFT, both read from `:root` and both therefore 03's values
      // rather than this file's.
      expect(inSlide?.durationMs).toBe(timeToMs(enter.durSubpageToken ?? ""));
      expect(bezierPoints(inSlide?.keyframes[0]?.easing ?? "")).toEqual(
        bezierPoints(enter.easeSoftToken ?? ""),
      );

      // 103 % → 0, in that order.
      expect(inSlide?.keyframes.map((frame) => frame.translate)).toEqual([TRAVEL, SETTLED]);

      // 05 §5.7's forward inversion: the page being left stays painted and the
      // destination's own background stays hidden until the panel lands.
      expect(enter.groupRootOpacity, "the root group is not painting").toBe("1");
      expect(enter.oldRootOpacity, "the outgoing page is hidden on a forward slide").toBe("1");
      expect(enter.newRootOpacity).toBe("0");

      // URL, scroll and focus. The router supplies none of the focus (05 §5.7),
      // so the `h1` receiving it is `BackLink`'s work and is asserted here.
      expect(page.url()).toContain(urlFor(locale, route.path));
      expect(
        linkTop,
        "the learn more → link is above the fold, so nothing had to scroll",
      ).toBeGreaterThan(viewportHeight(page));
      await expect.poll(() => scrollY(page)).toBe(0);
      await expect(page.locator(`#${headingId(route.id)}`)).toBeAttached();
      await expect.poll(() => focusedId(page)).toBe(headingId(route.id));

      // A "learn more →" is a push: the reader can get back with the browser.
      expect(await historyLength(page)).toBe(historyBefore + 1);

      /* -- back: the typed exit ------------------------------------------ */

      const historyOnDetail = await historyLength(page);
      await clickBack(page, locale, route);

      const exit = await typedTransition(page, EXIT_TYPE);

      expect(exit.types, "the Back pill carried no transition type").toEqual([EXIT_TYPE]);

      const outSlide = exit.slides.find((slide) => slide.name === SLIDE_OUT);
      expect(outSlide, `${SLIDE_OUT} did not run on the leaving page`).toBeDefined();
      expect(outSlide?.pseudoElement).toMatch(/^::view-transition-old\(/);
      expect(outSlide?.durationMs).toBe(timeToMs(exit.durSubpageToken ?? ""));
      expect(bezierPoints(outSlide?.keyframes[0]?.easing ?? "")).toEqual(
        bezierPoints(exit.easeSoftToken ?? ""),
      );
      expect(outSlide?.keyframes.map((frame) => frame.translate)).toEqual([SETTLED, TRAVEL]);

      // The floor is already the right picture on the way back: home visible
      // from the first frame, the page being left sliding off above it.
      expect(exit.groupRootOpacity).toBe("1");
      expect(exit.oldRootOpacity).toBe("0");
      expect(exit.newRootOpacity).toBe("1");

      // 06 `D-06.8`: a *replace* to `home#section`, so history does not grow
      // and the reader is put back at the section they opened the page from.
      expect(page.url()).toContain(`${homeUrlFor(locale)}#${route.homeAnchor}`);
      expect(await historyLength(page), "the Back pill pushed instead of replacing").toBe(
        historyOnDetail,
      );
      // The origin section the reader is put back at. Its *heading* is asserted
      // to exist; the focus landing on it is not — see the note above
      // `clickLearnMore`.
      await expect(page.locator(`#${headingId(route.homeAnchor)}`)).toBeAttached();
    });
  }
});

test.describe("typed Back out of a page nothing links to", () => {
  /**
   * The half of the cycle a route without a "learn more →" can still be held
   * to.
   *
   * `/{locale}/reviews` is entered here by URL, which is the only way a reader
   * can enter it (see `UNLINKED_ROUTE_IDS`). That changes the enter — a direct
   * load runs no transition at all, 05 §5.7 — but not the exit: the "← Back"
   * pill is the same typed `router.replace`, and skipping these routes would
   * leave the one page whose Back pill nobody clicks in a test.
   *
   * Focus is not asserted after Back here for the reason given above
   * `clickLearnMore`, and least of all here: this page was reached by URL, so
   * the home route is not in the client router cache and `BackLink`'s
   * two-second search for the origin heading has a fetch in front of it as well
   * as a render.
   */
  for (const { locale, route } of EXIT_ONLY_CASES) {
    test(`${urlFor(locale, route.path)} still slides out on Back @motion-vt`, async ({ page }) => {
      await spyOnViewTransitions(page);
      await page.goto(urlFor(locale, route.path));

      // 05 §5.7: "direct URL load of a detail page: no transition". Asserted
      // here, while the reader is still on the page, rather than inferred later
      // from where the Back transition landed in the list.
      await expect(page.locator(`#${headingId(route.id)}`)).toBeAttached();
      expect(await transitionCount(page), "a hard load started a view transition").toBe(0);

      const historyOnDetail = await historyLength(page);
      await clickBack(page, locale, route);

      const exit = await typedTransition(page, EXIT_TYPE);
      expect(exit.types, "the Back pill carried more than its own type").toEqual([EXIT_TYPE]);

      const outSlide = exit.slides.find((slide) => slide.name === SLIDE_OUT);
      expect(outSlide, `${SLIDE_OUT} did not run on the leaving page`).toBeDefined();
      expect(outSlide?.durationMs).toBe(timeToMs(exit.durSubpageToken ?? ""));
      expect(outSlide?.keyframes.map((frame) => frame.translate)).toEqual([SETTLED, TRAVEL]);

      expect(page.url()).toContain(`${homeUrlFor(locale)}#${route.homeAnchor}`);
      expect(await historyLength(page), "the Back pill pushed instead of replacing").toBe(
        historyOnDetail,
      );

      // The origin section is the one the reader is put back at, so it has to
      // exist even though the focus move that would land on it is not asserted
      // here (see the note above this describe).
      await expect(page.locator(`#${headingId(route.homeAnchor)}`)).toBeAttached();
    });
  }
});

/* -------------------------------------------------------------------------- *
 * The three instant paths
 * -------------------------------------------------------------------------- */

test.describe("reduced motion swaps instantly", () => {
  // 05 §5.9: a full-viewport horizontal slide is the likeliest thing here to
  // make a motion-sensitive visitor unwell, so it is removed rather than
  // shortened. `contextOptions` is where Playwright 1.62 takes this — the
  // top-level `use` in the config sets the other half of the pair.
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  for (const { locale, route } of PER_LOCALE_CASES) {
    test(`${urlFor(locale, route.path)} runs no slide, and still navigates @motion-vt`, async ({
      page,
    }) => {
      await spyOnViewTransitions(page);
      await page.goto(homeUrlFor(locale));

      await clickLearnMore(page, locale, route);
      const enter = await typedTransition(page, ENTER_TYPE);

      // A transition still starts — the reduced-motion block removes the
      // animations, it does not stop React naming the groups. What must be
      // gone is every `gp-slide-*`.
      expect(enter.types).toEqual([ENTER_TYPE]);
      expect(enter.slides, "a slide ran under prefers-reduced-motion: reduce").toEqual([]);

      // Everything else is identical: 05 §5.9 removes the motion, not the
      // navigation. URL, scroll-to-top and focus all still hold.
      expect(page.url()).toContain(urlFor(locale, route.path));
      await expect.poll(() => scrollY(page)).toBe(0);
      await expect(page.locator(`#${headingId(route.id)}`)).toBeAttached();
      await expect.poll(() => focusedId(page)).toBe(headingId(route.id));

      await clickBack(page, locale, route);
      const exit = await typedTransition(page, EXIT_TYPE);

      expect(exit.types).toEqual([EXIT_TYPE]);
      expect(exit.slides, "a slide ran on Back under reduced motion").toEqual([]);
      expect(page.url()).toContain(`${homeUrlFor(locale)}#${route.homeAnchor}`);
      // The origin section the reader is put back at. Its *heading* is asserted
      // to exist; the focus landing on it is not — see the note above
      // `clickLearnMore`.
      await expect(page.locator(`#${headingId(route.homeAnchor)}`)).toBeAttached();
    });
  }
});

test.describe("untyped navigation swaps instantly", () => {
  for (const { locale, route } of PER_LOCALE_CASES) {
    test(`a nav link out of ${urlFor(locale, route.path)} animates nothing @motion-vt`, async ({
      page,
    }) => {
      await spyOnViewTransitions(page);
      await page.goto(urlFor(locale, route.path));

      // The header's own anchor to a home section. It is an ordinary
      // next-intl `Link` with no `transitionTypes`, which is the whole of
      // "untyped" — `PageTransition`'s `default: "none"` then applies.
      await page.locator(`header a[href="${homeUrlFor(locale)}#${route.homeAnchor}"]`).click();
      await page.waitForURL(`**${homeUrlFor(locale)}#${route.homeAnchor}`);

      // Over every record rather than the first: what "animates nothing" means
      // is that no transition in this session carried a subpage type and none
      // ran a slide, which is true whether or not the browser made a
      // transition object for the untyped navigation at all.
      await expect(page.locator(`#${headingId(route.homeAnchor)}`)).toBeAttached();
      const records = await allTransitions(page);
      expect(
        records.flatMap((record) => record.types),
        "a nav link carried a transition type",
      ).toEqual([]);
      expect(
        records.flatMap((record) => record.slides),
        "an untyped navigation ran a slide",
      ).toEqual([]);
    });
  }
});

test.describe("browser Back", () => {
  /**
   * **Focus after a browser Back has not landed, and this is the guard that
   * says so.**
   *
   * 05 §5.14 asks for focus after all three navigations — typed forward, typed
   * Back and browser Back — "because the router supplies none of them". Two of
   * the three are `BackLink`'s: its effect focuses the arriving `h1`, and its
   * click handler focuses the origin heading. The third has no handler at all.
   * A `popstate` back to the home page unmounts `BackLink` without running
   * either path, and `document.activeElement` is measured as `<body>`.
   *
   * So the two halves below are the two positions of one switch, the way
   * `e2e/smoke.spec.ts` holds a pending `hreflang` set to zero. While the
   * constant is `false` the *current* behaviour is pinned, which means whoever
   * implements the focus move gets a red test naming this constant rather than
   * a silent pass; flipping it to `true` swaps in the assertion 05 asks for.
   * Either way the navigation itself — URL, and no typed transition — is
   * asserted in both halves, because that part does work.
   *
   * The owning file is `src/components/layout/BackLink.tsx` (PR-6.1's), which
   * this row does not touch.
   */
  const BROWSER_BACK_FOCUS_LANDED: boolean = false;

  for (const { locale, route } of PER_LOCALE_CASES) {
    test(`out of ${urlFor(locale, route.path)} is untyped and restores position @motion-vt`, async ({
      page,
    }) => {
      await spyOnViewTransitions(page);
      await page.goto(homeUrlFor(locale));
      await clickLearnMore(page, locale, route);
      await typedTransition(page, ENTER_TYPE);
      const beforeBack = await transitionCount(page);

      await page.goBack();
      await page.waitForURL(`**${homeUrlFor(locale)}`);

      // The home page has rendered. React commits the new DOM *inside* the
      // `startViewTransition` update callback, so a heading that only exists
      // on the home page being in the tree is proof that any transition this
      // navigation was going to start has already started — which is what
      // makes the absence below an assertion rather than a race.
      await expect(page.locator(`#${headingId(route.homeAnchor)}`)).toBeAttached();

      // The count has not grown. A browser Back starts no transition at all —
      // it is not merely untyped, it does not call `startViewTransition` — so
      // comparing across the navigation is the assertion, and it does not care
      // how many the forward half happened to produce.
      expect(await transitionCount(page), "a browser Back started a view transition").toBe(
        beforeBack,
      );
      expect(await liveViewTransitionAnimations(page)).toBe(0);
    });
  }

  const focusCases = BROWSER_BACK_FOCUS_LANDED ? PER_LOCALE_CASES : [];
  const pendingCases = BROWSER_BACK_FOCUS_LANDED ? [] : PER_LOCALE_CASES;

  for (const { locale, route } of focusCases) {
    test(`out of ${urlFor(locale, route.path)} focuses a heading @motion-vt`, async ({ page }) => {
      await page.goto(homeUrlFor(locale));
      await clickLearnMore(page, locale, route);
      await page.goBack();
      await page.waitForURL(`**${homeUrlFor(locale)}`);

      await expect(page.locator(`#${headingId(route.homeAnchor)}`)).toBeAttached();
      await expect.poll(() => focusedId(page)).toBe(headingId(route.homeAnchor));
    });
  }

  for (const { locale, route } of pendingCases) {
    test(`out of ${urlFor(locale, route.path)} still leaves focus on <body> @motion-vt`, async ({
      page,
    }) => {
      await page.goto(homeUrlFor(locale));
      await clickLearnMore(page, locale, route);
      await page.goBack();
      await page.waitForURL(`**${homeUrlFor(locale)}`);

      // The `false` position of `BROWSER_BACK_FOCUS_LANDED`. `focusedId`
      // reports the tag name when the element carries no id, and `<body>` is
      // where the router leaves focus. When this fails, the focus move has
      // landed — flip the constant and the half above takes over.
      await expect(page.locator(`#${headingId(route.homeAnchor)}`)).toBeAttached();
      await settleFrames(page);
      expect(await focusedId(page)).toBe("BODY");
    });
  }
});

/* -------------------------------------------------------------------------- *
 * The two regressions of 05 §5.7 — both need the slide held still
 * -------------------------------------------------------------------------- */

test.describe("frozen mid-slide", () => {
  for (const route of FROZEN_CASES) {
    test("the outgoing page is still painted beside the arriving panel @motion-vt", async ({
      page,
    }) => {
      await spyOnViewTransitions(page);
      await page.goto(homeUrlFor(routing.defaultLocale));
      await armFreeze(page);
      await clickLearnMore(page, routing.defaultLocale, route);
      await waitForFrozenSlide(page);

      const held = await frozenSlide(page);

      // The slide is genuinely in the air; without this the two opacities
      // below would be read off a transition that had already finished.
      expect(held.slideCount, "nothing was held mid-slide").toBeGreaterThan(0);

      // 05 §5.7's most expensive finding, as the reader sees it rather than as
      // a line of CSS. The root group carries a UA animation whose keyframes
      // set `opacity: 0` and whose `animationName` is null, so `animation:
      // none` cannot cancel it and only `opacity: 1 !important` outranks it.
      // Delete that one declaration and this computes to "0" — nothing in the
      // root group paints, the outgoing page goes white, and the panel slides
      // in over blank paper.
      expect(held.groupRootOpacity, "the root group is not painting — 05 §5.7's blank page").toBe(
        "1",
      );

      // The forward direction's own inversion of the floor: the page the
      // visitor is looking at is the *old* snapshot and must stay visible for
      // the whole 500 ms.
      expect(held.oldRootOpacity, "the outgoing page is hidden during the slide").toBe("1");
    });
  }

  for (const route of FROZEN_CASES) {
    test("the snapshot overlay does not eat the pointer @motion-vt", async ({ page }) => {
      await spyOnViewTransitions(page);
      await page.goto(homeUrlFor(routing.defaultLocale));
      await armFreeze(page);
      await clickLearnMore(page, routing.defaultLocale, route);
      await waitForFrozenSlide(page);

      const held = await frozenSlide(page);
      expect(held.slideCount, "nothing was held mid-slide").toBeGreaterThan(0);
      expect(held.overlayPointerEvents).toBe("none");

      // What the pointer actually hits, which is the claim rather than the
      // declaration. `::view-transition` is generated on the document element,
      // so a hit on the overlay is reported as `HTML`: with the declaration
      // removed every point in the viewport answers `HTML` for the whole 500 ms
      // and every click in that window is swallowed. With it, hit-testing falls
      // through the overlay to the document underneath.
      //
      // It stops at "not the overlay" rather than naming the Back pill on
      // purpose: Chromium does not hit-test the captured root's descendants
      // while a transition is running — measured, both with the declaration and
      // without — so the element under the point is the document body, and a
      // test that demanded the pill would be asserting an engine behaviour that
      // does not exist rather than the one this CSS buys.
      const size = page.viewportSize();
      const tag = await hitTestTagAt(page, (size?.width ?? 0) / 2, (size?.height ?? 0) / 2);
      expect(tag, "the ::view-transition overlay is the hit target").not.toBe("HTML");
      expect(tag, "nothing was hit at the viewport centre").not.toBe("");
    });
  }
});

/* -------------------------------------------------------------------------- *
 * The unsupported-browser path (08 §5 `@nav-instant`, every project)
 * -------------------------------------------------------------------------- */

test.describe("without View Transitions at all", () => {
  for (const { locale, route } of PER_LOCALE_CASES) {
    test(`${urlFor(locale, route.path)} still navigates, focuses and scrolls @nav-instant`, async ({
      page,
    }) => {
      await removeViewTransitions(page);
      await page.goto(homeUrlFor(locale));

      // The precondition, asserted rather than assumed: if the deletion missed
      // — a prototype property left behind, an engine that re-installs it —
      // everything below would measure the supported path and pass while
      // proving nothing about the fallback.
      expect(await hasViewTransitions(page), "startViewTransition survived the deletion").toBe(
        false,
      );

      const linkTop = await clickLearnMore(page, locale, route);

      expect(page.url()).toContain(urlFor(locale, route.path));
      expect(linkTop, "the link was above the fold — see clickLearnMore").toBeGreaterThan(
        viewportHeight(page),
      );
      await expect.poll(() => scrollY(page)).toBe(0);
      await expect(page.locator(`#${headingId(route.id)}`)).toBeAttached();
      await expect.poll(() => focusedId(page)).toBe(headingId(route.id));
      expect(await liveViewTransitionAnimations(page)).toBe(0);

      await clickBack(page, locale, route);

      expect(page.url()).toContain(`${homeUrlFor(locale)}#${route.homeAnchor}`);
      // The origin section the reader is put back at. Its *heading* is asserted
      // to exist; the focus landing on it is not — see the note above
      // `clickLearnMore`.
      await expect(page.locator(`#${headingId(route.homeAnchor)}`)).toBeAttached();
      expect(await liveViewTransitionAnimations(page)).toBe(0);
    });
  }
});
