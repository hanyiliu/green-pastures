// @vitest-environment node
import type { ReactElement } from "react";

import { describe, expect, it, vi } from "vitest";

import { reference } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

/**
 * The font classes on `<html>` (03 §3.1, 06 §6.2).
 *
 * `tests/unit/design/fonts.test.ts` checks the two *ends* of the font
 * pipeline — `src/design/fonts.ts` declares `--font-fredoka` / `--font-nunito`,
 * `src/styles/tokens.css` reads them — and both ends passed for two rows while
 * nothing mounted the classes that declare those properties. `next/font` emits
 * a `--font-*` declaration only on the element carrying its `variable` class,
 * and `--font-display` / `--font-body` are read off `:root`, so the `<html>`
 * this layout returns is the one element the classes work on. Without them both
 * tokens fall through to `--font-cjk` and every locale renders in the system
 * font — with no error, no lint failure and no other failing test. This file is
 * the check for the middle of that seam.
 *
 * `next/font/google` is a build-time construct whose published entry point is
 * empty, so the loaders are stubbed exactly as `fonts.test.ts` stubs them; the
 * assertion compares against the stubs' own `variable` strings rather than
 * literals, so it tests the wiring and not the names (`fonts.test.ts` owns the
 * names). `next-intl/server` is stubbed because a Server Component has no
 * request context here.
 */

vi.mock("next/font/google", () => ({
  Fredoka: () => ({ className: "fredoka", variable: "fredoka-variable", style: {} }),
  Nunito: () => ({ className: "nunito", variable: "nunito-variable", style: {} }),
}));

vi.mock("next-intl/server", () => ({
  getMessages: () => Promise.resolve(reference),
  getTranslations: () => Promise.resolve((key: string) => key),
}));

const { fredoka, nunito } = await import("@/design/fonts");
const { default: LocaleLayout } = await import("@/app/[locale]/layout");

/** The layout is an async Server Component: awaiting it yields its element. */
function html(locale: string): Promise<ReactElement<{ className?: string }, string>> {
  return LocaleLayout({ children: null, params: Promise.resolve({ locale }) });
}

describe("the [locale] layout mounts the brand faces", () => {
  it.each(routing.locales)("carries both variable classes on <html> in %s", async (locale) => {
    const element = await html(locale);

    // Not `<body>`, not a wrapper: `:root` is `<html>`, and tokens.css reads
    // `--font-fredoka` / `--font-nunito` there.
    expect(element.type).toBe("html");

    const classes = (element.props.className ?? "").split(/\s+/).filter(Boolean);
    expect(classes).toContain(fredoka.variable);
    expect(classes).toContain(nunito.variable);
  });
});
