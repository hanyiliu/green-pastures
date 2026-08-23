import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { Reveal } from "@/components/motion/Reveal";
import { MenuDayChips, type MenuDay } from "@/components/sections/menu/MenuDayChips";
import type { DayId } from "@/content/schemas/menu";

import {
  installIntersectionObserverStub,
  installMatchMedia,
  type IntersectionObserverStub,
} from "../../motion/harness";

/**
 * `MenuDayChips` (04 §4's row, `D-04.10`; 05 §5.6).
 *
 * The client half of the Menu section, tested away from the section so the
 * three claims that are *about the boundary* can be made against props rather
 * than against a page:
 *
 * - **it never reads a clock.** This is the mechanism behind "no SSR/CSR day
 *   mismatch": the selected day arrives as `defaultDay` and the component has
 *   no other source for it, so the client cannot disagree with the server about
 *   what today is. The test proves it the only way that stays true under a
 *   rewrite — by making `Date` and `Intl.DateTimeFormat` throw for the duration
 *   of the render;
 * - **it is handed nodes, not copy.** The lines are opaque `ReactNode`s and the
 *   labels are strings the server formatted, so no dish, no message namespace
 *   and no collection is in this component's world at all;
 * - **the tabs behave**: roving focus, arrow keys that wrap, `Home` / `End`,
 *   and one panel that is always labelled by the chip that is selected.
 */

let observer: IntersectionObserverStub;

beforeAll(() => {
  installMatchMedia(false);
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  resetRevealRegistry();
});

const DAYS: readonly MenuDay[] = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
];

/** Opaque nodes, exactly as the section hands them over. */
const LINES = Object.fromEntries(
  DAYS.map((day) => [day.id, <span key={day.id}>{day.id}-line</span>]),
);

const GROUP_LABEL = "Choose a day";

function renderChips(defaultDay: DayId = "mon") {
  return render(
    <MotionProvider>
      <Reveal id="menu.plate" stagger>
        <MenuDayChips days={DAYS} lines={LINES} defaultDay={defaultDay} groupLabel={GROUP_LABEL} />
      </Reveal>
    </MotionProvider>,
  );
}

function chips(): HTMLElement[] {
  return screen.getAllByRole("tab");
}

function selected(): string | undefined {
  return chips().find((chip) => chip.getAttribute("aria-selected") === "true")?.dataset.day;
}

/** Wait for `AnimatePresence mode="wait"` to finish the exit and mount the new line. */
async function swappedTo(day: string): Promise<void> {
  await waitFor(() => {
    expect(document.querySelector("[data-word-swap]")).toHaveAttribute("data-word-swap", day);
  });
}

describe("what the server decided", () => {
  it("opens on `defaultDay`, whatever the clock says", () => {
    renderChips("thu");

    expect(selected()).toBe("thu");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("thu-line");
  });

  it("reads no clock at all — the client cannot disagree with the server (D-04.10)", () => {
    const realDate = globalThis.Date;
    const realIntl = globalThis.Intl.DateTimeFormat;

    // Anything that asks "what day is it?" in this component fails loudly.
    globalThis.Date = new Proxy(realDate, {
      construct() {
        throw new Error("MenuDayChips read the clock");
      },
      apply() {
        throw new Error("MenuDayChips read the clock");
      },
    });
    globalThis.Intl.DateTimeFormat = (() => {
      throw new Error("MenuDayChips formatted a date");
    }) as unknown as typeof Intl.DateTimeFormat;

    try {
      renderChips("fri");
      expect(selected()).toBe("fri");
    } finally {
      globalThis.Date = realDate;
      globalThis.Intl.DateTimeFormat = realIntl;
    }
  });

  it("labels the panel with the selected chip, and every chip controls that panel", () => {
    renderChips("wed");

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", "menu-day-wed");
    for (const chip of chips()) {
      expect(chip).toHaveAttribute("aria-controls", panel.id);
    }
  });

  it("names the group from the string it was given", () => {
    renderChips();

    expect(screen.getByRole("tablist")).toHaveAccessibleName(GROUP_LABEL);
  });
});

describe("pressing a chip", () => {
  it("moves the selection, the tab order and the line", async () => {
    const user = userEvent.setup();
    renderChips("mon");

    await user.click(screen.getByRole("tab", { name: "Wed" }));

    expect(selected()).toBe("wed");
    expect(screen.getByRole("tab", { name: "Wed" }).tabIndex).toBe(0);
    expect(screen.getByRole("tab", { name: "Mon" }).tabIndex).toBe(-1);
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "menu-day-wed");

    await swappedTo("wed");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("wed-line");
  });

  it("never shows two lines at once — the swap waits (INV-05.7)", async () => {
    const user = userEvent.setup();
    renderChips("mon");

    await user.click(screen.getByRole("tab", { name: "Fri" }));
    expect(document.querySelectorAll("[data-word-swap]")).toHaveLength(1);

    await swappedTo("fri");
    expect(document.querySelectorAll("[data-word-swap]")).toHaveLength(1);
  });
});

describe("arrow-key roving focus", () => {
  it("moves right and left, carrying the focus with the selection", async () => {
    const user = userEvent.setup();
    renderChips("mon");

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Mon" }));

    await user.keyboard("{ArrowRight}");
    expect(selected()).toBe("tue");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Tue" }));

    await user.keyboard("{ArrowLeft}");
    expect(selected()).toBe("mon");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Mon" }));
  });

  it("wraps at both ends", async () => {
    const user = userEvent.setup();
    renderChips("mon");

    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toBe("fri");

    await user.keyboard("{ArrowRight}");
    expect(selected()).toBe("mon");
  });

  it("jumps with Home and End", async () => {
    const user = userEvent.setup();
    renderChips("wed");

    await user.tab();
    await user.keyboard("{End}");
    expect(selected()).toBe("fri");

    await user.keyboard("{Home}");
    expect(selected()).toBe("mon");
  });

  it("leaves every other key to the browser", async () => {
    const user = userEvent.setup();
    renderChips("wed");

    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(selected()).toBe("wed");
  });

  it("keeps one tab stop for the whole list, however the reader moves", async () => {
    const user = userEvent.setup();
    renderChips("mon");

    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}");

    expect(chips().filter((chip) => chip.tabIndex === 0)).toHaveLength(1);
    expect(chips().filter((chip) => chip.tabIndex === 0)[0]?.dataset.day).toBe(selected());
  });
});

describe("what crosses the boundary", () => {
  it("takes the lines as opaque nodes — no dish, no namespace, no collection", () => {
    const node = <em>a line the section rendered</em>;
    render(
      <MotionProvider>
        <Reveal id="menu.plate" stagger>
          <MenuDayChips
            days={[{ id: "mon", label: "Mon" }]}
            lines={{ mon: node }}
            defaultDay="mon"
            groupLabel={GROUP_LABEL}
          />
        </Reveal>
      </MotionProvider>,
    );

    expect(screen.getByRole("tabpanel").querySelector("em")).toHaveTextContent(
      "a line the section rendered",
    );
  });

  it("renders one chip per entry, in the order the server declared", () => {
    renderChips();

    expect(chips().map((chip) => chip.textContent)).toEqual(DAYS.map((day) => day.label));
  });

  it("draws the two states as two whole recipes, never as colliding classes", () => {
    renderChips("tue");

    const on = screen.getByRole("tab", { name: "Tue" });
    const off = screen.getByRole("tab", { name: "Mon" });

    expect(on.className).toContain("bg-daychip-selected");
    expect(on.className).not.toContain("bg-white");
    expect(off.className).toContain("bg-white");
    expect(off.className).not.toContain("bg-daychip-selected");
  });

  it("transitions the fill only, and over the token 05 §5.6 names", () => {
    renderChips();

    for (const chip of chips()) {
      expect(chip.className).toContain("transition-[background-color]");
      expect(chip.className).toContain("duration-(--dur-word-swap)");
      expect(chip.className).not.toMatch(/transition-\[?padding/u);
    }
  });
});

describe("the entrance", () => {
  it("is two stagger children, so the chips and the line drop in sequence", () => {
    renderChips();

    const items = [...document.querySelectorAll("[data-reveal]")].filter(
      (element) => !element.hasAttribute("data-reveal-id"),
    );
    expect(items).toHaveLength(2);
  });

  it("adds no observer of its own — the container above owns the only one", () => {
    const before = observer.observedCount();

    renderChips();

    // `RevealItem` carries no viewport: only the `Reveal` container is watched,
    // however many children this component contributes (INV-05.9).
    expect(observer.observedCount()).toBe(before + 1);
  });
});
