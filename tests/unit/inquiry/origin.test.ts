import { afterEach, describe, expect, it, vi } from "vitest";

import { hostOf } from "@/lib/inquiry/server/env";
import { acceptableHosts, isSameOrigin, requestHost } from "@/lib/inquiry/server/origin";

/** 07 §8 *Handler*: "403 guards (incl. branch-alias origin accepted)". */

afterEach(() => {
  vi.unstubAllEnvs();
});

function post(headers: Record<string, string>): Request {
  return new Request("https://greenpasturesdaycare.com/api/inquiry", { method: "POST", headers });
}

describe("hostOf", () => {
  it("reads both spellings the platform uses", () => {
    expect(hostOf("https://greenpasturesdaycare.com/")).toBe("greenpasturesdaycare.com");
    expect(hostOf("gp-git-feature.vercel.app")).toBe("gp-git-feature.vercel.app");
  });

  it("drops the port and the case", () => {
    expect(hostOf("https://LOCALHOST:3000")).toBe("localhost");
  });

  it("is undefined for nothing and for nonsense", () => {
    expect(hostOf(undefined)).toBeUndefined();
    expect(hostOf("://")).toBeUndefined();
  });
});

describe("requestHost", () => {
  it("prefers the proxy's header over Host", () => {
    expect(requestHost(post({ host: "internal", "x-forwarded-host": "public.example" }))).toBe(
      "public.example",
    );
  });

  it("falls back to Host", () => {
    expect(requestHost(post({ host: "public.example" }))).toBe("public.example");
  });
});

describe("isSameOrigin (07 §2 step 1)", () => {
  it("accepts a request from the host it arrived on", () => {
    const request = post({
      host: "greenpasturesdaycare.com",
      origin: "https://greenpasturesdaycare.com",
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it("accepts a Vercel branch alias, which is why the list exists", () => {
    vi.stubEnv("VERCEL_BRANCH_URL", "gp-git-wave-phase4.vercel.app");
    const request = post({
      host: "gp-abcdef.vercel.app",
      origin: "https://gp-git-wave-phase4.vercel.app",
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it("accepts the canonical origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://greenpasturesdaycare.com");
    expect(
      isSameOrigin(post({ host: "other.example", origin: "https://greenpasturesdaycare.com" })),
    ).toBe(true);
  });

  it("rejects a cross-site origin", () => {
    expect(
      isSameOrigin(post({ host: "greenpasturesdaycare.com", origin: "https://evil.example" })),
    ).toBe(false);
  });

  it("rejects a cross-site Referer when Origin is absent", () => {
    expect(
      isSameOrigin(post({ host: "greenpasturesdaycare.com", referer: "https://evil.example/x" })),
    ).toBe(false);
  });

  it("uses Referer only when Origin is absent", () => {
    const request = post({
      host: "greenpasturesdaycare.com",
      origin: "https://greenpasturesdaycare.com",
      referer: "https://evil.example/x",
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it("rejects a cross-site Sec-Fetch-Site outright", () => {
    const request = post({
      host: "greenpasturesdaycare.com",
      origin: "https://greenpasturesdaycare.com",
      "sec-fetch-site": "cross-site",
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("allows the header's `none`, which is a direct, non-browser request", () => {
    expect(isSameOrigin(post({ host: "greenpasturesdaycare.com", "sec-fetch-site": "none" }))).toBe(
      true,
    );
  });

  it("allows a request with neither header — the no-JavaScript and curl path", () => {
    expect(isSameOrigin(post({ host: "greenpasturesdaycare.com" }))).toBe(true);
  });

  it("does not accept localhost outside development", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(
      isSameOrigin(post({ host: "greenpasturesdaycare.com", origin: "http://localhost:3000" })),
    ).toBe(false);
  });

  it("accepts localhost in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const request = post({ host: "greenpasturesdaycare.com", origin: "http://localhost:3000" });
    expect(isSameOrigin(request)).toBe(true);
    expect(acceptableHosts(request)).toContain("localhost");
  });
});
