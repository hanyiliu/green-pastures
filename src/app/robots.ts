import type { MetadataRoute } from "next";

import { SITEMAP_PATH, absoluteUrl } from "@/lib/seo/urls";

/**
 * `/robots.txt` (06 §6.5, `D-06.12`, INV-06.4).
 *
 * Allow everything, disallow `/api/`, and point at the sitemap.
 *
 * `/api/` is the inquiry handler: a `POST`-only endpoint that answers `GET`
 * with 405 (07 §2). Crawling it costs a function invocation to learn nothing,
 * and a 405 in Search Console is noise nobody should have to explain.
 *
 * **No environment branching.** A Preview deployment serves this same file with
 * its own host in the `Sitemap:` line and is kept out of the index by Vercel's
 * automatic `X-Robots-Tag: noindex` header, not by anything here (`D-06.12`; a
 * custom preview domain would need a manual header, which is 09's). Next adds
 * `<meta name="robots" content="noindex">` to 404 responses by itself.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: absoluteUrl(SITEMAP_PATH),
  };
}
