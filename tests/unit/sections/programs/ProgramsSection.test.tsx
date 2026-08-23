import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { getSite } from "@/content/site";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { loadMessages, reference, type Messages } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

import {
  installIntersectionObserverStub,
  type IntersectionObserverStub,
} from "../../motion/harness";

/**
 * The Programs section shell (04 §3.5, §4, §7; 05 §5.3).
 *
 * `StonePath.test.tsx` owns the stones; this file owns everything around them —
 * the landmark, the header, the link out and the sun — plus the one structural
 * fact that is new to this section and true of five more to come: it is an
 * **async Server Component**, because `collections.programs` reaches it through
 * `getPrograms()` and the locale through `getLocale()` (04 §2's data flow).
 * `render(await ProgramsSection())` is what that costs a unit test.
 *
 * ── Why two modules are mocked, and what is still real ───────────────────
 *
 * `next-intl/server` has no request context outside a Next build, so it is
 * replaced by `createTranslator` over the **real** message tree — every string
 * asserted below is the one `content/` carries, in the locale under test.
 * `src/content/collections.ts` throws on import in a browser (02 `D-02.16`), so
 * its join is replayed here over the real `site.json` and the real collection
 * files; the loader's own behaviour is covered by
 * `tests/unit/content/loaders.test.ts`.
 *
 * Both trees are assembled the way **production** assembles them, which is the
 * branch that merges a locale over `en` (02 `D-02.8`) — and the reason
 * `zh-Hans`, whose `collections/programs.json` is still `{}`, renders three
 * complete stones instead of three `⟦…⟧` markers.
 */

/**
 * What the three mocks read. `vi.hoisted` runs before this file's imports, so
 * the seed values cannot come from `routing` — `beforeEach` and
 * {@link renderSection} replace them before anything renders.
 */
type MockState = {
  locale: Locale;
  messages: Messages | undefined;
  pathname: string;
};

const state = vi.hoisted<MockState>(() => ({
  locale: "en",
  messages: undefined,
  pathname: "/",
}));

vi.mock("@/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/navigation")>();
  return { ...actual, usePathname: () => state.pathname };
});

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { formats: named, TIME_ZONE: zone } = await import("@/i18n/formats");
  return {
    getLocale: () => Promise.resolve(state.locale),
    getTranslations: (namespace: "home.programs") =>
      Promise.resolve(
        createTranslator({
          locale: state.locale,
          messages: state.messages,
          namespace,
          formats: named,
          timeZone: zone,
        }),
      ),
  };
});

vi.mock("@/content/collections", async () => {
  const { getSite: site } = await import("@/content/site");
  return {
    getPrograms: () =>
      Promise.resolve(
        site().programs.map((programme) => ({
          ...programme,
          text: (state.messages as Messages).collections.programs[
            programme.id as keyof Messages["collections"]["programs"]
          ],
        })),
      ),
  };
});

const { default: ProgramsSection } = await import("@/components/sections/programs/ProgramsSection");

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  state.locale = routing.defaultLocale;
  state.messages = reference;
  state.pathname = "/";
  resetRevealRegistry();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** The tree production would assemble for a locale (02 `D-02.8`). */
async function productionMessages(locale: Locale): Promise<Messages> {
  vi.stubEnv("NODE_ENV", "production");
  const tree = await loadMessages(locale);
  vi.unstubAllEnvs();
  return tree;
}

async function renderSection(locale: Locale = routing.defaultLocale) {
  state.locale = locale;
  state.messages = await productionMessages(locale);

  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={state.messages}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      <MotionProvider>{await ProgramsSection()}</MotionProvider>
    </NextIntlClientProvider>,
  );
}

const copy = reference.home.programs;

/* -------------------------------------------------------------------------- *
 * The shell (INV-04.8, 04 §7)
 * -------------------------------------------------------------------------- */

describe("the section shell", () => {
  it("is the `programs` section, labelled by its own h2", async () => {
    const { container } = await renderSection();

    const section = container.querySelector("section");
    expect(section).toHaveAttribute("id", "programs");
    expect(section).toHaveAttribute("data-section", "programs");
    expect(section).toHaveAttribute("aria-labelledby", "programs-title");

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveAttribute("id", "programs-title");
    expect(heading).toHaveTextContent(copy.title);
  });

  it("takes its id from `site.routes[].homeAnchor` rather than a typed literal", () => {
    const route = getSite().routes.find((entry) => entry.id === "programs");
    expect(route?.homeAnchor).toBe("programs");
  });

  it("renders the eyebrow and keeps the intro to the wide view (04 §4)", async () => {
    await renderSection();

    expect(screen.getByText(copy.eyebrow)).toHaveClass("uppercase");
    expect(screen.getByText(copy.intro)).toHaveClass("hidden", "md:block");
  });
});

/* -------------------------------------------------------------------------- *
 * The link out (04 §3.2, 02 §5.4)
 * -------------------------------------------------------------------------- */

describe("the link", () => {
  it("resolves the Programs route from `site.json` and keeps the arrow in the string", async () => {
    await renderSection();

    const route = getSite().routes.find((entry) => entry.id === "programs");
    const link = screen.getByRole("link", { name: copy.link });

    expect(link).toHaveAttribute("href", `/${routing.defaultLocale}${route?.path ?? ""}`);
    expect(copy.link).toContain("→");
  });

  it("sits 28px under the path and 38px on the wide view", async () => {
    const { container } = await renderSection();

    const row = container.querySelector('[data-reveal-id="programs.link"]');
    expect(row).toHaveClass("mt-7", "text-center", "md:mt-9.5");
  });
});

/* -------------------------------------------------------------------------- *
 * Decoration (04 §3.4, INV-04.5, 05 §5.4)
 * -------------------------------------------------------------------------- */

describe("the decoration layer", () => {
  it("hangs one still sun in the top-right corner, on the wide view only", async () => {
    await renderSection();

    const sun = document.getElementById("deco-programs-sun");
    expect(sun).toHaveAttribute("data-deco", "deco-programs-sun");
    expect(sun).toHaveAttribute("aria-hidden");
    expect(sun).toHaveClass("absolute", "top-10", "right-12.5", "opacity-55", "hidden", "md:block");

    // 05 §5.4: only the hero's sun turns, so this one carries no `.loop`.
    const svg = sun?.querySelector("svg");
    expect(svg).toHaveClass("size-25");
    expect(svg).not.toHaveClass("loop");
  });
});

/* -------------------------------------------------------------------------- *
 * Motion (05 §5.3, INV-04.9, INV-05.9)
 * -------------------------------------------------------------------------- */

describe("the entrances", () => {
  it("reveals the header, the stones and the link, on one pooled observer", async () => {
    const { container } = await renderSection();

    for (const id of ["programs.header", "programs.stones", "programs.link"]) {
      expect(container.querySelector(`[data-reveal-id="${id}"]`)).not.toBeNull();
    }

    expect(observer.observedCount()).toBe(3);
    const options = observer.constructed.map((entry) => JSON.stringify(entry));
    expect(new Set(options).size).toBeLessThanOrEqual(1);
  });
});

/* -------------------------------------------------------------------------- *
 * Locales (04 §8, INV-02.9)
 * -------------------------------------------------------------------------- */

describe("every enabled locale", () => {
  it("renders its own words with no branch in the component", async () => {
    for (const locale of routing.locales) {
      const tree = await productionMessages(locale);
      const { unmount } = await renderSection(locale);

      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(tree.home.programs.title);
      expect(screen.getByRole("link", { name: tree.home.programs.link })).toHaveAttribute(
        "href",
        `/${locale}/programs`,
      );
      expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(getSite().programs.length);

      unmount();
      resetRevealRegistry();
    }
  });
});
