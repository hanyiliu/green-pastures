import { expect, test, type Page } from "@playwright/test";

import { routing } from "@/i18n/routing";
import { HONEYPOT_FIELD } from "@/lib/inquiry/schema";

import { openA11yPage, settleMotion } from "./a11y-support";
import { BUILT_DETAIL_ROUTES, headingId, homeUrlFor, urlFor } from "./routes-support";
import { VIEWPORTS } from "./visual-support";

/**
 * The keyboard scripts 08 §6 names (PR-8.4).
 *
 * "skip link is first `Tab` and lands on `main`; nav order matches the visual
 * order; hamburger: `Tab` cycles inside, `Esc` closes and returns focus to the
 * trigger; lightbox: arrows, `Esc`, focus trapped and returned; form: `Tab`
 * through all controls, `Enter` submits, error focus management (`D-07.4`); the
 * `:focus-visible` ring has a computed `outline-width` of `3px` (`D-03.11`)."
 *
 * ## Every assertion here reads `document.activeElement`
 *
 * Not a locator's `toBeFocused`, which is the same reading with the element
 * decided in advance, and never the component's source. "The sheet traps focus"
 * is a claim about where the browser puts the caret after a key, so the keys are
 * pressed and the answer is read back out of the document. {@link activeElement}
 * is that reading, and it returns enough to name what it found — a red test says
 * `BODY` or `A#skip` rather than "expected true, got false".
 *
 * ## The one place a component is asked instead of the browser
 *
 * Focus *order* cannot be read from one element. `tabThrough` presses `Tab` and
 * records where each press landed, which is the only way to observe an order
 * that the DOM, `tabindex` and `inert` all have a say in.
 *
 * ## Why five of these carry `@a11y-keys`
 *
 * Safari ships with Full Keyboard Access **off**, so its default tab sequence
 * holds text fields and popup menus and no links and no buttons at all.
 * Measured in `webkit-mobile`: the first `Tab` on `/` lands on
 * `#menu-day-mon`, never on the skip link, and a lap of the open sheet leaves
 * it on the first press. Every Tab-driven assertion here would therefore red in
 * that project while measuring a browser preference rather than this site, so
 * the five that press `Tab` past a link or a button are tagged `@a11y-keys` and
 * `playwright.config.ts` pins that tag to `chromium-desktop` — the same
 * treatment, and for a closely related reason, as note (b) of 08 §5's other
 * three. The four that move focus with `focus()` and `Enter` (the ring, the day
 * chips, the form, the Back pill) need no such gate and run everywhere.
 *
 * What that gate costs is worth naming: it is a real reader's experience on a
 * default Safari, and it is not something this site can fix. A keyboard visitor
 * on macOS or iOS has to turn Full Keyboard Access on before any skip link on
 * any website is reachable.
 */

/** What has focus right now, in enough detail to name it in a failure. */
type ActiveElement = {
  readonly tag: string;
  readonly id: string;
  /** The control's `name`, or its tag name — the form's tab order is read in these. */
  readonly control: string;
  readonly label: string;
  readonly href: string;
  /** Is this inside the sheet or the lightbox? — so "trapped" is answerable. */
  readonly withinDialog: boolean;
  readonly withinMain: boolean;
  /** Is this one of the header's own nav links? */
  readonly withinNav: boolean;
  /** `:focus-visible` ring width, `D-03.11`'s 3px when the ring is showing. */
  readonly outlineWidth: string;
};

function activeElement(page: Page): Promise<ActiveElement> {
  return page.evaluate(() => {
    const node = document.activeElement;
    if (node === null || !(node instanceof HTMLElement)) {
      return {
        tag: "NONE",
        id: "",
        control: "",
        label: "",
        href: "",
        withinDialog: false,
        withinMain: false,
        withinNav: false,
        outlineWidth: "",
      };
    }
    return {
      tag: node.tagName,
      id: node.id,
      control: node.getAttribute("name") ?? node.tagName,
      label: (node.getAttribute("aria-label") ?? node.textContent ?? "").trim().slice(0, 60),
      href: node.getAttribute("href") ?? "",
      withinDialog: node.closest('[role="dialog"], dialog') !== null,
      withinMain: node.closest("main") !== null,
      withinNav: node.closest("header nav") !== null,
      outlineWidth: getComputedStyle(node).outlineWidth,
    };
  });
}

/** Press `Tab` `count` times, reporting where each press landed. */
async function tabThrough(page: Page, count: number): Promise<ActiveElement[]> {
  const stops: ActiveElement[] = [];
  for (let step = 0; step < count; step += 1) {
    await page.keyboard.press("Tab");
    stops.push(await activeElement(page));
  }
  return stops;
}

const LOCALE = routing.defaultLocale;
const KEYBOARD_BUDGET_MS = 120_000;

/** How long to keep asking where a post-navigation focus effect landed. */
const FOCUS_SETTLE_TIMEOUT_MS = 15_000;

/**
 * The subpage the Back pill is driven on.
 *
 * Resolved once, at collection time, and it throws rather than skipping: an
 * empty `BUILT_DETAIL_ROUTES` means no detail page has a `page.tsx`, which is a
 * broken tree and not a reason for this test to quietly not run.
 */
const BACK_ROUTE = (() => {
  const route = BUILT_DETAIL_ROUTES[0];
  if (route === undefined) throw new Error("No detail route is built, so Back cannot be driven.");
  return route;
})();

test.describe("keyboard paths", () => {
  test.describe.configure({ timeout: KEYBOARD_BUDGET_MS });

  test("the skip link is the first tab stop and hands the next one to main @a11y-keys", async ({
    page,
  }) => {
    await openA11yPage(page, homeUrlFor(LOCALE));

    await page.keyboard.press("Tab");
    const first = await activeElement(page);
    expect(first.href, `first Tab landed on ${first.tag}#${first.id}`).toBe("#main");

    // `sr-only` until it takes focus (04 §3.1): a skip link nobody can see once
    // they have reached it is a skip link nobody can use. The box is the check —
    // `sr-only` clips the element to a 1px square.
    const box = await page.locator('a[href="#main"]').boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(1);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);

    // Following a fragment moves the *sequential focus navigation starting
    // point*, not the focus, so the assertion is about the next Tab rather than
    // about `activeElement` immediately after Enter.
    await page.keyboard.press("Tab");
    const afterSkip = await activeElement(page);
    expect(
      afterSkip.withinMain,
      `the Tab after the skip link landed on ${afterSkip.tag}#${afterSkip.id} outside <main>`,
    ).toBe(true);
  });

  test("the focus ring is 3px wide when the keyboard put it there @a11y", async ({ page }) => {
    await openA11yPage(page, homeUrlFor(LOCALE));

    // Reached by pressing Tab, not by calling `focus()`: `:focus-visible` is a
    // statement about *how* focus arrived, and a programmatic focus on a button
    // does not match it in Chromium. Calling `focus()` here would assert the
    // ring is absent and pass for the wrong reason.
    await page.keyboard.press("Tab");
    const ringed = await activeElement(page);
    expect(ringed.outlineWidth, `${ringed.tag}#${ringed.id} has no D-03.11 ring`).toBe("3px");
  });

  test("the Back pill returns home from the keyboard and lands focus on a heading @a11y", async ({
    page,
  }) => {
    await openA11yPage(page, urlFor(LOCALE, BACK_ROUTE.path));

    const back = page.locator(
      `[data-subpage="${BACK_ROUTE.id}"] a[href="${homeUrlFor(LOCALE)}#${BACK_ROUTE.homeAnchor}"]`,
    );
    await back.focus();
    expect((await activeElement(page)).href).toContain(`#${BACK_ROUTE.homeAnchor}`);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`#${BACK_ROUTE.homeAnchor}$`));

    /*
     * The router moves focus nowhere (05 §5.7); `BackLink` does, in an effect
     * that runs after the home page has rendered. Without it the next Tab
     * restarts from the top of the document on every navigation.
     *
     * The poll carries its own bound rather than `playwright.config.ts`'s 5 s,
     * and the reason is measured: under three concurrent workers on a loaded
     * machine this assertion sampled `<body>` for the whole five seconds and
     * then passed on its own a moment later — a navigation, a 500 ms slide and
     * a React commit do not all fit in one `expect` budget when the host is
     * busy. It is a give-up bound on a synchronisation, not a clock extended to
     * hide a failure (`D-08.13`): the condition is still "focus is on the
     * origin heading", and a `BackLink` that stops moving focus at all reds it
     * just as surely, only later.
     */
    await expect
      .poll(async () => (await activeElement(page)).id, { timeout: FOCUS_SETTLE_TIMEOUT_MS })
      .toBe(headingId(BACK_ROUTE.homeAnchor));
  });
});

/**
 * The horizontal nav row is `lg:` and up and the hamburger is below it (04
 * `D-04.9`), so these two pin their viewport instead of inheriting the
 * project's. Inheriting would mean each could only run in one project and would
 * have to branch in the other; pinning runs both in **both** engines, which is
 * more coverage than the project matrix gave them and no conditional in a test.
 */
test.describe("keyboard paths · the wide nav row", () => {
  test.use({ viewport: VIEWPORTS.desktop });
  test.describe.configure({ timeout: KEYBOARD_BUDGET_MS });

  test("the nav's tab order is its visual order @a11y-keys", async ({ page }) => {
    await openA11yPage(page, homeUrlFor(LOCALE));

    const visual = await page.locator("header nav a").evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          href: node.getAttribute("href") ?? "",
          x: node.getBoundingClientRect().x,
        }))
        .sort((a, b) => a.x - b.x)
        .map((entry) => entry.href),
    );
    expect(visual.length).toBeGreaterThan(1);

    // Filtered by *where the focus was*, not by the href it carried: the hero
    // cue and three "learn more" links point at the same fragments as the nav,
    // so matching on href alone counted `#philosophy` three times and compared
    // a list of nav destinations against a walk of the whole page.
    const stops = await tabThrough(page, visual.length + 4);
    const tabbed = stops.filter((stop) => stop.withinNav).map((stop) => stop.href);

    expect(tabbed).toEqual(visual);
  });
});

test.describe("keyboard paths · the hamburger sheet", () => {
  test.use({ viewport: VIEWPORTS.mobile });
  test.describe.configure({ timeout: KEYBOARD_BUDGET_MS });

  test("the sheet cycles focus, and Escape gives it back @a11y-keys", async ({ page }) => {
    await openA11yPage(page, homeUrlFor(LOCALE));

    const trigger = page.locator("header button[aria-expanded]");
    await trigger.focus();
    await page.keyboard.press("Enter");

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await settleMotion(page);

    // MobileMenu focuses the sheet's first stop on open.
    const stops = await sheet
      .locator('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim().slice(0, 40) ?? ""));
    expect(stops.length).toBeGreaterThan(2);

    const onOpen = await activeElement(page);
    expect(onOpen.withinDialog, `opening left focus on ${onOpen.tag}#${onOpen.id}`).toBe(true);
    expect(onOpen.label).toBe(stops[0]);

    // Backwards off the first stop wraps to the last …
    await page.keyboard.press("Shift+Tab");
    const wrappedBack = await activeElement(page);
    expect(wrappedBack.withinDialog).toBe(true);
    expect(wrappedBack.label).toBe(stops[stops.length - 1]);

    // … and forwards off the last wraps to the first.
    await page.keyboard.press("Tab");
    expect((await activeElement(page)).label).toBe(stops[0]);

    // A full lap plus one, so a leak shows up wherever it is rather than only
    // at the ends: every landing is still inside the sheet.
    const lap = await tabThrough(page, stops.length + 1);
    for (const stop of lap) {
      expect(stop.withinDialog, `Tab escaped the sheet onto ${stop.tag}#${stop.id}`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    const returned = await activeElement(page);
    expect(returned.tag).toBe("BUTTON");
    await expect(trigger).toBeFocused();
    expect(returned.label).not.toBe("");
  });
});

test.describe("keyboard paths · the rest", () => {
  test.describe.configure({ timeout: KEYBOARD_BUDGET_MS });

  test("the lightbox steps with the arrows and returns focus to the photograph shown @a11y-keys", async ({
    page,
  }) => {
    await openA11yPage(page, urlFor(LOCALE, "/gallery"));

    const thumbnails = page.locator("[data-gallery-photo]");
    const first = thumbnails.first();
    const firstId = await first.getAttribute("id");
    await first.focus();
    await page.keyboard.press("Enter");

    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await settleMotion(page);

    const opened = await activeElement(page);
    expect(opened.withinDialog, `the dialog opened with focus on ${opened.tag}#${opened.id}`).toBe(
      true,
    );

    const firstLabel = await dialog.getAttribute("aria-label");
    await page.keyboard.press("ArrowRight");
    await expect(dialog).not.toHaveAttribute("aria-label", firstLabel ?? "");
    const secondLabel = await dialog.getAttribute("aria-label");

    // Back to where it started, then on one more, so both directions are driven
    // rather than one of them assumed to be its mirror.
    await page.keyboard.press("ArrowLeft");
    await expect(dialog).toHaveAttribute("aria-label", firstLabel ?? "");
    await page.keyboard.press("ArrowRight");
    await expect(dialog).toHaveAttribute("aria-label", secondLabel ?? "");

    /*
     * A modal `<dialog>` traps focus in the platform (04 `D-04.7`), and the
     * assertion is that the trap is real here rather than merely specified.
     *
     * What "trapped" looks like is not "every stop is a child of the dialog".
     * Measured in Chromium, tabbing from the lightbox's three buttons cycles
     * `close → prev → next → <body> → <dialog> → close`: the wrap runs through
     * the document root and the dialog element itself, which is the top layer's
     * own route back to the start and not an escape. Nor is "outside `<main>`"
     * the property — the dialog is rendered inside `<main>`, so its own buttons
     * are in there too. What holds, and what stops holding the moment
     * `showModal()` becomes a plain `open`, is that every stop is either inside
     * the dialog or the document root itself, and never a control behind it.
     *
     * The lap runs *after* the arrows for a reason worth writing down: it ends
     * on `<body>`, and 04 §5.5 binds the arrow keys to the dialog element, so a
     * lap taken first leaves the keys with no path to their listener and the
     * arrow assertions fail on the test's own manoeuvring rather than on the
     * component.
     */
    const lap = await tabThrough(page, 8);
    for (const stop of lap) {
      expect(
        stop.withinDialog || stop.tag === "BODY",
        `Tab reached ${stop.tag}#${stop.id} behind the lightbox`,
      ).toBe(true);
    }
    expect(
      lap.filter((stop) => stop.withinDialog && stop.tag === "BUTTON").length,
      "the cycle never returned to the dialog's own controls",
    ).toBeGreaterThan(3);

    // And the background is genuinely inert, not merely un-tabbed-to: a modal
    // dialog makes the rest of the document unfocusable, so even a direct
    // `focus()` call on the thumbnail underneath is ignored. This is the half a
    // Tab lap cannot show, because a Tab that never goes there proves nothing
    // about a script — or a screen reader — that does.
    const behindTookFocus = await thumbnails.nth(2).evaluate((node) => {
      node.focus();
      return document.activeElement === node;
    });
    expect(behindTookFocus, "the page behind the lightbox still takes focus").toBe(false);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // The platform would hand focus back to whatever opened the dialog. 04 §5.5
    // asks for the thumbnail the reader is *looking at*, which after one arrow
    // press is a different photograph — so this is the assertion that fails if
    // `GalleryExplorer.onClose` stops re-pointing it.
    const returned = await activeElement(page);
    expect(returned.tag).toBe("BUTTON");
    expect(returned.id).not.toBe("");
    expect(returned.id, "Escape returned focus to the photograph the reader arrived on").not.toBe(
      firstId,
    );
    expect(returned.label).toBe(secondLabel);
  });

  test("the menu day chips rove, and hold one tab stop between them @a11y", async ({ page }) => {
    await openA11yPage(page, homeUrlFor(LOCALE));

    const chips = page.getByRole("tab");
    const count = await chips.count();
    expect(count).toBeGreaterThan(2);

    const selected = chips.filter({ has: page.locator("[aria-selected]") });
    expect(selected).toBeTruthy();

    await chips.first().focus();
    expect((await activeElement(page)).id).toBe(await chips.first().getAttribute("id"));

    await page.keyboard.press("ArrowRight");
    const afterRight = await activeElement(page);
    expect(afterRight.id).toBe(await chips.nth(1).getAttribute("id"));
    await expect(chips.nth(1)).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("End");
    expect((await activeElement(page)).id).toBe(await chips.nth(count - 1).getAttribute("id"));

    await page.keyboard.press("Home");
    expect((await activeElement(page)).id).toBe(await chips.first().getAttribute("id"));

    // Roving means one stop for the whole row: exactly one chip is tabbable.
    const tabbable = await chips.evaluateAll(
      (nodes) => nodes.filter((node) => node.getAttribute("tabindex") !== "-1").length,
    );
    expect(tabbable).toBe(1);

    const next = await tabThrough(page, 1);
    expect(next[0]?.id).not.toBe(await chips.nth(1).getAttribute("id"));
  });

  test("the gallery filters toggle from the keyboard @a11y-keys", async ({ page }) => {
    await openA11yPage(page, urlFor(LOCALE, "/gallery"));

    const filters = page.locator("[data-filter]");
    const second = filters.nth(1);
    await expect(second).toHaveAttribute("aria-pressed", "false");

    await filters.first().focus();
    const reached = await tabThrough(page, 1);
    expect(reached[0]?.tag).toBe("BUTTON");

    await page.keyboard.press("Space");
    await expect(second).toHaveAttribute("aria-pressed", "true");

    // A toggle button keeps focus when it is pressed; losing it here would drop
    // a keyboard reader back at the top of the document on every filter.
    const held = await activeElement(page);
    expect(held.tag).toBe("BUTTON");
  });

  test("the form is tabbable end to end, and a failed submit focuses the first problem @a11y", async ({
    page,
  }) => {
    await openA11yPage(page, homeUrlFor(LOCALE));

    const form = page.locator('form[action="/api/inquiry"]');
    const controls = await form
      .locator(
        'input:not([type=hidden]):not([tabindex="-1"]), select, textarea, button:not([tabindex="-1"])',
      )
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => node.getClientRects().length > 0)
          .map((node) => node.getAttribute("name") ?? node.tagName),
      );
    expect(controls.length).toBeGreaterThan(3);

    // The honeypot (07 §1) is `sr-only` and `tabIndex={-1}`, so it has a box and
    // must still never take focus. It is excluded above by its `tabindex`, and
    // asserted here rather than merely filtered — a honeypot a keyboard reader
    // can tab into is a form that traps its own visitors.
    expect(controls).not.toContain(HONEYPOT_FIELD);

    const firstControl = form.locator("[name]").first();
    await firstControl.focus();
    const reached = new Set([(await activeElement(page)).control]);
    // One press per control, plus two, so a stop that is *skipped* shows up as a
    // missing control rather than as a run that simply stopped counting early.
    for (const stop of await tabThrough(page, controls.length + 2)) reached.add(stop.control);

    // Every visible control was landed on. A control the keyboard cannot reach
    // is a form a keyboard reader cannot complete, and a `tabindex="-1"` or an
    // `inert` wrapper would open exactly this gap silently.
    const missed = controls.filter((control) => !reached.has(control));
    expect(missed, `Tab never landed on ${missed.join(", ")}`).toEqual([]);
    expect([...reached], "Tab landed on the honeypot").not.toContain(HONEYPOT_FIELD);

    await form.locator("button[type=submit]").click();

    // D-07.4: the first invalid control takes focus once its error text and the
    // `aria-describedby` pointing at it are both in the DOM.
    await expect(form.locator('[name="parentName"]')).toHaveAttribute("aria-invalid", "true");
    const focused = await activeElement(page);
    const firstInvalid = await form
      .locator("[aria-invalid=true]")
      .first()
      .evaluate((node) => node.id);
    expect(focused.id, `focus went to ${focused.tag}#${focused.id}`).toBe(firstInvalid);
  });
});
