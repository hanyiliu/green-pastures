import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { describeViolations, runAxe } from "./form-axe";
import {
  copy,
  fillDraft,
  forceInquiryResponse,
  gotoForm,
  INQUIRY_ENDPOINT,
  LAUNCH_LOCALES,
  stubTurnstile,
  submitButton,
  successPanel,
  VALID_DRAFT,
  visitCopy,
} from "./form-support";

/**
 * axe over the form's three states (PR-5.10 · 07 §8 · 08 §6).
 *
 * 08 §6 lists "the form idle / error / success" among the contexts axe runs on,
 * with all WCAG 2.2 AA rules and zero violations. Each state is a different DOM
 * — the error state adds three `aria-describedby` targets and an `aria-invalid`
 * on every control, the banner state adds a `role="alert"` with two links
 * inside it, and the success state replaces the form with a panel whose heading
 * is `tabindex="-1"` — so scanning the idle form and calling it covered would
 * miss exactly the markup that only exists when something has gone wrong.
 *
 * The four scans below are scoped to the form (or to what replaced it); the
 * reason is in `form-axe.ts`, and the short version is that the rest of `/`
 * belongs to other PRs and to PR-8.4's route-wide sweep.
 *
 * Tagged `@form` rather than `@a11y`: `@a11y` is PR-8.4's tag for the suite 08
 * §6 owns, and taking it here would put this file in a job that does not exist
 * yet. The scans run wherever the form family runs.
 */

/** What the form's own scan looks at. `07 D-07.1` fixes the action. */
const FORM_SELECTOR = `form[action="${INQUIRY_ENDPOINT}"]`;
const SUCCESS_SELECTOR = "[data-inquiry-success]";

/**
 * Scan `selector`, fail on anything unaudited, and record the rest.
 *
 * `D-08.8`'s two halves in one function: an **unmatched** violation fails the
 * job; a violation matching one of 03 §10's audited contrast pairs is
 * *reported* instead — here as a test annotation, which is where a Playwright
 * run puts something a job summary should pick up.
 */
async function expectAxeClean(page: Page, selector: string, info: TestInfo): Promise<void> {
  const { unexpected, allowed } = await runAxe(page, selector);

  for (const entry of allowed) {
    info.annotations.push({ type: "axe-exception", description: entry });
  }

  expect(unexpected, describeViolations(unexpected)).toEqual([]);
}

test.describe("inquiry form accessibility", () => {
  for (const id of LAUNCH_LOCALES) {
    test.describe(id, () => {
      const words = visitCopy(id);

      test(`is clean at rest @form`, async ({ page }, info) => {
        await stubTurnstile(page);
        const form = await gotoForm(page, id);

        await expect(form).toBeVisible();
        await expectAxeClean(page, FORM_SELECTOR, info);
      });

      test(`is clean with inline errors showing @form`, async ({ page }, info) => {
        await stubTurnstile(page);
        const form = await gotoForm(page, id);

        await submitButton(form).click();
        await expect(form.locator('[name="parentName"]')).toHaveAttribute("aria-invalid", "true");

        await expectAxeClean(page, FORM_SELECTOR, info);
      });

      test(`is clean with the failure banner showing @form`, async ({ page }, info) => {
        await stubTurnstile(page);
        const form = await gotoForm(page, id);
        await forceInquiryResponse(page, 502, { ok: false, code: "email_failed" });

        await fillDraft(form, VALID_DRAFT);
        await submitButton(form).click();
        await expect(form.getByRole("alert")).toContainText(copy(words, "form.errors.emailFailed"));

        await expectAxeClean(page, FORM_SELECTOR, info);
      });

      test(`is clean on the success panel @form`, async ({ page }, info) => {
        await stubTurnstile(page);
        const form = await gotoForm(page, id);
        await forceInquiryResponse(page, 200, { ok: true });

        await fillDraft(form, VALID_DRAFT);
        await submitButton(form).click();
        await expect(successPanel(page)).toBeVisible();

        await expectAxeClean(page, SUCCESS_SELECTOR, info);
      });
    });
  }
});
