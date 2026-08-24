import { expect, test } from "@playwright/test";

import { EMAIL_MAX_LENGTH, MESSAGE_MAX_LENGTH, NAME_MAX_LENGTH } from "../src/lib/inquiry/schema";

import {
  control,
  copy,
  inquiryForm,
  INQUIRY_ENDPOINT,
  LAUNCH_LOCALES,
  SITE_CONTACT,
  submitButton,
  visitCopy,
} from "./form-support";

/**
 * The form without JavaScript (PR-5.10 · 07 `D-07.5` · 08 §5 `@nojs`).
 *
 * `D-07.5` splits the promise in two, and both halves are asserted here because
 * only one of them is obvious.
 *
 * The obvious half: **a successful submission requires JavaScript**, because
 * Turnstile is a script, so the submit button is replaced by the direct-contact
 * fallback — and "replaced" is literal, a `<style>` inside a `<noscript>` that
 * only a scripting-disabled browser applies. Both the e-mail *and* the phone
 * have to be there: `D-07.11` made `contact.phone` and `contact.phoneDisplay`
 * required fields precisely so this fallback stopped having an "if the owner
 * supplied one" branch.
 *
 * The less obvious half: **the form still reads and validates natively**. The
 * server HTML carries `required`, `type="email"` and `maxlength` and carries no
 * `novalidate` — `InquiryForm`'s mount effect sets that attribute, which is the
 * moment JavaScript takes validation over. A `novalidate` in the *server* HTML
 * would leave a no-JavaScript parent with no validation at all and would be
 * invisible to every other test in this family, all of which run hydrated.
 *
 * `test.use({ javaScriptEnabled: false })` is why this is its own file rather
 * than a describe in `form.spec.ts`: the fixture applies to the whole worker
 * context, and none of the hydrated tests would survive it.
 */

test.describe("inquiry form without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const id of LAUNCH_LOCALES) {
    test(`${id} shows the direct-contact fallback instead of the submit button @form @nojs`, async ({
      page,
    }) => {
      const words = visitCopy(id);

      await page.goto(`/${id}#visit`);
      const form = inquiryForm(page);
      await expect(form).toBeVisible();

      // The `<noscript>` copy, rendered as real DOM because scripting is off.
      //
      // Located by CSS and asserted with `toHaveText` rather than found with
      // `getByText`: Playwright's text engine skips `script`, `style` and
      // `noscript` subtrees when it collects text, so the one element this
      // whole file exists to check is the one `getByText` can never see.
      // `toHaveText` reads `textContent`, which does see it.
      const fallback = form.locator("noscript p");
      await expect(fallback.first()).toBeVisible();
      await expect(fallback.first()).toHaveText(copy(words, "form.noscript"));

      const mail = form.locator(`a[href="mailto:${SITE_CONTACT.email}"]`);
      const tel = form.locator(`a[href="tel:${SITE_CONTACT.phone}"]`);
      await expect(mail).toBeVisible();
      await expect(mail).toHaveText(SITE_CONTACT.email);
      await expect(tel).toBeVisible();
      await expect(tel).toHaveText(SITE_CONTACT.phoneDisplay);

      // `D-07.5`'s replacement: the button is still in the document — it is
      // needed the moment scripting returns — but the `<noscript>` stylesheet
      // takes it off the page, so nobody can start a submission that cannot
      // finish.
      await expect(submitButton(form)).toBeHidden();
    });

    test(`${id} keeps native constraint validation in the server HTML @form @nojs`, async ({
      page,
    }) => {
      await page.goto(`/${id}#visit`);
      const form = inquiryForm(page);
      await expect(form).toBeVisible();

      // Absent, not "false": the attribute is what `InquiryForm` adds on mount,
      // so its presence here would mean the un-enhanced form validates nothing.
      await expect(form).not.toHaveAttribute("novalidate", /.*/);

      // The URL-encoded degradation path 07 §2 step 9 answers with a 303.
      await expect(form).toHaveAttribute("action", INQUIRY_ENDPOINT);
      await expect(form).toHaveAttribute("method", "post");

      const constraints: ReadonlyArray<readonly [string, string, string]> = [
        ["parentName", "required", ""],
        ["parentName", "maxlength", String(NAME_MAX_LENGTH)],
        ["email", "required", ""],
        ["email", "type", "email"],
        ["email", "maxlength", String(EMAIL_MAX_LENGTH)],
        ["childAge", "required", ""],
        ["message", "maxlength", String(MESSAGE_MAX_LENGTH)],
      ];

      for (const [name, attribute, value] of constraints) {
        await expect(control(form, name)).toHaveAttribute(attribute, value);
      }

      // The optional pair carries no `required`, or a parent could never send
      // the form at all without answering questions 07 §1 marks optional.
      for (const name of ["desiredStart", "message"]) {
        await expect(control(form, name)).not.toHaveAttribute("required", /.*/);
      }
    });
  }
});
