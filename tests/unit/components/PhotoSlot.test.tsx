import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PhotoSlot, radiusClass, type RadiusToken } from "@/components/ui/PhotoSlot";

/**
 * The photo placeholder holds the box a client photograph will land in. Its
 * contract is 03 §9's: the fill is a mix of the *section's* background — not a
 * grey, not a hex — and the radius is a 03 §5 step, so dropping a real photo in
 * later moves nothing.
 */
describe("PhotoSlot", () => {
  it("fills with a color-mix of the section background (03 §9)", () => {
    const { container } = render(<PhotoSlot slotId="philosophy" />);

    expect(container.firstElementChild?.className).toContain(
      "bg-[color:color-mix(in_oklab,var(--section-bg)_92%,var(--color-ink))]",
    );
  });

  it("mixes tokens only — no literal colour anywhere in the fill (INV-03.1)", () => {
    const { container } = render(<PhotoSlot slotId="map" />);
    const classes = container.firstElementChild?.className ?? "";

    expect(classes).not.toMatch(/#[0-9a-fA-F]{3}/);
    expect(classes).toContain("var(--section-bg)");
    expect(classes).toContain("var(--color-ink)");
  });

  it("defaults to the card radius, which 03 §5 sets at 20px", () => {
    const { container } = render(<PhotoSlot slotId="hero" />);

    expect(container.firstElementChild).toHaveClass("rounded-card");
  });

  it("maps every 03 §5 radius step to its token utility, and mints none", () => {
    const steps: readonly RadiusToken[] = [
      "pill",
      "card-lg",
      "card",
      "card-md",
      "card-sm",
      "tile",
      "logo-card",
      "input",
      "badge",
      "polaroid",
      "full",
    ];

    for (const step of steps) {
      expect(radiusClass(step)).toBe(`rounded-${step}`);
    }
  });

  it("lets the circle shape win over the radius, for stones and teacher photos", () => {
    const { container } = render(<PhotoSlot slotId="ping" shape="circle" radius="card-lg" />);
    const slot = container.firstElementChild;

    expect(slot).toHaveClass("rounded-full");
    expect(slot).toHaveClass("aspect-square");
    expect(slot).not.toHaveClass("rounded-card-lg");
  });

  it("is announced as an image once the caller has an alt for it", () => {
    render(<PhotoSlot slotId="hero" alt="Children at work in the classroom" />);

    expect(screen.getByRole("img", { name: "Children at work in the classroom" })).toHaveAttribute(
      "data-photo-slot",
      "hero",
    );
  });

  it("is hidden from the accessibility tree while it has no alt", () => {
    const { container } = render(<PhotoSlot slotId="gallery-3" />);
    const slot = container.firstElementChild;

    expect(slot).toHaveAttribute("aria-hidden", "true");
    expect(slot).not.toHaveAttribute("role");
  });

  it("shows no copy of its own — the slot id is data, not words (INV-02.1)", () => {
    const { container } = render(<PhotoSlot slotId="philosophy" />);

    expect(container.firstElementChild).toHaveTextContent("");
    expect(container.firstElementChild).toHaveAttribute("data-photo-slot", "philosophy");
  });

  it("can carry a frame or badge the caller draws over it", () => {
    render(
      <PhotoSlot slotId="ping" shape="circle">
        <span>HEAD TEACHER</span>
      </PhotoSlot>,
    );

    expect(screen.getByText("HEAD TEACHER")).toBeInTheDocument();
  });
});
