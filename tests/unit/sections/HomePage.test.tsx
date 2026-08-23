// @vitest-environment node
import { NextIntlClientProvider } from "next-intl";
import { prerender } from "react-dom/static";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { SECTION_IDS } from "@/components/layout/Section";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { loadMessages, type Messages } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

/**
 * The home route's composition (04 §1, §2; 05 §5.7, §5.8; INV-04.8).
 *
 * ── What this suite is for ───────────────────────────────────────────────
 *
 * Every section has its own suite; this one owns only the facts that belong
 * to *the page* and that no section can see from inside itself:
 *
 * - the page renders **its own `<main id="main">`**, the landmark the layout's
 *   skip link targets — the layout deliberately renders none (04 §1);
 * - that `<main>` carries **`data-snap-root`**, which opts the home page, and
 *   only the home page, into scroll snapping (05 §5.8);
 * - `PageTransition` wraps **one element**, not a fragment of siblings, or the
 *   browser has several boxes to name and the subpage slide stops meaning
 *   anything (05 `D-05.10`);
 * - the composed page has **exactly one `<h1>`** (INV-04.8) and its sections
 *   appear **in `SECTION_IDS` order** — the two facts that are true of the
 *   assembled route and false of every part of it.
 *
 * The last two are the reason this file may not mock the sections. A suite
 * that stubs each section until the only `<h1>` left is its own stub asserts
 * nothing; the sections render for real here, which is what makes a Phase-5
 * row that ships a second `<h1>`, or slots itself in at the wrong place, fail
 * on the pull request that adds it rather than in review.
 *
 * ── Why this is a server render, not `@testing-library/react` ────────────
 *
 * The route is a Server Component tree whose sections are `async`: they await
 * `src/content/collections.ts`, which joins `site.json`'s shared ids with this
 * locale's text (02 `D-02.11`). Two consequences follow, and the earlier jsdom
 * shape of this file could survive neither:
 *
 * - `collections.ts` **throws on import when `window` is defined** — 02
 *   `D-02.16`'s server-only guard, whose own docblock says a test that needs
 *   the module must run under `// @vitest-environment node`. So: node.
 * - an `async` component is not renderable by the client renderer at all.
 *   `render()` and `renderToStaticMarkup` both give up on it — the latter
 *   throws "A component suspended while responding to synchronous input".
 *   `react-dom/static`'s `prerender` awaits the tree and resolves with the
 *   finished markup, which is also what the crawler and the first paint get.
 *
 * Asserting on that markup rather than on a DOM is not a downgrade: what the
 * page is *for* here is its shape, and the shape is in the HTML.
 *
 * ── The two shims, and why neither hides anything ────────────────────────
 *
 * `ViewTransition` is not exported by the published `react` package at any
 * 19.x version — it comes from the canary build Next vendors and aliases at
 * build time — so Vitest resolves an `undefined` element type.
 * `tests/unit/motion/PageTransition.test.tsx` documents the same mock and
 * asserts the transition-type map; here the component only has to render its
 * child, and the wrapper it renders instead is what lets the single-child
 * assertion see the boundary.
 *
 * `next-intl/server` resolves to next-intl's *client* build outside Next's
 * `react-server` condition, and every entry point in it is a hard throw
 * ("`getTranslations` is not supported in Client Components"). Its real build
 * reads the request scope through `next/root-params`, which is a compiler
 * placeholder that throws when imported outside a Next build. So the shim
 * below is the only way an async section renders here at all — and it is a
 * delegation rather than a fake: `createTranslator` and `createFormatter` are
 * next-intl's own, given this locale's real message tree, `src/i18n/formats.ts`
 * and the marker fallback `src/i18n/request.ts` installs. The copy a section
 * renders through it is the copy production renders.
 */

/**
 * What the shim below answers with. Hoisted, because `vi.mock`'s factory runs
 * before this module's imports do; {@link renderHome} sets it per render.
 */
const intl = vi.hoisted((): { locale: Locale; messages: Messages } => ({
  locale: "en",
  messages: {} as Messages,
}));

/**
 * 02 `D-02.8` / INV-02.8 — the loud marker, spelled as `src/i18n/request.ts`
 * spells it. Both halves of the tree get it, so "no `⟦`" below is a claim
 * about the whole page and not only about its client subtree. (A marker
 * raised inside the shim names the key relative to its namespace, because the
 * shim scopes the tree rather than passing a namespace; the bracket, which is
 * what is asserted, is the same.)
 */
function getMessageFallback({ namespace, key }: { namespace?: string; key: string }): string {
  return `⟦${[namespace, key].filter(Boolean).join(".")}⟧`;
}

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    ViewTransition: ({ children }: { children?: ReactNode }) =>
      actual.createElement("div", { "data-testid": "view-transition" }, children),
  };
});

vi.mock("next-intl/server", async () => {
  const { createFormatter: create, createTranslator: translator } =
    await vi.importActual<typeof import("next-intl")>("next-intl");
  const { formats: appFormats, TIME_ZONE: zone } =
    await vi.importActual<typeof import("@/i18n/formats")>("@/i18n/formats");

  const isTree = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  /**
   * next-intl resolves a `namespace` by walking the message tree, and it types
   * that walk with generics only its own module can spell. Walking the tree
   * first and handing over the sub-tree is the same operation without them:
   * `getTranslations("home.gallery")` and a translator built on
   * `messages.home.gallery` answer every key identically. A namespace that
   * does not exist throws here, as it does in a Server Component.
   */
  const scoped = (namespace?: string): Record<string, unknown> => {
    let node: Record<string, unknown> = intl.messages;
    for (const key of namespace === undefined ? [] : namespace.split(".")) {
      const child = node[key];
      if (!isTree(child)) {
        throw new Error(`No message namespace "${namespace ?? ""}" in the ${intl.locale} tree.`);
      }
      node = child;
    }
    return node;
  };

  const shared = () => ({ locale: intl.locale, formats: appFormats, timeZone: zone });

  // Both call shapes a section may use — `getTranslations("home.gallery")` and
  // `getTranslations({ locale, namespace })`.
  type Options = string | { locale?: Locale; namespace?: string };

  return {
    getLocale: () => Promise.resolve(intl.locale),
    getMessages: () => Promise.resolve(intl.messages),
    getTimeZone: () => Promise.resolve(zone),
    getFormats: () => Promise.resolve(appFormats),
    getNow: () => Promise.resolve(new Date()),
    getFormatter: () => Promise.resolve(create(shared())),
    getTranslations: (options?: Options) =>
      Promise.resolve(
        translator({
          ...shared(),
          messages: scoped(typeof options === "object" ? options.namespace : options),
          getMessageFallback,
        }),
      ),
  };
});

vi.mock("@/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/navigation")>();
  return { ...actual, usePathname: () => "/" };
});

const { default: HomePage } = await import("@/app/[locale]/page");

beforeEach(() => {
  resetRevealRegistry();
});

/* -------------------------------------------------------------------------- *
 * Rendering
 * -------------------------------------------------------------------------- */

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let html = "";
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    html += decoder.decode(chunk, { stream: true });
  }
  return html + decoder.decode();
}

/**
 * The page, rendered the way the server renders it, inside the two providers
 * `app/[locale]/layout.tsx` supplies. The message tree is the one production
 * assembles for this locale — deep-merged over `en` (02 `D-02.8`).
 */
async function renderHome(locale: Locale = routing.defaultLocale): Promise<string> {
  vi.stubEnv("NODE_ENV", "production");
  const messages: Messages = await loadMessages(locale);
  vi.unstubAllEnvs();

  intl.locale = locale;
  intl.messages = messages;

  const { prelude } = await prerender(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      formats={formats}
      timeZone={TIME_ZONE}
      getMessageFallback={getMessageFallback}
    >
      <MotionProvider>
        <HomePage />
      </MotionProvider>
    </NextIntlClientProvider>,
  );

  return drain(prelude);
}

/** Every `<h1 …>` open tag in the markup. */
function headings(html: string): readonly string[] {
  return [...html.matchAll(/<h1(?=[\s>])/gu)].map((match) => match[0]);
}

/** The `data-section` value of every section shell, in document order. */
function sectionIds(html: string): readonly string[] {
  return [...html.matchAll(/<section\b[^>]*\sdata-section="([^"]+)"/gu)].map(
    (match) => match[1] ?? "",
  );
}

/* -------------------------------------------------------------------------- *
 * The landmark and the snap root (04 §1, 05 §5.8)
 * -------------------------------------------------------------------------- */

describe("the home page", () => {
  it("renders the skip link's target as its own landmark", async () => {
    const html = await renderHome();

    expect([...html.matchAll(/<main(?=[\s>])/gu)]).toHaveLength(1);
    expect(html).toMatch(/<main\b[^>]*\sid="main"/u);
  });

  it("opts into scroll snapping with data-snap-root (05 §5.8)", async () => {
    const html = await renderHome();

    expect(html).toMatch(/<main\b[^>]*\sdata-snap-root(?=[\s=>])/u);
  });

  it("gives PageTransition a single element to snapshot", async () => {
    const html = await renderHome();

    // The wrapper opens, the `<main>` opens immediately after it, and the
    // wrapper closes on the `</main>` — no sibling on either side.
    expect(html).toMatch(/<div data-testid="view-transition"><main\b/u);
    expect(html).toMatch(/<\/main><\/div>/u);
  });
});

/* -------------------------------------------------------------------------- *
 * The composition (INV-04.8, 04 §1)
 * -------------------------------------------------------------------------- */

describe("the composed page", () => {
  it("has exactly one h1, wherever the sections put it (INV-04.8)", async () => {
    const html = await renderHome();

    expect(headings(html)).toHaveLength(1);
  });

  it("opens with the hero", async () => {
    const html = await renderHome();

    expect(sectionIds(html)[0]).toBe(SECTION_IDS[0]);
  });

  it("lays its sections out in SECTION_IDS order, whichever have landed", async () => {
    const rendered = sectionIds(await renderHome());

    // Not every id is built yet, so the claim is the durable half: the ids the
    // page *does* render are a subsequence of the declared order, and none is
    // a stranger or a duplicate.
    expect(new Set(rendered).size).toBe(rendered.length);
    for (const id of rendered) expect(SECTION_IDS).toContain(id);
    expect(rendered).toStrictEqual(SECTION_IDS.filter((id) => rendered.includes(id)));
  });
});

/* -------------------------------------------------------------------------- *
 * Every locale (04 §8, INV-02.8)
 * -------------------------------------------------------------------------- */

describe("every id in routing.locales", () => {
  it.each(routing.locales)("renders %s with one h1 and no missing-key marker", async (locale) => {
    const html = await renderHome(locale);

    expect(headings(html)).toHaveLength(1);
    expect(html).not.toContain("⟦");
  });
});
