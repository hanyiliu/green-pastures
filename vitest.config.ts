import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Vitest (PR-2.5, 08 §4 / D-08.6, D-08.16).
 *
 * jsdom + `@testing-library/react` + `@testing-library/jest-dom` +
 * `@testing-library/user-event`. Network is mocked at the fetch layer with MSW
 * when the inquiry handler lands (PR-5.8) — no injected transport seam.
 *
 * Coverage: D-08.16 sets **no global percentage**. The meaningful coverage here
 * is the content gate and the e2e matrix. Floors apply by glob, and only to the
 * pure-logic trees; component trees are covered by RTL render tests and e2e.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    // `e2e/` is Playwright's; Vitest must never try to run a `.spec.ts` there.
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    restoreMocks: true,
    // next-intl's published ESM imports Next with extension-less specifiers
    // (`from "next/server"`) that only Next's own bundler rewrites, so Node's
    // resolver rejects them when the package is externalised. Inlining it lets
    // Vite resolve those imports, which is what makes 06 §6.10's proxy-matcher
    // and navigation tests runnable without a server.
    server: { deps: { inline: ["next-intl"] } },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
      exclude: ["src/app/**/layout.tsx", "**/*.d.ts"],
      // D-08.16: floors by glob, 90 % statements / 85 % branches, on the pure
      // modules only. Each glob is enabled by the PR that creates the tree —
      // `thresholds` entries for a glob that matches no file are inert, so these
      // start working the day the code arrives rather than needing a config PR.
      thresholds: {
        "src/i18n/**": { statements: 90, branches: 85 },
        "src/content/**": { statements: 90, branches: 85 },
        "src/lib/**": { statements: 90, branches: 85 },
        "src/design/**": { statements: 90, branches: 85 },
        "src/components/motion/variants.ts": { statements: 90, branches: 85 },
        "src/components/motion/reveal-registry.ts": { statements: 90, branches: 85 },
        "scripts/validate-content.ts": { statements: 90, branches: 85 },
      },
    },
  },
});
