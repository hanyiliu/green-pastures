import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { dishesFor, SampleLine } from "@/components/sections/menu/SampleLine";
import type { MenuEntries } from "@/content/collections";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { reference } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

/**
 * `SampleLine` (04 §4's row, `D-04.10`).
 *
 * The section's own suite renders this through `MenuSection` and asserts what a
 * reader sees. What is left for here is the leaf's two contracts: the cell
 * lookup that stands between the collection and the message's three arguments,
 * and the fact that the component itself is synchronous and locale-agnostic —
 * hand it a day and three dishes and it writes the sentence for whichever
 * locale the provider names.
 */

const week: MenuEntries["week"] = reference.collections.menu.week;

function renderLine(locale: Locale = routing.defaultLocale) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={reference}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      <SampleLine day="wed" dishes={dishesFor(week, "wed")} />
    </NextIntlClientProvider>,
  );
}

describe("dishesFor", () => {
  it("reads the three cells the ICU message names", () => {
    expect(dishesFor(week, "fri")).toEqual({
      breakfast: reference.collections.menu.week.fri.breakfast,
      lunch: reference.collections.menu.week.fri.lunch,
      snack: reference.collections.menu.week.fri.snack,
    });
  });

  it("names the missing key rather than printing a gap into the sentence", () => {
    expect(() => dishesFor({ mon: { breakfast: "porridge" } }, "mon")).toThrow(/week\.mon\.lunch/u);
  });

  it("names the day when the week has no column for it at all", () => {
    expect(() => dishesFor({}, "sat")).toThrow(/week\.sat\.breakfast/u);
  });
});

describe("the line", () => {
  it("derives the weekday rather than reading a stored name (02 D-02.6)", () => {
    renderLine();

    const day = screen.getByText("Wednesday");
    expect(day.tagName).toBe("B");
    expect(JSON.stringify(reference)).not.toContain('"Wednesday"');
  });

  it("puts every dish in the sentence, in the collection's own case", () => {
    const { container } = renderLine();

    const cells = reference.collections.menu.week.wed;
    expect(container.textContent).toContain(cells.breakfast);
    expect(container.textContent).toContain(cells.lunch);
    expect(container.textContent).toContain(cells.snack);
    expect(container.querySelector("p")?.className).not.toMatch(/lowercase|capitalize/u);
  });

  it("names the weekday in the reader's own language, with no branch of its own", () => {
    renderLine("zh-Hans");

    // The Chinese message tree has no `sampleLine`, so the reference string
    // renders — the weekday inside it is still `weekdayLong` for zh-Hans.
    expect(screen.getByText("星期三").tagName).toBe("B");
  });
});
