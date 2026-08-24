import { notFound } from "@/i18n/navigation";

/**
 * The catch-all that turns an unknown path into a **localised** 404
 * (06 `D-06.3`, §6.7).
 *
 * It renders nothing and it is not a page in any other sense. Its only job is
 * to exist, so that `/{locale}/nope` matches a route *inside* the `[locale]`
 * segment: `notFound()` thrown here is caught by `app/[locale]/not-found.tsx`,
 * which renders under the reader's own `<html lang>` with the nav and the
 * footer already in place. Without this file the request matches nothing in the
 * segment at all and Next serves the root `app/not-found.tsx`, which has no
 * locale layout above it and therefore answers every locale in `en`.
 *
 * **Explicit folders, no `[slug]` page** (`D-06.3`): the six detail routes are
 * six folders, each with its own composition and metadata. This catch-all is
 * the single exception to that rule and it resolves to a 404, never to content.
 *
 * **It is the only dynamic page in the build, by construction** (`D-06.4`).
 * A catch-all has no enumerable params, so `next build` marks it `ƒ Dynamic`
 * while every other route is `○ Static`. Every gate that asserts "all static"
 * exempts this route by name (INV-06.7).
 *
 * **Nothing links here and nothing prefetches it.** There is no href in the app
 * that resolves to an unmatched path — the nav, the footer, the hero CTAs and
 * the "learn more →" links all read `site.routes[]` / `site.nav.*` — so the
 * route is only ever reached by a typed or stale URL.
 *
 * `noindex` is Next's: it marks a rendered `not-found` boundary as
 * non-indexable itself, so this file adds no metadata of its own — and it must
 * not add a canonical or `hreflang`, which 06 §6.7 rules out for the 404.
 */
export default function CatchAllNotFound(): never {
  notFound();
}
