import { describe, expect, it } from "vitest";

import {
  assignSlots,
  DESKTOP_SLOTS,
  MOBILE_SLOTS,
  polaroidAspect,
  polaroidPlacement,
  polaroidTilt,
  type SlottedPhoto,
} from "@/components/sections/gallery/layout";
import { getSite } from "@/content/site";

/**
 * The gallery's slot tables (04 `D-04.6`).
 *
 * The tables are the design read off the two reference files, so what is worth
 * asserting is not their contents — a copy of the numbers here would only agree
 * with itself — but the three things that make them *work as data*:
 *
 * - the two subsets are the ones `content/site.json` actually declares, so the
 *   "7 desktop / 5 mobile" of the row is a fact about the content tree rather
 *   than a count typed into a component;
 * - a photo's wide slot and its narrow slot are **different rows**, because the
 *   narrow view omits two photos from the middle of the list — the bug this
 *   would otherwise hide is `g08` inheriting the seventh narrow slot, which
 *   does not exist;
 * - running out of slots throws, rather than dropping the photo silently.
 */

/** The photos the home wall draws, in `content/site.json` order. */
const onHome = getSite().gallery.photos.filter((photo) => photo.onHome);

function photos(...flags: readonly boolean[]): readonly SlottedPhoto[] {
  return flags.map((onMobile, index) => ({ id: `p${String(index)}`, onMobile }));
}

/** `count` photos, every one of them flagged `onMobile: value`. */
function repeated(count: number, value: boolean): readonly SlottedPhoto[] {
  return photos(...Array.from({ length: count }, () => value));
}

describe("the content tree fills the tables the design draws", () => {
  it("flags exactly one photo per wide slot", () => {
    expect(onHome).toHaveLength(DESKTOP_SLOTS.length);
  });

  it("flags exactly one of those per narrow slot", () => {
    expect(onHome.filter((photo) => photo.onMobile)).toHaveLength(MOBILE_SLOTS.length);
  });

  it("draws every slot at a distinct place, on both views", () => {
    for (const table of [DESKTOP_SLOTS, MOBILE_SLOTS]) {
      const places = table.map((slot) => slot.position);
      expect(new Set(places).size).toBe(table.length);
    }
  });

  it("tilts every frame, in both directions, within the design's ±2–6°", () => {
    for (const table of [DESKTOP_SLOTS, MOBILE_SLOTS]) {
      const degrees = table.map((slot) => {
        const found = /rotate-\[(?<value>-?\d+(?:\.\d+)?)deg\]/u.exec(slot.tilt)?.groups?.value;
        expect(found).toBeDefined();
        return Number(found);
      });

      expect(degrees.some((degree) => degree < 0)).toBe(true);
      expect(degrees.some((degree) => degree > 0)).toBe(true);
      for (const degree of degrees) {
        expect(Math.abs(degree)).toBeGreaterThanOrEqual(2);
        expect(Math.abs(degree)).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe("assignSlots fills in site.json order", () => {
  it("gives every photo a wide slot, in the table's order", () => {
    const assigned = assignSlots(onHome);

    expect(assigned).toHaveLength(onHome.length);
    assigned.forEach((slot, index) => {
      expect(slot.index).toBe(index);
      expect(slot.desktop).toBe(DESKTOP_SLOTS[index]);
    });
  });

  it("gives a narrow slot only to the photos flagged onMobile, closing the gaps", () => {
    const assigned = assignSlots(photos(true, true, false, true));

    expect(assigned.map((slot) => slot.mobile)).toEqual([
      MOBILE_SLOTS[0],
      MOBILE_SLOTS[1],
      null,
      // The third narrow slot, not the fourth: the omitted photo takes none.
      MOBILE_SLOTS[2],
    ]);
  });

  it("pairs the real content's fifth wide slot with the fourth narrow one", () => {
    const assigned = assignSlots(onHome);
    const fifth = assigned[4];

    expect(fifth?.desktop).toBe(DESKTOP_SLOTS[4]);
    expect(fifth?.mobile).toBe(MOBILE_SLOTS[3]);
  });

  it("throws rather than dropping a photo when the wide table runs out", () => {
    expect(() => assignSlots(repeated(DESKTOP_SLOTS.length + 1, false))).toThrow(
      /content\/site\.json/u,
    );
  });

  it("throws when more photos are flagged onMobile than the narrow table draws", () => {
    expect(() => assignSlots(repeated(MOBILE_SLOTS.length + 1, true))).toThrow(
      /narrow gallery wall/u,
    );
  });
});

describe("the composed class strings", () => {
  it("positions a photo on both views and clears the narrow anchors at lg", () => {
    const [first] = assignSlots(photos(true));
    expect(first).toBeDefined();
    const placement = polaroidPlacement(first as NonNullable<typeof first>);

    expect(placement).toContain("absolute");
    expect(placement).toContain(MOBILE_SLOTS[0]?.position ?? "");
    expect(placement).toContain(DESKTOP_SLOTS[0]?.position ?? "");
    // Two narrow slots hang off the right edge and one carries a centring
    // margin; the wide layout is left-anchored and must clear both.
    expect(placement).toContain("lg:right-auto");
    expect(placement).toContain("lg:ml-0");
    expect(placement).not.toMatch(/(^|\s)hidden(\s|$)/u);
  });

  it("renders an onMobile:false photo and hides it below lg, never filtering it (D-04.5)", () => {
    const [only] = assignSlots(photos(false));
    expect(only).toBeDefined();
    const slot = only as NonNullable<typeof only>;

    expect(polaroidPlacement(slot)).toContain("hidden lg:block");
    // Nothing below `lg` styles a `display: none` box, so it carries the wide
    // half of the tilt and the aspect and no narrow half at all.
    expect(polaroidTilt(slot)).toBe(DESKTOP_SLOTS[0]?.tilt);
    expect(polaroidAspect(slot)).toBe(DESKTOP_SLOTS[0]?.aspect);
  });

  it("carries both halves of the tilt and the aspect for a photo both views draw", () => {
    const [both] = assignSlots(photos(true));
    expect(both).toBeDefined();
    const slot = both as NonNullable<typeof both>;

    for (const half of [MOBILE_SLOTS[0]?.tilt, DESKTOP_SLOTS[0]?.tilt]) {
      expect(polaroidTilt(slot)).toContain(half ?? "");
    }
    for (const half of [MOBILE_SLOTS[0]?.aspect, DESKTOP_SLOTS[0]?.aspect]) {
      expect(polaroidAspect(slot)).toContain(half ?? "");
    }
  });

  it("writes every lg: class out in full, because Tailwind scans for whole names", () => {
    for (const slot of DESKTOP_SLOTS) {
      for (const entry of [slot.position, slot.tilt, slot.aspect]) {
        for (const className of entry.split(" ")) {
          expect(className.startsWith("lg:")).toBe(true);
        }
      }
    }
  });
});
