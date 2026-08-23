import { describe, expect, it, vi } from "vitest";

/**
 * 02 `D-02.16` — `src/content/collections.ts` is server-only.
 *
 * This file runs under the project's default jsdom environment, so `window`
 * exists and the module's own guard fires at import. That is the back door the
 * guard closes: `clientMessages()` keeps `collections.*` out of the provider,
 * and this keeps it out of a client component that imports the loader directly.
 */

describe("src/content/collections.ts under a browser global", () => {
  it("is reachable as a module specifier", () => {
    expect(typeof window).toBe("object");
  });

  it("throws at import rather than shipping the collection tree to the browser", async () => {
    vi.resetModules();
    await expect(import("@/content/collections")).rejects.toThrow(
      /collections\.ts is server-only \(02 D-02\.16\)/,
    );
  });

  it("names the fix in the message it throws", async () => {
    vi.resetModules();
    await expect(import("@/content/collections")).rejects.toThrow(
      /Render the values in a Server Component and pass props/,
    );
  });
});
