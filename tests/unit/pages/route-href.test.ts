import { describe, expect, it } from "vitest";

import { routeHref } from "@/components/pages/route-href";
import { getSite } from "@/content/site";
import { routing } from "@/i18n/routing";

/**
 * The one slug lookup behind all six detail pages (02 `D-02.12`, 06 `D-06.2`,
 * `D-06.10`).
 *
 * Philosophy, Programs, Menu and Team each carried a private copy of this
 * function until the six were collapsed onto this module. The copies agreed —
 * the same `find`, the same throw, only the message text differed — but four
 * copies is four places to drift, and the thing they resolve is the canonical
 * URL, which is the one output no rendered page shows you when it is wrong.
 *
 * So the contract is pinned here rather than at any one page:
 *
 * - every id in `routes[]` resolves to that entry's `path`, derived from the
 *   file rather than typed, so a renamed slug fails here and not in a diff of
 *   prerendered HTML;
 * - the path comes back **unprefixed** — `buildMetadata` owns the locale;
 * - a namespace with no route throws instead of returning a fallback.
 *
 * The last one is the load-bearing one. `faq` and `visit` are real message
 * namespaces with a `kicker` and no route (`D-02.17`); a lookup that answered
 * them with `""` or `"/"` would publish a canonical for a URL that does not
 * exist, and nothing downstream would notice.
 */

const site = getSite();

/** Namespaces `content/<locale>/messages/` declares that `routes[]` does not. */
const RESERVED = ["faq", "visit"] as const;

describe("routeHref", () => {
  it("answers every id content/site.json declares, with that entry's path", () => {
    for (const route of site.routes) {
      expect(routeHref(route.id)).toBe(route.path);
    }
  });

  it("returns the path unprefixed — the locale is buildMetadata's to add", () => {
    for (const route of site.routes) {
      const href = routeHref(route.id);
      expect(href.startsWith("/")).toBe(true);
      for (const locale of routing.locales) {
        expect(href.startsWith(`/${locale}`)).toBe(false);
      }
    }
  });

  it.each(RESERVED)("throws for the reserved namespace %s rather than guessing", (namespace) => {
    // The message names the id and the file to edit, because the fix is always
    // an entry in `routes[]` and never a change here.
    expect(() => routeHref(namespace)).toThrow(/does not declare it in routes\[\]/u);
    expect(() => routeHref(namespace)).toThrow(new RegExp(`"${namespace}"`, "u"));
  });

  it("throws for an id nothing declares at all", () => {
    expect(() => routeHref("nowhere")).toThrow(/does not declare it in routes\[\]/u);
  });
});
