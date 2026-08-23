import { locale as rootLocale } from "next/root-params";
import { hasLocale, IntlErrorCode, type IntlError } from "next-intl";
import { getRequestConfig, type GetRequestConfigParams } from "next-intl/server";

import { formats, TIME_ZONE } from "./formats";
import { loadMessages } from "./messages";
import { routing } from "./routing";

/**
 * The next-intl request configuration (02 `D-02.7`, `D-02.8`, `D-02.6`).
 *
 * Wired to Next.js by `createNextIntlPlugin` in `next.config.ts`; it runs once
 * per request (React-cached) for every Server Component that reads a message
 * or a formatter.
 */

/** One log line per missing key per server instance (02 `D-02.8`, prod row). */
const reportedMissingKeys = new Set<string>();

function reportMissing(error: IntlError): void {
  const key = error.originalMessage ?? error.message;
  if (reportedMissingKeys.has(key)) return;
  reportedMissingKeys.add(key);
  console.error(`[i18n] ${error.code}: ${error.message}`);
}

/**
 * Resolve the locale for this request, cheapest and most static-friendly first
 * (06 §6.2).
 *
 * 1. An explicit locale — `getTranslations({ locale })` from a Route Handler
 *    (07's inquiry e-mails), which has no `[locale]` segment to read.
 * 2. `next/root-params` — the `[locale]` root segment. This is what keeps every
 *    page `○ Static` (06 `D-06.4`): unlike `requestLocale` it does not read
 *    `headers()`, so it never opts a prerendered page into dynamic rendering,
 *    and it replaces the deprecated `setRequestLocale` sprinkled through every
 *    layout and page.
 * 3. `requestLocale` — the proxy's header, for anything rendering outside the
 *    `[locale]` segment.
 */
async function resolveRequestedLocale(params: GetRequestConfigParams): Promise<string | undefined> {
  if (params.locale !== undefined) return params.locale;
  // Next's generated declaration types this as `Promise<string>`, but a render
  // outside the `[locale]` segment has no such root param — hence the widening.
  const fromRootParams: string | undefined = await rootLocale();
  if (fromRootParams !== undefined) return fromRootParams;
  return params.requestLocale;
}

export default getRequestConfig(async (params) => {
  const requested = await resolveRequestedLocale(params);
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: TIME_ZONE,
    formats,
    onError(error) {
      if (error.code === IntlErrorCode.MISSING_MESSAGE) {
        reportMissing(error);
        return;
      }
      throw error;
    },
    /**
     * 02 `D-02.8` / INV-02.8. Reached only when the key is missing from `en`
     * too (production deep-merges the locale over `en`), and it never returns
     * an empty string: the marker is loud on purpose, and INV-02.5's Playwright
     * smoke asserts that no page contains a `⟦`.
     */
    getMessageFallback({ namespace, key }) {
      return `⟦${[namespace, key].filter(Boolean).join(".")}⟧`;
    },
  };
});
