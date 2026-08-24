import { useTranslations } from "next-intl";

import { LearnMoreLink } from "@/components/ui/LearnMoreLink";

/**
 * "Read all reviews →" — the row that closes the testimonials section
 * (04 §3.5; D L271, M L184).
 *
 * ── It goes to the subpage, which is what the design drew ────────────────
 *
 * Both references put `data-subpage="reviews"` on this link. 04 §3.5 used to
 * overrule that and send it to `site.yelp.url` instead, on the grounds that the
 * label said "on Yelp" and the subpage keeps its own "Open our Yelp page ↗"
 * button (D L544). The cost of that reading was that `/{locale}/reviews` was
 * reachable by URL and from `sitemap.xml` and from no anchor anywhere — a page
 * the site built, advertised and never linked.
 *
 * Both destinations survive the fix, one hop apart: this link lands the reader
 * on the reviews subpage, and `YelpButton` at the foot of that page is the
 * outbound Yelp hop. So nothing loses the Yelp path, the subpage stops being
 * orphaned, and the label drops the two words that named the old destination.
 *
 * ── Which makes it an ordinary `LearnMoreLink` ───────────────────────────
 *
 * The five other home sections close the same way: a route **id**, resolved
 * through `site.routes[]` (02 `D-02.12`), rendered as a next-intl `Link`
 * carrying `subpage-enter` (05 §5.7). Nothing here is special enough to restate
 * the recipe — the outbound version had to, because `target="_blank"`, `rel`
 * and a `yelp_click` handler are not what that primitive renders; an internal
 * subpage link is exactly what it renders.
 *
 * The new-tab warning goes with the old destination. `common.links.newTab` is
 * for links that leave the site, and this one does not.
 *
 * ── Why it is a component at all ─────────────────────────────────────────
 *
 * `TestimonialsSection` is async — it awaits a collection — and holds every
 * message read to a synchronous child, where `useTranslations` works and needs
 * no `next-intl/server` mock to test. One line of JSX is a small thing to give
 * a file for, and giving the section a `getTranslations` call instead would
 * have cost that file its two-data-call surface and its test its stub.
 */

/**
 * The `site.routes[]` id, which is also the subpage's message namespace.
 * `LearnMoreLink` throws, naming `content/site.json`, if it ever stops being
 * declared there.
 */
const REVIEWS_ROUTE_ID = "reviews";

export function ReviewsLink() {
  const t = useTranslations("home.testimonials");

  return <LearnMoreLink routeId={REVIEWS_ROUTE_ID}>{t("link")}</LearnMoreLink>;
}
