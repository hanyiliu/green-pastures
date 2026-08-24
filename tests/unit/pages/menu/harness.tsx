import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import { MotionProvider } from "@/components/motion/MotionProvider";
import type { MenuEntries } from "@/content/collections";
import { getSite } from "@/content/site";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { reference } from "@/i18n/messages";
import type { Locale } from "@/i18n/routing";

/**
 * What the Menu page's two structures need to render under jsdom, shared by
 * `WeeklyMenuTable.test.tsx` and `DayCards.test.tsx`.
 *
 * Both composites take their `MenuEntries` as a **prop** — the page does the
 * one `getMenu()` read and hands the same object to both — so neither suite has
 * to mock `src/content/collections.ts` at all. {@link menuFixture} builds that
 * object out of `content/site.json` and the `en` reference tree, which is what
 * keeps the expectations derived rather than typed.
 *
 * `next-intl/server` still has to be mocked, and by each suite rather than
 * here: `vi.mock` is hoisted to the top of the file that calls it, so a factory
 * exported from a helper module would be registered too late to intercept the
 * component's own import.
 *
 * Not a `*.test.tsx` file, so Vitest's `include` never collects it.
 */

/** The days, meals, sample week and dietary chips, straight from `content/`. */
export function menuFixture(): MenuEntries {
  const shared = getSite().menu;
  const text = reference.collections.menu;
  const dietaryText: Readonly<Record<string, { label: string; labelShort?: string }>> =
    text.dietary;

  return {
    days: shared.days,
    meals: shared.meals,
    week: text.week,
    dietary: shared.dietary.map((entry) => {
      const copy = dietaryText[entry.id];
      if (copy === undefined) throw new Error(`collections/menu.json has no dietary.${entry.id}`);
      return { ...entry, text: copy };
    }),
  };
}

/** One server-rendered tree inside the providers a `Reveal` needs. */
export function renderWithProviders(tree: ReactNode, locale: Locale) {
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

/**
 * The weekday names the two `Intl` formats produce for the reference locale.
 *
 * Written out here because they are the *expected output* of `weekdayShort` /
 * `weekdayLong` — the one place in these suites where naming a weekday is the
 * point rather than a stored string (02 `D-02.6`).
 */
export const SHORT_NAMES: Readonly<Record<string, string>> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
};

export const LONG_NAMES: Readonly<Record<string, string>> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};
