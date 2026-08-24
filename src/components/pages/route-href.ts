import { getSite } from "@/content/site";

/**
 * A detail page's unprefixed href, from `content/site.json` (02 `D-02.12`,
 * 06 `D-06.2`).
 *
 * `generateMetadata` needs the path its canonical and `hreflang` set are built
 * from, and 06 keeps a literal href off the allowlist: "the slug set lives once
 * in `content/site.json.routes[].path`". So a page names its **route id** — the
 * same id it hands `SubpageBar` and the same string as its message namespace —
 * and the slug is looked up, exactly as `LearnMoreLink` and `SubpageBar`
 * already look it up for their own links.
 *
 * It throws rather than falling back, for `SubpageBar`'s stated reason: the
 * reserved namespaces (`faq`, `visit` — `D-02.17`) carry a `kicker` and no
 * route, and a page that quietly emitted a canonical for a URL that does not
 * exist is worse than a build that names the file to edit.
 */
export function routeHref(routeId: string): string {
  const route = getSite().routes.find((entry) => entry.id === routeId);

  if (route === undefined) {
    throw new Error(
      `The page "${routeId}" asked for its href, and content/site.json does not declare it ` +
        `in routes[] (02 D-02.12). A reserved page's namespace exists before its route does ` +
        `(D-02.17); the route is what has to be added.`,
    );
  }

  return route.path;
}
