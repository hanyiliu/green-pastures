import { ImageResponse } from "next/og";

import { shareCard, shareCardSize } from "@/lib/seo/share-card";

/**
 * `GET /og/placeholder.png` — the Open Graph image every locale shares
 * (06 §6.5, `OQ-06.7`).
 *
 * `content/site.json` `images.og.src` points here and
 * `src/lib/seo/metadata.ts` puts that path on every page, so this one route is
 * what a Facebook post, an iMessage preview and a Slack unfurl all fetch. Until
 * it existed the value named `/og/cover.png`, a file that has never been in
 * `public/`, and every one of those fetches 404ed. What the card looks like and
 * why it carries no text is in `src/lib/seo/share-card.tsx`.
 *
 * ── One image for three locales ──────────────────────────────────────────
 *
 * `buildRootMetadata` and `buildMetadata` both take the image from
 * `site.images.og`, which is not a localized value — every locale's `og:image`
 * is this URL, and only `og:image:alt` and `og:locale` differ. Nothing here
 * changes that. It is also the right answer for *this* card: the wordmark it
 * draws already reads in English and in Chinese, and the two Latin faces this
 * repository loads have no CJK glyphs to set a translated name in even if the
 * metadata offered a per-locale slot. A locale-aware card is a property of the
 * real artwork, and `OQ-06.7` is where that gets decided.
 *
 * ── Static, because every page here is ───────────────────────────────────
 *
 * `dynamic = "force-static"` makes Next prerender the route during `next build`
 * rather than run Satori per request: a GET route handler is dynamic by default
 * in this version, and a share image re-rendered on every crawler's fetch would
 * be the one uncached thing on an otherwise fully prerendered site (`D-06.4`).
 * Being a build-time render is also what lets the card read
 * `public/brand/logo.png` and `src/styles/tokens.css` off disk — files a
 * serverless bundle would not carry — and what keeps it clear of `gp-dln.267`:
 * this route resolves no origin, so nothing about it depends on the site-origin
 * variable `D-06.11` reads being set at build time. Proven rather than assumed
 * — two builds, one with that variable set and one without, produce a
 * byte-identical PNG. The absolute URL in `og:image` is `metadataBase`'s
 * problem, and `src/config/site-url.ts` is the only module with an opinion
 * about it (INV-06.10).
 *
 * `runtime = "nodejs"` for `node:fs`, and because there is nothing here the
 * Edge runtime would buy.
 */

export const runtime = "nodejs";
export const dynamic = "force-static";

export function GET(): Response {
  return new ImageResponse(shareCard(), shareCardSize());
}
