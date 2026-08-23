import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

/**
 * The localised 404 (06 `D-06.14`, §6.7).
 *
 * Rendered whenever `notFound()` is called *below* the locale layout, which
 * PR-6.1's `[...rest]` catch-all is what makes routine: it is the route that
 * turns `/{locale}/nope` into this page instead of the root 404 (verified with
 * a stand-in catch-all — `/zh-Hans/nope` then renders here under
 * `<html lang="zh-Hans">`, `/en/nope` here under `lang="en"`). Until that route
 * lands, an unmatched path has no match inside the segment at all and Next
 * serves the root `not-found.tsx`; so does the layout's own unknown-locale
 * guard, since a segment's boundary cannot catch its own layout's throw.
 *
 * It renders *inside* the locale layout, so the `<html lang>`, the nav and the
 * footer are already correct and this file owns only the panel.
 *
 * Server component on purpose (04 `D-04.1`): nothing here is interactive, and
 * a `'use client'` file is a change to that document's closed allowlist. It
 * also carries no `loading.tsx` above it and no `Suspense` (06 §6.2) — a
 * streamed 404 would be served with status 200.
 *
 * Copy is `errors.notFound.*` (02 rule 10); INV-02.1 allows no literal string
 * here. PR-4.x replaces this body with `<ErrorPanel kind="notFound" />`, the
 * component 04 §3 assigns the markup and the styling to — the keys it reads
 * are these.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("errors");

  return (
    <main id="main">
      <h1>{t("notFound.title")}</h1>
      <p>{t("notFound.body")}</p>
      {/*
        06 §6.7: the CTA goes home through next-intl's `Link`, so it lands on
        the reader's own locale (`/zh-Hans`, not `/en`) and never redirects.
        `/` is on 06's two-entry literal-href allowlist.
      */}
      <Link href="/">{t("notFound.cta")}</Link>
    </main>
  );
}
