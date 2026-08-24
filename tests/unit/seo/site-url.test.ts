import { globSync, readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveSiteUrl, siteUrl } from "@/config/site-url";

/**
 * The one origin (06 `D-06.11`, INV-06.10).
 *
 * The chain is exercised as a pure function rather than by re-importing the
 * module once per environment, which keeps the cases readable and means the
 * frozen export is only asserted once — as itself.
 */
describe("src/config/site-url", () => {
  it("takes the first candidate that carries a value", () => {
    const url = resolveSiteUrl([
      { source: "NEXT_PUBLIC_SITE_URL", value: undefined },
      { source: "VERCEL_URL", value: "https://preview.vercel.app" },
      { source: "fallback", value: "http://localhost:3000" },
    ]);

    expect(url.origin).toBe("https://preview.vercel.app");
  });

  it("treats a blank or whitespace-only value as unset", () => {
    const url = resolveSiteUrl([
      { source: "NEXT_PUBLIC_SITE_URL", value: "" },
      { source: "VERCEL_PROJECT_PRODUCTION_URL", value: "   " },
      { source: "fallback", value: "http://localhost:3000" },
    ]);

    expect(url.origin).toBe("http://localhost:3000");
  });

  it("trims a value that a dashboard paste left padded", () => {
    const url = resolveSiteUrl([
      { source: "NEXT_PUBLIC_SITE_URL", value: "  https://example.com  " },
    ]);

    expect(url.origin).toBe("https://example.com");
  });

  it("throws and names the variable when a candidate is set but unparseable", () => {
    // The alternative is a Production deployment whose every canonical, sitemap
    // entry and JSON-LD `@id` silently says `http://localhost:3000`.
    expect(() =>
      resolveSiteUrl([
        { source: "NEXT_PUBLIC_SITE_URL", value: "example.com" },
        { source: "fallback", value: "http://localhost:3000" },
      ]),
    ).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("throws rather than returning undefined when the chain runs out", () => {
    expect(() => resolveSiteUrl([{ source: "NEXT_PUBLIC_SITE_URL", value: undefined }])).toThrow(
      /D-06.11/,
    );
  });

  it("exports a frozen absolute origin", () => {
    expect(siteUrl).toBeInstanceOf(URL);
    expect(Object.isFrozen(siteUrl)).toBe(true);
    expect(siteUrl.protocol).toMatch(/^https?:$/);
    expect(siteUrl.origin).toBe(new URL(siteUrl.href).origin);
  });
});

/**
 * The chain as the module actually reads it. Re-imported per case, because the
 * origin is parsed once at import — which is the behaviour under test.
 */
describe("src/config/site-url — the environment chain", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function originWith(env: Record<string, string>): Promise<string> {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    vi.resetModules();
    const module = await import("@/config/site-url");
    return module.siteUrl.origin;
  }

  it("prefers NEXT_PUBLIC_SITE_URL — the variable 09 sets in Production", async () => {
    await expect(
      originWith({
        NEXT_PUBLIC_SITE_URL: "https://example.com",
        VERCEL_PROJECT_PRODUCTION_URL: "production.vercel.app",
        VERCEL_URL: "deployment.vercel.app",
      }),
    ).resolves.toBe("https://example.com");
  });

  it("falls back to Vercel's production alias, which arrives as a bare host", async () => {
    await expect(
      originWith({
        VERCEL_PROJECT_PRODUCTION_URL: "production.vercel.app",
        VERCEL_URL: "deployment.vercel.app",
      }),
    ).resolves.toBe("https://production.vercel.app");
  });

  it("falls back to this deployment's own alias on a Preview", async () => {
    await expect(originWith({ VERCEL_URL: "deployment.vercel.app" })).resolves.toBe(
      "https://deployment.vercel.app",
    );
  });

  it("falls back to localhost in Development, so metadataBase is never undefined", async () => {
    await expect(originWith({})).resolves.toBe("http://localhost:3000");
  });
});

/**
 * INV-06.10, enforced rather than reviewed.
 *
 * The production host is settled (HD-13) and that is exactly when it becomes
 * tempting to type it into a component. It may appear in 06, in `.env.example`
 * and in the Vercel Production scope; in `src/` there is one origin and it comes
 * from the environment.
 */
describe("INV-06.10 — no absolute site origin is written in src/", () => {
  const sources = globSync("src/**/*.{ts,tsx}").sort();

  it("finds source files to check", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it("names neither the production host nor site.json's brand.url anywhere", () => {
    // Spelled in pieces so this file is not itself the literal it forbids.
    const hosts = [
      ["greenpasturesdaycare", "com"].join("."),
      ["greenpastures", "example"].join("."),
    ];

    for (const file of sources) {
      const contents = readFileSync(file, "utf8");
      for (const host of hosts)
        expect({ file, names: contents.includes(host) }).toEqual({ file, names: false });
    }
  });

  it("reads NEXT_PUBLIC_SITE_URL in the two modules that are allowed to", () => {
    // 06's origin module and 07's origin check (INV-07.3's neighbour), and
    // nowhere else — a third reader is a second answer to "what is our origin".
    const readers = sources.filter((file) =>
      readFileSync(file, "utf8").includes("NEXT_PUBLIC_SITE_URL"),
    );

    expect(readers).toEqual(["src/config/site-url.ts", "src/lib/inquiry/server/env.ts"]);
  });
});
