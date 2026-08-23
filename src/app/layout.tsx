import type { ReactNode } from "react";

import "./globals.css";

/**
 * Root layout — scaffold only (PR-2.4).
 *
 * It carries no copy, no metadata and no fonts. PR-3.1 introduces
 * `src/app/[locale]/layout.tsx`, which owns `<html lang>` (the locale id
 * verbatim, D-02.1), `data-scroll-behavior="smooth"`, `generateStaticParams`
 * and `NextIntlClientProvider`; PR-4.1 attaches the font variables; PR-6.8 owns
 * per-locale metadata. `lang="en"` here is the default-locale placeholder that
 * keeps this document valid until the `[locale]` segment exists.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
