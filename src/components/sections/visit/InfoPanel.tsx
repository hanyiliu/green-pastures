import { useTranslations } from "next-intl";

import { Eyebrow } from "@/components/ui/Eyebrow";
import { getSite } from "@/content/site";

import {
  VISIT_HOURS_SEPARATOR,
  VISIT_HOURS_TIME,
  VISIT_MAPS_LINK,
  VISIT_PANEL,
  VISIT_PANEL_VALUE,
} from "./layout";

/**
 * The dark info panel beside the form (04 §3.5; D L328–L332, M L243).
 *
 * Three facts a parent needs before they can visit — where, when, and in which
 * languages — as a **description list**, which is what 04 §3.5 asks for and
 * what the shape actually is: three terms, three definitions. The labels are
 * `Eyebrow size="panel"`, so the uppercasing is CSS in the one place the site
 * applies it (04 §5.5) and the words reach the DOM in the case the content tree
 * authored them.
 *
 * ── Why the hours arrive as a prop and the rest do not ────────────────────
 *
 * The city and the languages line are **copy**: one message key each, read
 * where they are drawn. The hours are **not** — they are `site.hours` put
 * through two `Intl` formats and two range templates, which needs the
 * formatter, so `VisitSection` derives them and hands the pair down (04 §3.5
 * gives this component exactly the props `hours`, `city`, `languages`). Nothing
 * in this file, or in the content tree, names a weekday or a time
 * (02 `D-02.6`, PR-5.7's *hours derived from `site.hours`, never typed*).
 *
 * ── The hours line breaks differently on the two views ────────────────────
 *
 * The desktop reference puts the days and the times on two lines (D L330's
 * `<br>`) and the mobile one joins them with a middot (M L243). Both halves
 * always render; `md:` decides whether the second is a block and whether the
 * separator is drawn, so no view is a code branch (`D-04.5`, INV-04.4). The
 * middot is `aria-hidden`: it is punctuation between two values, not a word,
 * and the pair reads as one line either way.
 *
 * ── "Open in Maps" ───────────────────────────────────────────────────────
 *
 * 07 §6 rules out a map embed — it would load third-party scripts and cookies
 * for every visitor and be the only consent-relevant asset on the page — and
 * replaces it with a photo plus a link to `contact.mapsUrl`. The design draws
 * no such link, which is why 02 registers `home.visit.info.mapsLink` as
 * "production copy, not in the design"; it lives under the address because that
 * is the fact it acts on. `MapPhoto` links to the same place from the image,
 * and the two names — the photo's `alt` and this link's words — are what keep
 * the pair distinguishable to a screen reader rather than two identical
 * "opens in a new tab" links in a row.
 *
 * `contact.mapsUrl` is read from `getSite()` rather than passed: it is a
 * required field of the site schema (07 `D-07.11`), so there is nothing to
 * branch on and no prop that could go missing.
 */

export type InfoPanelHours = {
  /** "Monday – Friday" — `common.format.dayRange` over `site.hours.days`. */
  readonly days: string;
  /** "7:30 AM – 6:00 PM" — `common.format.timeRange` over `open` / `close`. */
  readonly times: string;
};

export type InfoPanelProps = {
  readonly hours: InfoPanelHours;
  /** `home.visit.info.city` — "Fremont, California". */
  readonly city: string;
  /** `home.visit.info.languages` — "English · 中文 (Mandarin)". */
  readonly languages: string;
};

export function InfoPanel({ hours, city, languages }: InfoPanelProps) {
  const t = useTranslations("home.visit.info");
  const tCommon = useTranslations("common");
  const { mapsUrl } = getSite().contact;

  return (
    <dl className={VISIT_PANEL}>
      <div>
        <dt>
          <Eyebrow size="panel">{t("visitLabel")}</Eyebrow>
        </dt>
        <dd className={VISIT_PANEL_VALUE}>
          {/* A block, so the link below it starts its own line (the panel's
              values are otherwise single lines of running text). */}
          <span className="block">{city}</span>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={VISIT_MAPS_LINK}>
            {t("mapsLink")}
            {/*
              The separator is markup, not copy: two adjacent inline boxes
              concatenate with nothing between them in the accessible-name
              computation, and "Open in Mapsopens in a new tab" is what a screen
              reader would then read. A JSX space expression is the one spelling
              that is a space and never a translatable string (the shape
              `YelpButton` established).
            */}{" "}
            <span className="sr-only">{tCommon("links.newTab")}</span>
          </a>
        </dd>
      </div>

      <div>
        <dt>
          <Eyebrow size="panel">{t("hoursLabel")}</Eyebrow>
        </dt>
        <dd className={VISIT_PANEL_VALUE}>
          <span>{hours.days}</span>
          <span aria-hidden className={VISIT_HOURS_SEPARATOR}>
            {" · "}
          </span>
          <span className={VISIT_HOURS_TIME}>{hours.times}</span>
        </dd>
      </div>

      <div>
        <dt>
          <Eyebrow size="panel">{t("languagesLabel")}</Eyebrow>
        </dt>
        <dd className={VISIT_PANEL_VALUE}>{languages}</dd>
      </div>
    </dl>
  );
}
