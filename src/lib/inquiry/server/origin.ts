import { allowedOriginHosts, hostOf, isDevelopment } from "./env";

/**
 * The same-origin check (07 §2 step 1, `D-07.7`).
 *
 * Route Handlers have no built-in CSRF protection — that was one of the two
 * things `D-07.1` gave up by choosing a Route Handler over a Server Action, and
 * it said the check is "a few lines". These are the few lines.
 *
 * The rule: the host of `Origin` — or of `Referer` when `Origin` is absent —
 * must equal the host the request arrived on, or one of the allow-listed hosts
 * derived from the environment. `Sec-Fetch-Site`, when the browser sends it,
 * must say `same-origin`.
 *
 * A request with **no** `Origin` and no `Referer` is allowed through. That is
 * not a hole: it is the `curl`/no-JavaScript path 07 `D-07.5` requires to work,
 * and it is not a CSRF vector, because CSRF is a *browser* attaching a user's
 * cookies to a cross-site request and every browser sends one of the two
 * headers on a POST. Nothing here is authenticated by a cookie in any case.
 */

/** The host this request actually arrived on, behind Vercel's proxy. */
export function requestHost(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-host");
  return hostOf(forwarded ?? request.headers.get("host") ?? undefined);
}

/** Every host a submission may claim to come from, for this request. */
export function acceptableHosts(request: Request): readonly string[] {
  const hosts = [...allowedOriginHosts()];

  const own = requestHost(request);
  if (own !== undefined && !hosts.includes(own)) hosts.push(own);

  if (isDevelopment()) {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      if (!hosts.includes(host)) hosts.push(host);
    }
  }

  return hosts;
}

/** Does this request come from one of our own pages (07 §2 step 1)? */
export function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const claimed = hostOf(
    request.headers.get("origin") ?? request.headers.get("referer") ?? undefined,
  );
  if (claimed === undefined) return true;

  return acceptableHosts(request).includes(claimed);
}
