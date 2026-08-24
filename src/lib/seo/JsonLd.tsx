import { getLocale, getTranslations } from "next-intl/server";

import { buildChildCareJsonLd, serialiseJsonLd } from "./json-ld";

/**
 * The `<script type="application/ld+json">` the home page renders (06 §6.6).
 *
 * Two components, because they fail in different ways and so want different
 * tests. {@link JsonLdScript} is pure markup — hand it an object, get an
 * escaped script element — and {@link ChildCareJsonLd} is the server component
 * that reads the locale and the description and hands them to the builder.
 *
 * Server components on purpose (04 `D-04.1`): the object is the same on every
 * request, so shipping the builder, `content/site.json` and the whole
 * `routing.ts` table to the browser to produce a tag no user can see would be a
 * bundle spent on nothing.
 *
 * `dangerouslySetInnerHTML` is the only way to put JSON inside a `<script>` —
 * React escapes text children into HTML entities, which a JSON-LD parser reads
 * as literal `&quot;` and rejects. {@link serialiseJsonLd} is what makes it
 * safe: it neutralises every `<` before the string reaches this file, so no
 * content value can close the element.
 */

export type JsonLdScriptProps = {
  readonly data: unknown;
};

/** Serialise one object into an escaped `ld+json` script element. */
export function JsonLdScript({ data }: JsonLdScriptProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }}
    />
  );
}

/**
 * The home page's business object, in the reader's locale.
 *
 * It reads the locale itself rather than taking a prop: the home page renders
 * inside the `[locale]` segment, so `getLocale()` is already the right answer
 * and a prop would be one more thing a caller could get wrong.
 *
 * The description is `home.meta.description` — deliberately the same sentence
 * the page's `<meta name="description">` carries, so the graph and the snippet
 * cannot disagree.
 */
export async function ChildCareJsonLd() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <JsonLdScript data={buildChildCareJsonLd({ locale, description: t("meta.description") })} />
  );
}
