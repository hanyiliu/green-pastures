import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import { siteUrl } from "@/config/site-url";
import { SITEMAP_PATH } from "@/lib/seo/urls";

/**
 * `/robots.txt` (06 `D-06.12`, INV-06.4).
 */
describe("app/robots.ts", () => {
  const rules = robots();

  it("allows the site and disallows the API", () => {
    expect(rules.rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/api/"] });
  });

  it("points at this environment's sitemap, not a hard-coded host", () => {
    expect(rules.sitemap).toBe(`${siteUrl.origin}${SITEMAP_PATH}`);
    expect(rules.sitemap).toBe(new URL(SITEMAP_PATH, siteUrl).toString());
  });

  it("does not branch on the environment — previews are noindexed by a header", () => {
    // Nothing in the returned object mentions an environment, a host or a
    // `noindex`: Vercel's automatic `X-Robots-Tag` keeps previews out of the
    // index (`D-06.12`), and Next adds the 404 `noindex` by itself.
    expect(JSON.stringify(rules)).not.toContain("noindex");
    expect(rules.host).toBeUndefined();
  });
});
