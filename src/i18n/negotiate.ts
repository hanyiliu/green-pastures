import { hasLocale } from "next-intl";
import { NextRequest } from "next/server";

import { ACCEPT_LANGUAGE, LOCALE_COOKIE_NAME, routing, type Locale } from "./routing";

/**
 * The two pure helpers `src/proxy.ts` wraps around `createMiddleware(routing)`
 * (06 `D-06.15`). The tables themselves stay in `routing.ts` beside
 * `LOCALE_META`, as 02 *Design → Routing* requires.
 */

function segmentsOf(pathname: string): string[] {
  return pathname.split("/");
}

/** The enabled locale a path is prefixed with, or `undefined`. */
export function localePrefixOf(pathname: string): Locale | undefined {
  const first = segmentsOf(pathname)[1];
  return hasLocale(routing.locales, first) ? first : undefined;
}

/**
 * Canonical casing (06 `D-06.15`(b)).
 *
 * Locale ids are case-sensitive path segments, so `/zh-hans/menu` is not a
 * route. When the first segment case-insensitively equals a locale id but is
 * not that id, return the corrected path so the proxy can 308 to it — once,
 * before anything else runs. Returns `null` when the path is already canonical
 * or is not locale-prefixed at all.
 */
export function canonicalCasing(pathname: string): string | null {
  const segments = segmentsOf(pathname);
  const first = segments[1];
  if (first === undefined || first === "") return null;

  const canonical = routing.locales.find((locale) => locale.toLowerCase() === first.toLowerCase());
  if (canonical === undefined || canonical === first) return null;

  segments[1] = canonical;
  return segments.join("/");
}

type WeightedTag = { readonly tag: string; readonly quality: number; readonly order: number };

function parseAcceptLanguage(header: string): WeightedTag[] {
  return header
    .split(",")
    .map((part, order): WeightedTag => {
      const [tag = "", ...parameters] = part.split(";");
      const quality = parameters
        .map((parameter) => /^\s*q\s*=\s*([\d.]+)\s*$/i.exec(parameter))
        .find((match) => match !== null);
      return {
        tag: tag.trim(),
        quality: quality ? Number(quality[1]) : 1,
        order,
      };
    })
    .filter((entry) => entry.tag !== "" && Number.isFinite(entry.quality) && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.order - b.order);
}

/**
 * 02's Accept-Language table, implemented literally (06 `D-06.15`(a)).
 *
 * Walks the header's tags in q-order; the first tag that matches an
 * `ACCEPT_LANGUAGE` row resolves to that row's **first surviving locale** —
 * the first entry of its ordered preference chain that is still in
 * `routing.locales`. So `zh-TW` prefers `zh-Hant` — enabled since PR-3.9 — and
 * would fall back to `zh-Hans` if INV-02.11 ever held that locale back again:
 * the same language in the other script, and never `en`.
 *
 * Returns `null` when no row matches, which leaves the header untouched for
 * next-intl's own best fit (`en-*` and everything else → `en`).
 */
export function resolveAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;

  for (const { tag } of parseAcceptLanguage(header)) {
    for (const [pattern, preference] of ACCEPT_LANGUAGE) {
      if (!pattern.test(tag)) continue;
      for (const id of preference) {
        if (hasLocale(routing.locales, id)) return id;
      }
    }
  }
  return null;
}

/**
 * Apply `D-06.15`(a) by **rewriting the request's `Accept-Language` to the one
 * resolved tag** before delegating to `createMiddleware`, so next-intl still
 * owns the redirect, the cookie and the detection order — there is no second
 * code path that could disagree with it.
 *
 * The request is returned untouched when the path is already locale-prefixed or
 * a valid `NEXT_LOCALE` cookie is present: next-intl's order (prefix → cookie →
 * `Accept-Language` → default) is preserved, not replaced.
 */
export function withResolvedLanguage(request: NextRequest): NextRequest {
  if (localePrefixOf(request.nextUrl.pathname) !== undefined) return request;

  const cookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (hasLocale(routing.locales, cookie)) return request;

  const resolved = resolveAcceptLanguage(request.headers.get("accept-language"));
  if (resolved === null) return request;

  const headers = new Headers(request.headers);
  headers.set("accept-language", resolved);
  return new NextRequest(request.url, { headers, method: request.method });
}
