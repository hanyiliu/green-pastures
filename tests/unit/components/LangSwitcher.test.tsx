import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LangSwitcher } from "@/components/layout/LangSwitcher";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { reference } from "@/i18n/messages";
import { LOCALE_META, routing, type Locale } from "@/i18n/routing";

/**
 * The three-option locale menu (04 `D-04.16`, 02 `D-02.10`, 06 `D-06.9`).
 *
 * Two things are under test and they pull in opposite directions. The first is
 * **INV-02.9**: nothing about this control may know a locale id, so every
 * expectation below is computed from `routing.locales` and `LOCALE_META` rather
 * than written out — a test that spelled "zh-Hant" would pass on the day the
 * component started spelling it too. The second is the **keyboard and dismissal
 * contract**, which is the part `D-04.16` had to argue for: a disclosure over a
 * list of links, not a `role="menu"`.
 */

const nav = vi.hoisted(() => ({
  pathname: "/",
  replace: vi.fn(),
}));

const registry = vi.hoisted(() => ({ markLocaleSwap: vi.fn() }));

vi.mock("@/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/navigation")>();
  return {
    ...actual,
    usePathname: () => nav.pathname,
    useRouter: () => ({
      replace: nav.replace,
      push: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});

vi.mock("@/components/motion/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/motion/registry")>();
  return { ...actual, markLocaleSwap: registry.markLocaleSwap };
});

function renderSwitcher(variant: "nav" | "sheet", locale: Locale = routing.defaultLocale) {
  return render(
    <NextIntlClientProvider locale={locale} messages={reference}>
      <MotionProvider>
        <LangSwitcher variant={variant} />
      </MotionProvider>
    </NextIntlClientProvider>,
  );
}

/** jsdom does not implement `<summary>`'s activation, so the toggle is staged. */
function openPanel(container: HTMLElement): HTMLDetailsElement {
  const details = container.querySelector("details");
  if (!(details instanceof HTMLDetailsElement)) throw new Error("no <details> rendered");
  details.open = true;
  fireEvent(details, new Event("toggle"));
  return details;
}

function options(): HTMLAnchorElement[] {
  return screen.getAllByRole("link").filter((node) => node instanceof HTMLAnchorElement);
}

beforeEach(() => {
  nav.pathname = "/";
  nav.replace.mockClear();
  registry.markLocaleSwap.mockClear();
  window.history.replaceState({}, "", "/en");
});

describe("the option list is built from routing.locales (INV-02.9, INV-04.12)", () => {
  it("renders one option per enabled locale, in that order, by endonym", () => {
    renderSwitcher("nav");

    expect(options().map((option) => option.textContent)).toEqual(
      routing.locales.map((id) => LOCALE_META[id].nativeName),
    );
  });

  it("marks exactly the current locale with aria-current, whichever locale that is", () => {
    for (const locale of routing.locales) {
      const { unmount } = renderSwitcher("nav", locale);

      const marked = options().filter((option) => option.getAttribute("aria-current") === "true");
      expect(marked).toHaveLength(1);
      expect(marked[0]?.textContent).toBe(LOCALE_META[locale].nativeName);

      unmount();
    }
  });

  it("labels every option from optionAriaLabel with the target's endonym", () => {
    renderSwitcher("nav");

    for (const [index, id] of routing.locales.entries()) {
      expect(options()[index]).toHaveAttribute(
        "aria-label",
        reference.common.localeSwitcher.optionAriaLabel.replace(
          "{locale}",
          LOCALE_META[id].nativeName,
        ),
      );
    }
  });

  it("carries hrefLang and a real href per option, so the list works unscripted", () => {
    renderSwitcher("nav");

    for (const [index, id] of routing.locales.entries()) {
      const option = options()[index];
      expect(option).toHaveAttribute("hreflang", LOCALE_META[id].hreflang);
      expect(option).toHaveAttribute("href", `/${id}`);
    }
  });

  it("names no locale anywhere in its source (INV-02.9's grep half)", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/layout/LangSwitcher.tsx"),
      "utf8",
    );
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

    for (const id of routing.locales) {
      expect(code).not.toContain(`"${id}"`);
      expect(code).not.toContain(`'${id}'`);
    }
    expect(code).not.toMatch(/locale\s*[=!]==?\s*["']/u);
  });
});

describe("the nav trigger (ADJ-20, 03 §3.3)", () => {
  it("shows the current locale's shortLabel and nothing else — no chevron", () => {
    for (const locale of routing.locales) {
      const { container, unmount } = renderSwitcher("nav", locale);

      const summary = container.querySelector("summary");
      expect(summary?.textContent).toBe(LOCALE_META[locale].shortLabel);
      expect(summary?.textContent).not.toContain("⌄");

      unmount();
    }
  });

  it("names the control with localeSwitcher.ariaLabel, not with the visible label", () => {
    const { container } = renderSwitcher("nav");

    expect(container.querySelector("summary")).toHaveAttribute(
      "aria-label",
      reference.common.localeSwitcher.ariaLabel,
    );
  });

  it("reserves one fixed-width box for all three labels, so the row cannot shift", () => {
    const widths = new Set<string | undefined>();

    for (const locale of routing.locales) {
      const { container, unmount } = renderSwitcher("nav", locale);
      widths.add(
        container
          .querySelector("summary")
          ?.className.split(/\s+/u)
          .find((entry) => entry.startsWith("w-")),
      );
      unmount();
    }

    expect(widths.size).toBe(1);
    expect([...widths][0]).toBeDefined();
  });

  it("renders a disclosure, not a menu", () => {
    const { container } = renderSwitcher("nav");

    expect(container.querySelector("details")).not.toBeNull();
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(container.querySelector('[role="menuitem"]')).toBeNull();
  });

  it("starts closed, so the server HTML carries no open attribute", () => {
    const { container } = renderSwitcher("nav");

    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });
});

describe("dismissal and focus", () => {
  it("closes on Escape and returns focus to the trigger", () => {
    const { container } = renderSwitcher("nav");
    const details = openPanel(container);

    const first = options()[0];
    first?.focus();
    fireEvent.keyDown(first as Element, { key: "Escape" });

    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(container.querySelector("summary"));
  });

  it("closes on Escape from the trigger itself", () => {
    const { container } = renderSwitcher("nav");
    const details = openPanel(container);

    const summary = container.querySelector("summary");
    fireEvent.keyDown(summary as Element, { key: "Escape" });

    expect(details.open).toBe(false);
  });

  it("closes on an outside pointerdown and leaves focus alone", () => {
    const { container } = renderSwitcher("nav");
    const details = openPanel(container);

    fireEvent.pointerDown(document.body);

    expect(details.open).toBe(false);
  });

  it("stays open for a pointerdown inside the panel", () => {
    const { container } = renderSwitcher("nav");
    const details = openPanel(container);

    fireEvent.pointerDown(options()[0] as Element);

    expect(details.open).toBe(true);
  });

  it("moves focus between options with the arrow keys, Home and End", () => {
    const { container } = renderSwitcher("nav");
    openPanel(container);

    const list = options();
    const last = list[list.length - 1];
    list[0]?.focus();

    fireEvent.keyDown(list[0] as Element, { key: "ArrowDown" });
    expect(document.activeElement).toBe(list[1]);

    fireEvent.keyDown(list[1] as Element, { key: "ArrowUp" });
    expect(document.activeElement).toBe(list[0]);

    // The list wraps, which is what makes ArrowUp from the first option useful.
    fireEvent.keyDown(list[0] as Element, { key: "ArrowUp" });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(last as Element, { key: "Home" });
    expect(document.activeElement).toBe(list[0]);

    fireEvent.keyDown(list[0] as Element, { key: "End" });
    expect(document.activeElement).toBe(last);
  });

  it("leaves every other key alone, on the options and on the trigger", () => {
    const { container } = renderSwitcher("nav");
    const details = openPanel(container);

    const first = options()[0];
    first?.focus();
    fireEvent.keyDown(first as Element, { key: "a" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(container.querySelector("summary") as Element, { key: "Enter" });
    expect(details.open).toBe(true);
  });

  it("leaves every option an ordinary tab stop — no roving tabindex", () => {
    const { container } = renderSwitcher("nav");
    openPanel(container);

    for (const option of options()) expect(option).not.toHaveAttribute("tabindex");
  });
});

describe("what a click does (05 §5.6, 06 D-06.9)", () => {
  it("marks the reveal registry and replaces the URL in place, keeping query and hash", () => {
    nav.pathname = "/menu";
    window.history.replaceState({}, "", "/en/menu?ref=flyer#visit");

    renderSwitcher("nav");
    const target = routing.locales[1];
    const option = options()[1];

    fireEvent.click(option as Element, { button: 0 });

    expect(registry.markLocaleSwap).toHaveBeenCalledOnce();
    expect(nav.replace).toHaveBeenCalledWith("/menu?ref=flyer#visit", {
      locale: target,
      scroll: false,
      transitionTypes: ["locale-swap"],
    });
  });

  it("closes the panel before it navigates", () => {
    const { container } = renderSwitcher("nav");
    const details = openPanel(container);

    fireEvent.click(options()[1] as Element, { button: 0 });

    expect(details.open).toBe(false);
  });

  it("leaves a modified click to the browser, so the option is still a real URL", () => {
    renderSwitcher("nav");

    fireEvent.click(options()[1] as Element, { button: 0, metaKey: true });

    expect(nav.replace).not.toHaveBeenCalled();
    expect(registry.markLocaleSwap).not.toHaveBeenCalled();
  });
});

describe('variant="sheet" (04 D-04.8, 02 D-02.10)', () => {
  it("renders the same options as flat rows with no disclosure", () => {
    const { container } = renderSwitcher("sheet");

    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector("summary")).toBeNull();
    expect(options()).toHaveLength(routing.locales.length);
  });

  it("names the group on the list itself, since there is no trigger to name it", () => {
    const { container } = renderSwitcher("sheet");

    expect(container.querySelector("ul")).toHaveAttribute(
      "aria-label",
      reference.common.localeSwitcher.ariaLabel,
    );
  });

  it("keeps the arrow keys, and Escape does not steal focus to a trigger that is not there", () => {
    const { container } = renderSwitcher("sheet");
    const list = options();

    list[0]?.focus();
    fireEvent.keyDown(list[0] as Element, { key: "ArrowDown" });
    expect(document.activeElement).toBe(list[1]);

    fireEvent.keyDown(list[1] as Element, { key: "Escape" });
    expect(document.activeElement).toBe(list[1]);
    expect(container.querySelector("summary")).toBeNull();
  });
});
