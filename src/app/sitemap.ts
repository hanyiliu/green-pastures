import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { absoluteAlternates, canonicalUrl, pageHrefs } from "@/lib/seo/urls";

/**
 * `/sitemap.xml` (06 §6.5, `D-06.12`, INV-06.4).
 *
 * Every page route × every enabled locale, each entry carrying the same
 * `hreflang` set the page's own `<head>` carries. Nothing else: no `/api`, no
 * 404, no query or hash variants, no metadata routes.
 *
 * ── The count is derived, never written down ─────────────────────────────
 *
 * Seven page routes (the home page plus `site.json.routes[]`) × three locales
 * (`routing.locales`) = **21 URLs** today. The two lists are the only inputs, so
 * enabling the reserved `/faq` page adds three entries and holding `zh-Hant`
 * back at the Phase 8 gate (`D-10.12`) leaves 14 — in both directions without
 * an edit to this file or to the test that counts them.
 *
 * ── No `lastModified`, `priority` or `changeFrequency` ───────────────────
 *
 * `D-06.12`. The only date this build could offer is its own timestamp, which
 * is not a content date: it would tell a crawler that all seven pages changed
 * every time anything shipped. `priority` and `changeFrequency` are ignored by
 * Google outright.
 *
 * The URLs are absolute because sitemap XML has no base to resolve against;
 * they resolve through the shared origin (`D-06.11`), so a Preview deployment's
 * sitemap describes the Preview and Production's describes the apex.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return pageHrefs().flatMap((href) =>
    routing.locales.map((locale) => ({
      url: canonicalUrl(locale, href),
      alternates: { languages: absoluteAlternates(href) },
    })),
  );
}
