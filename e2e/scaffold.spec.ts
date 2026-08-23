import { expect, test } from "@playwright/test";

/**
 * End-to-end rig self-test (PR-2.5, 08 §5).
 *
 * This is the one e2e spec the lint-and-test-tooling PR owns, and it is
 * deliberately *not* named `e2e/smoke*`: that family belongs to PR-3.6, which
 * replaces these three assertions with the real route × locale matrix read from
 * `routing.locales` and `site.json.routes[]` (INV-02.5, INV-08.4).
 *
 * What it proves today is what nothing else can: `next build` + `next start` +
 * the browsers + this config actually serve and load the app. Every assertion
 * below holds for the blank PR-2.4 scaffold and keeps holding once the real
 * homepage lands, so PR-3.1 does not have to come back and edit it.
 */
test.describe("scaffold", () => {
  test("serves the app over the production build @scaffold", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
  });

  test("renders a document with a declared language @scaffold", async ({ page }) => {
    await page.goto("/");

    // PR-3.1 replaces this with `LOCALE_META[locale].htmlLang`, which HD-10
    // makes identical to the URL segment. Until the `[locale]` segment exists,
    // the scaffold's root layout declares `en`.
    await expect(page.locator("html")).toHaveAttribute("lang", /^[a-z]{2}(-[A-Za-z]+)?$/);
    await expect(page.locator("main")).toBeAttached();
  });

  test("emits no missing-message marker @scaffold", async ({ page }) => {
    await page.goto("/");

    // The dev-only `⟦namespace.key⟧` marker of 02 §Loading. Under `next start`
    // the production loader deep-merges to `en` instead of emitting it, so this
    // is a check that no key is missing from `en` as well (08 §5 note (a));
    // Chinese gaps are the `content` job's business (INV-02.2).
    await expect(page.locator("body")).not.toContainText("⟦");
  });
});
