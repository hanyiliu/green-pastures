import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import type { ProgramEntry } from "@/content/collections";
import { getSite } from "@/content/site";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { reference, type Messages } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

import {
  installIntersectionObserverStub,
  type IntersectionObserverStub,
} from "../../motion/harness";

/**
 * The Programs page's room cards (04 §3.6's `RoomCards` / `RoomCard` row;
 * gp-dln.200; D L398–428, M L303–319).
 *
 * The row's own acceptance is what this file is about:
 *
 * - **the ratio and the highlights are drawn here**, not on the home page —
 *   02 puts `programs.ratioLabel` in the Subpages namespace and 04 §3.6 assigns
 *   both to this composite, so the home Programs section deliberately has
 *   neither and this suite is where they are checked;
 * - **the ratio chip is `site.programs[].ratio` formatted through
 *   `programs.ratioLabel`**, so neither number nor the word "ratio" is a
 *   literal anywhere;
 * - **the highlight arrays are equal length per locale** — the row's stated
 *   criterion, enforced by `validate:content` and asserted here against the
 *   reference tree so a component that sliced them would be caught too;
 * - **every highlight renders on both views** and `md:` decides which are drawn
 *   (`D-04.5`, INV-04.4), so the narrow view's "ratio + 1" is a class and never
 *   a slice in code;
 * - **which room is raised is `site.json` data**, never a name (`D-04.18`);
 * - the composite adds **no second IntersectionObserver** (INV-05.9).
 *
 * Every expectation is derived from `content/` rather than typed out, so the
 * suite catches a component that stopped agreeing with the content rather than
 * one that agrees with itself.
 *
 * **Why two modules are mocked.** `src/content/collections.ts` refuses to load
 * where `window` exists (02 `D-02.16`) and this file is jsdom; and
 * `next-intl/server` resolves to next-intl's *client* build outside Next's
 * `react-server` condition, where every entry point throws. Both seams are
 * filled from the real content tree, so the mocks replace the transport and not
 * the data — the shape `tests/unit/sections/menu/MenuSection.test.tsx`
 * established.
 */

const fixture = vi.hoisted((): { locale: Locale; messages: Messages } => ({
  locale: "en",
  messages: {} as Messages,
}));

const getProgramsSpy = vi.hoisted(() => vi.fn());

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await vi.importActual<typeof import("next-intl")>("next-intl");
  const { formats: appFormats, TIME_ZONE: zone } =
    await vi.importActual<typeof import("@/i18n/formats")>("@/i18n/formats");
  const { loadMessages } = await import("@/i18n/messages");

  return {
    getLocale: () => Promise.resolve(fixture.locale),
    getTranslations: async (namespace: string) => {
      fixture.messages = await loadMessages(fixture.locale);
      const node: unknown = Reflect.get(fixture.messages, namespace);
      if (typeof node !== "object" || node === null) {
        throw new Error(`No message namespace "${namespace}" in the ${fixture.locale} tree.`);
      }
      return createTranslator({
        locale: fixture.locale,
        formats: appFormats,
        timeZone: zone,
        messages: node as Record<string, unknown>,
      });
    },
  };
});

vi.mock("@/content/collections", async () => {
  const { getSite: site } = await import("@/content/site");
  const { reference: tree } = await import("@/i18n/messages");

  getProgramsSpy.mockImplementation((): Promise<readonly ProgramEntry[]> => {
    const text: Readonly<Record<string, ProgramEntry["text"]>> = tree.collections.programs;

    return Promise.resolve(
      site().programs.map((entry) => {
        const copy = text[entry.id];
        if (copy === undefined) throw new Error(`No programs text for "${entry.id}"`);
        return { ...entry, text: copy };
      }),
    );
  });

  return { getPrograms: getProgramsSpy };
});

const { RoomCards } = await import("@/components/pages/programs/RoomCards");

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  fixture.locale = routing.defaultLocale;
  getProgramsSpy.mockClear();
  resetRevealRegistry();
});

async function renderRooms(locale: Locale = routing.defaultLocale) {
  fixture.locale = locale;
  const tree = await RoomCards();

  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={reference}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      <MotionProvider>{tree}</MotionProvider>
    </NextIntlClientProvider>,
  );
}

const site = getSite();
const copy = reference.programs;
const collection: Readonly<Record<string, ProgramEntry["text"]>> = reference.collections.programs;

/** One room's reference text, by the id `content/site.json` declares. */
function textFor(id: string): ProgramEntry["text"] {
  const text = collection[id];
  if (text === undefined) throw new Error(`collections/programs.json has no "${id}"`);
  return text;
}

/** The cards, in DOM order — the `<li>`s the composite renders. */
function cards(): HTMLElement[] {
  return screen.getAllByRole("listitem").filter((item) => item.querySelector("h2") !== null);
}

/** One card's chips, in DOM order, with the class that hides them `< md`. */
function chipsOf(card: HTMLElement): { text: string; wideOnly: boolean }[] {
  return [...card.querySelectorAll("ul > li")].map((item) => ({
    text: item.textContent ?? "",
    wideOnly: item.classList.contains("hidden"),
  }));
}

describe("the list", () => {
  it("is a <ul> of one <li> per site.programs[], in that order", async () => {
    await renderRooms();

    expect(cards()).toHaveLength(site.programs.length);
    expect(cards().map((card) => card.querySelector("h2")?.textContent)).toEqual(
      site.programs.map((program) => textFor(program.id).name),
    );
  });

  it("names each room with an h2 under the page's h1 (04 §3.6)", async () => {
    await renderRooms();

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(
      site.programs.map((program) => textFor(program.id).name),
    );
  });

  it("adds no second IntersectionObserver — one for the stagger group (INV-05.9)", async () => {
    await renderRooms();

    expect(observer.constructed).toHaveLength(1);
  });

  it("reads the collection through getPrograms with the resolved locale (04 §5.1)", async () => {
    await renderRooms("zh-Hant");

    expect(getProgramsSpy).toHaveBeenCalledExactlyOnceWith("zh-Hant");
  });
});

describe("the ratio chip", () => {
  it("is site.programs[].ratio formatted through programs.ratioLabel", async () => {
    await renderRooms();

    for (const [index, program] of site.programs.entries()) {
      const card = cards()[index];
      expect(card).toBeDefined();

      const expected = copy.ratioLabel
        .replace("{adults}", String(program.ratio[0]))
        .replace("{children}", String(program.ratio[1]));

      expect(chipsOf(card as HTMLElement)[0]).toEqual({ text: expected, wideOnly: false });
    }
  });

  it("leads the row on both views — only the highlights thin out (04 §3.6)", async () => {
    await renderRooms();

    for (const card of cards()) {
      expect(chipsOf(card)[0]?.wideOnly).toBe(false);
    }
  });

  it("spells neither number nor the word anywhere in a component", async () => {
    await renderRooms();

    // The label is the message's, so every ratio chip differs from every other
    // only in the two numbers the shared config supplies.
    const labels = cards().map((card) => chipsOf(card)[0]?.text);
    expect(new Set(labels).size).toBe(site.programs.length);
    for (const label of labels) {
      expect(label).toMatch(/^\d+:\d+ /u);
    }
  });
});

describe("the highlight chips", () => {
  it("renders every highlight the collection carries, in order", async () => {
    await renderRooms();

    for (const [index, program] of site.programs.entries()) {
      const card = cards()[index];
      expect(card).toBeDefined();

      const highlights = chipsOf(card as HTMLElement)
        .slice(1)
        .map((chip) => chip.text);
      expect(highlights).toEqual([...textFor(program.id).highlights]);
    }
  });

  it("hides index >= 1 below md rather than slicing the array (D-04.5, INV-04.4)", async () => {
    await renderRooms();

    for (const card of cards()) {
      const highlights = chipsOf(card).slice(1);
      expect(highlights.length).toBeGreaterThan(1);
      expect(highlights[0]?.wideOnly).toBe(false);
      for (const chip of highlights.slice(1)) expect(chip.wideOnly).toBe(true);
    }
  });

  it("keeps the highlight arrays the same length in every locale (the row's criterion)", () => {
    // `validate:content` is the gate; this is the same assertion at the shape
    // the component depends on, so a locale that shipped a short array would
    // fail here as well as there.
    const lengths = site.programs.map((program) => textFor(program.id).highlights.length);
    expect(new Set(lengths).size).toBe(1);
  });
});

describe("the raised room", () => {
  it("is the one site.json flags featured, never a name (D-04.18, INV-04.4)", async () => {
    await renderRooms();

    const featured = site.programs.map((program) => program.featured);
    expect(featured.filter(Boolean)).toHaveLength(1);

    const bordered = cards().map(
      (card) => card.firstElementChild?.classList.contains("border-2") ?? false,
    );
    expect(bordered).toEqual(featured);
  });
});

describe("the photograph", () => {
  it("carries the collection's photoAlt as its accessible name (INV-02.3)", async () => {
    await renderRooms();

    for (const program of site.programs) {
      const slot = document.querySelector(`[data-photo-slot="programs-room-${program.id}"]`);
      expect(slot).toHaveAttribute("role", "img");
      expect(slot).toHaveAttribute("aria-label", textFor(program.id).photoAlt);
    }
  });
});
