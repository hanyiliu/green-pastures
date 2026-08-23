import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Vitest setup (PR-2.5, 08 §4).
 *
 * `@testing-library/jest-dom/vitest` registers the DOM matchers on Vitest's
 * `expect`; RTL's auto-cleanup only runs when a global `afterEach` exists, and
 * this project runs `globals: false`, so cleanup is wired explicitly.
 */
afterEach(() => {
  cleanup();
});
