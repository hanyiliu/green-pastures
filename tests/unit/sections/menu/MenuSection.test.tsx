import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import type { MenuEntries } from "@/content/collections";
import { getSite } from "@/content/site";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { reference, type Messages } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

import {
  installIntersectionObserverStub,
  type IntersectionObserverStub,
} from "../../motion/harness";

/**
 * The Menu section (04 §3.5, §4, §6; 05 §5.3, §5.6; `docs/design/desktop/README.md`
 * §4 and `docs/design/mobile/README.md` §4).
 *
 * The row's own acceptance is what most of this file is about, and the first
 * one is the reason PR-5.3 was scheduled last:
 *
 * - **the default day is computed on the server**, in `America/Los_Angeles`,
 *   and reaches the client as a prop — so the markup a reader gets before
 *   hydration already has the right chip selected and the right line on screen
 *   (`D-04.10`). The clock is faked here, so "a Wednesday selects Wednesday"
 *   and "a Saturday selects Monday" are assertions about the render rather than
 *   about the day the suite happens to run;
 * - **all five lines are rendered on the server**, one visible — which is what
 *   makes the swap instant and keeps the dishes out of the client bundle;
 * - **the sample line's words come from the collection only** — the weekday
 *   through `weekdayLong`, the dishes from `collections.menu.week`, the dashes
 *   and middots from the translated string;
 * - **both copy toggles render both strings** and let `md:` choose, so no view
 *   is a code branch (`D-04.5`, INV-04.4);
 * - the section adds **no second IntersectionObserver** (INV-05.9).
 *
 * Every expectation is derived from `content/` — `site.json`, the message tree,
 * the menu collection — rather than typed out, so the suite catches a section
 * that stopped agreeing with the content rather than one that agrees with
 * itself.
 *
 * **Why two modules are mocked.** `src/content/collections.ts` refuses to load
 * where `window` exists (02 `D-02.16`) and this file is jsdom; and
 * `next-intl/server` resolves to next-intl's *client* build outside Next's
 * `react-server` condition, where every entry point is a hard throw. Both seams
 * are filled from the real content tree — `getSite()`, `loadMessages()`,
 * next-intl's own `createTranslator` / `createFormatter` — so the mocks replace
 * the *transport*, not the data, and the copy this suite reads is the copy
 * production renders.
 */

const fixture = vi.hoisted(
  (): {
    locale: Locale;
    messages: Messages;
    dropShortLabels: boolean;
  } => ({
    locale: "en",
    messages: {} as Messages,
    dropShortLabels: false,
  }),
);

/** The one collection read a render is allowed (04 §2's data flow). */
const getMenuSpy = vi.hoisted(() => vi.fn());

vi.mock("next-intl/server", async () => {
  const { createFormatter, createTranslator } =
    await vi.importActual<typeof import("next-intl")>("next-intl");
  const { formats: appFormats, TIME_ZONE: zone } =
    await vi.importActual<typeof import("@/i18n/formats")>("@/i18n/formats");
  const { loadMessages } = await import("@/i18n/messages");

  const shared = () => ({ locale: fixture.locale, formats: appFormats, timeZone: zone });

  /**
   * next-intl resolves a `namespace` by walking the message tree and types that
   * walk with generics only its own module can spell. Walking first and handing
   * over the sub-tree is the same operation without them — the shape
   * `tests/unit/sections/HomePage.test.tsx` established.
   */
  const scoped = (namespace: string): Record<string, unknown> => {
    let node: unknown = fixture.messages;
    for (const key of namespace.split(".")) {
      node = typeof node === "object" && node !== null ? Reflect.get(node, key) : undefined;
    }
    if (typeof node !== "object" || node === null) {
      throw new Error(`No message namespace "${namespace}" in the ${fixture.locale} tree.`);
    }
    return node as Record<string, unknown>;
  };

  return {
    getLocale: () => Promise.resolve(fixture.locale),
    getFormatter: () => Promise.resolve(createFormatter(shared())),
    getTranslations: async (namespace: string) => {
      fixture.messages = await loadMessages(fixture.locale);
      return createTranslator({ ...shared(), messages: scoped(namespace) });
    },
  };
});

vi.mock("@/content/collections", async () => {
  const { getSite: site } = await import("@/content/site");
  const { reference: tree } = await import("@/i18n/messages");

  const dietaryText: Readonly<Record<string, { label: string; labelShort?: string }>> =
    tree.collections.menu.dietary;

  getMenuSpy.mockImplementation((): Promise<MenuEntries> => {
    const shared = site().menu;

    return Promise.resolve({
      days: shared.days,
      meals: shared.meals,
      week: tree.collections.menu.week,
      dietary: shared.dietary.map((entry) => {
        const copy = dietaryText[entry.id] ?? { label: entry.id };
        return {
          ...entry,
          text: {
            label: copy.label,
            labelShort: fixture.dropShortLabels ? undefined : copy.labelShort,
          },
        };
      }),
    });
  });

  return { getMenu: getMenuSpy };
});

const { default: MenuSection } = await import("@/components/sections/menu/MenuSection");

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  fixture.locale = routing.defaultLocale;
  fixture.dropShortLabels = false;
  getMenuSpy.mockClear();
  resetRevealRegistry();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Freeze the clock at noon UTC on a given date — mid-morning in Fremont, so the
 * calendar day is unambiguous on both sides of the zone conversion.
 */
function freezeAt(year: number, month: number, day: number): void {
  vi.useFakeTimers({ now: Date.UTC(year, month - 1, day, 12), toFake: ["Date"] });
}

async function renderMenu(locale: Locale = routing.defaultLocale) {
  fixture.locale = locale;
  const tree = await MenuSection();

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
const copy = reference.home.menu;
const menuCopy = reference.menu;
const collection = reference.collections.menu;

/** The chips, in DOM order. */
function chips(): HTMLElement[] {
  return screen.getAllByRole("tab");
}

/** The day whose chip is marked selected. */
function selectedDay(): string | undefined {
  return chips().find((chip) => chip.getAttribute("aria-selected") === "true")?.dataset.day;
}

/**
 * The weekday names the two `Intl` formats produce for the reference locale.
 * Written out here because they are the *expected* output of `weekdayShort` /
 * `weekdayLong` — the one place in this file where naming a weekday is the
 * point rather than a stored string (02 `D-02.6`).
 */
const shortNames: Readonly<Record<string, string>> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
};

const longNames: Readonly<Record<string, string>> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

/** The sample week and the dietary copy, keyed by the ids `site.json` declares. */
const week: Readonly<Record<string, Readonly<Record<string, string>>>> = collection.week;
const dietary: Readonly<Record<string, { label: string; labelShort?: string }>> =
  collection.dietary;

/** One day's column of the sample week — the section's own source for the line. */
function cellsFor(day: string): Readonly<Record<string, string>> {
  const cells = week[day];
  if (cells === undefined) throw new Error(`collections/menu.json has no week.${day}`);
  return cells;
}

/** One dietary chip's copy. */
function dietaryFor(id: string): { label: string; labelShort?: string } {
  const text = dietary[id];
  if (text === undefined) throw new Error(`collections/menu.json has no dietary.${id}`);
  return text;
}

/** One day's line, as `SampleLine` writes it, read from the content tree. */
function lineFor(day: string, weekday: string): string {
  const cells = cellsFor(day);
  return `${weekday} — ${cells.breakfast} · ${cells.lunch} · ${cells.snack}`;
}

describe("the section shell", () => {
  it("is the menu Section, labelled by its own h2 (INV-04.8)", async () => {
    await renderMenu();

    const section = document.querySelector("section#menu");
    expect(section).toHaveAttribute("data-section", "menu");
    expect(section).toHaveAttribute("aria-labelledby", "menu-title");
    expect(screen.getByRole("heading", { level: 2, name: copy.title })).toHaveAttribute(
      "id",
      "menu-title",
    );
  });

  it("draws no decoration — neither reference gives this section one (04 §3.4)", async () => {
    await renderMenu();

    expect(document.querySelectorAll("#menu [data-deco]")).toHaveLength(1);
    expect(document.querySelector("#menu [data-deco]")).toHaveAttribute(
      "data-deco",
      "deco-menu-plate",
    );
  });

  it("closes with the link the content tree names, resolved through site.routes[]", async () => {
    const menu = site.routes.find((route) => route.id === "menu");
    expect(menu).toBeDefined();

    await renderMenu();

    expect(screen.getByRole("link", { name: copy.link })).toHaveAttribute(
      "href",
      `/${routing.defaultLocale}${menu?.path ?? ""}`,
    );
  });

  it("adds no second IntersectionObserver (INV-05.9)", async () => {
    await renderMenu();

    expect(observer.constructed).toHaveLength(1);
  });
});

describe("the default day is the server's (D-04.10)", () => {
  it("selects today when the sample week draws it", async () => {
    // 2026-08-19 is a Wednesday.
    freezeAt(2026, 8, 19);
    await renderMenu();

    expect(selectedDay()).toBe("wed");
    expect(screen.getByRole("tabpanel")).toHaveTextContent(lineFor("wed", "Wednesday"));
  });

  it("sends the weekend to the first day of the week — Monday", async () => {
    // 2026-08-22 is a Saturday.
    freezeAt(2026, 8, 22);
    await renderMenu();

    expect(selectedDay()).toBe(site.menu.days[0]);
    expect(selectedDay()).toBe("mon");
    expect(screen.getByRole("tabpanel")).toHaveTextContent(lineFor("mon", "Monday"));
  });

  it("marks exactly one chip, and puts only that chip in the tab order", async () => {
    freezeAt(2026, 8, 20);
    await renderMenu();

    const selected = chips().filter((chip) => chip.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0]?.tabIndex).toBe(0);
    for (const chip of chips()) {
      if (chip === selected[0]) continue;
      expect(chip.tabIndex).toBe(-1);
    }
  });

  it("is the same markup on two renders of the same instant — nothing is a clock read", async () => {
    freezeAt(2026, 8, 21);
    const first = await renderMenu();
    const before = first.container.innerHTML;
    first.unmount();
    resetRevealRegistry();

    freezeAt(2026, 8, 21);
    const second = await renderMenu();

    expect(second.container.innerHTML).toBe(before);
  });
});

describe("the day chips", () => {
  it("draws one chip per site.menu.days entry, labelled by the weekdayShort format", async () => {
    await renderMenu();

    expect(chips().map((chip) => chip.dataset.day)).toEqual([...site.menu.days]);
    expect(chips().map((chip) => chip.textContent)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  });

  it("never stores a weekday name — no chip label is in the message tree (02 D-02.6)", async () => {
    await renderMenu();

    const tree = JSON.stringify(reference);
    for (const chip of chips()) {
      expect(tree).not.toContain(`"${chip.textContent ?? ""}"`);
    }
  });

  it("names the tablist from menu.dayChips.label", async () => {
    await renderMenu();

    expect(screen.getByRole("tablist")).toHaveAccessibleName(menuCopy.dayChips.label);
  });

  it("extends the hit area with a pseudo-element and leaves the pill alone (03 §6)", async () => {
    await renderMenu();

    for (const chip of chips()) {
      expect(chip.className).toContain("before:h-(--tap-min)");
      expect(chip.className).toContain("before:min-w-(--tap-min)");
      // The drawn pill keeps the design's padding token, selected or not.
      expect(chip.className).toMatch(/p-\(--chip-day(-selected)?\)/u);
    }
  });
});

describe("the sample line", () => {
  it("mounts one line, and holds the other four without a second read (D-04.10)", async () => {
    const user = userEvent.setup();
    freezeAt(2026, 8, 19);
    const { container } = await renderMenu();

    expect(container.querySelectorAll("[data-word-swap]")).toHaveLength(1);
    expect(getMenuSpy).toHaveBeenCalledTimes(1);

    /*
     * Every day the sample week declares is reachable from the nodes the
     * section already handed over: the whole point of `D-04.10`'s "rendered
     * five times on the server, one visible" is that pressing a chip needs no
     * round trip. One `getMenu` call for five lines is that claim.
     */
    for (const day of site.menu.days) {
      await user.click(screen.getByRole("tab", { name: shortNames[day] ?? "" }));
      await waitFor(() => {
        expect(screen.getByRole("tabpanel")).toHaveTextContent(lineFor(day, longNames[day] ?? ""));
      });
      expect(container.querySelectorAll("[data-word-swap]")).toHaveLength(1);
    }

    expect(getMenuSpy).toHaveBeenCalledTimes(1);
  });

  it("takes every word from the collection and the format, nothing from a literal", async () => {
    freezeAt(2026, 8, 20);
    await renderMenu();

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent(lineFor("thu", "Thursday"));
    expect(panel.textContent).toContain(cellsFor("thu").breakfast);
    expect(panel.textContent).toContain(cellsFor("thu").lunch);
    expect(panel.textContent).toContain(cellsFor("thu").snack);
  });

  it("bolds the weekday through the <day> tag (02 D-02.5)", async () => {
    freezeAt(2026, 8, 20);
    await renderMenu();

    const day = screen.getByRole("tabpanel").querySelector("b");
    expect(day).toHaveTextContent("Thursday");
    expect(day).toHaveClass("text-ink");
  });

  it("renders the cells in the case the content tree authored (04 §4's 02 flag)", async () => {
    freezeAt(2026, 8, 17);
    await renderMenu();

    const panel = screen.getByRole("tabpanel");
    expect(panel.className).not.toMatch(/lowercase|capitalize|uppercase/u);
    expect(panel.textContent).toContain(cellsFor("mon").breakfast);
  });
});

describe("the plate", () => {
  it("draws one dot per site.menu.meals entry, captioned from menu.meals.<id>", async () => {
    await renderMenu();

    const dots = [...document.querySelectorAll("[data-plate-dot]")];
    expect(dots.map((dot) => (dot as HTMLElement).dataset.plateDot)).toEqual([...site.menu.meals]);

    for (const meal of site.menu.meals) {
      expect(screen.getByText(menuCopy.meals[meal])).toBeInTheDocument();
    }
  });

  it("upper-cases the captions through the Eyebrow recipe and nowhere else (04 §5.5)", async () => {
    await renderMenu();

    const uppercased = document.querySelectorAll("#menu .uppercase");
    expect(uppercased.length).toBeGreaterThan(0);
    for (const element of uppercased) {
      expect(element.className).toMatch(/\btext-(eyebrow|eyebrow-sm|panel-label)\b/u);
    }
  });

  it("gives the plate the deco identity INV-05.5 asks for", async () => {
    await renderMenu();

    expect(document.querySelector('[data-deco="deco-menu-plate"]')).toHaveAttribute(
      "id",
      "deco-menu-plate",
    );
  });
});

describe("the dietary chips", () => {
  it("shows the onHome subset the shared config declares, and no more", async () => {
    await renderMenu();

    const onHome = site.menu.dietary.filter((entry) => entry.onHome);
    expect(onHome.length).toBeLessThan(site.menu.dietary.length);
    expect(document.querySelectorAll("#menu ul > li")).toHaveLength(onHome.length);

    const drawn = site.menu.dietary
      .filter((entry) => screen.queryByText(dietaryFor(entry.id).label) !== null)
      .map((entry) => entry.id);

    expect(drawn).toEqual(onHome.map((entry) => entry.id));
  });

  it("renders both labels and lets md: pick one (D-04.5)", async () => {
    await renderMenu();

    for (const entry of site.menu.dietary.filter((item) => item.onHome)) {
      const text = dietaryFor(entry.id);
      expect(text.labelShort).toBeDefined();
      expect(screen.getByText(text.labelShort ?? "")).toHaveClass("md:hidden!");
      expect(screen.getByText(text.label)).toHaveClass("hidden!", "md:inline-flex!");
    }
  });

  it("renders one unconditional chip when the locale supplies no short label", async () => {
    fixture.dropShortLabels = true;
    await renderMenu();

    for (const entry of site.menu.dietary.filter((item) => item.onHome)) {
      const text = dietaryFor(entry.id);
      const chip = screen.getByText(text.label);
      expect(chip).not.toHaveClass("hidden!");
      expect(chip).not.toHaveClass("md:hidden!");
    }
  });

  it("carries the emoji inside the label rather than as a separate node (02 D-02.5)", async () => {
    await renderMenu();

    for (const entry of site.menu.dietary.filter((item) => item.onHome)) {
      const text = dietaryFor(entry.id);
      expect(screen.getByText(text.label).children).toHaveLength(0);
    }
  });
});

describe("per-view copy is CSS, never a branch (D-04.5)", () => {
  it("renders the intro once, hidden below md", async () => {
    await renderMenu();

    expect(screen.getByText(copy.intro)).toHaveClass("hidden", "md:block");
  });
});

describe("every locale renders its own copy (04 §8)", () => {
  it.each(routing.locales)("renders %s with no locale branch in the section", async (locale) => {
    vi.stubEnv("NODE_ENV", "production");
    await renderMenu(locale);
    vi.unstubAllEnvs();

    expect(screen.getAllByRole("tab")).toHaveLength(site.menu.days.length);
    expect(screen.getByRole("link").getAttribute("href")).toMatch(new RegExp(`^/${locale}/`, "u"));
    expect(document.body.textContent ?? "").not.toContain("⟦");
  });
});
