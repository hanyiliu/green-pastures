import { expect, test, type Locator } from "@playwright/test";

import { HONEYPOT_FIELD, INQUIRY_FORM_FIELDS } from "../src/lib/inquiry/schema";

import {
  awaitInquiryResponse,
  control,
  copy,
  EXPECTED_LAUNCH_LOCALE_COUNT,
  expectWellFormedSubmission,
  fillDraft,
  fillHoneypot,
  forceInquiryResponse,
  gate,
  gotoForm,
  inquiryForm,
  INQUIRY_ENDPOINT,
  LAUNCH_LOCALES,
  passTimeToSubmitFloor,
  SITE_CONTACT,
  stubTurnstile,
  submitButton,
  successPanel,
  VALID_DRAFT,
  visitCopy,
} from "./form-support";

/**
 * The inquiry form, end to end, in the two launch locales (PR-5.10 · 07 §8 ·
 * 08 §5 `@form` · 10's PR-5.10 row).
 *
 * 07 §8's e2e list is the contents page for this file: fill → submit → success
 * panel with focus on its heading; blank required fields → inline errors with
 * focus on the first invalid; the error banner on a forced 502; the 429
 * mapping; the honeypot path answering success; the 390 px layout; keyboard-only
 * completion. Axe lives in `form-a11y.spec.ts` and the no-JavaScript fallback in
 * `form-nojs.spec.ts` — same family, different fixtures.
 *
 * What each test is allowed to conclude is set by `form-support.ts`'s notes (a)
 * and (b), and is worth one sentence here because it is the thing a reader will
 * want to check first: **the success test and the honeypot test run against the
 * live handler**, and every *failure* outcome is forced with `page.route`
 * because this rig cannot make a running server answer 502 or 429 — 08 §5's
 * `@form` row prescribes exactly that, and the forced tests still assert the
 * *request* the form built, so none of them is a test of its own fixture.
 *
 * The success test only became reachable at `gp-dln.232`. Until then
 * `siteverify` rejected its own published test secret's answer here — no
 * `action`, hostname `example.com` — so the "form submits" row of the Phase 5
 * gate was asserted against a `page.route` fixture and not against the site.
 */

/**
 * `D-07.4`'s "it is never `disabled`", asserted as the HTML property rather
 * than with `toBeEnabled()`.
 *
 * The two are not the same question. Playwright reads `aria-disabled="true"` as
 * disabled — correctly, for the user-facing meaning — and the pending button
 * carries exactly that. What `D-07.4` forbids is the *attribute*, because that
 * is the one that drops the element out of the tab order and off the
 * accessibility tree the moment a submission starts. So the check is on
 * `HTMLButtonElement.disabled`, and the tab stop is proved beside it.
 */
async function expectNeverDisabled(submit: Locator): Promise<void> {
  await expect(submit).not.toHaveAttribute("disabled", /.*/);
  expect(await submit.evaluate((node: HTMLButtonElement) => node.disabled)).toBe(false);

  await submit.focus();
  await expect(submit).toBeFocused();
}

/** 03 §3.3's mobile reference width, and the design's minimum touch target. */
const MOBILE_WIDTH = 390;
const MIN_TOUCH_TARGET = 44;

/**
 * A layout box, or a failure that names the element.
 *
 * The null check lives here rather than in the test body for two reasons: it is
 * the same three lines at every call site, and `playwright/no-conditional-in-test`
 * is right that a branch inside a test is a path that might not run. Throwing
 * from a helper keeps every assertion in the test unconditional.
 */
async function boxOf(
  locator: Locator,
  label: string,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`${label} has no layout box — is it rendered?`);
  return box;
}

test.describe("inquiry form", () => {
  test("runs in the two launch locales and no others @form", () => {
    // 10's PR-5.10 row says two, and the filter in `form-support.ts` is only as
    // honest as this line: a locale withdrawn from `routing.locales` would
    // otherwise shrink every describe below to one row and still be green.
    expect(LAUNCH_LOCALES).toHaveLength(EXPECTED_LAUNCH_LOCALE_COUNT);
    expect(new Set(LAUNCH_LOCALES).size).toBe(EXPECTED_LAUNCH_LOCALE_COUNT);
  });

  for (const id of LAUNCH_LOCALES) {
    test.describe(id, () => {
      const words = visitCopy(id);

      /* ------------------------------------------------------------------ *
       * Success
       * ------------------------------------------------------------------ */

      test(`fills, submits and lands on the success panel @form`, async ({ page }) => {
        await stubTurnstile(page);
        const form = await gotoForm(page, id);

        // No `page.route`: this submission goes to the running
        // `POST /api/inquiry`, through 07 §2's nine steps in order, and the 200
        // it comes back with is the server's own.
        const answered = awaitInquiryResponse(page);

        await fillDraft(form, VALID_DRAFT);

        // Past the time-to-submit floor, which is what separates this test from
        // the decoy one below. `isBotSignal` answers true for anything sooner
        // than `MIN_SUBMIT_MS`, and a decoy returns the *same* `{ ok: true }`
        // from step 3 — so without this wait a 200 would prove nothing about
        // `siteverify` at step 5. With it, and with the honeypot left empty,
        // the only route to a 200 is the whole handler.
        await passTimeToSubmitFloor(form);

        const submit = submitButton(form);
        await expect(submit).toHaveText(copy(words, "form.submit"));
        await submit.click();

        const { status, text, captured } = await answered;
        expect(status).toBe(200);
        expect(text).toBe(JSON.stringify({ ok: true }));

        const panel = successPanel(page);
        const heading = panel.getByRole("heading", { level: 3 });
        await expect(heading).toHaveText(copy(words, "form.status.success.title"));
        await expect(panel).toContainText(copy(words, "form.status.success.body"));

        // `D-07.4`: focus moves to the heading of what replaced the form, so a
        // keyboard user is not dropped on `<body>` with nothing announced.
        await expect(heading).toBeFocused();
        await expect(form).toBeHidden();

        expectWellFormedSubmission(captured, id, VALID_DRAFT);
      });

      /**
       * `D-07.4`'s pending contract, which is the one thing the live test above
       * cannot observe: the window is however long the server takes, and a
       * suite that raced it would be flaky in exactly the direction that hides
       * a regression. So this one keeps `page.route` and holds the response
       * open until every assertion has run. It is a question about the client,
       * and the client cannot tell the two responses apart.
       */
      test(`keeps the submit button announced and focusable while pending @form`, async ({
        page,
      }) => {
        await stubTurnstile(page);
        const form = await gotoForm(page, id);

        const held = gate();
        const captured = await forceInquiryResponse(
          page,
          200,
          { ok: true },
          { deferUntil: held.opened },
        );

        await fillDraft(form, VALID_DRAFT);

        const submit = submitButton(form);
        await submit.click();

        // Pending: the accessible name changes, `aria-busy`/`aria-disabled` go
        // on, and the button is **never** the HTML `disabled` that would drop
        // it out of the tab order and off the accessibility tree.
        await expect(submit).toHaveAttribute("aria-busy", "true");
        await expect(submit).toHaveAttribute("aria-disabled", "true");
        await expect(submit).toHaveText(copy(words, "form.status.submitting"));
        await expectNeverDisabled(submit);

        held.open();

        await expect(successPanel(page).getByRole("heading", { level: 3 })).toBeFocused();
        expectWellFormedSubmission(captured, id, VALID_DRAFT);
      });

      test(`offers a reset that returns an empty form @form`, async ({ page }) => {
        await stubTurnstile(page);
        const form = await gotoForm(page, id);
        await forceInquiryResponse(page, 200, { ok: true });

        await fillDraft(form, VALID_DRAFT);
        await submitButton(form).click();

        const panel = successPanel(page);
        await expect(panel).toBeVisible();

        await panel.getByRole("button", { name: copy(words, "form.status.success.reset") }).click();

        const returned = inquiryForm(page);
        await expect(returned).toBeVisible();
        for (const name of INQUIRY_FORM_FIELDS) {
          await expect(control(returned, name)).toHaveValue("");
        }
      });

      /* ------------------------------------------------------------------ *
       * Inline validation
       * ------------------------------------------------------------------ */

      test(`shows inline errors and focuses the first invalid control @form`, async ({ page }) => {
        await stubTurnstile(page);
        const form = await gotoForm(page, id);

        let posted = false;
        await page.route(`**${INQUIRY_ENDPOINT}`, async (route) => {
          posted = true;
          await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
        });

        await submitButton(form).click();

        // The three `required` codes the shared schema answers for a blank
        // form, each resolved through its own field-scoped key (02's table).
        const required: ReadonlyArray<readonly [string, string]> = [
          ["parentName", "form.fields.parentName.errors.required"],
          ["email", "form.fields.email.errors.required"],
          ["childAge", "form.fields.childAge.errors.required"],
        ];

        for (const [name, key] of required) {
          const field = control(form, name);
          await expect(field).toHaveAttribute("aria-invalid", "true");

          const describedBy = await field.getAttribute("aria-describedby");
          expect(describedBy, `${name} has no aria-describedby`).not.toBeNull();
          await expect(form.locator(`#${String(describedBy)}`)).toHaveText(copy(words, key));
        }

        // The optional pair carries no error and says so in the attribute, not
        // only by the absence of text.
        for (const name of ["desiredStart", "message"]) {
          await expect(control(form, name)).toHaveAttribute("aria-invalid", "false");
        }

        await expect(control(form, "parentName")).toBeFocused();
        expect(posted, "a form that failed its own validation still posted").toBe(false);
      });

      test(`validates a field on blur once it has been touched @form`, async ({ page }) => {
        await stubTurnstile(page);
        const form = await gotoForm(page, id);

        const email = control(form, "email");
        await email.fill("not-an-email");
        await control(form, "parentName").focus();

        await expect(email).toHaveAttribute("aria-invalid", "true");
        const describedBy = await email.getAttribute("aria-describedby");
        await expect(form.locator(`#${String(describedBy)}`)).toHaveText(
          copy(words, "form.fields.email.errors.invalid"),
        );

        // Fixing it clears the message without a second submit.
        await email.fill(VALID_DRAFT.email);
        await expect(email).toHaveAttribute("aria-invalid", "false");
      });

      /* ------------------------------------------------------------------ *
       * Forced server answers (08 §5 `@form`)
       * ------------------------------------------------------------------ */

      const banners: ReadonlyArray<{
        readonly label: string;
        readonly status: number;
        readonly body: unknown;
        readonly key: string;
        /**
         * How many direct-contact links the banner prints. 07 §1's table marks
         * exactly two outcomes "direct-contact fallback shown", so this is 1
         * for `email_failed` and 0 for the rest — a number in the table rather
         * than a branch in the test, which is also what keeps the assertion
         * unconditional and therefore always run.
         */
        readonly contactLinks: number;
      }> = [
        {
          label: "502",
          status: 502,
          body: { ok: false, code: "email_failed" },
          key: "form.errors.emailFailed",
          contactLinks: 1,
        },
        {
          label: "429",
          status: 429,
          // The WAF answers before the function runs (07 §3), so there is no
          // JSON code to read — the client maps the bare status itself.
          body: undefined,
          key: "form.errors.rateLimited",
          contactLinks: 0,
        },
        {
          label: "turnstile_failed",
          status: 400,
          body: { ok: false, code: "turnstile_failed" },
          key: "form.errors.turnstileFailed",
          contactLinks: 0,
        },
      ];

      for (const banner of banners) {
        test(`raises the ${banner.label} banner and keeps the typed values @form`, async ({
          page,
        }) => {
          await stubTurnstile(page);
          const form = await gotoForm(page, id);
          const captured = await forceInquiryResponse(
            page,
            banner.status,
            banner.body ?? "<html>rate limited</html>",
          );

          await fillDraft(form, VALID_DRAFT);
          await submitButton(form).click();

          const alert = form.getByRole("alert");
          await expect(alert).toBeVisible();
          await expect(alert).toContainText(copy(words, banner.key));

          // The direct-contact fallback belongs to two outcomes and no others,
          // so a row that must not print an address asserts zero rather than
          // asserting nothing.
          await expect(alert.locator(`a[href="mailto:${SITE_CONTACT.email}"]`)).toHaveCount(
            banner.contactLinks,
          );
          await expect(alert.locator(`a[href="tel:${SITE_CONTACT.phone}"]`)).toHaveCount(
            banner.contactLinks,
          );

          // `D-07.4`: typed values are preserved and a retry is allowed.
          await expect(control(form, "parentName")).toHaveValue(VALID_DRAFT.parentName);
          await expect(control(form, "message")).toHaveValue(VALID_DRAFT.message ?? "");
          await expect(submitButton(form)).toHaveAttribute("aria-busy", "false");
          await expectNeverDisabled(submitButton(form));

          expectWellFormedSubmission(captured, id, VALID_DRAFT);
        });
      }

      test(`prints both direct-contact links in the 502 banner @form`, async ({ page }) => {
        await stubTurnstile(page);
        const form = await gotoForm(page, id);
        await forceInquiryResponse(page, 502, { ok: false, code: "email_failed" });

        await fillDraft(form, VALID_DRAFT);
        await submitButton(form).click();

        // `D-07.11` made `contact.phone` and `contact.phoneDisplay` required so
        // this pair has no "if the owner supplied one" branch; `{phone}` is
        // printed from one field and dialled from the other, which is why both
        // are asserted rather than just the link.
        const alert = form.getByRole("alert");
        await expect(alert.locator(`a[href="mailto:${SITE_CONTACT.email}"]`)).toHaveText(
          SITE_CONTACT.email,
        );
        await expect(alert.locator(`a[href="tel:${SITE_CONTACT.phone}"]`)).toHaveText(
          SITE_CONTACT.phoneDisplay,
        );
      });

      /* ------------------------------------------------------------------ *
       * The decoy — answered at step 3, before `siteverify`
       * ------------------------------------------------------------------ */

      test(`answers a filled honeypot with the success panel @form`, async ({ page }) => {
        await stubTurnstile(page);
        const form = await gotoForm(page, id);

        // Also live, and the point of the pair: 07 §2 answers the decoy at step
        // 3, so this 200 has to be **byte-identical** to the step-9 one the
        // success test above reads off the same endpoint. A bot learns nothing.
        const answered = awaitInquiryResponse(page);

        await fillDraft(form, VALID_DRAFT);
        await fillHoneypot(form, "https://example.test/cheap-pills");

        // Past the time-to-submit floor, so the decoy can only be the honeypot's
        // doing and not the clock's.
        await passTimeToSubmitFloor(form);
        await submitButton(form).click();

        const { status, text } = await answered;
        expect(status).toBe(200);
        expect(text).toBe(JSON.stringify({ ok: true }));

        await expect(successPanel(page)).toBeVisible();
        await expect(successPanel(page).getByRole("heading", { level: 3 })).toHaveText(
          copy(words, "form.status.success.title"),
        );
      });

      test(`keeps the honeypot out of sight and out of the tab order @form`, async ({ page }) => {
        await stubTurnstile(page);
        const form = await gotoForm(page, id);

        const decoy = control(form, HONEYPOT_FIELD);
        await expect(decoy).toHaveAttribute("tabindex", "-1");
        await expect(decoy).toHaveAttribute("aria-hidden", "true");
        await expect(decoy).toHaveAttribute("autocomplete", "off");

        // 07 §1: "visually hidden off-screen (not `display:none`, so naive bots
        // still fill it)". A decoy the browser never lays out is no decoy.
        const display = await decoy.evaluate((node) => getComputedStyle(node).display);
        expect(display).not.toBe("none");
      });

      /* ------------------------------------------------------------------ *
       * Keyboard only
       * ------------------------------------------------------------------ */

      test(`completes from the keyboard alone @form`, async ({ page }) => {
        await stubTurnstile(page);
        const form = await gotoForm(page, id);
        const captured = await forceInquiryResponse(page, 200, { ok: true });

        const keyboard = page.keyboard;

        await control(form, "parentName").focus();
        await keyboard.type(VALID_DRAFT.parentName);

        await keyboard.press("Tab");
        await expect(control(form, "email")).toBeFocused();
        await keyboard.type(VALID_DRAFT.email);

        // The two `<select>`s are the one place this test uses an API instead
        // of a key, and the reason is the control, not the form: a native
        // select's value idiom belongs to the engine — arrow keys move the
        // selection in Chrome-on-Android, do nothing until the popup is open in
        // Chrome-on-desktop and in WebKit, and open a full-screen picker on
        // touch. Driving one of those spellings would test the browser. What
        // the *form* owes a keyboard user is that the control is reached in
        // order, keeps focus while it is set, and that the submission finishes
        // without a pointer — all three are asserted here.
        await keyboard.press("Tab");
        const childAge = control(form, "childAge");
        await expect(childAge).toBeFocused();
        await childAge.selectOption(VALID_DRAFT.childAge);
        await expect(childAge).toHaveValue(VALID_DRAFT.childAge);
        await expect(childAge).toBeFocused();

        await keyboard.press("Tab");
        await expect(control(form, "desiredStart")).toBeFocused();

        await keyboard.press("Tab");
        const message = control(form, "message");
        await expect(message).toBeFocused();
        await keyboard.type(VALID_DRAFT.message ?? "");

        // The honeypot is the next element in the DOM and must not be the next
        // tab stop — `tabindex="-1"` is what keeps it out of the way, and a
        // parent who tabbed into it would fill it and be answered with a decoy.
        // Where focus goes *instead* is the engine's business: WebKit ships
        // Safari's "press Tab to highlight each item" off, so it skips the
        // submit button, and asserting a button tab stop here would be
        // asserting a browser preference.
        await keyboard.press("Tab");
        await expect(control(form, HONEYPOT_FIELD)).not.toBeFocused();

        // The button is reachable and stays in the accessibility tree — the
        // half of `D-07.4` that does not depend on the engine's tab policy.
        await expectNeverDisabled(submitButton(form));

        // Implicit submission: `Enter` in a single-line text field activates
        // the form's submit button, in every engine and without a pointer.
        await control(form, "email").focus();
        await keyboard.press("Enter");

        await expect(successPanel(page).getByRole("heading", { level: 3 })).toBeFocused();
        expect(captured.body, "Enter in a text field sent nothing").toBeDefined();
      });

      /* ------------------------------------------------------------------ *
       * 390 px (03 §3.3, mobile design Layout + §8)
       * ------------------------------------------------------------------ */

      test.describe("at 390 px", () => {
        test.use({ viewport: { width: 390, height: 844 } });

        test(`stacks full-width controls with 44 px touch targets @form`, async ({ page }) => {
          await stubTurnstile(page);
          const form = await gotoForm(page, id);

          const formBox = await boxOf(form, "the form");

          // The whole form fits the 390 viewport: a control wider than the page
          // is the CJK-width overflow 07 §8 sends the Chinese runs looking for.
          expect(formBox.width).toBeLessThanOrEqual(MOBILE_WIDTH);

          // Full-width submit (mobile design Layout): the button spans the
          // card's content box rather than hugging its label as it does at `md`.
          const submit = submitButton(form);
          const submitBox = await boxOf(submit, "the submit button");
          expect(Math.abs(submitBox.width - formBox.width)).toBeLessThanOrEqual(1);

          const targets: ReadonlyArray<readonly [string, Locator]> = [
            ...INQUIRY_FORM_FIELDS.filter((name) => name !== "message").map(
              (name): readonly [string, Locator] => [name, control(form, name)],
            ),
            ["submit", submit] as const,
          ];

          for (const [name, target] of targets) {
            const box = await boxOf(target, name);
            expect(box.height, `${name} is under the 44px touch target`).toBeGreaterThanOrEqual(
              MIN_TOUCH_TARGET,
            );
          }

          // The age/start pair is the one two-column row the mobile design
          // keeps, and it is where a wide glyph set overflows first.
          const ageBox = await boxOf(control(form, "childAge"), "childAge");
          const startBox = await boxOf(control(form, "desiredStart"), "desiredStart");
          expect(ageBox.y).toBeCloseTo(startBox.y, 0);
          expect(ageBox.width + startBox.width).toBeLessThanOrEqual(formBox.width);
        });
      });
    });
  }
});
