import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { reference } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

import { installIntersectionObserverStub } from "../motion/harness";

/**
 * The home route's shape (04 §1, 05 §5.7, §5.8).
 *
 * Three structural facts that no other test can see, because they are about
 * what wraps what rather than about any component:
 *
 * - the page renders **its own `<main id="main">`**, which is the landmark the
 *   layout's skip link targets — the layout deliberately renders none;
 * - that `<main>` carries **`data-snap-root`**, the attribute 05 §5.8 opts the
 *   home page (and only the home page) into `scroll-snap-type` with;
 * - `PageTransition` wraps **one element**, not a fragment of siblings, or the
 *   browser has several boxes to name and the subpage slide stops meaning
 *   anything.
 *
 * **Why `react` is mocked.** `ViewTransition` is not exported by the published
 * `react` package at any 19.x version — it comes from the canary build Next
 * vendors and aliases at build time — so Vitest resolves an `undefined`
 * element type. `tests/unit/motion/PageTransition.test.tsx` documents the same
 * mock and asserts the transition-type map; this file only needs the component
 * to render its child.
 */

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    ViewTransition: ({ children }: { children?: ReactNode }) =>
      actual.createElement("div", { "data-testid": "view-transition" }, children),
  };
});

vi.mock("@/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/navigation")>();
  return { ...actual, usePathname: () => "/" };
});

const { default: HomePage } = await import("@/app/[locale]/page");

beforeAll(() => {
  installIntersectionObserverStub();
});

beforeEach(() => {
  resetRevealRegistry();
});

function renderHome() {
  return render(
    <NextIntlClientProvider
      locale={routing.defaultLocale}
      messages={reference}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      <MotionProvider>
        <HomePage />
      </MotionProvider>
    </NextIntlClientProvider>,
  );
}

describe("the home page", () => {
  it("renders the skip link's target as its own landmark", () => {
    renderHome();

    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("opts into scroll snapping with data-snap-root (05 §5.8)", () => {
    renderHome();

    expect(screen.getByRole("main")).toHaveAttribute("data-snap-root");
  });

  it("gives PageTransition a single element to snapshot", () => {
    renderHome();

    const wrapper = screen.getByTestId("view-transition");
    expect(wrapper.children).toHaveLength(1);
    expect(wrapper.firstElementChild?.tagName).toBe("MAIN");
  });

  it("renders the hero, and the hero's h1 is the page's only one (INV-04.8)", () => {
    renderHome();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("main").querySelector("section")).toHaveAttribute("id", "hero");
  });
});
