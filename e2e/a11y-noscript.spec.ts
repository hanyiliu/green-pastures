import { expect, test, type Browser, type Page } from "@playwright/test";

import { routing } from "@/i18n/routing";

import { describeViolations, scanAxe } from "./a11y-support";
import { BUILT_ROUTE_PATHS, homeUrlFor, urlFor } from "./routes-support";

/**
 * The page a reader without JavaScript gets — the one no axe run has ever seen
 * (PR-8.4 · `gp-dln.264`).
 *
 * ## The blind spot, stated exactly
 *
 * A browser with scripting **enabled** parses `<noscript>` content as raw text.
 * The markup inside is one text node: no elements, no computed styles, nothing
 * in the accessibility tree. axe walks the DOM, so everything inside a
 * `<noscript>` is invisible to it — not "hard to reach", *absent*. A real AA
 * contrast failure lived in `NoscriptFallback` — sage links at 14 px bold,
 * 3.83:1 — through every green axe run this repository had, and was found
 * because a human read the file. The first test below pins the gap itself —
 * `noscript *` is empty with scripting on and non-empty with it off — so the
 * reason this file exists cannot quietly stop being true without saying so.
 *
 * And this is the path that matters most for the guarantee: a reader on a
 * locked-down browser, an enterprise or school network that strips scripts, or
 * a screen reader in a hardened profile gets exactly this DOM and no other.
 *
 * ## Why "just run axe with JavaScript off" does not work
 *
 * It was tried first. Playwright's `javaScriptEnabled: false` does give the
 * true DOM — `noscript a` is a real element there, with a bounding box — and
 * `page.evaluate` still works, because Playwright drives it over CDP rather
 * than through page script. What does *not* work is anything asynchronous:
 * with script execution disabled, **`setTimeout` and `requestAnimationFrame`
 * never fire**. Measured directly: a promise resolved from a 50 ms timer was
 * still pending after 4 s. axe-core's `run` is built on those timers, so it
 * attaches (`window.axe` is an object) and then never resolves — the run ends
 * with "Resulting promise was garbage collected".
 *
 * So the two halves are taken by two instruments, and between them they cover
 * both what axe measures and what it cannot:
 *
 * - **The true no-JS DOM** (`javaScriptEnabled: false`) is measured with
 *   synchronous DOM reads: every text-bearing element inside a `<noscript>`,
 *   its computed colour, the first opaque background above it, and the WCAG
 *   contrast ratio between them, checked against 4.5:1 (or 3:1 for large text).
 *   This is the check a human was doing by hand.
 * - **Every other WCAG 2.2 AA rule** — link names, colour on a composited
 *   ground, the rest — is taken by axe over a *reconstruction*: the page loaded
 *   with every script request aborted, so React never hydrates and the DOM is
 *   the server's, and then each `<noscript>` replaced in place by its own
 *   parsed content. Scripting is enabled in that context, so axe runs; the
 *   cascade is the real one, because the elements stay where they stood.
 *
 * The axe half is scoped to the reconstructed elements rather than run over the
 * whole document, and the reason is a finding rather than a preference. In
 * `webkit-mobile` — and **only** with `isMobile` emulation on, a narrow
 * viewport and no JavaScript — WebKit drops the five inline custom properties
 * on the Visit `<section>`, so `--section-bg` computes empty, the forest ground
 * disappears and the section's light type lands on white at 1.52:1. Chromium at
 * the same width is fine with and without scripts; desktop WebKit without
 * scripts is fine; running the page's own JavaScript fixes it in every engine.
 * A whole-document scan here would red on that, and it is neither this file's
 * subject nor something a spec can fix: it is recorded in 08 §6 as a finding
 * with its reproduction, for a bead of its own and a look on a real iPhone.
 */

/** Text under 24px (or under 18.66px bold) needs 4.5:1; larger needs 3:1 (03 §10). */
const AA_NORMAL = 4.5;
const AA_LARGE = 3;

type NoscriptText = {
  readonly tag: string;
  readonly text: string;
  readonly color: string;
  readonly background: string;
  readonly ratio: number;
  readonly required: number;
};

/**
 * Every text-bearing element inside a `<noscript>`, with its measured ratio.
 *
 * Runs entirely inside the page so it can read *computed* styles: the colours
 * are whatever the real cascade resolves for these elements in this document,
 * not what the source says they should be.
 */
function noscriptText(page: Page): Promise<NoscriptText[]> {
  return page.evaluate(
    ([normal, large]) => {
      const channels = (value: string): number[] =>
        (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

      const luminance = (value: string): number => {
        const [r = 0, g = 0, b = 0] = channels(value).map((channel) => {
          const scaled = channel / 255;
          return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };

      const contrast = (fore: string, back: string): number => {
        const a = luminance(fore);
        const b = luminance(back);
        return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
      };

      /** The first ancestor that actually paints something behind the text. */
      const backgroundOf = (element: Element): string => {
        let node: Element | null = element;
        while (node !== null) {
          const painted = getComputedStyle(node).backgroundColor;
          if (painted !== "" && !/rgba\(0, 0, 0, 0\)|transparent/.test(painted)) return painted;
          node = node.parentElement;
        }
        return "rgb(255, 255, 255)";
      };

      const rows: NoscriptText[] = [];

      for (const block of document.querySelectorAll("noscript")) {
        for (const element of block.querySelectorAll("*")) {
          const own = [...element.childNodes]
            .filter((child) => child.nodeType === Node.TEXT_NODE)
            .map((child) => child.textContent ?? "")
            .join("")
            .trim();
          if (own === "" || element.tagName === "STYLE") continue;

          const styles = getComputedStyle(element);
          const size = Number.parseFloat(styles.fontSize);
          const bold = Number.parseInt(styles.fontWeight, 10) >= 700;
          const background = backgroundOf(element);

          rows.push({
            tag: element.tagName,
            text: own.slice(0, 60),
            color: styles.color,
            background,
            ratio: contrast(styles.color, background),
            required: size >= 24 || (bold && size >= 18.66) ? large : normal,
          });
        }
      }

      return rows;
    },
    [AA_NORMAL, AA_LARGE] as const,
  );
}

/** A context whose pages run no script at all. */
async function withoutJavaScript<T>(
  browser: Browser,
  page: Page,
  body: (nojs: Page) => Promise<T>,
): Promise<T> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: page.viewportSize() ?? undefined,
    javaScriptEnabled: false,
  });
  try {
    return await body(await context.newPage());
  } finally {
    await context.close();
  }
}

/**
 * Load the server's HTML with no script able to run, then put each
 * `<noscript>`'s content into the document where the element stood.
 *
 * Two separate things, and both are needed. Aborting the scripts is what stops
 * React hydrating, so the DOM under test is the server's — the same DOM a
 * reader without JavaScript is handed. Replacing the `<noscript>` elements is
 * what a browser with scripting *disabled* would have done at parse time, and
 * doing it explicitly is the only way to have those elements in a document
 * where axe can still run.
 */
async function openReconstructed(page: Page, url: string): Promise<number> {
  await page.route(/\.js(\?.*)?$/, (route) => route.abort());
  await page.goto(url);

  return page.evaluate((marker) => {
    let inlined = 0;
    for (const block of [...document.querySelectorAll("noscript")]) {
      const parsed = document.createElement("template");
      parsed.innerHTML = block.textContent ?? "";

      // Marked, not moved. The elements are put exactly where the `<noscript>`
      // stood so the cascade reaching them is the real one — a wrapper, or a
      // detached fragment, would compute colours against a ground the page does
      // not have. The attribute is what lets axe be scoped to them.
      for (const element of [...parsed.content.children]) element.setAttribute(marker, "");
      inlined += parsed.content.childElementCount;
      block.replaceWith(parsed.content);
    }
    return inlined;
  }, RECONSTRUCTED);
}

/** Set on every element lifted out of a `<noscript>`, so axe can be scoped to them. */
const RECONSTRUCTED = "data-noscript-content";

const NOJS_BUDGET_MS = 120_000;

test.describe("the no-JavaScript page", () => {
  test.describe.configure({ timeout: NOJS_BUDGET_MS });

  test("scripting-enabled sees no elements inside a noscript at all @a11y", async ({
    page,
    browser,
  }) => {
    await page.goto(homeUrlFor(routing.defaultLocale));

    const asText = await page.evaluate(() => ({
      blocks: document.querySelectorAll("noscript").length,
      elements: document.querySelectorAll("noscript *").length,
    }));

    expect(asText.blocks, "the home page carries no <noscript> to be blind to").toBeGreaterThan(0);
    // The blind spot, as a number. If this ever stops being 0 the whole family
    // below is redundant and should be deleted rather than left duplicating a
    // plain axe run.
    expect(
      asText.elements,
      "a scripting-enabled browser now parses <noscript> as markup — gp-dln.264 no longer holds",
    ).toBe(0);

    const asMarkup = await withoutJavaScript(browser, page, async (nojs) => {
      await nojs.goto(homeUrlFor(routing.defaultLocale));
      return nojs.evaluate(() => document.querySelectorAll("noscript *").length);
    });

    expect(asMarkup, "the no-JS DOM has no elements inside its <noscript> either").toBeGreaterThan(
      0,
    );
  });

  for (const locale of routing.locales) {
    test(`${homeUrlFor(locale)} keeps AA contrast inside every noscript block @a11y`, async ({
      page,
      browser,
    }) => {
      const failures = await withoutJavaScript(browser, page, async (nojs) => {
        const bad: NoscriptText[] = [];
        for (const routePath of BUILT_ROUTE_PATHS) {
          await nojs.goto(urlFor(locale, routePath));
          const rows = await noscriptText(nojs);
          bad.push(...rows.filter((row) => row.ratio < row.required));
        }
        return bad;
      });

      expect(
        failures,
        failures
          .map(
            (row) =>
              `${row.tag} "${row.text}": ${row.color} on ${row.background} = ` +
              `${String(row.ratio)}:1, needs ${String(row.required)}:1`,
          )
          .join("\n"),
      ).toEqual([]);
    });

    test(`${homeUrlFor(locale)} is axe-clean once its noscript content is in the DOM @a11y`, async ({
      page,
    }, info) => {
      const inlined = await openReconstructed(page, homeUrlFor(locale));

      // A reconstruction that inlined nothing would scan the same DOM as every
      // other suite and report a pass having measured none of the markup this
      // file exists for.
      expect(inlined, "no <noscript> content reached the document").toBeGreaterThan(0);

      // INV-05.10: without JavaScript no `Reveal` ever animates, so the
      // `<noscript>` stylesheet is the only thing standing between a reader and
      // a page of `opacity: 0`. It is inside a `<noscript>`, so this is the one
      // pass that can see whether it works.
      const hidden = await page.evaluate(
        () =>
          [...document.querySelectorAll("[data-reveal]")].filter(
            (node) => node.getClientRects().length > 0 && getComputedStyle(node).opacity !== "1",
          ).length,
      );
      expect(hidden, "reveals are still hidden without JavaScript").toBe(0);

      const { unexpected } = await scanAxe(page, info, { include: `[${RECONSTRUCTED}]` });
      expect(unexpected, describeViolations(unexpected)).toEqual([]);
    });
  }
});
