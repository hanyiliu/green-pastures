import { useTranslations } from "next-intl";

import { PhotoSlot } from "@/components/ui/PhotoSlot";
import { getSite } from "@/content/site";

import { VISIT_MAP, VISIT_MAP_LINK } from "./layout";

/**
 * The map / building photo above the info panel (04 §3.5; D L327, M L242).
 *
 * **A photo, never an embed** (07 §6). A Google Maps or Mapbox iframe would
 * load third-party scripts and cookies for every visitor and would be the only
 * consent-relevant asset on the page; it also departs from the design, which
 * draws a plain drop slot here. So the section renders the slot and links it to
 * `contact.mapsUrl`, which is a required field of the site schema (07
 * `D-07.11`) — there is no "if the owner supplied one" branch.
 *
 * **A plain `<a>`, not `TrackedLink`.** 07 §4's event list has `cta_book_tour`
 * and `yelp_click` and no map event, and 04 §3.5 says so on this component's
 * row. Adding one would be an analytics decision, not a composition one.
 *
 * **The accessible name is the photograph's.** `PhotoSlot` with an `alt` is
 * `role="img"` carrying it, so the link announces "Map showing our Fremont
 * neighborhood". The panel below carries the same destination under the words
 * "Open in Maps" — two links, two names, which is the image-plus-caption shape
 * rather than the same link twice.
 *
 * `site.images.map` is deliberately not read here. Every photograph on this
 * site is client-supplied and none has arrived (03 §9, `D-04.12`), so what the
 * design draws is a reserved box and what this renders is `PhotoSlot`; the
 * `Picture` component 04 §3.5 names, and with it `site.images.map`'s `src`,
 * `width` and `height`, bind the day a real photograph does.
 */

/** The slot id, which `data-photo-slot` carries so 08 can find the box. */
const MAP_SLOT_ID = "map";

export function MapPhoto() {
  const t = useTranslations("home.visit");
  const { mapsUrl } = getSite().contact;

  return (
    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={VISIT_MAP_LINK}>
      <PhotoSlot slotId={MAP_SLOT_ID} alt={t("map.alt")} radius="tile" className={VISIT_MAP} />
    </a>
  );
}
