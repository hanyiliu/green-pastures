// @vitest-environment node
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { getSite } from "@/content/site";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { loadMessages, type Messages } from "@/i18n/messages";
import { LOCALE_META, routing, type Locale } from "@/i18n/routing";

/**
 * The two routes this row ships — `/{locale}/programs` (gp-dln.200) and
 * `/{locale}/menu` (gp-dln.201) — as *routes* rather than as composites.
 *
 * The composites have their own suites; this one owns only what belongs to the
 * page and what no composite can see from inside itself:
 *
 * - the shell chain 04 §1 and 06 §6.2 spell — `PageTransition` wrapping **one**
 *   element, `SubpageBar` inside it, and the `<main id="main">` the layout's
 *   skip link targets and deliberately does not render itself;
 * - **no `data-snap-root`**: scroll snapping is the home page's alone (05 §5.8),
 *   and a detail page that copied the attribute would snap its own sections;
 * - **exactly one `<h1>`** per page (INV-04.8) — the composites render `h2`s,
 *   so a composite that promoted one would fail here;
 * - **`generateMetadata` is one `buildMetadata` call** (06 `D-06.10`,
 *   INV-06.3): the canonical is the locale-prefixed `site.routes[].path`, the
 *   alternates are one entry per enabled locale plus `x-default`, and the copy
 *   is the page namespace's own `meta.*`;
 * - **the Menu page reads no clock.** The home Menu section's "today" is frozen
 *   at build time because the page is statically prerendered (06 `D-06.4`);
 *   this route sidesteps that entirely by never asking, which the two-instant
 *   render below is what actually demonstrates.
 *
 * ── Why this is a server render in the node environment ─────────────────
 *
 * The same two reasons `tests/unit/sections/HomePage.test.tsx` gives, and its
 * shape is followed here: `src/content/collections.ts` throws on import where
 * `window` is defined (02 `D-02.16`), and an `async` Server Component is not
 * renderable by the client renderer at all — `react-dom/static`'s `prerender`
 * awaits the tree and resolves with the markup the crawler and the first paint
 * get. Nothing is mocked but the two shims that file documents: React's
 * `ViewTransition`, which the published `react` package does not export, and
 * `next-intl/server`, whose non-`react-server` build is a hard throw. The
 * collections, the message tree and `content/site.json` are all real.
 */

const intl = vi.hoisted((): { locale: Locale; messages: Messages } => ({
  locale: "en",
  messages: {} as Messages,
}));

/** 02 `D-02.8` / INV-02.8 — the loud marker, as `src/i18n/request.ts` spells it. */
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
  const { createFormatter, createTranslator } =
    await vi.importActual<typeof import("next-intl")>("next-intl");
  const { formats: appFormats, TIME_ZONE: zone } =
    await vi.importActual<typeof import("@/i18n/formats")>("@/i18n/formats");

  const isTree = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

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
  type Options = string | { locale?: Locale; namespace?: string };

  return {
    getLocale: () => Promise.resolve(intl.locale),
    getMessages: () => Promise.resolve(intl.messages),
    getTimeZone: () => Promise.resolve(zone),
    getFormats: () => Promise.resolve(appFormats),
    getNow: () => Promise.resolve(new Date()),
    getFormatter: () => Promise.resolve(createFormatter(shared())),
    getTranslations: (options?: Options) =>
      Promise.resolve(
        createTranslator({
          ...shared(),
          messages: scoped(typeof options === "object" ? options.namespace : options),
          getMessageFallback,
        }),
      ),
  };
});

const programs = await import("@/app/[locale]/programs/page");
const menu = await import("@/app/[locale]/menu/page");

const ROUTES = [
  { id: "programs", page: programs.default, generateMetadata: programs.generateMetadata },
  { id: "menu", page: menu.default, generateMetadata: menu.generateMetadata },
] as const;

beforeEach(() => {
  resetRevealRegistry();
});

afterEach(() => {
  vi.useRealTimers();
});

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let html = "";
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    html += decoder.decode(chunk, { stream: true });
  }
  return html + decoder.decode();
}

/** One route, rendered the way the server renders it, inside the layout's providers. */
async function renderRoute(
  Page: () => Promise<ReactNode>,
  locale: Locale = routing.defaultLocale,
): Promise<string> {
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
      <MotionProvider>{await Page()}</MotionProvider>
    </NextIntlClientProvider>,
  );

  return drain(prelude);
}

/** Every `<h1 …>` open tag in the markup. */
function headings(html: string): readonly string[] {
  return [...html.matchAll(/<h1(?=[\s>])/gu)].map((match) => match[0]);
}

const site = getSite();

/**
 * Content text as it appears in the markup.
 *
 * React escapes `&` and the quote characters on the way out, so a dish called
 * "Apple slices & cheese" is `Apple slices &amp; cheese` in the HTML and a
 * plain `toContain` on the JSON value never matches. Escaping the *expectation*
 * rather than unescaping the markup keeps the assertion pointed at what the
 * browser actually receives.
 */
function asMarkup(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#x27;");
}

function pathOf(id: string): string {
  const route = site.routes.find((entry) => entry.id === id);
  if (route === undefined) throw new Error(`content/site.json has no routes[] entry "${id}"`);
  return route.path;
}

/* -------------------------------------------------------------------------- *
 * The shell chain (04 §1, 06 §6.2, 05 D-05.10)
 * -------------------------------------------------------------------------- */

describe.each(ROUTES)("the $id route", ({ id, page, generateMetadata }) => {
  it("wraps the page in PageTransition and puts SubpageBar inside it", async () => {
    const html = await renderRoute(page);

    expect(html).toContain('data-testid="view-transition"');
    expect(html).toContain(`data-subpage="${id}"`);
    expect(html.indexOf('data-testid="view-transition"')).toBeLessThan(
      html.indexOf(`data-subpage="${id}"`),
    );
  });

  it("renders the skip link's landmark, and only one", async () => {
    const html = await renderRoute(page);

    expect([...html.matchAll(/<main\b/gu)]).toHaveLength(1);
    expect(html).toContain('id="main"');
  });

  it("never carries data-snap-root — snapping is the home page's alone (05 §5.8)", async () => {
    const html = await renderRoute(page);

    expect(html).not.toContain("data-snap-root");
  });

  it("has exactly one h1 (INV-04.8)", async () => {
    const html = await renderRoute(page);

    expect(headings(html)).toHaveLength(1);
    expect(html).toContain(`id="${id}-title"`);
  });

  it("renders no missing-key marker in any locale (02 D-02.8)", async () => {
    for (const locale of routing.locales) {
      resetRevealRegistry();
      expect(await renderRoute(page, locale)).not.toContain("⟦");
    }
  });

  /* ------------------------------------------------------------------ *
   * Metadata (06 D-06.10, INV-06.3)
   * ------------------------------------------------------------------ */

  it("publishes the canonical site.routes[] path, prefixed with the locale", async () => {
    for (const locale of routing.locales) {
      intl.locale = locale;
      const meta = await generateMetadata();

      expect(meta.alternates?.canonical).toBe(`/${locale}${pathOf(id)}`);
    }
  });

  it("publishes one hreflang per enabled locale plus x-default", async () => {
    intl.locale = routing.defaultLocale;
    const meta = await generateMetadata();
    const languages = meta.alternates?.languages ?? {};

    expect(Object.keys(languages).sort()).toEqual(
      [...routing.locales.map((locale) => LOCALE_META[locale].hreflang), "x-default"].sort(),
    );
    expect(languages["x-default"]).toBe(`/${routing.defaultLocale}${pathOf(id)}`);
  });

  it("takes its title and description from the page namespace's own meta.*", async () => {
    intl.locale = routing.defaultLocale;
    intl.messages = await loadMessages(routing.defaultLocale);

    const meta = await generateMetadata();
    const namespace: { meta: { title: string; description: string } } = intl.messages[id];

    expect(meta.title).toBe(namespace.meta.title);
    expect(meta.description).toBe(namespace.meta.description);
  });
});

/* -------------------------------------------------------------------------- *
 * The Programs page's own row (gp-dln.200)
 * -------------------------------------------------------------------------- */

describe("the Programs page", () => {
  it("draws one card per site.programs[] and closes with the footnote", async () => {
    const html = await renderRoute(programs.default);

    for (const program of site.programs) {
      expect(html).toContain(`data-photo-slot="programs-room-${program.id}"`);
    }
    expect(html).toContain(asMarkup(intl.messages.programs.footnote));
  });
});

/* -------------------------------------------------------------------------- *
 * The Menu page's own row (gp-dln.201)
 * -------------------------------------------------------------------------- */

describe("the Menu page", () => {
  it("renders both structures — the table and the day cards (D-04.11)", async () => {
    const html = await renderRoute(menu.default);

    expect([...html.matchAll(/<table\b/gu)]).toHaveLength(1);
    // One `<section>` per day, each carrying its own id — the attribute rather
    // than the tag, because React writes `aria-labelledby` first.
    expect([...html.matchAll(/<section\b/gu)]).toHaveLength(site.menu.days.length);
    for (const day of site.menu.days) expect(html).toContain(`data-day="${day}"`);
  });

  it("draws every cell of the sample week in each structure", async () => {
    const html = await renderRoute(menu.default);
    const week: Readonly<Record<string, Readonly<Record<string, string>>>> =
      intl.messages.collections.menu.week;

    for (const day of site.menu.days) {
      for (const meal of site.menu.meals) {
        const dish = week[day]?.[meal];
        expect(dish).toBeDefined();
        // Once in the table, once in that day's card — `D-04.11`'s stated cost.
        expect([...html.matchAll(pattern(asMarkup(dish ?? "")))]).toHaveLength(2);
      }
    }
  });

  it("shows all three dietary chips, where the home section shows the onHome two", async () => {
    const html = await renderRoute(menu.default);
    const dietary: Readonly<Record<string, { label: string }>> =
      intl.messages.collections.menu.dietary;

    expect(site.menu.dietary.filter((entry) => entry.onHome).length).toBeLessThan(
      site.menu.dietary.length,
    );
    for (const entry of site.menu.dietary) {
      expect(html).toContain(asMarkup(dietary[entry.id]?.label ?? ""));
    }
  });

  /**
   * The frozen-day tension, from the other side.
   *
   * `defaultMenuDay()` on the *home* page answers with the day the build ran,
   * and stays there until the next deployment — a known, filed consequence of
   * 06 `D-06.4`'s build-time prerender, not something to fix here. This route
   * has no such property because it never asks what day it is: `weekdayDate()`
   * runs the derivation the other way, from a day id to a fixed anchor date
   * whose only readable property is its weekday. Two renders six months apart
   * therefore produce byte-identical markup.
   */
  it("reads no clock — six months apart is the same markup", async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 1, 14, 12), toFake: ["Date"] });
    const winter = await renderRoute(menu.default);

    resetRevealRegistry();
    vi.setSystemTime(Date.UTC(2026, 7, 22, 12)); // a Saturday, six months on
    const summer = await renderRoute(menu.default);

    expect(summer).toBe(winter);
  });
});

/** One dish, as a global `RegExp` that matches it literally. */
function pattern(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "gu");
}
