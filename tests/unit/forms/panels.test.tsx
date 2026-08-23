import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { FormAlert } from "@/components/forms/FormAlert";
import { NoscriptFallback, type InquiryContact } from "@/components/forms/NoscriptFallback";
import { SuccessPanel } from "@/components/forms/SuccessPanel";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { reference } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

/**
 * The three leaves that render an outcome: the success panel, the failure
 * banner, and the no-JavaScript fallback.
 *
 * Every expectation reads its copy out of `reference` rather than spelling it
 * out, which is INV-02.1 pointed at the tests: an assertion that quoted "Thank
 * you — your request is on its way." would keep passing on the day the
 * component started quoting it too.
 */

const visitForm = reference.visit.form;

const CONTACT: InquiryContact = {
  email: "hello@example.test",
  phone: "+15105550142",
  phoneDisplay: "(510) 555-0142",
};

function wrap(children: ReactNode) {
  return render(
    <NextIntlClientProvider
      locale={routing.defaultLocale}
      messages={reference}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      {children}
    </NextIntlClientProvider>,
  );
}

describe("SuccessPanel (07 D-07.4)", () => {
  it("puts focus on its heading, because the form the parent was in is gone", () => {
    wrap(<SuccessPanel onReset={vi.fn()} />);

    const heading = screen.getByRole("heading", { name: visitForm.status.success.title });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(heading).toHaveFocus();
  });

  it("offers one control that resets the form for another inquiry", () => {
    const onReset = vi.fn();
    wrap(<SuccessPanel onReset={onReset} />);

    screen.getByRole("button", { name: visitForm.status.success.reset }).click();
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe("FormAlert (07 D-07.4, 04 D-04.14)", () => {
  it("announces itself as an alert and renders the resolved key", () => {
    wrap(<FormAlert messageKey="errors.rateLimited" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(visitForm.errors.rateLimited);
  });

  it("renders no direct-contact line unless one is handed to it", () => {
    wrap(<FormAlert messageKey="errors.turnstileFailed" />);

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("puts the direct-contact fallback inside the alert, as two real links", () => {
    wrap(<FormAlert messageKey="errors.emailFailed" contact={CONTACT} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(visitForm.errors.emailFailed);

    expect(screen.getByRole("link", { name: CONTACT.email })).toHaveAttribute(
      "href",
      `mailto:${CONTACT.email}`,
    );
    // Printed and dialled from two different fields (02 Shared config).
    expect(screen.getByRole("link", { name: CONTACT.phoneDisplay })).toHaveAttribute(
      "href",
      `tel:${CONTACT.phone}`,
    );
  });

  it("leaves no marker behind when it interpolates the two links", () => {
    wrap(<FormAlert messageKey="errors.emailFailed" contact={CONTACT} />);

    expect(screen.getByRole("alert").textContent ?? "").not.toContain("⟦");
  });
});

describe("NoscriptFallback (07 D-07.5)", () => {
  /**
   * A scripting-enabled browser parses `noscript` content as raw text, which is
   * why the component writes markup rather than children — so the assertions
   * read the element's `innerHTML`, which is what a browser with scripting off
   * would parse and render.
   */
  function renderFallback(): string {
    const { container } = wrap(<NoscriptFallback contact={CONTACT} />);
    const noscript = container.querySelector("noscript");
    expect(noscript).not.toBeNull();
    return noscript?.innerHTML ?? "";
  }

  it("says the form cannot be sent and offers both contacts", () => {
    const html = renderFallback();

    expect(html).toContain(visitForm.noscript);
    expect(html).toContain(`href="mailto:${CONTACT.email}"`);
    expect(html).toContain(`href="tel:${CONTACT.phone}"`);
    expect(html).toContain(CONTACT.phoneDisplay);
  });

  it("escapes the copy around the links and leaves no marker behind", () => {
    const html = renderFallback();

    expect(html).not.toContain("⟦");
    // The copy's apostrophes survive as entities rather than as raw markup.
    expect(html.startsWith("<p ")).toBe(true);
  });

  it("carries no client code — it is a server component", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile("src/components/forms/NoscriptFallback.tsx", "utf8"),
    );
    expect(source.trimStart().startsWith('"use client"')).toBe(false);
  });
});
