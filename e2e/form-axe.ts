import type { Page } from "@playwright/test";

import { runAxe as runAxeScoped, type AxeOutcome } from "./a11y-support";

/**
 * The form suite's view of the accessibility runner (PR-5.10, now PR-8.4's).
 *
 * ## What this file used to be, and why it is nine lines now
 *
 * It was the whole instrument: an axe-core resolver that walked pnpm's virtual
 * store because `@axe-core/playwright` was not a dependency, plus the four
 * audited contrast pairs written inline because `e2e/axe-exceptions.json` —
 * which `D-08.8` names — did not exist. Both were deliberate. 10 §7 gives
 * PR-5.10 `e2e/form*` and gives `e2e/a11y*` to PR-8.4, so adding the dependency
 * and creating the shared allowlist were this row's to do, and PR-5.10 reported
 * them (`gp-dln.233`) rather than reaching outside its files.
 *
 * PR-8.4 has done both. `@axe-core/playwright` and `axe-core` are
 * devDependencies, the store walk is gone, the entries live in
 * `e2e/axe-exceptions.json`, and every scan on the site goes through one
 * runner with one allowlist.
 *
 * ## Why it is not deleted
 *
 * `e2e/form-a11y.spec.ts` imports from here, and that file belongs to
 * PR-5.10's family. Re-exporting keeps the form suite working with no edit to
 * it, and keeps `runAxe(page, selector)`'s original two-argument shape for the
 * one caller that uses it — the scoped scan of the form, which stays scoped for
 * the reason PR-5.10 gave: the rest of `/` belongs to other rows and to
 * `e2e/a11y-axe.spec.ts`'s document-level sweep.
 */

export {
  CONTRAST_EXCEPTIONS,
  describeViolations,
  WCAG_TAGS,
  type AxeNode,
  type AxeOutcome,
  type AxeViolation,
  type ContrastException,
} from "./a11y-support";

/** Run axe over `selector` and split the result into unexpected and audited. */
export function runAxe(page: Page, selector: string): Promise<AxeOutcome> {
  return runAxeScoped(page, { include: selector });
}
