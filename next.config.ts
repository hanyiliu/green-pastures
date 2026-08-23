import { globSync } from "node:fs";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * Next.js configuration.
 *
 * Owned one phase at a time (10 §7, "shared files"):
 *   - PR-2.4 created it, deliberately empty.
 *   - PR-3.1 (here) wraps the export in next-intl's plugin — 01 ADR-002, 02.
 *   - PR-6.11 adds the security headers of 06 §6.9 / 09 D-09.18.
 *   - PR-8.7 revisits image/remote-pattern configuration.
 *
 * `output: 'export'` is forbidden by 01 ADR-007: next-intl's proxy does not run
 * under a static export, which would drop locale negotiation on unprefixed URLs.
 */
const nextConfig: NextConfig = {};

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
