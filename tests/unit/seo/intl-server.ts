/**
 * The `next-intl/server` seam these suites render through.
 *
 * Outside Next's `react-server` condition next-intl resolves to its *client*
 * build, where every server entry point is a hard throw, so the module has to be
 * replaced to exercise anything that reads a message on the server. What is
 * replaced is the **transport**, never the data: the translator is next-intl's
 * own `createTranslator` over the real `content/` tree, with the project's real
 * formats and time zone, so the strings these suites assert are the strings
 * production renders.
 *
 * The shape is the one `tests/unit/sections/HomePage.test.tsx` established,
 * extended with the object form — `getTranslations({ locale, namespace })` —
 * which is what `src/lib/seo/metadata.ts` calls, and with a settable locale for
 * `getLocale()`.
 *
 * Used from a test file as:
 *
 * ```ts
 * vi.mock("next-intl/server", async () => {
 *   const { createIntlServerStub } = await import("../intl-server");
 *   return createIntlServerStub();
 * });
 * ```
 */

import { routing, type Locale } from "@/i18n/routing";

/** Which locale `getLocale()` answers with, and the default for `getTranslations`. */
export const intlFixture: { locale: Locale } = { locale: routing.defaultLocale };

type TranslationOptions = string | { readonly locale?: string; readonly namespace: string };

/** Walk a message tree down a dotted namespace, the way next-intl does. */
function walk(tree: unknown, namespace: string, locale: string): Record<string, unknown> {
  let node = tree;
  for (const key of namespace.split(".")) {
    node = typeof node === "object" && node !== null ? Reflect.get(node, key) : undefined;
  }
  if (typeof node !== "object" || node === null) {
    throw new Error(`No message namespace "${namespace}" in the ${locale} tree.`);
  }
  return node as Record<string, unknown>;
}

function isTree(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge one locale's tree over the `en` reference, which is what
 * `assembleLocaleTree` does in **production** (02 `D-02.8`).
 *
 * The Chinese trees are `{}` in fifteen of their seventeen files today — the
 * phased-translation window INV-02.11 describes — so a suite that read them
 * unmerged would assert `⟦home.meta.title⟧` and call it a locale's metadata.
 * Production is the environment that matters for a crawler, and merging here is
 * what makes these assertions agree with the HTML `next build` emits.
 */
function mergeOverReference(
  reference: Record<string, unknown>,
  locale: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...reference };
  for (const [key, value] of Object.entries(locale)) {
    const existing = merged[key];
    merged[key] = isTree(existing) && isTree(value) ? mergeOverReference(existing, value) : value;
  }
  return merged;
}

/** The replacement module object. Call it from a `vi.mock` factory. */
export async function createIntlServerStub(): Promise<Record<string, unknown>> {
  const { createTranslator } = await import("next-intl");
  const { formats, TIME_ZONE } = await import("@/i18n/formats");
  const { loadMessages, reference } = await import("@/i18n/messages");

  return {
    getLocale: () => Promise.resolve(intlFixture.locale),
    getTranslations: async (options: TranslationOptions) => {
      const namespace = typeof options === "string" ? options : options.namespace;
      const requested = typeof options === "string" ? undefined : options.locale;
      const locale =
        routing.locales.find((candidate) => candidate === requested) ?? intlFixture.locale;
      const loaded = await loadMessages(locale);
      const messages = mergeOverReference(reference, loaded);

      return createTranslator({
        locale,
        formats,
        timeZone: TIME_ZONE,
        messages: walk(messages, namespace, locale),
      });
    },
  };
}
