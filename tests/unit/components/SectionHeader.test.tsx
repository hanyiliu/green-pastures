import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Section } from "@/components/layout/Section";
import { SectionHeader, type SectionHeaderProps } from "@/components/layout/SectionHeader";

/**
 * The header stack. Its contract is the one `D-04.5` is strictest about: a
 * per-view string renders **both** ways and lets CSS choose, so the server HTML
 * is the same for every viewport. The other half is that the heading it renders
 * is the element the enclosing `Section` names.
 */
describe("SectionHeader", () => {
  it("gives the enclosing Section a heading to be named by", () => {
    render(
      <Section id="programs" labelledBy="programs-title">
        <SectionHeader titleId="programs-title" title="Growing with us" />
      </Section>,
    );

    expect(screen.getByRole("region", { name: "Growing with us" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveAttribute("id", "programs-title");
  });

  it("renders the eyebrow through the one uppercase recipe", () => {
    render(<SectionHeader titleId="t" title="Growing with us" eyebrow="Programs & ages" />);

    expect(screen.getByText("Programs & ages")).toHaveClass("uppercase");
  });

  it("omits the eyebrow and the intro when the caller has no key for them", () => {
    const { container } = render(<SectionHeader titleId="t" title="A week of meals" />);

    expect(container.querySelectorAll("p")).toHaveLength(0);
    expect(container.querySelectorAll("span")).toHaveLength(0);
  });

  it("renders one h1 for a subpage when asked", () => {
    render(<SectionHeader titleId="t" title="Our philosophy" as="h1" />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders both intro strings and lets md: pick one (D-04.5)", () => {
    render(
      <SectionHeader
        titleId="t"
        title="Growing with us"
        intro="Three little stepping-stones, from first steps to kindergarten-ready."
        introShort="Three stepping-stones, from first steps to kindergarten."
      />,
    );

    const short = screen.getByText(/^Three stepping-stones/);
    const long = screen.getByText(/^Three little stepping-stones/);

    expect(short).toHaveClass("md:hidden");
    expect(long).toHaveClass("hidden", "md:block");
  });

  it("keeps a lone intro visible on every view", () => {
    render(<SectionHeader titleId="t" title="Our photo wall" intro="Everyday moments." />);
    const intro = screen.getByText("Everyday moments.");

    expect(intro).not.toHaveClass("hidden");
    expect(intro).not.toHaveClass("md:hidden");
  });

  it("hides a desktop-only intro with CSS rather than a viewport check", () => {
    render(
      <SectionHeader
        titleId="t"
        title="Growing with us"
        intro="Each with its own prepared environment."
        introDesktopOnly
      />,
    );
    const intro = screen.getByText("Each with its own prepared environment.");

    // Present in the DOM at every width — hidden, never absent.
    expect(intro).toHaveClass("hidden", "md:block");
  });

  it("colours the intro from the section role variable, not a section colour", () => {
    render(<SectionHeader titleId="t" title="A week of meals" intro="Fresh, home-cooked." />);
    const intro = screen.getByText("Fresh, home-cooked.");

    expect(intro).toHaveClass("text-(color:--section-sub)");
    expect(intro.className).not.toMatch(/--color-sub-/);
  });

  it("stacks and spaces itself from the design's gaps, per view", () => {
    const { container } = render(<SectionHeader titleId="t" title="Who we are" />);
    const stack = container.firstElementChild;

    expect(stack).toHaveClass("flex", "flex-col");
    expect(stack).toHaveClass("gap-2.5", "md:gap-3");
    expect(stack).toHaveClass("mb-7", "md:mb-11");
    expect(stack).toHaveClass("items-center", "text-center");
  });

  it("can align to the start for the two-column blocks", () => {
    const { container } = render(
      <SectionHeader titleId="t" title="Come and visit" align="start" />,
    );

    expect(container.firstElementChild).toHaveClass("items-start", "text-start");
  });

  /**
   * `introShort` and `introDesktopOnly` are alternatives, and used not to be:
   * both spellings produced the same `hidden md:block`, so passing the flag
   * beside a short intro said nothing and was accepted anyway. The union in
   * `SectionHeaderProps` now rejects the pair, which is what the
   * `@ts-expect-error` below asserts — `tsc --noEmit` fails if the combination
   * ever becomes legal again.
   */
  describe("the two intro shapes", () => {
    it("hides a desktop-only intro below md and shows it above", () => {
      render(<SectionHeader titleId="t" title="Programs" intro="Three rooms." introDesktopOnly />);

      expect(screen.getByText("Three rooms.")).toHaveClass("hidden", "md:block");
    });

    it("renders both halves of a pair and lets md: pick", () => {
      render(
        <SectionHeader titleId="t" title="Programs" intro="Three rooms." introShort="Rooms." />,
      );

      expect(screen.getByText("Rooms.")).toHaveClass("md:hidden");
      expect(screen.getByText("Three rooms.")).toHaveClass("hidden", "md:block");
    });

    it("keeps one intro visible on both views when neither is asked for", () => {
      render(<SectionHeader titleId="t" title="Programs" intro="Three rooms." />);
      const intro = screen.getByText("Three rooms.");

      expect(intro).not.toHaveClass("hidden");
      expect(intro).not.toHaveClass("md:block");
    });

    it("rejects the pair the type union excludes", () => {
      const pair = {
        titleId: "t",
        title: "Programs",
        intro: "Three rooms.",
        introShort: "Rooms.",
        introDesktopOnly: true,
      };

      // @ts-expect-error `introDesktopOnly` says nothing beside `introShort`, so
      // `SectionHeaderIntro` has no member this object satisfies.
      const rejected: SectionHeaderProps = pair;

      expect(rejected.introShort).toBe("Rooms.");
    });
  });

  describe("caller classes", () => {
    it("takes a class that sets a property the recipe leaves alone", () => {
      const { container } = render(
        <SectionHeader titleId="t" title="Who we are" className="max-w-140" />,
      );

      expect(container.firstElementChild).toHaveClass("max-w-140");
    });

    it("refuses the bottom margin the recipe already sets", () => {
      expect(() =>
        render(<SectionHeader titleId="t" title="Who we are" className="mb-0" />),
      ).toThrow(/"mb-0"/u);
    });

    it("takes the same margin marked important", () => {
      const { container } = render(
        <SectionHeader titleId="t" title="Who we are" className="mb-0!" />,
      );

      expect(container.firstElementChild).toHaveClass("mb-0!");
    });
  });
});
