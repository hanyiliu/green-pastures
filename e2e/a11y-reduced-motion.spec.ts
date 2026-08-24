import { expect, test, type Browser, type Page } from "@playwright/test";

import { routing } from "@/i18n/routing";

import { openA11yPage, settleMotion } from "./a11y-support";
import { homeUrlFor } from "./routes-support";
import { VIEWPORTS } from "./visual-support";

/**
 * Reduced-motion parity — 05 §5.14's first bullet and the §5.9 table (PR-8.4).
 *
 * "With the media query emulated, the settled DOM/styles of every section equal
 * the post-animation state of the default run; no transform/filter animations,
 * no loops, count-up shows final values."
 *
 * ## Two runs, one comparison
 *
 * Parity is a statement about two pages, so there are two: the test's own
 * `page`, which `playwright.config.ts` pins to `reducedMotion: "no-preference"`
 * so "default" is a stated value rather than the runner's OS preference, and a
 * second context that asks for `reduce`. Same engine, same viewport, same
 * locale, one media query apart.
 *
 * ## Why the property list is sampled rather than the styles inspected
 *
 * "No transform/filter animations" cannot be read off a settled page: an
 * entrance that translated 18 px and then landed leaves `transform: none`
 * behind, exactly like one that never moved. The only moment the difference
 * exists is while it is happening. So {@link recordAnimatedProperties} installs
 * a frame-by-frame sampler *before* the page is walked and reads
 * `getKeyframes()` off every animation it catches — which covers CSS animations,
 * Motion's WAAPI animations and View Transitions alike, and covers the elements
 * that carry no `data-reveal` (the day chip's `WordSwap`, the sheet, the
 * count-up) without naming any of them.
 */

type SettledPage = {
  readonly reveals: readonly { id: string; opacity: string; transform: string; filter: string }[];
  readonly sections: readonly { id: string; height: number }[];
  readonly countUps: readonly string[];
};

/** Everything 05 §5.14 says the two runs must agree on. */
function snapshot(page: Page): Promise<SettledPage> {
  return page.evaluate(() => {
    /*
     * An animation that has finished leaves its own identity value behind, and
     * a run that never animated leaves the keyword. `matrix(1, 0, 0, 1, 0, 0)`
     * and `none` are the same rendering; so are `blur(0px)` and `none`. Both
     * differences were measured on this page — the default run keeps
     * `blur(0px)` on `philosophy.badges` after the `ink` variant and an identity
     * matrix on the three teacher frames — and comparing the raw strings would
     * fail on *whether an animation ran*, which is the one thing parity is not
     * about. Anything that is not an identity survives, so a run that settled at
     * `translateY(18px)` still fails.
     */
    const settledValue = (value: string): string =>
      /^(none|matrix\(1, 0, 0, 1, 0, 0\)|matrix3d\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1\)|blur\(0px\))$/.test(
        value,
      )
        ? "none"
        : value;

    return {
      reveals: [...document.querySelectorAll("[data-reveal]")]
        .filter((node) => node.getClientRects().length > 0)
        .map((node, index) => {
          const styles = getComputedStyle(node);
          return {
            id: node.getAttribute("data-reveal-id") ?? `${node.tagName}#${String(index)}`,
            opacity: styles.opacity,
            transform: settledValue(styles.transform),
            filter: settledValue(styles.filter),
          };
        }),
      sections: [...document.querySelectorAll("section[id]")].map((node) => ({
        id: node.id,
        height: Math.round(node.getBoundingClientRect().height),
      })),
      countUps: [...document.querySelectorAll("[data-countup]")].map((node) =>
        (node.textContent ?? "").trim(),
      ),
    };
  });
}

/** Open `url` in a second context that asks for `prefers-reduced-motion: reduce`. */
async function withReducedMotion<T>(
  browser: Browser,
  page: Page,
  body: (reduced: Page) => Promise<T>,
): Promise<T> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: page.viewportSize() ?? undefined,
    reducedMotion: "reduce",
  });
  try {
    return await body(await context.newPage());
  } finally {
    await context.close();
  }
}

/**
 * Every property any animation touched while `body` ran.
 *
 * The sampler is a `requestAnimationFrame` loop inside the page rather than a
 * poll from the test: an entrance is 600–750 ms and a stagger step is 110 ms
 * (05 §5.2), so a round-trip-per-sample would miss whole animations between two
 * reads. `getKeyframes()` returns the four bookkeeping fields alongside the
 * animated ones, and those are dropped here rather than asserted around.
 *
 * It is installed with `addInitScript` rather than evaluated into a loaded page,
 * and that is the whole reason it sees anything: the entrances this test is
 * about start on the *navigation* `body` performs, so a sampler injected before
 * that navigation would be thrown away with the previous document, and one
 * injected after it would arrive after the hero had already faded in.
 */
async function recordAnimatedProperties(page: Page, body: () => Promise<void>): Promise<string[]> {
  await page.addInitScript(() => {
    const bookkeeping = new Set(["offset", "computedOffset", "easing", "composite"]);
    const seen = new Set<string>();
    (globalThis as unknown as { __animatedProperties: Set<string> }).__animatedProperties = seen;

    const sample = () => {
      for (const animation of document.getAnimations()) {
        // `getKeyframes` lives on `KeyframeEffect`, which is what both a CSS
        // animation and a Motion animation carry; a View Transition's effect is
        // one too, with a `pseudoElement`.
        const effect = animation.effect;
        if (!(effect instanceof KeyframeEffect)) continue;

        for (const frame of effect.getKeyframes()) {
          for (const property of Object.keys(frame)) {
            if (!bookkeeping.has(property)) seen.add(property);
          }
        }
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await body();

  return page.evaluate(() => [
    ...(globalThis as unknown as { __animatedProperties: Set<string> }).__animatedProperties,
  ]);
}

const LOCALE = routing.defaultLocale;
const PARITY_BUDGET_MS = 180_000;

test.describe("reduced-motion parity (05 §5.9, §5.14)", () => {
  test.describe.configure({ timeout: PARITY_BUDGET_MS });

  test("the settled page is the same page either way @a11y", async ({ page, browser }) => {
    await openA11yPage(page, homeUrlFor(LOCALE));
    const asDefault = await snapshot(page);

    const asReduced = await withReducedMotion(browser, page, async (reduced) => {
      await openA11yPage(reduced, homeUrlFor(LOCALE));
      return snapshot(reduced);
    });

    // Same reveals, in the same order, at the same end state. `Reveal` renders
    // the catalogue's `reduced` form under the query (05 §5.9) — a different
    // animation, and this is the assertion that it lands in the same place.
    expect(asReduced.reveals).toEqual(asDefault.reveals);

    // Every reveal actually arrived, in both runs. Without this the comparison
    // above passes on two pages that both failed to render.
    expect(asDefault.reveals.length).toBeGreaterThan(0);
    for (const reveal of asDefault.reveals) expect(reveal.opacity).toBe("1");

    expect(asReduced.sections).toEqual(asDefault.sections);
    expect(asReduced.countUps).toEqual(asDefault.countUps);
    expect(asDefault.countUps.length).toBeGreaterThan(0);
  });

  test("nothing animates transform or filter under the query @a11y", async ({ page, browser }) => {
    const properties = await withReducedMotion(browser, page, async (reduced) =>
      recordAnimatedProperties(reduced, async () => {
        await openA11yPage(reduced, homeUrlFor(LOCALE));

        // The day chip's `WordSwap` and the tab panel it controls are the other
        // half of 05 §5.9's table, and neither carries `data-reveal`, so the
        // walk above never touches them.
        const tabs = reduced.getByRole("tab");
        await tabs.nth(1).click();
        await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
        await settleMotion(reduced);
      }),
    );

    // 05 §5.9: opacity is kept, transform and filter are not. `filter` is the
    // one Motion's own `reducedMotion` gate misses — it leaves the `ink` blur
    // animating — so it is named here rather than assumed.
    expect(properties, properties.join(", ")).not.toContain("transform");
    expect(properties, properties.join(", ")).not.toContain("filter");
    expect(properties, "no animation ran at all, so this measured nothing").toContain("opacity");
  });

  test("the ambient loops stop, and smooth scrolling with them @a11y", async ({
    page,
    browser,
  }) => {
    const state = await withReducedMotion(browser, page, async (reduced) => {
      await openA11yPage(reduced, homeUrlFor(LOCALE));
      return reduced.evaluate(() => ({
        loops: [...document.querySelectorAll("[data-loop]")].map((node) => ({
          which: node.getAttribute("data-loop") ?? "",
          animationName: getComputedStyle(node).animationName,
        })),
        scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      }));
    });

    expect(state.loops.length, "the home page has no ambient loop to switch off").toBeGreaterThan(
      0,
    );
    for (const loop of state.loops) {
      expect(loop.animationName, `the ${loop.which} loop is still running`).toBe("none");
    }

    // 05 §5.9's last-but-one row: `scroll-behavior: auto`, snap kept.
    expect(state.scrollBehavior).toBe("auto");
  });

  test("the count-up is already at its final value @a11y", async ({ page, browser }) => {
    const first = await withReducedMotion(browser, page, async (reduced) => {
      await reduced.goto(homeUrlFor(LOCALE));
      // Read before anything is scrolled or settled: under the query the value
      // is rendered, not counted to (05 §5.9), so the first paint is the answer.
      return reduced.locator("[data-countup]").first().textContent();
    });

    const settled = await withReducedMotion(browser, page, async (reduced) => {
      await openA11yPage(reduced, homeUrlFor(LOCALE));
      return reduced.locator("[data-countup]").first().textContent();
    });

    expect(first?.trim()).not.toBe("");
    expect(first?.trim()).toBe(settled?.trim());
  });
});

/**
 * 05 §5.10 gates hover on a pointer that can hover, so this pins the wide
 * viewport rather than branching on the project's — the same reason
 * `e2e/a11y-keyboard.spec.ts` pins its two.
 */
test.describe("reduced-motion parity · hover", () => {
  test.use({ viewport: VIEWPORTS.desktop });
  test.describe.configure({ timeout: PARITY_BUDGET_MS });

  test("hover changes colour and nothing else under the query @a11y", async ({ page, browser }) => {
    const measured = await withReducedMotion(browser, page, async (reduced) => {
      await openA11yPage(reduced, homeUrlFor(LOCALE));

      const button = reduced.locator('[data-reveal-id="hero.text"] a[href="#visit"]');
      const before = await button.evaluate((node) => getComputedStyle(node).transform);
      await button.hover();
      await settleMotion(reduced);
      const after = await button.evaluate((node) => getComputedStyle(node).transform);
      return { before, after };
    });

    // `Button` carries `hover:-translate-y-px motion-reduce:hover:translate-y-0`
    // (05 §5.9's "colour changes only; no transform").
    expect(measured.after).toBe(measured.before);
  });
});
