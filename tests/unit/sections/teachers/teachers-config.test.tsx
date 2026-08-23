import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import * as layout from "@/components/sections/teachers/layout";
import { Chip } from "@/components/ui/Chip";

/**
 * The Teachers section's geometry, checked as a module (04 `D-04.6`, INV-04.5).
 *
 * `layout.ts` is where every number the two references draw for this section
 * lives, so it is also where the class-level invariants can be checked once
 * instead of per component: no raw value, no breakpoint outside 03's two, no
 * `uppercase` (04 §5.5), and the one reorder the section is allowed.
 *
 * The last block is the interesting one. The HEAD TEACHER badge overrides
 * `Chip`'s padding with 03 §4's `--chip-head-teacher`, and it does so with
 * **one** important class: the token flips at `--breakpoint-md` inside
 * `tokens.css`, and `!important` outranks a non-important rule whether or not
 * that rule sits in a media query. The badge carried a `md:` twin as well until
 * `gp-dln.135` measured the pair against the single class in chromium and found
 * them identical at 390px and 1280px; the assertion below now pins the single
 * class, so restoring the twin fails rather than passing unnoticed.
 */

const CLASSES: ReadonlyArray<readonly [string, string]> = Object.entries(layout);

/**
 * A class's variant prefixes, ignoring the `:` inside an arbitrary value — the
 * same split `withOverrides` performs, so `text-(color:--section-sub)` reads as
 * an unprefixed utility rather than as a `text-(color` variant.
 */
function variantsOf(className: string): readonly string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < className.length; index += 1) {
    const character = className.charAt(index);
    if (character === "[" || character === "(") depth += 1;
    else if (character === "]" || character === ")") depth -= 1;
    else if (character === ":" && depth === 0) {
      parts.push(className.slice(start, index));
      start = index + 1;
    }
  }

  return parts;
}

describe("the geometry is written in tokens (INV-03.1, INV-03.2, INV-03.3)", () => {
  it("exports only class strings, and every one of them is non-empty", () => {
    expect(CLASSES.length).toBeGreaterThan(0);
    for (const [name, value] of CLASSES) {
      expect([name, typeof value]).toEqual([name, "string"]);
      expect([name, value]).not.toEqual([name, ""]);
    }
  });

  it("uses no arbitrary colour, px, rem, ms or bezier", () => {
    for (const [name, value] of CLASSES) {
      expect([name, /-\[#|\[[0-9.]+(px|ms|rem|s)\]|cubic-bezier/u.test(value)]).toEqual([
        name,
        false,
      ]);
    }
  });

  it("uses only the md: and lg: variants 03 §1 allows", () => {
    for (const [name, value] of CLASSES) {
      for (const className of value.split(/\s+/u)) {
        for (const variant of variantsOf(className)) {
          expect([variant, name]).toEqual([expect.stringMatching(/^(md|lg)$/u), name]);
        }
      }
    }
  });

  it("applies no uppercase of its own — that recipe is Eyebrow's (04 §5.5)", () => {
    for (const [name, value] of CLASSES) {
      expect([name, value.split(/\s+/u).includes("uppercase")]).toEqual([name, false]);
    }
  });
});

describe("the layout switch is lg, the copy switch is md (03 D-03.6, 04 §6)", () => {
  it("moves every box at lg, so a tablet keeps the mobile structure", () => {
    const structural = [
      layout.TEACHERS_ROW,
      layout.TEACHERS_HEAD_FRAME,
      layout.TEACHERS_ASSISTANT_FRAME,
      layout.TEACHERS_LINK_ROW,
      layout.TEACHERS_HEAD_CARD,
      layout.TEACHERS_ASSISTANT_CARD,
      layout.TEACHERS_HEAD_PHOTO,
      layout.TEACHERS_HEAD_RING,
    ];

    for (const value of structural) {
      expect(value).toMatch(/\blg:/u);
      // The badge is the one exception and is asserted on its own below.
      expect(value).not.toMatch(/\bmd:/u);
    }
  });
});

describe("the mobile reorder is one class on one frame (04 §4)", () => {
  it("orders the head teacher's frame first below lg and releases it above", () => {
    expect(layout.TEACHERS_HEAD_FRAME).toContain("order-first");
    expect(layout.TEACHERS_HEAD_FRAME).toContain("lg:order-none");
  });

  it("leaves the assistants' frame in DOM order at every width", () => {
    expect(layout.TEACHERS_ASSISTANT_FRAME).not.toMatch(/(^|\s|:)order-/u);
  });

  it("wraps below lg and stops wrapping at the triptych", () => {
    expect(layout.TEACHERS_ROW).toContain("flex-wrap");
    expect(layout.TEACHERS_ROW).toContain("lg:flex-nowrap");
    expect(layout.TEACHERS_HEAD_FRAME).toContain("w-full");
    expect(layout.TEACHERS_ASSISTANT_FRAME).toContain("flex-1");
  });
});

describe("the overrides a primitive's recipe would otherwise win (04 §3.2)", () => {
  it("marks the head photograph's width important, against PhotoSlot's w-full", () => {
    for (const className of layout.TEACHERS_HEAD_PHOTO.split(/\s+/u)) {
      expect(className).toMatch(/!$/u);
    }
  });

  it("lands --chip-head-teacher on the badge with one important class, not two", () => {
    const { container } = render(
      <Chip tone="sage" className={layout.TEACHERS_HEAD_BADGE}>
        {"HEAD TEACHER"}
      </Chip>,
    );

    const chip = container.firstElementChild;
    expect(chip).not.toBeNull();

    const padding = new Map<string, { recipe: boolean; override: boolean }>();
    for (const className of (chip?.className ?? "").split(/\s+/u)) {
      const variants = variantsOf(className);
      const utility = className.slice(variants.join(":").length).replace(/^:/u, "");
      if (!/^-?p[xytrbles]?-/u.test(utility)) continue;

      const variant = variants.join(":");
      const entry = padding.get(variant) ?? { recipe: false, override: false };
      if (utility.endsWith("!")) entry.override = true;
      else entry.recipe = true;
      padding.set(variant, entry);
    }

    // Padding is claimed at exactly one variant — unprefixed — on both sides.
    // `Chip`'s recipe binds `--chip-hero-badge`, whose own `var()` flips at
    // `md`, so neither the recipe nor the override has a `md:` twin to answer.
    expect([...padding.keys()].sort()).toEqual([""]);
    for (const [variant, entry] of padding) {
      expect([variant, entry.recipe, entry.override]).toEqual([variant, true, true]);
    }
    expect(layout.TEACHERS_HEAD_BADGE).toContain("p-(--chip-head-teacher)!");
  });
});
