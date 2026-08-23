import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  canonicalCasing,
  localePrefixOf,
  resolveAcceptLanguage,
  withResolvedLanguage,
} from "@/i18n/negotiate";
import { ACCEPT_LANGUAGE, LOCALE_COOKIE_NAME, routing } from "@/i18n/routing";

/**
 * 06 `D-06.15` — the negotiation table and canonical casing (02 *Routing*).
 *
 * These are pure-function tests: no server, no proxy runtime. The rows below
 * are the contract's table, not a re-derivation of the implementation.
 */

function request(url: string, init?: { language?: string; cookie?: string }): NextRequest {
  const headers = new Headers();
  if (init?.language !== undefined) headers.set("accept-language", init.language);
  if (init?.cookie !== undefined) headers.set("cookie", `${LOCALE_COOKIE_NAME}=${init.cookie}`);
  return new NextRequest(`https://example.test${url}`, { headers });
}

describe("routing.locales", () => {
  it("enables all three ids now that PR-3.9 has seeded zh-Hant (INV-02.11)", () => {
    expect([...routing.locales]).toStrictEqual(["en", "zh-Hans", "zh-Hant"]);
    expect(routing.defaultLocale).toBe("en");
  });

  it("prefixes every locale and leaves hreflang to route metadata (02 D-02.9)", () => {
    expect(routing.localePrefix).toBe("always");
    expect(routing.alternateLinks).toBe(false);
  });
});

describe("canonicalCasing (D-06.15(b))", () => {
  it.each([
    ["/zh-hans", "/zh-Hans"],
    ["/zh-hans/menu", "/zh-Hans/menu"],
    ["/ZH-HANS/menu", "/zh-Hans/menu"],
    ["/zh-hant", "/zh-Hant"],
    ["/zh-hant/menu", "/zh-Hant/menu"],
    ["/EN", "/en"],
    ["/En/programs", "/en/programs"],
  ])("308-corrects %s to %s", (input, expected) => {
    expect(canonicalCasing(input)).toBe(expected);
  });

  it.each([
    ["/"],
    ["//"],
    [""],
    ["/en"],
    ["/en/menu"],
    ["/zh-Hans"],
    ["/zh-Hans/menu"],
    ["/zh-Hant"],
    ["/zh-Hant/menu"],
    ["/about"],
    ["/fr/x"],
  ])("leaves %s alone", (input) => {
    expect(canonicalCasing(input)).toBeNull();
  });

  it("does not canonicalise a locale that is not enabled", () => {
    // Canonical casing is derived from `routing.locales`, so an id the project
    // does not enable is an unprefixed path, not a mis-cased locale. PR-3.9
    // enabled `zh-Hant`, which is why `/zh-hant/x` moved to the 308 table above
    // with no edit to `canonicalCasing` itself; `fr` stands in for the rule.
    expect(canonicalCasing("/fr-FR/x")).toBeNull();
  });
});

describe("localePrefixOf", () => {
  it.each([
    ["/en", "en"],
    ["/zh-Hans/menu", "zh-Hans"],
    ["/zh-Hant/menu", "zh-Hant"],
  ])("reads %s as %s", (pathname, expected) => {
    expect(localePrefixOf(pathname)).toBe(expected);
  });

  it.each([["/"], ["/about"], ["/zh-hans"], ["/zh-hant"], ["/fr/x"]])(
    "reads no locale from %s",
    (pathname) => {
      expect(localePrefixOf(pathname)).toBeUndefined();
    },
  );
});

describe("resolveAcceptLanguage (D-06.15(a) — 02's table)", () => {
  it.each([["zh"], ["zh-CN"], ["zh-SG"], ["zh-MY"], ["zh-Hans"], ["zh-Hans-CN"]])(
    "%s resolves to zh-Hans",
    (header) => {
      expect(resolveAcceptLanguage(header)).toBe("zh-Hans");
    },
  );

  it.each([["zh-TW"], ["zh-HK"], ["zh-MO"], ["zh-Hant"], ["zh-Hant-TW"]])(
    "%s resolves to zh-Hant now that PR-3.9 has enabled it — and to zh-Hans, never en, if D-10.12 takes it away again",
    (header) => {
      expect(resolveAcceptLanguage(header)).toBe("zh-Hant");
      // The chain, not just today's survivor: what row 2 falls back to is the
      // half of D-06.15(a) the fallback depends on and this file is the only
      // place it is stated.
      const [, traditional] = ACCEPT_LANGUAGE;
      expect([...(traditional?.[1] ?? [])]).toStrictEqual(["zh-Hant", "zh-Hans"]);
    },
  );

  it.each([["en"], ["en-US"], ["en-GB"]])("%s resolves to the default locale", (header) => {
    expect(resolveAcceptLanguage(header)).toBe("en");
  });

  it.each([[""], ["fr-FR"], ["de,fr;q=0.8"], ["ja"]])(
    "%s matches no row and is left to next-intl",
    (header) => {
      expect(resolveAcceptLanguage(header)).toBeNull();
    },
  );

  it("ignores a missing header", () => {
    expect(resolveAcceptLanguage(null)).toBeNull();
    expect(resolveAcceptLanguage(undefined)).toBeNull();
  });

  it("honours q-order rather than document order", () => {
    expect(resolveAcceptLanguage("en;q=0.5,zh-CN;q=0.9")).toBe("zh-Hans");
    expect(resolveAcceptLanguage("zh-CN;q=0.4,en-US;q=0.9")).toBe("en");
  });

  it("keeps an English-first reader in English even when Chinese follows", () => {
    expect(resolveAcceptLanguage("en-US,zh-CN;q=0.8")).toBe("en");
  });

  it("skips a tag no row matches and keeps walking", () => {
    expect(resolveAcceptLanguage("fr-FR,zh-TW;q=0.8")).toBe("zh-Hant");
  });

  it("keeps document order when two tags share a quality", () => {
    expect(resolveAcceptLanguage("fr-FR,zh-CN")).toBe("zh-Hans");
    expect(resolveAcceptLanguage("zh-CN,en-US")).toBe("zh-Hans");
  });

  it("drops q=0 tags", () => {
    expect(resolveAcceptLanguage("zh-CN;q=0")).toBeNull();
  });

  it("ignores wildcards and malformed segments", () => {
    expect(resolveAcceptLanguage("*")).toBeNull();
    expect(resolveAcceptLanguage(",,")).toBeNull();
  });
});

describe("withResolvedLanguage", () => {
  it("rewrites Accept-Language to the single resolved tag on an unprefixed path", () => {
    const rewritten = withResolvedLanguage(request("/", { language: "zh-TW,zh;q=0.9" }));
    expect(rewritten.headers.get("accept-language")).toBe("zh-Hant");
  });

  it("keeps every other header and the URL", () => {
    const original = request("/programs?tour=1", { language: "zh-CN" });
    original.headers.set("x-probe", "kept");
    const rewritten = withResolvedLanguage(original);

    expect(rewritten.nextUrl.pathname).toBe("/programs");
    expect(rewritten.nextUrl.searchParams.get("tour")).toBe("1");
    expect(rewritten.headers.get("x-probe")).toBe("kept");
  });

  it("leaves an already-prefixed path untouched", () => {
    const original = request("/en/menu", { language: "zh-CN" });
    expect(withResolvedLanguage(original)).toBe(original);
  });

  it("leaves the request untouched when a valid NEXT_LOCALE cookie is present", () => {
    const original = request("/", { language: "zh-CN", cookie: "en" });
    expect(withResolvedLanguage(original)).toBe(original);
  });

  it("still negotiates when the cookie holds a locale that is not enabled", () => {
    // A stale cookie: `fr` never was a locale here, and `zh-Hant` stopped being
    // an example of one the day PR-3.9 enabled it. Either way the value is not
    // in `routing.locales`, so negotiation runs rather than being short-circuited.
    const rewritten = withResolvedLanguage(request("/", { language: "zh-CN", cookie: "fr" }));
    expect(rewritten.headers.get("accept-language")).toBe("zh-Hans");
  });

  it("leaves a header no row matches untouched", () => {
    const original = request("/", { language: "fr-FR" });
    expect(withResolvedLanguage(original)).toBe(original);
  });
});
