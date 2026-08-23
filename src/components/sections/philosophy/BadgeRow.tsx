import { useTranslations } from "next-intl";

import { Chip } from "@/components/ui/Chip";
import { LearnMoreLink } from "@/components/ui/LearnMoreLink";

import { PHILOSOPHY_BADGE, PHILOSOPHY_BILINGUAL } from "./layout";

/**
 * The three things that close the section (04 §3.5; D L152–154, M L88–90): the
 * credential badge, the bilingual welcome, and the link into the Philosophy
 * page.
 *
 * It renders a fragment, not a box — the row (a centred column below `md`, a
 * centred row above) is the enclosing `Reveal`'s, the same division of labour
 * the hero's text column uses. That keeps the three to one animated element and
 * saves a wrapper that would do nothing.
 *
 * ── Three notes ──────────────────────────────────────────────────────────
 *
 * **The badge is `tone="sage"`.** 04 §3.2 pins that tone to two drawings and
 * this is one of them: solid sage with a white label (D L152). Only the padding
 * differs from the hero badge `Chip` is built around, and 03 §4 says in as many
 * words that this padding "has no row here and no token", so it is spacing on
 * the scale (see `layout.ts`).
 *
 * **The 🌱 arrives inside the message.** `home.philosophy.badgeCertified` is
 * "🌱 Certified Montessori credentials" — one string, not an `icon` field
 * beside one. `Chip` takes an `icon` prop for the `site.json` case (`D-02.5`)
 * and `site.json` carries no philosophy icon, so the glyph stays where 02 put
 * it. Filed, because the two spellings of "an emoji in a chip" should not both
 * exist.
 *
 * **The bilingual line is not an `Eyebrow`.** 04 §3.2 singles
 * `home.philosophy.badgeBilingual` out by name: it carries 中文, and `Eyebrow`
 * is the one recipe that applies `uppercase` and 1.5px tracking, which mangles
 * a mixed EN/中文 string. It is a `<p>` with the design's own Nunito 700 at
 * `--text-chip` instead.
 */

/**
 * The `site.routes[]` id `LearnMoreLink` resolves to a path. Naming the id
 * rather than the path is what makes a route move a `content/site.json` edit
 * (02 `D-02.12`); `LearnMoreLink` throws, naming the file, if it disappears.
 */
const PHILOSOPHY_ROUTE_ID = "philosophy";

export function BadgeRow() {
  const t = useTranslations("home.philosophy");

  return (
    <>
      <Chip tone="sage" className={PHILOSOPHY_BADGE}>
        {t("badgeCertified")}
      </Chip>

      <p className={PHILOSOPHY_BILINGUAL}>{t("badgeBilingual")}</p>

      <LearnMoreLink routeId={PHILOSOPHY_ROUTE_ID}>{t("link")}</LearnMoreLink>
    </>
  );
}
