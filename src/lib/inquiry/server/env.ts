/**
 * The only module in the project that reads the inquiry environment (07 §5,
 * INV-07.3).
 *
 * `eslint.config.mjs` bans `process.env.RESEND_API_KEY`,
 * `process.env.TURNSTILE_SECRET_KEY` and `process.env.INQUIRY_TO_EMAIL`
 * everywhere except `src/app/api/**` and `src/lib/inquiry/server/**`. This file
 * narrows that to one place inside the second tree, and the route handler reads
 * nothing at all, so "which files can see a secret" has a one-line answer.
 *
 * Every accessor reads `process.env` **per call**, never at module scope. Two
 * reasons: a value captured at import time is baked into the build, which is
 * exactly how a secret leaks into a bundle; and a test that stubs an
 * environment variable expects the next call to see it.
 *
 * Nothing here is *provisioned*. No Resend account, Turnstile widget or DNS
 * record exists yet — every name below is declared in `.env.example`, and the
 * human fills them in the Vercel dashboard (09 §2). Unset is a supported state
 * at every call site: the transport falls back to `log`, `siteverify` fails
 * closed, and the sending identity resolves from `content/site.json`.
 */

/** Which transport sends the mail. `resend` when unset (07 §5, preview + prod). */
export type InquiryTransportName = "log" | "resend";

function read(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * `INQUIRY_TRANSPORT`. `log` prints the rendered mail instead of calling
 * Resend; anything else — including unset — is `resend`, which is what makes
 * preview and production real without needing the variable set there.
 */
export function inquiryTransportName(): InquiryTransportName {
  return read("INQUIRY_TRANSPORT") === "log" ? "log" : "resend";
}

/** `RESEND_API_KEY` — sending-only, restricted to the sending domain (07 §5). */
export function resendApiKey(): string | undefined {
  return read("RESEND_API_KEY");
}

/** `TURNSTILE_SECRET_KEY` — the `siteverify` secret (07 §5). */
export function turnstileSecretKey(): string | undefined {
  return read("TURNSTILE_SECRET_KEY");
}

/**
 * `INQUIRY_FROM_EMAIL` — the per-environment override of the sender address.
 * Unset is the norm: the address is content, in `content/site.json`
 * (`D-07.10`). 09 §2 flags this variable for removal under OQ-09.11.
 */
export function fromAddressOverride(): string | undefined {
  return read("INQUIRY_FROM_EMAIL");
}

/**
 * `INQUIRY_TO_EMAIL` — the per-environment override of the recipient list,
 * comma-separated. **Required in the Preview scope**: the content default names
 * the daycare's real inbox, so a preview that did not override it would mail a
 * stranger (07 §5).
 */
export function recipientsOverride(): readonly string[] | undefined {
  const raw = read("INQUIRY_TO_EMAIL");
  if (raw === undefined) return undefined;
  const recipients = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return recipients.length === 0 ? undefined : recipients;
}

/** `INQUIRY_AUTOACK` — `1` enables the parent acknowledgement; off by default. */
export function autoAcknowledgementEnabled(): boolean {
  return read("INQUIRY_AUTOACK") === "1";
}

/**
 * The hosts the origin check accepts besides the one the request arrived on
 * (07 §2 step 1): the canonical origin plus Vercel's three deployment aliases,
 * which is what keeps Git-branch aliases and custom preview domains working.
 */
export function allowedOriginHosts(): readonly string[] {
  const sources = [
    read("NEXT_PUBLIC_SITE_URL"),
    read("VERCEL_PROJECT_PRODUCTION_URL"),
    read("VERCEL_URL"),
    read("VERCEL_BRANCH_URL"),
  ];

  const hosts: string[] = [];
  for (const source of sources) {
    const host = hostOf(source);
    if (host !== undefined && !hosts.includes(host)) hosts.push(host);
  }
  return hosts;
}

/**
 * A host from either spelling Vercel and 06 use: a bare `example.vercel.app`
 * (`VERCEL_URL`) or a full `https://example.com/` (`NEXT_PUBLIC_SITE_URL`).
 * Port and case are dropped, so `EXAMPLE.com:443` and `example.com` are one
 * host.
 */
export function hostOf(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const withScheme = value.includes("://") ? value : `https://${value}`;
  try {
    const { hostname } = new URL(withScheme);
    return hostname.length === 0 ? undefined : hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** Development, where `localhost` is an acceptable origin and nothing is rate limited. */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}
