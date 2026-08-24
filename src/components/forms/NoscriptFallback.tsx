import { useTranslations } from "next-intl";

import type { SiteConfig } from "@/content/site";
import { escapeHtml } from "@/lib/inquiry/normalise";

/**
 * The no-JavaScript fallback (07 `D-07.5`, 04 §3.5).
 *
 * **A server component, and the only one in this folder.** It reads two message
 * keys and two `site.json` fields and renders no interactive anything, so it
 * ships zero client bytes and survives the client-boundary lint (INV-04.1). The
 * Visit section renders it and hands it to `InquiryForm` as the `noscript`
 * prop; `InquiryForm` never imports it, which is what keeps a server component
 * out of a client module graph.
 *
 * **Why the content is written as markup rather than as JSX children.** A
 * browser with scripting *enabled* parses `<noscript>` content as raw text, so
 * server HTML that carried real elements inside one would come back as a single
 * text node and hydration would disagree with itself. `MotionProvider` met the
 * same wall for INV-05.10's stylesheet and answered it the same way; the string
 * below produces identical server HTML and gives React nothing to reconcile.
 * Every interpolation is escaped or is a `site.json` value that has already been
 * through 02's schema.
 *
 * **`{phone}` is printed and dialled from two different fields** (02 *Shared
 * config*): `contact.phoneDisplay` is what a parent reads, `contact.phone` is
 * the E.164 form the `tel:` href needs. They are never the same field twice.
 * Both, and `contact.email`, are required fields with sample defaults
 * (07 `D-07.11`), so this renders a real pair of contacts unconditionally —
 * there is no "if the owner supplied one" branch here (07 `D-07.5`).
 */

/**
 * The three contact facts the form and its fallbacks print, typed from 02's
 * schema so a rename in `content/site.json` lands here as a type error rather
 * than as an empty line in a parent's browser.
 *
 * It lives in this file because this is the folder's one non-`"use client"`
 * module: both the client components and the server one can import the type
 * from here without either crossing a boundary it should not.
 */
export type InquiryContact = Pick<SiteConfig["contact"], "email" | "phone" | "phoneDisplay">;

export type NoscriptFallbackProps = {
  readonly contact: InquiryContact;
};

const TEXT_CLASS = "font-body text-input text-body";

/**
 * The same `--color-form-link` the other two panels take (03 §2.3): 14px bold
 * is small text, sage on the card's white measures 3.83:1 and this measures
 * 5.97:1. No axe run reaches this one — a browser with scripting enabled parses
 * the block as text — so it is fixed alongside its two siblings rather than
 * left as the one sage link in the folder.
 */
const LINK_CLASS = "font-bold text-form-link underline";

/** `<a href="…">…</a>` with both halves escaped — see the note on markup above. */
function anchor(href: string, text: string): string {
  return `<a class="${LINK_CLASS}" href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
}

/**
 * Sentinels, so the *copy* is escaped and the *links* are not.
 *
 * Substituting the anchors straight into ICU would leave the surrounding
 * sentence unescaped; escaping after substitution would turn the anchors into
 * visible angle brackets. The message is therefore rendered with two markers no
 * text can contain, escaped whole, and the markers swapped for markup last. The
 * brackets are next-intl's own missing-key marker, which INV-02.5 already
 * asserts appears on no rendered page — so no copy can collide with them.
 */
const EMAIL_SLOT = "⟦email⟧";
const PHONE_SLOT = "⟦phone⟧";

export function NoscriptFallback({ contact }: NoscriptFallbackProps) {
  const t = useTranslations("visit.form");

  const directContact = escapeHtml(t("directContact", { email: EMAIL_SLOT, phone: PHONE_SLOT }))
    .replace(EMAIL_SLOT, anchor(`mailto:${contact.email}`, contact.email))
    .replace(PHONE_SLOT, anchor(`tel:${contact.phone}`, contact.phoneDisplay));

  const html = [
    `<p class="${TEXT_CLASS}">${escapeHtml(t("noscript"))}</p>`,
    `<p class="${TEXT_CLASS}">${directContact}</p>`,
  ].join("");

  return <noscript dangerouslySetInnerHTML={{ __html: html }} />;
}
