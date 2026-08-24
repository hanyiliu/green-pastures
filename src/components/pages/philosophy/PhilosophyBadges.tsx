import { useMessages, useTranslations } from "next-intl";

import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { Chip } from "@/components/ui/Chip";
import type { Messages } from "@/i18n/messages";

import { PHILOSOPHY_BADGES } from "./layout";

/**
 * The credential badges that close the page (04 §3.6; D L381–L385).
 *
 * Three pills, centred: a solid sage one carrying the credential, then two
 * white ones. They are a `<ul>` of `Chip`s, and they are **drawn on the wide
 * view only** — the mobile reference ends the page with the timeline card
 * (M L288). See `layout.ts` for why the whole row is hidden `< md` rather than
 * the two 04 §3.6 names.
 *
 * ── Membership comes from the message tree ───────────────────────────────
 *
 * There is no `site.json` array behind these — they are three message keys and
 * nothing else — so the list is `Object.keys(philosophy.badges)` rather than
 * three ids typed here. A locale-independent fourth credential is then a
 * content edit (INV-04.4), and the order in the JSON is the order drawn.
 *
 * **Position picks the tone, not the id.** The reference fills the first pill
 * and leaves the rest white (D L382 against L383–L384), so the lead badge is
 * `tone="sage"` and the others are `tone="cool"` — white on `--section-link`,
 * which resolves to the reference's own `#4f6b43` on this page (`D-04.3`).
 * Nothing here tests for `certified`.
 *
 * **The 🌱 arrives inside the message**, exactly as it does in the home
 * section's `BadgeRow`: `philosophy.badges.certified` is
 * "🌱 Certified Montessori credentials", one string, because `site.json` has no
 * philosophy icon for `Chip`'s `icon` prop to read (02 `D-02.5`).
 */

/** The badge ids the `en` tree carries, derived rather than listed. */
type BadgeId = keyof Messages["philosophy"]["badges"];

export function PhilosophyBadges() {
  const t = useTranslations("philosophy.badges");
  const messages = useMessages();

  const ids = Object.keys(messages.philosophy.badges) as BadgeId[];

  return (
    <Reveal id="philosophy.credentials" stagger as="ul" className={PHILOSOPHY_BADGES}>
      {ids.map((id, index) => (
        <RevealItem key={id} variant="riseChild" as="li">
          <Chip tone={index === 0 ? "sage" : "cool"}>{t(id)}</Chip>
        </RevealItem>
      ))}
    </Reveal>
  );
}
