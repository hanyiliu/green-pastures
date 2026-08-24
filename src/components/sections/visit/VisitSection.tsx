import { useFormatter, useTranslations } from "next-intl";

import { Leaf } from "@/components/decor/Leaf";
import { Sun } from "@/components/decor/Sun";
import { InquiryForm } from "@/components/forms/InquiryForm";
import { NoscriptFallback } from "@/components/forms/NoscriptFallback";
import { Section } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getSite } from "@/content/site";
import { hoursDayRange, openingTimeDate } from "@/lib/hours";
import type { InquirySource } from "@/lib/inquiry/schema";
import { weekdayDate } from "@/lib/menu-day";

import { InfoPanel } from "./InfoPanel";
import {
  VISIT_FORM_CARD,
  VISIT_GRID,
  VISIT_HEADER,
  VISIT_INFO_COLUMN,
  VISIT_LEAF,
  VISIT_PADDING,
  VISIT_SUBTITLE,
  VISIT_SUN,
  VISIT_TITLE,
} from "./layout";
import { MapPhoto } from "./MapPhoto";

/**
 * The Visit section (04 §3.5, §4, §6; 05 §5.3; `docs/design/desktop/README.md`
 * §8 and `docs/design/mobile/README.md` §8).
 *
 * The last section of the homepage and the only one with a job beyond reading:
 * it is where a parent asks for a tour. It is also the target of every "Book a
 * tour" control on the site — `site.nav.cta.href` and the footer's `contact`
 * entry are both `/#visit`, and `SECTION_IDS`' last bookend is `visit`, so the
 * `id` here is `Section`'s to know rather than this file's to type (INV-04.8,
 * 07 §6).
 *
 * ── Three blocks, one slow fade (05 §5.3) ────────────────────────────────
 *
 * Header, form card, info column — the three `data-anim` elements both
 * references mark (D L310, L315, L326; M L222, L227, L241) — each a `Reveal`
 * on the catalogue's `fade`: opacity only, 1.1s, no transform. It is the one
 * entrance in the design that never moves, which is why its `reduced` form is
 * identical to its full one. Three reveals add no observers of their own:
 * they pass the same frozen viewport options as every other `Reveal` and share
 * the page's single pooled `IntersectionObserver` (INV-05.9).
 *
 * ── The card is the section's, the form is the form's (07 `D-07.4`) ───────
 *
 * On success the form is **replaced inside the same card** by the success
 * panel, so `InquiryForm` renders only the shell that swaps one for the other
 * and the white box around both is drawn here (`VISIT_FORM_CARD`). It is
 * handed `site.contact`'s three fields, the public Turnstile site key, and a
 * server-rendered `NoscriptFallback` as a node — the form only `import type`s
 * from that module, which is what keeps a Server Component out of a client
 * module graph (04 §3.5, INV-04.1).
 *
 * ── The hours are derived, never typed ───────────────────────────────────
 *
 * "Monday – Friday" and "7:30 am – 6:00 pm" are `site.hours` — five day ids and
 * two `HH:MM` strings — put through the `weekdayLong` and `timeShort` formats
 * and the `common.format.dayRange` / `common.format.timeRange` templates
 * (02 `D-02.6`, 04 §4). No locale file contains a weekday or a clock time, a
 * new locale gets both for free, and an owner who changes the opening time
 * edits one field. `./hours.ts` mints the two dates `Intl` needs for values
 * that are not instants.
 *
 * ── Why this component is not `async` ────────────────────────────────────
 *
 * It reads messages, the shared config and a formatter, and no collection —
 * so `useTranslations` / `useFormatter` in a Server Component is the shape 04
 * §5.1 prescribes, and `getTranslations` would buy nothing. `SampleLine` reads
 * a formatter the same way.
 */

/** The `h2`'s id, which the `Section` points `aria-labelledby` at (INV-04.8). */
const VISIT_TITLE_ID = "visit-title";

/** Which placement submitted, for the handler's log and the e-mail (07 §1). */
const INQUIRY_SOURCE = "home" satisfies InquirySource;

export default function VisitSection() {
  const t = useTranslations("home.visit");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const site = getSite();

  const days = hoursDayRange(site.hours.days);
  const hours = {
    days: tCommon("format.dayRange", {
      from: format.dateTime(weekdayDate(days.from), "weekdayLong"),
      to: format.dateTime(weekdayDate(days.to), "weekdayLong"),
    }),
    times: tCommon("format.timeRange", {
      from: format.dateTime(openingTimeDate(site.hours.open, site.timeZone), "timeShort"),
      to: format.dateTime(openingTimeDate(site.hours.close, site.timeZone), "timeShort"),
    }),
  };

  const contact = {
    email: site.contact.email,
    phone: site.contact.phone,
    phoneDisplay: site.contact.phoneDisplay,
  };

  return (
    <Section
      id="visit"
      labelledBy={VISIT_TITLE_ID}
      className={VISIT_PADDING}
      decor={
        <>
          <Sun id="deco-visit-sun" size="visit" loop={false} className={VISIT_SUN} />
          <Leaf id="deco-visit-leaf-1" size={34} tint="visit" loop={false} className={VISIT_LEAF} />
        </>
      }
    >
      <Reveal id="visit.header" variant="fade" className={VISIT_HEADER}>
        <SectionTitle id={VISIT_TITLE_ID} className={VISIT_TITLE}>
          {t("title")}
        </SectionTitle>

        {/* Both strings render and `md:` picks one, so no view is a code
            branch (`D-04.5`, INV-04.4). */}
        <p className={`${VISIT_SUBTITLE} md:hidden`}>{t("subtitleShort")}</p>
        <p className={`${VISIT_SUBTITLE} hidden md:block`}>{t("subtitle")}</p>
      </Reveal>

      <div className={VISIT_GRID}>
        <Reveal id="visit.form" variant="fade" className={VISIT_FORM_CARD}>
          <InquiryForm
            source={INQUIRY_SOURCE}
            contact={contact}
            turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
            noscript={<NoscriptFallback contact={contact} />}
          />
        </Reveal>

        <Reveal id="visit.info" variant="fade" className={VISIT_INFO_COLUMN}>
          <MapPhoto />
          <InfoPanel hours={hours} city={t("info.city")} languages={t("info.languages")} />
        </Reveal>
      </div>
    </Section>
  );
}
