import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import proxy, { config } from "@/proxy";
import { LOCALE_COOKIE_NAME } from "@/i18n/routing";

/**
 * `src/proxy.ts` (06 `D-06.5`, `D-06.15`; 02 `D-02.9`).
 *
 * The matcher is an allowlist assertion: a path the proxy should *not* see is
 * as much of a bug as one it misses.
 */

function matches(url: string): boolean {
  return unstable_doesMiddlewareMatch({ config, url });
}

function get(url: string, init?: { language?: string; cookie?: string }): NextRequest {
  const headers = new Headers();
  if (init?.language !== undefined) headers.set("accept-language", init.language);
  if (init?.cookie !== undefined) headers.set("cookie", `${LOCALE_COOKIE_NAME}=${init.cookie}`);
  return new NextRequest(`https://example.test${url}`, { headers });
}

describe("proxy matcher", () => {
  it.each([["/"], ["/en"], ["/zh-Hans/menu"], ["/programs"], ["/zh-hans/menu"]])(
    "runs on %s",
    (url) => {
      expect(matches(url)).toBe(true);
    },
  );

  it.each([
    ["/api/inquiry"],
    ["/_next/static/chunk.js"],
    ["/_vercel/insights/script.js"],
    ["/sitemap.xml"],
    ["/robots.txt"],
    ["/manifest.webmanifest"],
    ["/og/cover.png"],
    ["/favicon.ico"],
  ])("never runs on %s", (url) => {
    expect(matches(url)).toBe(false);
  });
});

describe("proxy behaviour", () => {
  it("308-redirects a wrong-cased locale segment to the canonical id (D-06.15(b))", () => {
    const response = proxy(get("/zh-hans/menu?tour=1"));

    expect(response.status).toBe(308);
    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    expect(new URL(location ?? "", "https://example.test").pathname).toBe("/zh-Hans/menu");
    expect(new URL(location ?? "", "https://example.test").search).toBe("?tour=1");
  });

  it("307-redirects the bare root to the negotiated locale (D-06.15(a))", () => {
    const response = proxy(get("/", { language: "zh-TW,zh;q=0.9" }));

    expect(response.status).toBe(307);
    // PR-3.9 enabled zh-Hant, so a Traditional reader now lands on their own
    // script rather than on Simplified — the one behaviour change the seed
    // makes for a reader who was already being served (D-06.15(a)).
    expect(new URL(response.headers.get("location") ?? "", "https://example.test").pathname).toBe(
      "/zh-Hant",
    );
  });

  it("prefers an explicit NEXT_LOCALE cookie over the header", () => {
    const response = proxy(get("/", { language: "zh-CN", cookie: "en" }));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "", "https://example.test").pathname).toBe(
      "/en",
    );
  });

  it("sends an unmatched header to the default locale", () => {
    const response = proxy(get("/programs", { language: "fr-FR" }));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "", "https://example.test").pathname).toBe(
      "/en/programs",
    );
  });

  it("never redirects a canonical prefixed URL", () => {
    expect(proxy(get("/zh-Hans/menu", { language: "en-US" })).status).toBe(200);
    expect(proxy(get("/en", { language: "zh-CN" })).status).toBe(200);
  });

  it("emits no alternate-links header — hreflang comes from route metadata (D-02.9)", () => {
    expect(proxy(get("/en")).headers.get("link")).toBeNull();
  });
});
