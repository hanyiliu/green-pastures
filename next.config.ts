import type { NextConfig } from "next";

/**
 * Scaffold configuration (PR-2.4).
 *
 * Deliberately empty. Later PRs extend this file and nothing else touches it
 * (10 §7, "shared files"):
 *   - PR-3.1 wraps the export in next-intl's plugin (`createNextIntlPlugin`,
 *     with `experimental.createMessagesDeclaration`) — 01 ADR-002, 02.
 *   - PR-6.11 adds the security headers of 06 §6.9 / 09 D-09.18.
 *   - PR-8.7 revisits image/remote-pattern configuration.
 *
 * `output: 'export'` is forbidden by 01 ADR-007: next-intl's proxy does not run
 * under a static export, which would drop locale negotiation on unprefixed URLs.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
