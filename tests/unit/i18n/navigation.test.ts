import { describe, expect, it } from "vitest";

import { getPathname, Link, notFound, redirect, usePathname, useRouter } from "@/i18n/navigation";

/**
 * 02 INV-02.7 — locale lives in the URL, so every internal navigation comes
 * from `src/i18n/navigation.ts`, and `no-restricted-imports` bans `next/link`
 * and `next/navigation` everywhere else.
 */
describe("src/i18n/navigation", () => {
  it("exposes the locale-aware navigation API plus notFound", () => {
    expect(Link).toBeDefined();
    expect(typeof redirect).toBe("function");
    expect(typeof getPathname).toBe("function");
    expect(typeof usePathname).toBe("function");
    expect(typeof useRouter).toBe("function");
    expect(typeof notFound).toBe("function");
  });

  it("prefixes every locale, including the default one (localePrefix: always)", () => {
    expect(getPathname({ href: "/", locale: "en" })).toBe("/en");
    expect(getPathname({ href: "/menu", locale: "en" })).toBe("/en/menu");
    expect(getPathname({ href: "/menu", locale: "zh-Hans" })).toBe("/zh-Hans/menu");
  });
});
