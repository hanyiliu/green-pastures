import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * The only navigation API the app may use (02 INV-02.7).
 *
 * Locale lives in the URL, never in client state, so every internal link,
 * redirect and programmatic navigation goes through these locale-aware
 * wrappers. `next/link` and `next/navigation` are banned everywhere outside
 * `src/i18n/` by `no-restricted-imports`; this module is the exemption.
 */
export const { Link, getPathname, redirect, usePathname, useRouter } = createNavigation(routing);

/**
 * `notFound` has no next-intl equivalent — it is not locale-aware and does not
 * need to be — but `next/navigation` is banned outside this directory
 * (INV-02.7). Re-exporting it here keeps that ban absolute and gives the route
 * tree (the `[locale]` layout guard, `[...rest]`, the error routes of PR-3.7)
 * a single import site.
 */
export { notFound } from "next/navigation";
