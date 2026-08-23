import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionProvider } from "@/components/motion/MotionProvider";
import { resetRevealRegistry } from "@/components/motion/registry";
import { StonePath } from "@/components/sections/programs/StonePath";
import type { ProgramEntry } from "@/content/collections";
import type { ProgramText } from "@/content/schemas/programs";
import { getSite } from "@/content/site";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { loadMessages, reference } from "@/i18n/messages";
import { routing, type Locale } from "@/i18n/routing";

import {
  installIntersectionObserverStub,
  type IntersectionObserverStub,
} from "../../motion/harness";

/**
 * The stepping stones (04 §3.5's `StonePath` row; 05 §5.3; `docs/design/desktop
 * /README.md` §3 and `docs/design/mobile/README.md` §3).
 *
 * This is where the row's acceptance lives, and every one of its four clauses
 * is something a green build cannot check on its own:
 *
 * - the **drawn diameters** — 104/122/104 below `md`, 150/188/150 above — which
 *   are the numbers 03 §4 "component sizes" prints for this section and the
 *   only thing that makes the middle stone read as raised;
 * - the **three columns at `lg`** and the alternating path below it, one DOM
 *   with two sets of classes rather than two components (INV-04.4);
 * - the **`summaryShort` toggle**, which must render *both* strings so that no
 *   view is a code branch (`D-04.5`);
 * - **no locale branching**: every enabled locale renders byte-identical class
 *   attributes, iterated from `routing.locales` so a fourth locale needs no
 *   edit here.
 *
 * The expected text is read from `content/` rather than typed out, so the suite
 * catches a stone that stopped rendering its name instead of agreeing with
 * itself. The class strings *are* typed out, because agreeing with
 * `layout.ts` is exactly what would let the geometry drift unnoticed.
 */

let observer: IntersectionObserverStub;

beforeAll(() => {
  observer = installIntersectionObserverStub();
});

beforeEach(() => {
  resetRevealRegistry();
});

/* -------------------------------------------------------------------------- *
 * Fixtures — `site.programs[]` joined with one locale's text
 * -------------------------------------------------------------------------- */

const site = getSite();

/**
 * The join `src/content/collections.ts` performs on the server, done here from
 * the message tree instead: that module throws on import in a browser
 * (02 `D-02.16`) and this suite runs in jsdom. Its own join is covered by
 * `tests/unit/content/loaders.test.ts`; what this file needs is the shape.
 */
function entriesFor(text: Readonly<Record<string, ProgramText>>): readonly ProgramEntry[] {
  return site.programs.map((shared) => {
    const localized = text[shared.id];
    if (localized === undefined) throw new Error(`no text for programme "${shared.id}"`);
    return { ...shared, text: localized };
  });
}

const referenceText: Readonly<Record<string, ProgramText>> = reference.collections.programs;
const entries = entriesFor(referenceText);

/**
 * The message tree production would assemble for a locale (02 `D-02.8`).
 *
 * `loadMessages` reads `NODE_ENV` to decide whether to merge the locale over
 * `en`, and production is both the branch a visitor sees and the one a locale
 * with an empty collection file — both Chinese trees today — depends on.
 */
async function productionEntries(locale: Locale): Promise<readonly ProgramEntry[]> {
  vi.stubEnv("NODE_ENV", "production");
  const tree = await loadMessages(locale);
  vi.unstubAllEnvs();
  return entriesFor(tree.collections.programs);
}

function renderPath(items: readonly ProgramEntry[] = entries, locale: Locale = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={reference}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      <MotionProvider>
        <StonePath items={items} />
      </MotionProvider>
    </NextIntlClientProvider>,
  );
}

function stones(): readonly HTMLElement[] {
  return within(screen.getByRole("list")).getAllByRole("listitem");
}

/** The one stone whose `site.json` entry is `featured` — the design's Toddler. */
const featuredIndex = site.programs.findIndex((programme) => programme.featured);

/* -------------------------------------------------------------------------- *
 * Structure and semantics (04 §3.5, §7)
 * -------------------------------------------------------------------------- */

describe("the path", () => {
  it("is a list of one item per programme, in `site.programs[]` order", () => {
    renderPath();

    const items = stones();
    expect(items).toHaveLength(site.programs.length);

    const names = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(site.programs.map((programme) => referenceText[programme.id]?.name));
  });

  it("gives every stone a name, an age line and a photo labelled from its own locale", () => {
    renderPath();

    for (const [index, programme] of site.programs.entries()) {
      const text = referenceText[programme.id];
      const stone = stones()[index];
      if (text === undefined || stone === undefined) throw new Error("missing fixture");

      expect(within(stone).getByRole("heading", { level: 3 })).toHaveTextContent(text.name);
      expect(stone).toHaveTextContent(text.ageLabel);
      expect(within(stone).getByRole("img", { name: text.photoAlt })).toHaveAttribute(
        "data-photo-slot",
        programme.id,
      );
    }
  });

  it("upper-cases only the age line, through `Eyebrow` (04 §5.5)", () => {
    renderPath();

    const stone = stones()[0];
    const uppercased = stone?.querySelectorAll(".uppercase") ?? [];
    expect(uppercased).toHaveLength(1);
    expect(uppercased[0]).toHaveTextContent(referenceText.infant?.ageLabel ?? "");
  });

  it("wraps each photo in a `deco-*` stepping stone that is not hidden from assistive tech", () => {
    renderPath();

    for (const programme of site.programs) {
      const stone = document.getElementById(`deco-programs-stone-${programme.id}`);
      expect(stone).toHaveAttribute("data-deco", `deco-programs-stone-${programme.id}`);
      expect(stone).not.toHaveAttribute("aria-hidden");
    }
  });
});

/* -------------------------------------------------------------------------- *
 * The drawn geometry (03 §4; the row's acceptance)
 * -------------------------------------------------------------------------- */

/**
 * The diameters 03 §4 prints, on Tailwind's `--spacing` scale: `size-26` is
 * 104px, `size-30.5` 122px, `size-37.5` 150px, `size-47` 188px. Both classes of
 * a pair are important because `PhotoSlot`'s recipe already sets `w-full`.
 */
const DIAMETERS: Readonly<Record<string, readonly [string, string]>> = {
  infant: ["size-26!", "md:size-37.5!"],
  toddler: ["size-30.5!", "md:size-47!"],
  preschool: ["size-26!", "md:size-37.5!"],
};

describe("the stone sizes", () => {
  it("draws 104/122/104 below `md` and 150/188/150 above it", () => {
    renderPath();

    for (const programme of site.programs) {
      const photo = document.querySelector(`[data-photo-slot="${programme.id}"]`);
      const expected = DIAMETERS[programme.id];
      if (photo === null || expected === undefined) throw new Error("missing fixture");

      for (const className of expected) expect(photo).toHaveClass(className);
    }
  });

  it("rings the featured stone in the heavier shadow and everything else in the lighter one", () => {
    renderPath();

    for (const [index, programme] of site.programs.entries()) {
      const outer = document.getElementById(`deco-programs-stone-${programme.id}`);
      const ring = outer?.firstElementChild;
      expect(ring).toHaveClass(index === featuredIndex ? "shadow-stone-lg" : "shadow-stone");
      expect(ring).toHaveClass("rounded-full", "bg-white");
    }
  });

  it("raises the featured column by 34px on the three-column row", () => {
    renderPath();

    const items = stones();
    expect(items[featuredIndex]).toHaveClass("lg:mb-8.5", "lg:w-59", "lg:gap-3.75");

    for (const [index, item] of items.entries()) {
      if (index === featuredIndex) continue;
      expect(item).toHaveClass("lg:w-50", "lg:gap-3.25");
      expect(item).not.toHaveClass("lg:mb-8.5");
    }
  });
});

/* -------------------------------------------------------------------------- *
 * The two views, both in CSS (INV-04.4, `D-04.5`)
 * -------------------------------------------------------------------------- */

describe("the two views", () => {
  it("becomes a bottom-aligned row of three at `lg` and a column below it", () => {
    renderPath();

    expect(screen.getByRole("list")).toHaveClass(
      "flex",
      "flex-col",
      "gap-5.5",
      "lg:flex-row",
      "lg:items-end",
      "lg:justify-center",
      "lg:gap-11",
      "lg:max-w-245",
    );
  });

  it("mirrors every other row below `lg` and straightens them all above", () => {
    renderPath();

    for (const item of stones()) expect(item).toHaveClass("lg:flex-col", "lg:text-center");

    // Parity, not `featured` — see STONE_ITEM_MIRRORED. With the design's three
    // programmes the two readings agree, and only this one keeps alternating.
    const parity = site.programs.map((_, index) => index % 2 === 1);
    expect(stones().map((item) => item.classList.contains("flex-row-reverse"))).toEqual(parity);
    expect(stones().map((item) => item.classList.contains("text-end"))).toEqual(parity);
  });

  it("renders both blurbs where the design draws a short one, and lets `md:` choose", () => {
    renderPath();

    const shortened = site.programs.filter((p) => referenceText[p.id]?.summaryShort !== undefined);
    expect(shortened.length).toBeGreaterThan(0);

    for (const programme of shortened) {
      const text = referenceText[programme.id];
      expect(screen.getByText(text?.summary ?? "")).toHaveClass("hidden", "md:block");
      expect(screen.getByText(text?.summaryShort ?? "")).toHaveClass("md:hidden");
    }
  });

  it("renders one blurb, always visible, where the design draws only the long one", () => {
    renderPath();

    const plain = site.programs.filter((p) => referenceText[p.id]?.summaryShort === undefined);
    expect(plain.length).toBeGreaterThan(0);

    for (const programme of plain) {
      expect(screen.getByText(referenceText[programme.id]?.summary ?? "")).not.toHaveClass(
        "hidden",
      );
    }
  });

  it("sizes the featured name through a token 03 has yet to mint, falling back to the one it has", () => {
    renderPath();

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings[featuredIndex]).toHaveClass(
      "text-[length:var(--text-program-title-featured,var(--text-program-title))]!",
    );

    for (const [index, heading] of headings.entries()) {
      if (index === featuredIndex) continue;
      expect(heading).toHaveClass("text-program-title!");
    }
  });
});

/* -------------------------------------------------------------------------- *
 * Motion (05 §5.1, §5.3, INV-05.4, INV-05.9)
 * -------------------------------------------------------------------------- */

describe("the entrance", () => {
  it("is one stagger container over three items, and observes only the container", () => {
    renderPath();

    const container = document.querySelector('[data-reveal-id="programs.stones"]');
    expect(container?.tagName).toBe("UL");

    for (const item of stones()) expect(item).toHaveAttribute("data-reveal");

    expect(observer.observedCount()).toBe(1);
    const options = observer.constructed.map((entry) => JSON.stringify(entry));
    expect(new Set(options).size).toBeLessThanOrEqual(1);
  });
});

/* -------------------------------------------------------------------------- *
 * Locales (INV-02.9, INV-04.4 — no locale branching anywhere)
 * -------------------------------------------------------------------------- */

describe("every enabled locale", () => {
  it("renders the same classes and its own words", async () => {
    const first = renderPath();
    const referenceClasses = stones().map((item) => item.className);
    first.unmount();

    for (const locale of routing.locales) {
      const items = await productionEntries(locale);
      const { unmount } = renderPath(items, locale);

      expect(stones().map((item) => item.className)).toEqual(referenceClasses);

      for (const entry of items) {
        expect(screen.getByRole("img", { name: entry.text.photoAlt })).toBeInTheDocument();
        expect(
          screen.getByRole("heading", { level: 3, name: entry.text.name }),
        ).toBeInTheDocument();
      }

      unmount();
    }
  });
});
