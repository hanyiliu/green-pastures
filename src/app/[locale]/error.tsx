"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

/**
 * The locale error boundary (06 `D-06.14`, §6.7).
 *
 * `'use client'` because Next requires it of every `error.tsx` — this file and
 * `global-error.tsx` are the two route-file boundaries 04 `D-04.1` counts
 * toward its 32 `'use client'` files, and it is the reason `errors` is a client
 * namespace (02 `D-02.16`, already in `CLIENT_NAMESPACES`).
 *
 * It sits inside the `[locale]` layout, so `NextIntlClientProvider` is above it
 * and `useTranslations('errors')` reads the same tree the server rendered —
 * hence copy from `errors.serverError.*` and not one literal string (INV-02.1).
 * An error thrown by the layout itself is not caught here (React never mounts a
 * boundary for its own segment's layout); that is `global-error.tsx`'s job.
 *
 * PR-4.x replaces this body with `<ErrorPanel kind="serverError" reset={reset} />`.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  // The digest is the only handle on the server-side stack, which Next strips
  // from the client payload in production; without this line a production
  // error is unattributable in the logs.
  useEffect(() => {
    console.error(`[error] ${error.digest ?? error.message}`);
  }, [error]);

  return (
    <main id="main">
      <h1>{t("serverError.title")}</h1>
      <p>{t("serverError.body")}</p>
      <button type="button" onClick={reset}>
        {t("serverError.retry")}
      </button>
    </main>
  );
}
