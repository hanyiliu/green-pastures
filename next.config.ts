import { globSync } from "node:fs";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * Next.js configuration.
 *
 * Owned one phase at a time (10 §7, "shared files"):
 *   - PR-2.4 created it, deliberately empty.
 *   - PR-3.1 wraps the export in next-intl's plugin — 01 ADR-002, 02.
 *   - PR-6.11 (here) adds 06 §6.9's route items and 09 `D-09.18`'s headers.
 *   - PR-8.7 revisits image/remote-pattern configuration and adds `redirects()`.
 *
 * `output: 'export'` is forbidden by 01 ADR-007: next-intl's proxy does not run
 * under a static export, which would drop locale negotiation on unprefixed URLs.
 * INV-06.7 restates it as a build gate, and `e2e/headers.spec.ts` catches it
 * from the other side — a static export serves none of the headers below.
 */

/**
 * The security headers of 09 `D-09.18`, on every route.
 *
 * **There is deliberately no full `Content-Security-Policy` here**, and the one
 * CSP directive present is the one that costs nothing. `frame-ancestors 'none'`
 * governs who may *embed this site*; it says nothing about what this site may
 * load, so it is orthogonal to every third party 07 and 08 allow. That matters,
 * because the three things a naive policy would break are all live in this tree:
 *
 *   - **Turnstile** (`src/components/forms/Turnstile.tsx`) fetches its script
 *     from `challenges.cloudflare.com` and renders the widget in an iframe of
 *     its own. A `script-src 'self'` or a `frame-src 'self'` would kill the
 *     form's spam gate; `frame-ancestors` touches neither.
 *   - **Vercel analytics** (07 `D-07.13`) loads from `va.vercel-scripts.com`
 *     and beacons to `vitals.vercel-insights.com` — 08 §5's `@thirdparty`
 *     allowlist is the record of both.
 *   - **The fonts** are `next/font/google`, which downloads the faces at build
 *     time and serves them from `/_next/static/media/**` — so `font-src` is not
 *     the problem, but Next's own inline `<style>` and hydration `<script>` are:
 *     they need a nonce, a nonce needs per-request rendering, and `D-06.4`
 *     prerenders every page. That is `D-09.18`'s stated reason for holding the
 *     full policy back, and it is still true. A
 *     `Content-Security-Policy-Report-Only` allowlist is the post-launch task,
 *     once a report endpoint exists.
 *
 * `Strict-Transport-Security` is **not** in this list on purpose. `D-09.18`
 * keeps Vercel's default rather than overriding it, so nothing here should
 * mint a `max-age` of its own — and over the plain-HTTP `next start` that
 * `D-08.7` runs the e2e suite against, an HSTS header would be ignored by every
 * browser anyway. 08 §5 says as much in the `@headers` row ("HSTS on Vercel"),
 * and the spec asserts it only where it can exist.
 */
const securityHeaders: { readonly key: string; readonly value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  /**
   * 06 §6.9. This is also Next's default, and it is written down anyway: 06
   * §6.10 makes `/en/menu/` → 308 `/en/menu` an asserted row of the redirect
   * matrix, and a matrix row that rests on a framework default is one major
   * version away from being untrue. Setting it pins the behaviour to this file.
   */
  trailingSlash: false,

  /** 06 §6.9: no `x-powered-by`. `e2e/headers.spec.ts` asserts its absence. */
  poweredByHeader: false,

  images: {
    /**
     * 06 §6.9. Empty is also the default, and here too the point is the
     * statement: every image on this site is a local asset under `public/`
     * (`D-02.13`), so an entry appearing in this array is a review question,
     * not a configuration detail. PR-8.7 owns any change.
     */
    remotePatterns: [],

    /**
     * AVIF first, WebP second — array order is the preference order Next
     * resolves the request's `Accept` header against, falling back to the
     * source format when neither matches [verified: `next/image` docs,
     * Next 16.3.2].
     */
    formats: ["image/avif", "image/webp"],
  },

  /**
   * `/:path*` matches every path *including* `/` — `:path*` accepts zero
   * segments, where `:path+` would need one and would silently leave the root
   * bare. "Every route" in `D-09.18` is meant literally.
   */
  headers: () => Promise.resolve([{ source: "/:path*", headers: securityHeaders }]),
};

/**
 * Every reference-locale content file, discovered rather than listed (02
 * `D-02.7`).
 *
 * `createMessagesDeclaration` takes explicit JSON paths — it has no glob of its
 * own and *errors* on a path that does not exist — so the list is expanded
 * here. Discovering it means the PRs that author `content/en/**` never have to
 * reopen this file, which is what 10 §7's one-owner-per-phase rule is for. Each
 * entry gets a git-ignored `.d.json.ts` companion carrying the literal message
 * shapes, which is what makes ICU *arguments* type-checked at the call site.
 */
const referenceMessageFiles = globSync("content/en/**/*.json").sort();

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/i18n/request.ts",
  experimental: { createMessagesDeclaration: referenceMessageFiles },
});

export default withNextIntl(nextConfig);
