import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MobileMenu } from "@/components/layout/MobileMenu";
import type { NavLinkItem } from "@/components/layout/PrimaryNav";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { reference } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

/**
 * The hamburger sheet (04 `D-04.8`, §3.1; sign-off OQ-04.1).
 *
 * The design leaves this control undesigned, so what is worth pinning down is
 * not how it looks but the four promises `D-04.8` makes about it: the trigger
 * names itself correctly in both states, focus goes into the sheet and comes
 * back out, `Escape` and a link click close it, and the page behind is inert
 * and unscrollable while it is open. Every one of those is invisible until it
 * regresses.
 */

const nav = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("@/i18n/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/navigation")>();
  return { ...actual, usePathname: () => nav.pathname };
});

const LINKS: readonly NavLinkItem[] = [
  { id: "philosophy", href: "/#philosophy", label: "Philosophy" },
  { id: "team", href: "/#teachers", label: "Our Team" },
  { id: "contact", href: "/#visit", label: "Contact" },
];

/** A body sibling, so the `inert` sweep has something to act on. */
let behind: HTMLElement;

function renderMenu() {
  return render(
    <NextIntlClientProvider locale={routing.defaultLocale} messages={reference}>
      <MotionProvider>
        <MobileMenu links={LINKS}>
          <a href="#visit">Book a tour</a>
        </MobileMenu>
      </MotionProvider>
    </NextIntlClientProvider>,
  );
}

function trigger(): HTMLElement {
  return screen.getByRole("button");
}

function sheet(): HTMLElement | null {
  return screen.queryByRole("dialog");
}

beforeEach(() => {
  nav.pathname = "/";
  behind = document.createElement("main");
  document.body.append(behind);
});

afterEach(() => {
  behind.remove();
});

describe("the trigger (04 §3.1, INV-04.7)", () => {
  it("is a button that names the sheet it controls", () => {
    renderMenu();

    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger().getAttribute("aria-controls")).toBeTruthy();
  });

  it("flips its accessible name between menuOpen and menuClose", () => {
    renderMenu();

    expect(trigger()).toHaveAttribute("aria-label", reference.common.nav.menuOpen);

    fireEvent.click(trigger());

    expect(trigger()).toHaveAttribute("aria-label", reference.common.nav.menuClose);
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("points aria-controls at the sheet that actually appears", () => {
    renderMenu();
    fireEvent.click(trigger());

    expect(sheet()?.id).toBe(trigger().getAttribute("aria-controls"));
  });

  it("draws its bars as decoration, so no glyph reaches the accessibility tree", () => {
    renderMenu();

    expect(trigger().textContent).toBe("");
    expect(trigger().querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("the sheet", () => {
  it("is absent until it is asked for", () => {
    renderMenu();

    expect(sheet()).toBeNull();
  });

  it("is a modal dialog with a name", () => {
    renderMenu();
    fireEvent.click(trigger());

    expect(sheet()).toHaveAttribute("aria-modal", "true");
    expect(sheet()).toHaveAttribute("aria-label", reference.common.nav.label);
  });

  it("renders every row it was handed, Contact included, plus its children", () => {
    renderMenu();
    fireEvent.click(trigger());

    const hrefs = [...(sheet()?.querySelectorAll("a") ?? [])].map((link) =>
      link.getAttribute("href"),
    );

    expect(hrefs).toEqual(["#philosophy", "#teachers", "#visit", "#visit"]);
  });
});

describe("focus, dismissal and the page behind (04 §3.1)", () => {
  it("moves focus into the sheet on open and back to the trigger on close", () => {
    renderMenu();

    fireEvent.click(trigger());
    const first = sheet()?.querySelector("a");
    expect(document.activeElement).toBe(first);

    fireEvent.click(trigger());
    expect(document.activeElement).toBe(trigger());
  });

  it("closes on Escape", () => {
    renderMenu();
    fireEvent.click(trigger());

    fireEvent.keyDown(sheet() as Element, { key: "Escape" });

    expect(sheet()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("traps Tab inside the sheet, in both directions", () => {
    renderMenu();
    fireEvent.click(trigger());

    const stops = [...(sheet()?.querySelectorAll("a") ?? [])];
    const first = stops[0];
    const last = stops[stops.length - 1];

    last?.focus();
    fireEvent.keyDown(sheet() as Element, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(sheet() as Element, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("passes every other key straight through", () => {
    renderMenu();
    fireEvent.click(trigger());

    const first = sheet()?.querySelector("a");
    fireEvent.keyDown(sheet() as Element, { key: "ArrowDown" });

    expect(sheet()).not.toBeNull();
    expect(document.activeElement).toBe(first);
  });

  it("makes the rest of the page inert and locks body scroll, and undoes both", () => {
    renderMenu();

    fireEvent.click(trigger());
    expect(behind).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(trigger());
    expect(behind).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("");
  });

  it("closes when a link inside it is clicked, whoever rendered that link", () => {
    renderMenu();
    fireEvent.click(trigger());

    const cta = screen.getByText("Book a tour");
    fireEvent.click(cta);

    expect(sheet()).toBeNull();
  });

  it("closes rather than hides when the viewport grows past lg", () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: false,
          media: query,
          addEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => {
            listeners.add(fn);
          },
          removeEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => {
            listeners.delete(fn);
          },
        }) as unknown as MediaQueryList,
    );

    renderMenu();
    fireEvent.click(trigger());
    expect(behind).toHaveAttribute("inert");

    act(() => {
      for (const fn of listeners) fn({ matches: true } as MediaQueryListEvent);
    });

    expect(sheet()).toBeNull();
    expect(behind).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("");

    vi.unstubAllGlobals();
  });

  it("closes when the route changes under it", () => {
    const { rerender } = renderMenu();
    fireEvent.click(trigger());
    expect(sheet()).not.toBeNull();

    nav.pathname = "/menu";
    rerender(
      <NextIntlClientProvider locale={routing.defaultLocale} messages={reference}>
        <MotionProvider>
          <MobileMenu links={LINKS}>
            <a href="#visit">Book a tour</a>
          </MobileMenu>
        </MotionProvider>
      </NextIntlClientProvider>,
    );

    expect(sheet()).toBeNull();
  });
});
