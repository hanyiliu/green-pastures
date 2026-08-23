import type { createTranslator } from "next-intl";

import { TIME_ZONE } from "@/i18n/formats";
import type { Messages } from "@/i18n/messages";
import { LOCALE_META, type Locale } from "@/i18n/routing";

import { childAgeOptionKey, desiredStartOptionKey } from "../labels";
import { isDesiredStartKeyword } from "../months";
import { escapeHtml, headerSafe } from "../normalise";
import { NAME_MAX_LENGTH, type Inquiry } from "../schema";

/**
 * The two e-mails, rendered from locale JSON (07 §2 step 6, `D-07.6`).
 *
 * **No user-visible string exists in this file** (INV-07.1): every word comes
 * from `email.*` or `visit.form.*` through a translator the caller built with
 * `getTranslations({ locale, namespace })`. The only strings typed here are
 * message keys, HTML tag names and the inline CSS of the HTML part.
 *
 * **Two locales, not one.** The staff notification renders in the site's
 * default locale — one inbox, one language, staff triage it (`D-07.6`) — and
 * carries a "preferred language" line printing `LOCALE_META[locale].nativeName`,
 * so it reads *English*, *简体中文* or *繁體中文* and never the raw id. The
 * parent's acknowledgement renders in the parent's own locale. Neither branches
 * on a locale id (INV-02.9): the locale is an argument to `getTranslations` and
 * a key into `LOCALE_META`.
 *
 * **Where `markup` is used and where it is not.** The HTML part renders the
 * prose messages — heading, intro, footer, the acknowledgement body — through
 * `t.markup`, so the day an owner puts `<strong>` in one of them the compiler
 * asks for a renderer instead of the mail showing the tag as text. The *field
 * values* never go near `markup`: they are user input, and they are escaped
 * with {@link escapeHtml} at the point they are interpolated. That split is the
 * whole of the HTML-escaping story.
 */

type EmailTranslator = ReturnType<typeof createTranslator<Messages, "email">>;
type VisitTranslator = ReturnType<typeof createTranslator<Messages, "visit">>;

export type RenderedEmail = {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
};

/** A rendered line of the staff notification: a label and its value. */
type FieldLine = { readonly label: string; readonly value: string };

/**
 * The subject line's argument.
 *
 * 07 §2 step 6 requires that no user-entered text reach a header, and 02's
 * canonical `email.inquiry.subject` is `"Tour request from {parentName}"` —
 * which is user text in a header. The two cannot both be taken literally, and
 * 02 owns the key (memo ADJ-9), so the key wins and the *risk* step 6 is
 * actually about is closed here instead: the name is flattened to a single line
 * and capped before it is interpolated, on top of the schema having already
 * stripped every control character at parse time. A CR or LF cannot reach the
 * header by either route. The residual disagreement is a documentation defect,
 * not a code one, and is reported rather than silently resolved.
 */
function subjectName(inquiry: Inquiry): string {
  return headerSafe(inquiry.parentName, NAME_MAX_LENGTH);
}

/** `Intl` in the site's fixed zone, so "submitted at" is wall-clock Fremont. */
function formatSubmittedAt(locale: Locale, when: Date): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(when);
}

/** A `YYYY-MM` printed the way the form's own option list prints it. */
function formatMonth(locale: Locale, monthId: string): string {
  const year = Number(monthId.slice(0, 4));
  const month = Number(monthId.slice(5, 7));
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(year, month - 1, 15, 12)));
}

function desiredStartValue(
  tVisit: VisitTranslator,
  locale: Locale,
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  if (isDesiredStartKeyword(value)) return tVisit(desiredStartOptionKey(value));
  return formatMonth(locale, value);
}

/* -------------------------------------------------------------------------- *
 * HTML part
 * -------------------------------------------------------------------------- */

const HTML_BODY_STYLE =
  "margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
  "font-size:15px;line-height:1.6;color:#2f3a2c;";
const HTML_LABEL_STYLE =
  "padding:4px 12px 4px 0;vertical-align:top;color:#6b7566;white-space:nowrap;";
const HTML_VALUE_STYLE = "padding:4px 0;vertical-align:top;";
const HTML_FOOTER_STYLE = "margin:24px 0 0;font-size:13px;color:#6b7566;";

/**
 * Wrap already-rendered prose in paragraphs, keeping its line breaks.
 *
 * The input is `t.markup` output — content, not user input, and the content
 * gate (02 `D-02.5`, INV-02.8, 08 §3's `html-in-value`) is what keeps raw HTML
 * out of it — so it is **not** escaped here; escaping it would print the very
 * tags `markup` exists to render. Everything that came from the form goes
 * through {@link escapeHtml} instead, before it is interpolated.
 */
function htmlProse(rendered: string): string {
  return rendered
    .split("\n\n")
    .map((paragraph) => `<p style="margin:0 0 12px;">${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function htmlTable(lines: readonly FieldLine[]): string {
  const rows = lines
    .map(
      (line) =>
        `<tr><th align="left" style="${HTML_LABEL_STYLE}">${escapeHtml(line.label)}</th>` +
        `<td style="${HTML_VALUE_STYLE}">${escapeHtml(line.value).replace(/\n/g, "<br />")}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`;
}

function textLines(lines: readonly FieldLine[]): string {
  return lines.map((line) => `${line.label}: ${line.value}`).join("\n");
}

/* -------------------------------------------------------------------------- *
 * Staff notification
 * -------------------------------------------------------------------------- */

export type StaffNotificationOptions = {
  /** A translator on `email`, in the *staff* locale (the site default). */
  readonly t: EmailTranslator;
  /** A translator on `visit`, same locale — the age and start option labels. */
  readonly tVisit: VisitTranslator;
  /** The locale the notification is written in. */
  readonly locale: Locale;
  readonly inquiry: Inquiry;
  readonly submittedAt: Date;
};

/**
 * The one notification the daycare receives per submission (`D-07.6`).
 *
 * The plain-text part is primary; the HTML part is a minimal inline-styled
 * wrapper of the same content, which is what keeps the mail readable in a
 * text-only client and in the daycare's phone alike.
 */
export function renderStaffNotification(options: StaffNotificationOptions): RenderedEmail {
  const { t, tVisit, locale, inquiry } = options;

  const lines: FieldLine[] = [
    { label: t("inquiry.fields.parentName"), value: inquiry.parentName },
    { label: t("inquiry.fields.email"), value: inquiry.email },
    { label: t("inquiry.fields.childAge"), value: tVisit(childAgeOptionKey(inquiry.childAge)) },
  ];

  const start = desiredStartValue(tVisit, locale, inquiry.desiredStart);
  if (start !== undefined) lines.push({ label: t("inquiry.fields.desiredStart"), value: start });

  lines.push({
    label: t("inquiry.fields.preferredLanguage"),
    value: LOCALE_META[inquiry.locale].nativeName,
  });
  lines.push({
    label: t("inquiry.fields.submittedAt"),
    value: formatSubmittedAt(locale, options.submittedAt),
  });

  if (inquiry.message !== undefined) {
    lines.push({ label: t("inquiry.fields.message"), value: inquiry.message });
  }

  const heading = t("inquiry.heading");
  const intro = t("inquiry.intro");
  const footer = t("inquiry.footer");

  const text = [heading, "", intro, "", textLines(lines), "", footer].join("\n");

  const html =
    `<div style="${HTML_BODY_STYLE}">` +
    `<h1 style="margin:0 0 8px;font-size:19px;">${t.markup("inquiry.heading")}</h1>` +
    `<p style="margin:0 0 16px;">${t.markup("inquiry.intro")}</p>` +
    htmlTable(lines) +
    `<p style="${HTML_FOOTER_STYLE}">${t.markup("inquiry.footer")}</p>` +
    `</div>`;

  return { subject: t("inquiry.subject", { parentName: subjectName(inquiry) }), text, html };
}

/* -------------------------------------------------------------------------- *
 * Parent acknowledgement
 * -------------------------------------------------------------------------- */

export type AutoReplyOptions = {
  /** A translator on `email`, in the **submitter's** locale. */
  readonly t: EmailTranslator;
  readonly inquiry: Inquiry;
  /** `brand.name[submitter's locale]`, from `site.json` — never a literal. */
  readonly brandName: string;
};

/**
 * The acknowledgement, sent only when `INQUIRY_AUTOACK=1` (off at launch,
 * OQ-07.2). Fixed template text: the sole argument that comes from the form is
 * the parent's own name in the greeting, which 02's `email.autoReply.greeting`
 * declares, and it is header-safe and length-capped before it is used.
 *
 * 07 §2 step 8 asks for no typed fields at all here, to keep the ack from
 * becoming a spam relay. Because the greeting key exists and is 02's, the
 * relay surface is narrowed rather than removed: at most one flattened,
 * 80-character name, sent to an address that has already passed validation and
 * a single-use Turnstile token. The residual difference between the two
 * documents is reported, not decided here.
 */
export function renderAutoReply(options: AutoReplyOptions): RenderedEmail {
  const { t, inquiry, brandName } = options;
  const parentName = headerSafe(inquiry.parentName, NAME_MAX_LENGTH);

  const greeting = t("autoReply.greeting", { parentName });
  const body = t("autoReply.body");
  const signature = t("autoReply.signature", { brandName });

  return {
    subject: t("autoReply.subject"),
    text: [greeting, "", body, "", signature].join("\n"),
    html:
      `<div style="${HTML_BODY_STYLE}">` +
      `<p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>` +
      htmlProse(t.markup("autoReply.body")) +
      `<p style="${HTML_FOOTER_STYLE}">${escapeHtml(signature).replace(/\n/g, "<br />")}</p>` +
      `</div>`,
  };
}
