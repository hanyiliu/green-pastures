import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormField, type FieldControlProps } from "@/components/forms/FormField";

/**
 * The labelled-control wrapper (04 §3.5) and the half of 07 §1's accessibility
 * contract it owns: a visible `<label htmlFor>` bound by id, error text as a
 * sibling element referenced by `aria-describedby` rather than a tooltip, and
 * `aria-invalid` on the control itself.
 *
 * The control is rendered through a render prop, so every assertion below is
 * really the same one: a caller *cannot* render a control that is missing the
 * wiring, because the wiring arrives as its props.
 */

function input(props: FieldControlProps) {
  return <input {...props} type="text" />;
}

describe("label binding", () => {
  it("binds the label to the control by id", () => {
    render(<FormField name="parentName" label="Parent name" control={input} />);

    const control = screen.getByLabelText("Parent name");
    expect(control).toBeInstanceOf(HTMLInputElement);
    expect(control).toHaveAttribute("name", "parentName");
  });

  it("scopes ids per instance, so two forms on one page do not collide", () => {
    render(
      <>
        <FormField name="email" label="Email" control={input} />
        <FormField name="email" label="Email" control={input} />
      </>,
    );

    const [first, second] = screen.getAllByLabelText("Email");
    expect(first?.id).not.toBe(second?.id);
    expect(first?.id).toBeTruthy();
  });
});

describe("the required marker (07 §1)", () => {
  it("marks the control required and shows the glyph the legend explains", () => {
    const { container } = render(
      <FormField name="parentName" label="Parent name" required control={input} />,
    );

    const control = screen.getByLabelText(/Parent name/u);
    expect(control).toBeRequired();
    expect(control).toHaveAttribute("aria-required", "true");

    // The glyph is decorative: `aria-required` already carries the meaning.
    const marker = container.querySelector("label span");
    expect(marker).toHaveTextContent("*");
    expect(marker).toHaveAttribute("aria-hidden", "true");
  });

  it("leaves an optional field unmarked", () => {
    render(<FormField name="message" label="Message" control={input} />);

    const control = screen.getByLabelText("Message");
    expect(control).not.toBeRequired();
    expect(control).toHaveAttribute("aria-required", "false");
  });
});

describe("error and help text", () => {
  it("describes the control with neither when it has neither", () => {
    render(<FormField name="email" label="Email" control={input} />);

    const control = screen.getByLabelText("Email");
    expect(control).not.toHaveAttribute("aria-describedby");
    expect(control).toHaveAttribute("aria-invalid", "false");
  });

  it("points aria-describedby at the error element and sets aria-invalid", () => {
    render(
      <FormField
        name="email"
        label="Email"
        error="That email doesn't look right."
        control={input}
      />,
    );

    const control = screen.getByLabelText("Email");
    expect(control).toHaveAttribute("aria-invalid", "true");

    const describedBy = control.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? "")).toHaveTextContent(
      "That email doesn't look right.",
    );
  });

  it("describes the control with the help text and the error together, in that order", () => {
    render(
      <FormField
        name="email"
        label="Email"
        help="We only use it to reply."
        error="Required."
        control={input}
      />,
    );

    const ids = screen.getByLabelText("Email").getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0] ?? "")).toHaveTextContent("We only use it to reply.");
    expect(document.getElementById(ids[1] ?? "")).toHaveTextContent("Required.");
  });
});
