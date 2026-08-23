import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * Unit-harness self-test (PR-2.5, 08 §4).
 *
 * The one unit test the lint-and-test-tooling PR owns. It asserts the four
 * pieces D-08.6 names are actually wired — jsdom, `@testing-library/react`,
 * `@testing-library/jest-dom`'s matchers and `user-event` — so that when a real
 * suite goes red in Phase 3 the failure is the code and never the rig.
 *
 * The section suites of 08 §4 (component render loop, DOM-literal test, i18n,
 * content, tokens, motion, inquiry) replace this file's role as they land; this
 * one stays, because "the harness itself works" is the assertion nothing else
 * makes.
 */
function Counter({ onPress }: { onPress: () => void }) {
  return (
    <button type="button" onClick={onPress}>
      press me
    </button>
  );
}

describe("unit harness", () => {
  it("renders React 19 into jsdom and exposes jest-dom matchers", () => {
    render(<Counter onPress={() => undefined} />);

    const button = screen.getByRole("button", { name: "press me" });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("type", "button");
  });

  it("dispatches real user events", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();

    render(<Counter onPress={onPress} />);
    await user.click(screen.getByRole("button", { name: "press me" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("cleans the DOM up between tests", () => {
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
