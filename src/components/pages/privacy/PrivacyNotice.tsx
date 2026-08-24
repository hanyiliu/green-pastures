import { useMessages, useTranslations } from "next-intl";

import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { getSite } from "@/content/site";
import type { Messages } from "@/i18n/messages";

import {
  PRIVACY_DRAFT_BANNER,
  PRIVACY_DRAFT_BODY,
  PRIVACY_DRAFT_LABEL,
  PRIVACY_SECTION,
  PRIVACY_SECTION_BODY,
  PRIVACY_SECTION_HEADING,
} from "./layout";

/**
 * The whole of the Privacy page below its header (06 §6.2's conditional route,
 * `OQ-07.5` answered yes; 10 PR-6.9).
 *
 * ── The banner is the point of this component ────────────────────────────
 *
 * The copy on this page is the owner's or their counsel's and has not been
 * supplied. What ships instead is a developer's description of what the
 * software does, and the failure mode that matters is not that it is wrong —
 * it is that it *reads* like a privacy policy and so nobody notices it is not
 * one. Two things guard against that, and they guard different readers:
 *
 * - every paragraph is registered in `content/site.json`'s `provisional` array,
 *   so `pnpm validate:content --release` fails while it stands and the site
 *   cannot be launched on it (INV-02.10, 08 §3 R1);
 * - and the first thing on the page says so in words, above the prose rather
 *   than under it, because the registry is invisible to everyone who is not
 *   running the release gate.
 *
 * The registry is what stops the launch. The banner is what stops a reader —
 * the owner, a parent, a reviewer opening the preview — from believing the
 * page. Deleting either one alone leaves a real hole.
 *
 * ── Why the sections are data ────────────────────────────────────────────
 *
 * `privacy.sections` is a keyed object, and this component renders whatever it
 * holds in the order the file writes it. So counsel's version can be four
 * sections or nine, with different ids, and no code changes — which is the
 * whole point when the copy is certain to be replaced wholesale. It is keyed
 * rather than an array so that a `provisional` entry names a section
 * (`messages.privacy.sections.hosting.body`) instead of a position that moves
 * when the list is reordered.
 *
 * ── The one section with arguments ───────────────────────────────────────
 *
 * `asking` prints the daycare's e-mail address and phone number, which are
 * locale-agnostic facts and therefore ICU arguments out of `site.contact`,
 * never words in a locale file (INV-02.4, `D-02.3`). Both are passed to every
 * section, so which section spends them stays a content decision: an ICU
 * message ignores an argument it does not name, and a version of this page that
 * moves the contact line somewhere else needs no edit here.
 */

/** The keyed sections, derived from the `en` tree rather than listed here. */
type PrivacySectionId = keyof Messages["privacy"]["sections"];

export function PrivacyNotice() {
  const t = useTranslations("privacy");
  const messages = useMessages();
  const contact = getSite().contact;

  const sectionIds = Object.keys(messages.privacy.sections) as PrivacySectionId[];

  return (
    <>
      <Reveal id="privacy.draftNotice" variant="rise">
        <aside className={PRIVACY_DRAFT_BANNER}>
          <p className={PRIVACY_DRAFT_LABEL}>{t("draftNotice.label")}</p>
          <p className={PRIVACY_DRAFT_BODY}>{t("draftNotice.body")}</p>
        </aside>
      </Reveal>

      <Reveal id="privacy.sections" variant="rise" stagger>
        {sectionIds.map((id) => (
          <RevealItem key={id} variant="riseChild" className={PRIVACY_SECTION}>
            <h2 className={PRIVACY_SECTION_HEADING}>{t(`sections.${id}.heading`)}</h2>
            <p className={PRIVACY_SECTION_BODY}>
              {t(`sections.${id}.body`, {
                email: contact.email,
                phone: contact.phoneDisplay,
              })}
            </p>
          </RevealItem>
        ))}
      </Reveal>
    </>
  );
}
