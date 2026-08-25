"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { InquiryErrorKey } from "./inquiry-codes";
import type { InquiryContact } from "./NoscriptFallback";

/**
 * The inline failure banner (07 `D-07.4`, 04 §3.5).
 *
 * It sits above the submit button, keeps every typed value where it is, and
 * allows a retry. There are **no toasts** (`D-07.4`): a message that disappears
 * on a timer is the wrong shape for "your request did not send".
 *
 * **A client component because the key is chosen at runtime** — `D-04.14`'s
 * reason exactly. The server answers with a wire code (`turnstile_failed`,
 * `email_failed`), the form resolves it through `inquiryErrorKey`, and the
 * resolved key arrives here as a prop. Nothing in the API carries copy
 * (INV-07.1).
 *
 * **`role="alert"` and nothing else.** The element announces itself when it
 * mounts, so the form's polite live region deliberately stays empty in the
 * states this banner covers — one outcome, announced once.
 *
 * **The direct-contact line is inside the alert, not beside it.** 07 §1's table
 * shows the fallback for exactly two rows — `turnstile_unavailable` and
 * `email_failed`, the two failures a retry may not fix — and a parent who hears
 * "we couldn't deliver your request" needs the e-mail address in the same
 * breath, not in a paragraph the alert did not include.
 */

export type FormAlertProps = {
  readonly messageKey: InquiryErrorKey;
  /** Present only for the two outcomes 07 §1 marks "direct-contact shown". */
  readonly contact?: InquiryContact;
};

/**
 * `--color-form-error` (03 §2.3), the same `#d3402e` this border drew as
 * `--color-yelp` before 03 named the red for its second job. A border is
 * non-text, so AA asks 3:1 of it and it measures 4.36 on the banner's cream.
 */
const ALERT_CLASS =
  "flex flex-col gap-1 rounded-input border border-form-error bg-cream p-3 md:p-3.5";
const TEXT_CLASS = "font-body text-input text-ink";
const CONTACT_CLASS = "font-body text-form-label text-body";

/**
 * `--color-form-link` (03 §2.3), not `--color-sage`.
 *
 * This line is 11–12px bold, so AA's threshold for it is 4.5:1 and not 3:1.
 * Sage on the banner's cream measures 3.61:1 — 03 §10 passes that pair only as
 * AA-large, for a 64px accent word — while `--color-form-link` measures 5.63:1
 * on the same ground. A parent reads this line exactly when their request did
 * not send, which is the worst place on the page to be hard to read.
 */
const LINK_CLASS = "font-bold text-form-link underline";

/**
 * `visit.form.directContact`'s `{email}` and `{phone}` are ICU **values**, not
 * tags, so `t.rich` will not accept an element for them — its generated
 * argument types allow `string | number | Date` and tag functions only. The
 * message is therefore rendered with two markers, and the markers are swapped
 * for anchors afterwards. The brackets are next-intl's own missing-key marker,
 * which INV-02.5 already asserts appears on no rendered page, so no copy can
 * collide with them.
 */
const EMAIL_SLOT = "⟦email⟧";
const PHONE_SLOT = "⟦phone⟧";

/** Split `text` on each marker and put the node in its place. */
function interpolate(
  text: string,
  slots: ReadonlyArray<readonly [string, ReactNode]>,
): ReactNode[] {
  let parts: ReactNode[] = [text];

  for (const [slot, node] of slots) {
    const next: ReactNode[] = [];
    for (const part of parts) {
      if (typeof part !== "string") {
        next.push(part);
        continue;
      }
      const index = part.indexOf(slot);
      if (index < 0) {
        next.push(part);
        continue;
      }
      next.push(part.slice(0, index), node, part.slice(index + slot.length));
    }
    parts = next;
  }

  return parts;
}

export function FormAlert({ messageKey, contact }: FormAlertProps) {
  const t = useTranslations("visit.form");

  return (
    <div role="alert" className={ALERT_CLASS}>
      <p className={TEXT_CLASS}>{t(messageKey)}</p>
      {contact === undefined ? null : (
        <p className={CONTACT_CLASS}>
          {interpolate(t("directContact", { email: EMAIL_SLOT, phone: PHONE_SLOT }), [
            [
              EMAIL_SLOT,
              <a key={EMAIL_SLOT} className={LINK_CLASS} href={`mailto:${contact.email}`}>
                {contact.email}
              </a>,
            ],
            [
              PHONE_SLOT,
              <a key={PHONE_SLOT} className={LINK_CLASS} href={`tel:${contact.phone}`}>
                {contact.phoneDisplay}
              </a>,
            ],
          ])}
        </p>
      )}
    </div>
  );
}
