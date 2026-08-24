import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getProvisionalPaths, getSite } from "@/content/site";

/**
 * Who serves `site.json` `images.og.src`, and whether `OQ-06.7` is still awake
 * (`gp-dln.196`).
 *
 * The share image is the one `images.*` entry that is not a photograph waiting
 * on PR-8.3: it is generated. That buys a real image today and costs a way to
 * forget — a placeholder that looks deliberate is a placeholder nobody
 * remembers to replace, and the design owner still owes the artwork `OQ-06.7`
 * assigns them.
 *
 * So the rule these assertions hold is not "the file exists" but **something
 * answers, and if the answer is generated it is registered**:
 *
 *  - the advertised path is served by *either* a file under `public/` *or* a
 *    route handler under `src/app/`, and
 *  - while it is the route handler, `images.og.src` sits in `site.json`'s
 *    `provisional` array, which is what makes `pnpm validate:content --release`
 *    refuse to launch (`D-02.20`, INV-02.10).
 *
 * That shape is what lets the replacement be a clean edit rather than a fight
 * with a test: commit `public/og/cover.png`, point the value at it, delete the
 * route and delete the registry line, and the first branch takes over.
 */

const PROVISIONAL_PATH = "images.og.src";

/** Where a `public/` file for this path would live. */
function publicFile(src: string): string {
  return join(process.cwd(), "public", src);
}

/** Where the App Router route handler serving this path would live. */
function routeFile(src: string): string {
  return join(process.cwd(), "src", "app", src, "route.ts");
}

describe("the share image", () => {
  const src = getSite().images.og.src;

  it("is advertised as a site-absolute path", () => {
    expect(src.startsWith("/")).toBe(true);
  });

  it("is served by a committed file or by a route handler, and by exactly one", () => {
    const asFile = existsSync(publicFile(src));
    const asRoute = existsSync(routeFile(src));

    // Both would be an ambiguity nobody should have to resolve at request time;
    // neither is the 404 this bead was opened for.
    expect(
      [asFile, asRoute].filter(Boolean),
      `${src} is served by ${String(Number(asFile) + Number(asRoute))} of {public/, src/app/}`,
    ).toHaveLength(1);
  });

  it("is registered provisional for exactly as long as it is generated", () => {
    const generated = existsSync(routeFile(src));
    expect(getProvisionalPaths().includes(PROVISIONAL_PATH)).toBe(generated);
  });
});
