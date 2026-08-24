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
import { LONG_NAMES, menuFixture, renderWithProviders } from "./harness";

/**
 * The Menu page's per-day cards (04 §3.6, `D-04.11`; gp-dln.201; M L332–371).
 *
 * The transpose of `WeeklyMenuTable`, and the half of `D-04.11` the narrow view
 * draws. What this file holds:
 *
 * - **one `<section>` per day, named by its own `h2`**, so the five days are
 *   navigable regions rather than anonymous boxes (04 §3.6);
 * - **a `<dl>` of meal → dish**, which is what says *breakfast is the name of
 *   this dish* instead of leaving two spans side by side;
 * - **`weekdayLong` where the table uses `weekdayShort`** (04 §3.6), over the
 *   same `weekdayDate()` — still derived, still never stored (02 `D-02.6`);
 * - **the same fifteen cells the table draws**, which is `D-04.11`'s stated
 *   cost and the thing that would silently drift if either structure read a
 *   different collection;
 * - no second IntersectionObserver (INV-05.9).
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

const { DayCards } = await import("@/components/pages/menu/DayCards");

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  fixture.locale = routing.defaultLocale;
  resetRevealRegistry();
});

async function renderCards(locale: Locale = routing.defaultLocale) {
  fixture.locale = locale;
  return renderWithProviders(await DayCards({ menu: menuFixture() }), locale);
}

const site = getSite();
const menuCopy = reference.menu;
const week: Readonly<Record<string, Readonly<Record<string, string>>>> =
  reference.collections.menu.week;

function dish(day: string, meal: string): string {
  const cell = week[day]?.[meal];
  if (cell === undefined) throw new Error(`collections/menu.json has no week.${day}.${meal}`);
  return cell;
}

/** The day cards, in DOM order. */
function sections(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("section[data-day]")];
}

describe("the structure", () => {
  it("is one region per site.menu.days entry, in that order", async () => {
    await renderCards();

    expect(sections().map((section) => section.dataset.day)).toEqual([...site.menu.days]);
  });

  it("names each region with its own h2 (04 §3.6, §7)", async () => {
    await renderCards();

    for (const section of sections()) {
      const heading = section.querySelector("h2");
      expect(heading).not.toBeNull();
      expect(section).toHaveAttribute("aria-labelledby", heading?.id);
      expect(heading?.id).toBe(`menu-day-${section.dataset.day ?? ""}-title`);
    }
  });

  it("lists the meals as a description list, one dt/dd pair each", async () => {
    await renderCards();

    for (const section of sections()) {
      const list = section.querySelector("dl");
      expect(list?.querySelectorAll("dt")).toHaveLength(site.menu.meals.length);
      expect(list?.querySelectorAll("dd")).toHaveLength(site.menu.meals.length);
    }
  });

  it("adds no second IntersectionObserver (INV-05.9)", async () => {
    await renderCards();

    expect(observer.constructed).toHaveLength(1);
  });
});

describe("the words", () => {
  it("titles each card with weekdayLong, never a stored name (02 D-02.6)", async () => {
    await renderCards();

    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(
      site.menu.days.map((day) => LONG_NAMES[day]),
    );
  });

  it("derives the titles per locale from the same code", async () => {
    await renderCards("zh-Hant");

    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "星期一",
      "星期二",
      "星期三",
      "星期四",
      "星期五",
    ]);
  });

  it("pairs each meal label with that day's dish, from the same collection as the table", async () => {
    await renderCards();

    for (const section of sections()) {
      const day = section.dataset.day ?? "";
      const terms = [...section.querySelectorAll("dt")].map((dt) => dt.textContent);
      const dishes = [...section.querySelectorAll("dd")].map((dd) => dd.textContent);

      expect(terms).toEqual(site.menu.meals.map((meal) => menuCopy.meals[meal]));
      expect(dishes).toEqual(site.menu.meals.map((meal) => dish(day, meal)));
    }
  });
});
