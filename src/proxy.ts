import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { canonicalCasing, withResolvedLanguage } from "./i18n/negotiate";
import { routing } from "./i18n/routing";

/**
 * The locale proxy (06 `D-06.5`, `D-06.15`; 02 `D-02.9`).
 *
 * `proxy.ts` is Next 16's name for what used to be `middleware.ts`. It is a
 * thin wrapper around `createMiddleware(routing)` that adds exactly two things
 * next-intl cannot do alone, and nothing else — no logging, no geo, no
 * rewrites: it runs as a Node function ahead of every cached page response, so
 * it stays cheap.
 *
 * 1. **Canonical casing** — a wrong-cased locale segment 308s to the canonical
 *    id (`/zh-hans/menu` → `/zh-Hans/menu`), once, before anything else runs.
 *    308 because casing is not a matter of taste.
 * 2. **Chinese negotiation** — 02's Accept-Language table, applied by rewriting
 *    the header to one resolved tag so next-intl owns the 307 redirect, the
 *    `NEXT_LOCALE` cookie and the detection order (prefix → cookie →
 *    Accept-Language → `en`).
 *
 * A prefixed URL in canonical casing is never redirected.
 */
const handle = createMiddleware(routing);

export default function proxy(request: NextRequest): NextResponse {
  const canonical = canonicalCasing(request.nextUrl.pathname);
  if (canonical !== null) {
    const url = request.nextUrl.clone();
    url.pathname = canonical;
    return NextResponse.redirect(url, 308);
  }

  return handle(withResolvedLanguage(request));
}

/**
 * Excluded: `/api/*` (07 — the inquiry form must never be locale-redirected),
 * `/_next/*`, `/_vercel/*` and any path with a dot (`/sitemap.xml`,
 * `/robots.txt`, `/manifest.webmanifest`, icons, everything in `public/`).
 */
export const config = { matcher: "/((?!api|_next|_vercel|.*\\..*).*)" };
