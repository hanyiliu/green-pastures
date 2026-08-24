import { screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRevealRegistry } from "@/components/motion/registry";
import { getSite } from "@/content/site";
import { reference, type Messages } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

import {
  installIntersectionObserverStub,
  type IntersectionObserverStub,
} from "../../motion/harness";
import { menuFixture, renderWithProviders, SHORT_NAMES } from "./harness";

/**
 * The Menu page's weekly table (04 §3.6, `D-04.11`; gp-dln.201; D L443–472).
 *
 * The row's own acceptance is what this file is about:
 *
 * - **the weekday headers come from `weekdayShort`**, never from a stored
 *   string (02 `D-02.6`), over `weekdayDate()` from `src/lib/menu-day.ts` —
 *   the module PR-5.3 put on that path so this page could reuse it;
 * - **it is the same collection the home sample line reads** — the fifteen
 *   cells are `collections.menu.week`, cross-checked here against the reference
 *   tree rather than typed;
 * - **it is a real table**: `<th scope="col">` days and `<th scope="row">`
 *   meals, so "Wednesday, Lunch" is a relationship the accessibility tree
 *   carries rather than a visual arrangement;
 * - **the rows and columns are `content/site.json`'s** `menu.meals` and
 *   `menu.days`, in their declared order — nothing here names a day or a meal;
 * - it adds **no second IntersectionObserver** (INV-05.9).
 *
 * `next-intl/server` is mocked because it resolves to next-intl's *client*
 * build outside Next's `react-server` condition, where every entry point
 * throws; the translator and formatter behind the mock are next-intl's own,
 * over the real message tree. The collection is not mocked at all — the
 * composite takes it as a prop (see `./harness`).
 */

const fixture = vi.hoisted((): { locale: Locale; messages: Messages } => ({
  locale: "en",
  messages: {} as Messages,
}));

vi.mock("next-intl/server", async () => {
  const { createFormatter, createTranslator } =
    await vi.importActual<typeof import("next-intl")>("next-intl");
  const { formats: appFormats, TIME_ZONE: zone } =
    await vi.importActual<typeof import("@/i18n/formats")>("@/i18n/formats");
  const { loadMessages } = await import("@/i18n/messages");

  const shared = () => ({ locale: fixture.locale, formats: appFormats, timeZone: zone });

  return {
    getLocale: () => Promise.resolve(fixture.locale),
    getFormatter: () => Promise.resolve(createFormatter(shared())),
    getTranslations: async (namespace: string) => {
      fixture.messages = await loadMessages(fixture.locale);
      const node: unknown = Reflect.get(fixture.messages, namespace);
      if (typeof node !== "object" || node === null) {
        throw new Error(`No message namespace "${namespace}" in the ${fixture.locale} tree.`);
      }
      return createTranslator({ ...shared(), messages: node as Record<string, unknown> });
    },
  };
});

const { WeeklyMenuTable } = await import("@/components/pages/menu/WeeklyMenuTable");

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  fixture.locale = routing.defaultLocale;
  resetRevealRegistry();
});

async function renderTable(locale: Locale = routing.defaultLocale) {
  fixture.locale = locale;
  return renderWithProviders(await WeeklyMenuTable({ menu: menuFixture() }), locale);
}

const site = getSite();
const menuCopy = reference.menu;
const week: Readonly<Record<string, Readonly<Record<string, string>>>> =
  reference.collections.menu.week;

/** One cell of the sample week, from the reference tree. */
function dish(day: string, meal: string): string {
  const cell = week[day]?.[meal];
  if (cell === undefined) throw new Error(`collections/menu.json has no week.${day}.${meal}`);
  return cell;
}

describe("the structure", () => {
  it("is a table with a visually hidden caption", async () => {
    await renderTable();

    const table = screen.getByRole("table", { name: menuCopy.eyebrow });
    expect(table.querySelector("caption")).toHaveClass("sr-only");
  });

  it("heads every column with a day and every row with a meal", async () => {
    await renderTable();

    const columns = screen.getAllByRole("columnheader");
    const rows = screen.getAllByRole("rowheader");

    expect(columns.map((th) => th.dataset.day)).toEqual([...site.menu.days]);
    expect(rows.map((th) => th.dataset.meal)).toEqual([...site.menu.meals]);
  });

  it("leaves the corner an unlabelled <td>, not an empty header", async () => {
    await renderTable();

    const head = screen.getByRole("table").querySelector("thead tr");
    expect(head?.firstElementChild?.tagName).toBe("TD");
    expect(head?.firstElementChild?.textContent).toBe("");
  });

  it("draws days x meals cells and nothing more", async () => {
    await renderTable();

    const cells = screen.getByRole("table").querySelectorAll("tbody td");
    expect(cells).toHaveLength(site.menu.days.length * site.menu.meals.length);
  });

  it("adds no second IntersectionObserver (INV-05.9)", async () => {
    await renderTable();

    expect(observer.constructed).toHaveLength(1);
  });
});

describe("the words", () => {
  it("labels the meals from menu.meals.*", async () => {
    await renderTable();

    expect(screen.getAllByRole("rowheader").map((th) => th.textContent)).toEqual(
      site.menu.meals.map((meal) => menuCopy.meals[meal]),
    );
  });

  it("labels the days with weekdayShort, never a stored name (02 D-02.6)", async () => {
    await renderTable();

    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual(
      site.menu.days.map((day) => SHORT_NAMES[day]),
    );
  });

  it("derives the day names per locale — Chinese gets Chinese from the same code", async () => {
    await renderTable("zh-Hans");

    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "周一",
      "周二",
      "周三",
      "周四",
      "周五",
    ]);
  });

  it("fills every cell from collections.menu.week — the home sample line's collection", async () => {
    await renderTable();

    for (const meal of site.menu.meals) {
      const row = screen.getByRole("table").querySelector(`th[data-meal="${meal}"]`)?.parentElement;
      expect(row).toBeDefined();

      const cells = [...(row?.querySelectorAll("td") ?? [])].map((td) => td.textContent);
      expect(cells).toEqual(site.menu.days.map((day) => dish(day, meal)));
    }
  });
});
