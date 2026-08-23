import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Chip } from "@/components/ui/Chip";

/**
 * The chip is decoration around copy: it is never the interactive element (the
 * pressable day and filter chips are their sections'), and it must not name a
 * per-section colour. Both are asserted, because both are easy to break by
 * reaching for `bg-bg-teachers` the first time a lavender tag is needed.
 */
describe("Chip", () => {
  it("is a pill on the radius token, at the chip type size", () => {
    render(<Chip>Certified Montessori</Chip>);
    const chip = screen.getByText("Certified Montessori");

    expect(chip).toHaveClass("rounded-pill");
    expect(chip).toHaveClass("text-chip");
    expect(chip).toHaveClass("font-body");
  });

  it("defaults to the pale sage recipe the hero badge and trust row use", () => {
    render(<Chip>Montessori daycare</Chip>);
    const chip = screen.getByText("Montessori daycare");

    expect(chip).toHaveClass("bg-chip-bg");
    expect(chip).toHaveClass("text-chip-text");
  });

  it("keeps `sage` as the solid badge 04 §3.2 pins the head-teacher badge to", () => {
    render(<Chip tone="sage">HEAD TEACHER</Chip>);
    const chip = screen.getByText("HEAD TEACHER");

    expect(chip).toHaveClass("bg-sage");
    expect(chip).toHaveClass("text-white");
    expect(chip).toHaveClass("shadow-badge");
  });

  it("draws the section-scoped tones from role variables, not section colours", () => {
    render(
      <>
        <Chip tone="cool">Classroom</Chip>
        <Chip tone="white">Vegetarian options daily</Chip>
        <Chip tone="lavender">1:3 ratio</Chip>
      </>,
    );

    expect(screen.getByText("Classroom")).toHaveClass("text-(color:--section-link)");
    expect(screen.getByText("Vegetarian options daily")).toHaveClass("text-(color:--section-sub)");
    expect(screen.getByText("1:3 ratio")).toHaveClass("bg-(color:--section-bg)");

    for (const label of ["Classroom", "Vegetarian options daily", "1:3 ratio"]) {
      expect(screen.getByText(label).className).not.toMatch(/-(gallery|menu|teachers)\b/);
    }
  });

  it("carries the gold trust pill on its own brand tokens", () => {
    render(<Chip tone="gold">5.0 on Yelp</Chip>);
    const chip = screen.getByText("5.0 on Yelp");

    expect(chip).toHaveClass("bg-yelp-pill-bg");
    expect(chip).toHaveClass("text-yelp-pill-text");
  });

  it("renders an icon decoratively, so the words are the accessible text", () => {
    const { container } = render(<Chip icon="🌿">Montessori daycare</Chip>);
    const chip = container.firstElementChild;
    const icon = chip?.querySelector('[aria-hidden="true"]');

    expect(icon).toHaveTextContent("🌿");
    expect(icon).not.toHaveAttribute("role");
    expect(chip).toHaveTextContent("Montessori daycare");
  });

  it("claims no hit area of its own — it is not the interactive element", () => {
    render(<Chip>Meals</Chip>);

    expect(screen.getByText("Meals").className).not.toContain("--tap-min");
  });
});
