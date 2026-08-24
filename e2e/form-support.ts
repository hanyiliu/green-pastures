import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, type Locator, type Page, type Route } from "@playwright/test";

import { routing, type Locale } from "../src/i18n/routing";
import {
  CHILD_AGE_IDS,
  HONEYPOT_FIELD,
  INQUIRY_FORM_FIELDS,
  MIN_SUBMIT_MS,
  TURNSTILE_TOKEN_FIELD,
} from "../src/lib/inquiry/schema";
import { TURNSTILE_SCRIPT_URL } from "../src/lib/inquiry/turnstile";

/**
 * Shared rig for the inquiry-form end-to-end family (PR-5.10 · 07 §8 · 08 §5
 * `@form`).
 *
 * Everything the four `e2e/form*.spec.ts` files need that is not an assertion
 * lives here: which locales run, where the copy comes from, how the Turnstile
 * script is stubbed, and how one submission is driven. The specs then read as
 * the list 07 §8 writes.
 *
 * Three properties of this rig decide what the suite can and cannot prove, and
 * they are stated once, here, rather than re-argued in each spec.
 *
 * **(a) The Turnstile *script* is stubbed; the server's `siteverify` is not.**
 * 07 §1 loads `challenges.cloudflare.com/turnstile/v0/api.js` lazily into the
 * page, and a suite that fetched it for real would make every form test depend
 * on Cloudflare being reachable from the runner — which INV-08.7's own
 * hermetic-run goal forbids and the Playwright container cannot promise.
 * {@link stubTurnstile} answers that one URL with a widget that mints a token
 * on `execute()`, asynchronously, exactly as the real one does. What it cannot
 * touch is the *server's* outbound call from `src/lib/inquiry/server/turnstile.ts`,
 * which is Node-to-Cloudflare and never passes through the browser.
 *
 * **(b) Which submissions therefore reach the real handler.** The **success
 * path does**, and so do the two decoys 07 §2 answers before step 5 (step 3's
 * honeypot and too-fast tests). Those specs run against the live
 * `POST /api/inquiry` with no interception at all, so the round trip — fetch,
 * guards, shared-schema re-parse, decoy or `siteverify`, `{ ok: true }`,
 * success panel — is genuinely end to end.
 *
 * The success path was *not* reachable until `gp-dln.232`. Cloudflare answers
 * the published always-pass secret in `playwright.config.ts` with a payload
 * that carries no `action` and the hostname `example.com`, so 07 §2 step 5's
 * two echo checks rejected it and the only 200 this suite could observe was a
 * decoy's. `src/lib/inquiry/server/turnstile.ts` now skips those two checks —
 * and only those two — when the configured secret is literally one of
 * Cloudflare's three published testing values, so this run reaches the same
 * `{ ok: true }` a parent will. `success === true` is still required, which is
 * why the `2x…` secret still fails.
 *
 * That makes the success test the one spec in the family with an outbound
 * dependency: `siteverify` is a Node-to-Cloudflare call, and 07 §2 step 5 fails
 * *closed*, so a Cloudflare outage turns it into a 503 rather than a flake that
 * passes. It is one test per locale, deliberately, and every other 200 the
 * suite needs — the reset panel, the keyboard run, the pending state — is still
 * forced with `page.route`, because each of those is a question about the
 * client and none of them is improved by a second network round trip.
 *
 * Every outcome that is *not* a success remains a server answer this rig cannot
 * provoke locally, so the specs force it with `page.route`, which is what
 * 08 §5's `@form` row prescribes in as many words ("`page.route` forces
 * 502 → `emailFailed` banner; forces 429 → `rateLimited`").
 *
 * **(c) The copy is read, never typed** (INV-08.5). {@link visitCopy} loads
 * `content/<locale>/messages/visit.json` and deep-merges it over `en` the way
 * 02 `D-02.8` says the production loader does — which is the loader
 * `pnpm start` serves. That merge is not a nicety: `content/zh-Hans/messages/
 * visit.json` holds one key today (`form.submit`), so a `zh-Hans` assertion
 * that read only the Chinese file would compare the page against `undefined`,
 * and one that hard-coded English would go stale the day the file is
 * translated.
 */

/* -------------------------------------------------------------------------- *
 * Locales
 * -------------------------------------------------------------------------- */

/**
 * The two locales this family runs in — 10's PR-5.10 row, verbatim: "the full
 * form journey runs on the two launch locales, not all three".
 *
 * The restriction is a decision, not an omission. `zh-Hant` differs from
 * `zh-Hans` only in glyphs at this point, and its form is covered by PR-3.6's
 * `@smoke` matrix, PR-8.6's visual matrix and one manual pass at PR-8.8. A
 * third row here would double the wall time to re-measure the same DOM.
 *
 * Written as a filter over `routing.locales` rather than as the list itself, so
 * a locale that leaves the enabled set (`D-10.12` may still withdraw `zh-Hant`,
 * and nothing stops the same happening to `zh-Hans`) is caught by the meta test
 * in `form.spec.ts` instead of silently halving the matrix.
 */
const LAUNCH_LOCALE_IDS: readonly string[] = ["en", "zh-Hans"];

export const LAUNCH_LOCALES: readonly Locale[] = routing.locales.filter((id) =>
  LAUNCH_LOCALE_IDS.includes(id),
);

/** How many locales {@link LAUNCH_LOCALES} must contain to be honest. */
export const EXPECTED_LAUNCH_LOCALE_COUNT = LAUNCH_LOCALE_IDS.length;

/* -------------------------------------------------------------------------- *
 * Copy and configuration, read from the content tree
 * -------------------------------------------------------------------------- */

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

type Tree = Record<string, unknown>;

function isTree(value: unknown): value is Tree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 02 `D-02.8`'s production deep-merge, in the six lines it takes. */
function deepMerge(base: Tree, override: Tree): Tree {
  const merged: Tree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = merged[key];
    merged[key] = isTree(existing) && isTree(value) ? deepMerge(existing, value) : value;
  }
  return merged;
}

function readNamespace(id: Locale, namespace: string): Tree {
  const path = join(REPO_ROOT, "content", id, "messages", `${namespace}.json`);
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  return isTree(parsed) ? parsed : {};
}

const VISIT_BY_LOCALE = new Map<Locale, Tree>();

/** The `visit` namespace as the running server resolves it for `id`. */
export function visitCopy(id: Locale): Tree {
  const cached = VISIT_BY_LOCALE.get(id);
  if (cached !== undefined) return cached;

  const reference = readNamespace(routing.defaultLocale, "visit");
  const tree =
    id === routing.defaultLocale ? reference : deepMerge(reference, readNamespace(id, "visit"));
  VISIT_BY_LOCALE.set(id, tree);
  return tree;
}

/**
 * One string out of a message tree, by dotted path.
 *
 * Throws rather than returning `undefined`, so a key renamed in 02 fails the
 * run at the assertion that reads it and not three lines later with an
 * "expected undefined" that names nothing.
 */
export function copy(tree: Tree, path: string): string {
  let node: unknown = tree;
  for (const segment of path.split(".")) {
    node = isTree(node) ? node[segment] : undefined;
  }
  if (typeof node !== "string") {
    throw new Error(`content/**/visit.json has no string at "${path}" — 02 renamed a key.`);
  }
  return node;
}

type SiteContact = {
  readonly email: string;
  readonly phone: string;
  readonly phoneDisplay: string;
};

/** `site.contact`, the three facts the two failure fallbacks print (07 `D-07.5`). */
export const SITE_CONTACT: SiteContact = (
  JSON.parse(readFileSync(join(REPO_ROOT, "content", "site.json"), "utf8")) as {
    readonly contact: SiteContact;
  }
).contact;

/* -------------------------------------------------------------------------- *
 * The Turnstile stub — see note (a) above
 * -------------------------------------------------------------------------- */

/** What the stubbed widget hands back. Any 1–2048 character string parses. */
export const STUB_TURNSTILE_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

const TURNSTILE_SCRIPT_PATTERN = new RegExp(
  `^${TURNSTILE_SCRIPT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
);

/**
 * The stub `window.turnstile`, as the source the route serves.
 *
 * Two behaviours are load-bearing rather than cosmetic.
 *
 * - **`execute` calls back on a later task**, not synchronously.
 *   `InquiryForm.awaitToken` calls `execute()` and *then* registers the waiter
 *   that resolves its promise, so a synchronous callback would land in an empty
 *   waiter list and the submission would sit out its twelve-second token wait.
 *   Cloudflare's own widget is asynchronous; so is this.
 * - **`reset` drops the token but keeps the widget**, so a retry after a forced
 *   failure mints a second token rather than reporting the challenge gone —
 *   which is what 07 §1's "re-executes on retry" asks the real widget for.
 */
const TURNSTILE_STUB_SOURCE = `
(() => {
  const widgets = new Map();
  let counter = 0;
  window.turnstile = {
    render(container, options) {
      const id = "gp-stub-" + String(++counter);
      widgets.set(id, options);
      container.setAttribute("data-turnstile-stub", id);
      return id;
    },
    execute(id) {
      const options = widgets.get(id);
      if (options === undefined) return;
      setTimeout(() => { options.callback(${JSON.stringify(STUB_TURNSTILE_TOKEN)}); }, 0);
    },
    reset() {},
    remove(id) { widgets.delete(id); },
  };
})();
`;

/**
 * Answer the lazily-loaded Turnstile script with {@link TURNSTILE_STUB_SOURCE}.
 *
 * Call it before the first navigation of every test that submits. The URL is
 * unchanged, so 06/09's `script-src` allowance for `challenges.cloudflare.com`
 * is exercised rather than bypassed.
 */
export async function stubTurnstile(page: Page): Promise<void> {
  await page.route(TURNSTILE_SCRIPT_PATTERN, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: TURNSTILE_STUB_SOURCE,
    });
  });
}

/* -------------------------------------------------------------------------- *
 * The form
 * -------------------------------------------------------------------------- */

/** Fixed and unlocalised (07 `D-07.1`), which is why it can be a literal here. */
export const INQUIRY_ENDPOINT = "/api/inquiry";

/** The `page.route` glob for the endpoint above. */
export const INQUIRY_ROUTE_GLOB = `**${INQUIRY_ENDPOINT}`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The one form on the site, wherever it is placed (07 `D-07.2`). */
export function inquiryForm(page: Page): Locator {
  return page.locator(`form[action="${INQUIRY_ENDPOINT}"]`);
}

export function control(form: Locator, name: string): Locator {
  return form.locator(`[name="${name}"]`);
}

export function submitButton(form: Locator): Locator {
  return form.locator("[data-inquiry-submit]");
}

export function successPanel(page: Page): Locator {
  return page.locator("[data-inquiry-success]");
}

/**
 * Load `/{id}`, scroll the Visit section into view and wait until the form is
 * *hydrated* rather than merely present.
 *
 * The barrier is `submissionId`, which 07 §1 makes a browser-only value: the
 * server renders the input empty and `InquiryForm`'s mount effect writes a UUID
 * into it. A non-empty, well-formed value therefore proves the client bundle
 * ran — which no `toBeVisible()` on server HTML can — and it is the same effect
 * that sets `noValidate`, so a test that got past this line is testing the
 * JavaScript path and not the progressive-enhancement one.
 */
export async function gotoForm(page: Page, id: Locale): Promise<Locator> {
  await page.goto(`/${id}#visit`);

  const form = inquiryForm(page);
  await expect(form).toBeAttached();
  await expect(control(form, "submissionId")).toHaveValue(UUID_PATTERN);
  await settleReveals(form);

  return form;
}

/**
 * Wait until every `Reveal` between the form and the document root has finished
 * its entrance.
 *
 * This is not tidiness. The Visit section fades in over the forest footer
 * ground, so while the card is at `opacity: 0.4` the *composited* colour of
 * every word inside it is a blend of the design's palette and a dark green —
 * and axe reads composited colours. A scan run one frame early reports the
 * privacy line as `#47593e` on `#52664c` at 1.21:1, a pair that exists nowhere
 * in 03 §10 and describes nothing anyone will ever see. Measuring geometry has
 * the same problem: a card mid-`translateY` gives a bounding box the 390 px
 * assertions would compare against the wrong number.
 *
 * The condition is scoped to the form's own ancestor chain rather than to
 * `document.getAnimations()`, because 05's ambient loops never finish by
 * design — a global "nothing is running" would wait forever.
 */
export async function settleReveals(form: Locator): Promise<void> {
  await form.scrollIntoViewIfNeeded();

  await form.page().waitForFunction((selector: string) => {
    const root = document.querySelector(selector);
    if (root === null) return false;

    for (let node: Element | null = root; node !== null; node = node.parentElement) {
      if (!node.matches("[data-reveal]")) continue;

      const style = getComputedStyle(node);
      if (style.opacity !== "1" || style.transform !== "none") return false;
      if (node.getAnimations().some((animation) => animation.playState === "running")) return false;
    }

    return true;
  }, `form[action="${INQUIRY_ENDPOINT}"]`);
}

/** A submission the shared schema accepts, in any locale. */
export type InquiryDraft = {
  readonly parentName: string;
  readonly email: string;
  readonly childAge: string;
  readonly desiredStart?: string;
  readonly message?: string;
};

/**
 * A valid draft. The name is non-ASCII on purpose: 07 §1 requires "any script
 * (CJK names pass)", and a rig that only ever typed `Ada` would never notice a
 * regression that narrowed the field to Latin.
 */
export const VALID_DRAFT: InquiryDraft = {
  parentName: "李美玲 Ada",
  email: "ada@example.test",
  childAge: CHILD_AGE_IDS[1],
  message: "We would like to visit on a weekday morning.",
};

export async function fillDraft(form: Locator, draft: InquiryDraft): Promise<void> {
  await control(form, "parentName").fill(draft.parentName);
  await control(form, "email").fill(draft.email);
  await control(form, "childAge").selectOption(draft.childAge);
  if (draft.desiredStart !== undefined) {
    await control(form, "desiredStart").selectOption(draft.desiredStart);
  }
  if (draft.message !== undefined) await control(form, "message").fill(draft.message);
}

/**
 * Wait out 07 §1's time-to-submit floor.
 *
 * `MIN_SUBMIT_MS` after the form mounted, `isBotSignal` stops answering true
 * for the clock — which is what lets a test attribute a decoy response to the
 * honeypot and nothing else. The wait is measured against the form's own
 * `startedAt`, not against a fixed sleep, so it costs only the time the page
 * has not already spent loading (`playwright/no-wait-for-timeout`).
 */
export async function passTimeToSubmitFloor(form: Locator): Promise<void> {
  const startedAt = Number(await control(form, "startedAt").inputValue());

  await form
    .page()
    .waitForFunction(
      ([mountedAt, floor]) => Date.now() - mountedAt >= floor,
      [startedAt, MIN_SUBMIT_MS] as const,
      { timeout: MIN_SUBMIT_MS * 3 },
    );
}

/** Type a value into the honeypot the way a naive bot would (07 §1's table). */
export async function fillHoneypot(form: Locator, value: string): Promise<void> {
  await control(form, HONEYPOT_FIELD).fill(value);
}

/* -------------------------------------------------------------------------- *
 * The live handler — see note (b) above
 * -------------------------------------------------------------------------- */

/** What the browser actually sent, captured by {@link forceInquiryResponse}. */
export type CapturedSubmission = { body: Record<string, unknown> | undefined };

/** One real round trip to `POST /api/inquiry`, both halves of it. */
export type LiveSubmission = {
  readonly status: number;
  /** The raw bytes, so `{ ok: true }` can be compared exactly (07 §2 step 3). */
  readonly text: string;
  readonly captured: CapturedSubmission;
};

/**
 * Wait for the running server's own answer to the next submission.
 *
 * Nothing is intercepted: the request leaves the browser, the Route Handler
 * runs, and both halves come back — the status and body the server chose, and
 * the request the *form* built, read off the same `Response` so the two cannot
 * disagree.
 *
 * Call it **before** the click. It registers the waiter first and returns the
 * promise, which is the only ordering in which a fast answer cannot be missed.
 */
export function awaitInquiryResponse(page: Page): Promise<LiveSubmission> {
  return page
    .waitForResponse(
      (response) =>
        response.url().endsWith(INQUIRY_ENDPOINT) && response.request().method() === "POST",
    )
    .then(async (response): Promise<LiveSubmission> => {
      const parsed: unknown = response.request().postDataJSON();
      return {
        status: response.status(),
        text: await response.text(),
        captured: { body: isTree(parsed) ? parsed : undefined },
      };
    });
}

/* -------------------------------------------------------------------------- *
 * Forcing a server answer — see note (b) above
 * -------------------------------------------------------------------------- */

/**
 * Intercept `POST /api/inquiry`, record the request, and answer with `body`.
 *
 * The recording half is what keeps a forced test honest: the response is ours,
 * but the *request* is the form's, so the assertions can still check that every
 * field 07 §1's table names arrived, spelled the way the handler parses it.
 */
export async function forceInquiryResponse(
  page: Page,
  status: number,
  body: unknown,
  options: { readonly deferUntil?: Promise<void> } = {},
): Promise<CapturedSubmission> {
  const captured: CapturedSubmission = { body: undefined };

  await page.route(INQUIRY_ROUTE_GLOB, async (route: Route) => {
    const parsed: unknown = route.request().postDataJSON();
    if (isTree(parsed)) captured.body = parsed;

    if (options.deferUntil !== undefined) await options.deferUntil;

    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  return captured;
}

/**
 * A promise plus the function that settles it.
 *
 * Used to hold `/api/inquiry` open for exactly as long as it takes to observe
 * the pending state (`D-07.4`: `aria-busy`, the swapped label, and a button
 * that is never `disabled`). Holding the response is the only way to make that
 * window deterministic; a fixed sleep would be both slower and flakier, and
 * `playwright/no-wait-for-timeout` rightly forbids it.
 */
export function gate(): { readonly opened: Promise<void>; open: () => void } {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

/**
 * Assert that a captured submission carries 07 §1's field set.
 *
 * Shared because three specs want it and because the interesting half is the
 * negative one — the honeypot must arrive *empty* from a page nobody filled it
 * on, and a token must be present, or the suite would be proving a form that
 * posts whatever it likes.
 */
export function expectWellFormedSubmission(
  captured: CapturedSubmission,
  id: Locale,
  draft: InquiryDraft,
): void {
  const body = captured.body;
  expect(body, "the form posted nothing to /api/inquiry").toBeDefined();
  if (body === undefined) return;

  for (const name of INQUIRY_FORM_FIELDS) {
    const expected = draft[name] ?? "";
    expect(body[name], `${name} did not travel with the submission`).toBe(expected);
  }

  expect(body["locale"]).toBe(id);
  expect(body["source"]).toBe("home");
  expect(String(body["submissionId"])).toMatch(UUID_PATTERN);
  expect(Number(body["startedAt"])).toBeGreaterThan(0);
  expect(body[HONEYPOT_FIELD], "the honeypot was sent filled by an unfilled form").toBe("");
  expect(String(body[TURNSTILE_TOKEN_FIELD]).length).toBeGreaterThan(0);
}
