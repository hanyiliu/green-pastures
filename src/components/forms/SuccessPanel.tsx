"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

/**
 * What replaces the form after a submission is accepted (07 `D-07.4`, 04 §3.5).
 *
 * **It replaces the form inside the same card**, which is why it renders no
 * card of its own: the Visit section draws the white box, `InquiryForm` swaps
 * its contents.
 *
 * **Focus moves to the heading**, which is the whole reason the heading carries
 * `tabIndex={-1}`. A parent who submitted with the keyboard has just lost the
 * element they were on — the form is gone — and without this their focus would
 * fall back to `<body>` and a screen reader would say nothing at all. Moving it
 * here announces the outcome and puts the reader at the top of what replaced
 * the form, so the "send another" link is the next tab stop.
 *
 * That focus move is also why the panel carries no `role="status"`: the heading
 * is read because focus lands on it, and a live region would say the same
 * sentence a second time.
 *
 * **"Send another" is a `<button>`, not a link.** 07 `D-07.4` calls it a text
 * link and it is styled as one, but it navigates nowhere — it resets client
 * state — and a link that is not a URL is a keyboard trap for anyone who
 * expects `Enter` to go somewhere.
 */

export type SuccessPanelProps = {
  readonly onReset: () => void;
};

const PANEL_CLASS = "flex flex-col items-start gap-2 md:gap-2.5";
const TITLE_CLASS = "font-display text-name font-semibold text-ink";
const BODY_CLASS = "font-body text-input text-body";
const RESET_CLASS =
  "min-h-(--tap-min) font-body text-input font-bold text-sage underline transition-colors duration-(--dur-word-swap) ease-soft hover:text-forest";

export function SuccessPanel({ onReset }: SuccessPanelProps) {
  const t = useTranslations("visit.form");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className={PANEL_CLASS} data-inquiry-success="">
      <h3 ref={headingRef} tabIndex={-1} className={TITLE_CLASS}>
        {t("status.success.title")}
      </h3>
      <p className={BODY_CLASS}>{t("status.success.body")}</p>
      <button type="button" className={RESET_CLASS} onClick={onReset}>
        {t("status.success.reset")}
      </button>
    </div>
  );
}
