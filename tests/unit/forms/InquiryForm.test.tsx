import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InquiryForm } from "@/components/forms/InquiryForm";
import type { InquiryContact } from "@/components/forms/NoscriptFallback";
import type { TurnstileProps } from "@/components/forms/Turnstile";
import { formats, TIME_ZONE } from "@/i18n/formats";
import { reference } from "@/i18n/messages";
import { routing } from "@/i18n/routing";
import { HONEYPOT_FIELD, TURNSTILE_TOKEN_FIELD } from "@/lib/inquiry/schema";

/**
 * The form (07 §1, `D-07.4`; 04 §3.5).
 *
 * **Turnstile is mocked, and only Turnstile.** The real wrapper is exercised in
 * its own file against a hand-driven script; here it stands in as the thing it
 * is from the form's side — something that eventually produces a token, or
 * eventually says it cannot. Everything else is the real component: the real
 * shared schema decides which fields are invalid, and the real message tree
 * supplies every string an assertion compares against.
 */

const turnstile = vi.hoisted(() => ({
  token: "test-token",
  unavailable: false,
  execute: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("@/components/forms/Turnstile", async () => {
  const { useEffect, useImperativeHandle } = await import("react");
  return {
    Turnstile: ({ ref, onToken, onUnavailable }: TurnstileProps) => {
      useImperativeHandle(ref, () => ({ execute: turnstile.execute, reset: turnstile.reset }), []);
      useEffect(() => {
        if (turnstile.unavailable) onUnavailable();
        else if (turnstile.token.length > 0) onToken(turnstile.token);
        // The stand-in reports once per mount, like the real widget.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <div data-testid="turnstile" />;
    },
  };
});

const visitForm = reference.visit.form;

const CONTACT: InquiryContact = {
  email: "hello@example.test",
  phone: "+15105550142",
  phoneDisplay: "(510) 555-0142",
};

const VALID = {
  parentName: "Wei Chen",
  email: "wei@example.test",
  childAge: "toddler",
};

function renderForm() {
  return render(
    <NextIntlClientProvider
      locale={routing.defaultLocale}
      messages={reference}
      formats={formats}
      timeZone={TIME_ZONE}
    >
      <InquiryForm
        source="home"
        contact={CONTACT}
        turnstileSiteKey="site-key"
        noscript={<div data-testid="noscript-node" />}
      />
    </NextIntlClientProvider>,
  );
}

function control(label: string): HTMLElement {
  return screen.getByLabelText(new RegExp(label, "u"));
}

function fillValid(): void {
  fireEvent.change(control(visitForm.fields.parentName.label), {
    target: { value: VALID.parentName },
  });
  fireEvent.change(control(visitForm.fields.email.label), { target: { value: VALID.email } });
  fireEvent.change(control(visitForm.fields.childAge.label), {
    target: { value: VALID.childAge },
  });
}

function submitButton(): HTMLElement {
  return screen.getByRole("button", { name: visitForm.submit });
}

/** The form element, not the button: the button's name changes while pending. */
function formElement(): HTMLFormElement {
  const form = document.querySelector("form");
  if (form === null) throw new Error("no form rendered");
  return form;
}

function submit(): void {
  fireEvent.submit(formElement());
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/** A 429 from the WAF: a platform page, not our JSON (07 §1's table). */
function opaqueResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.reject(new Error("not json")),
  } as unknown as Response;
}

const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>();

beforeEach(() => {
  turnstile.token = "test-token";
  turnstile.unavailable = false;
  turnstile.execute.mockClear();
  turnstile.reset.mockClear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* -------------------------------------------------------------------------- *
 * Shape
 * -------------------------------------------------------------------------- */

describe("what the form renders (07 §1, 04 §3.5)", () => {
  it("draws the design's five controls, labelled and bound", () => {
    renderForm();

    expect(control(visitForm.fields.parentName.label)).toHaveAttribute("type", "text");
    expect(control(visitForm.fields.email.label)).toHaveAttribute("type", "email");
    expect(control(visitForm.fields.childAge.label).tagName).toBe("SELECT");
    expect(control(visitForm.fields.desiredStart.label).tagName).toBe("SELECT");
    expect(control(visitForm.fields.message.label).tagName).toBe("TEXTAREA");
  });

  it("carries the native constraints the no-JavaScript path needs (D-07.5)", () => {
    renderForm();

    expect(control(visitForm.fields.parentName.label)).toBeRequired();
    expect(control(visitForm.fields.email.label)).toBeRequired();
    expect(control(visitForm.fields.childAge.label)).toBeRequired();
    expect(control(visitForm.fields.desiredStart.label)).not.toBeRequired();
    expect(control(visitForm.fields.message.label)).toHaveAttribute("maxlength", "1000");
  });

  it("posts to the fixed unlocalised endpoint and sets lang from the page locale", () => {
    renderForm();
    const form = submitButton().closest("form");

    expect(form).toHaveAttribute("action", "/api/inquiry");
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("lang", routing.defaultLocale);
  });

  it("hands native validation over to JavaScript only once JavaScript is there", async () => {
    renderForm();
    // The attribute is absent from the server HTML and set on mount, which is
    // what keeps the form validating with scripting off.
    await waitFor(() => {
      expect(formElement().noValidate).toBe(true);
    });
  });

  it("renders 07 §1's technical fields, honeypot included and off-screen", async () => {
    const { container } = renderForm();

    const honeypot = container.querySelector<HTMLInputElement>(`[name="${HONEYPOT_FIELD}"]`);
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("aria-hidden", "true");
    // Never `display: none` — a naive bot has to be able to fill it (07 §1).
    expect(honeypot?.className).not.toMatch(/\bhidden\b/u);

    await waitFor(() => {
      expect(container.querySelector<HTMLInputElement>('[name="submissionId"]')?.value).toMatch(
        /^[0-9a-f-]{36}$/u,
      );
    });
    expect(
      Number(container.querySelector<HTMLInputElement>('[name="startedAt"]')?.value),
    ).toBeGreaterThan(0);
    expect(container.querySelector<HTMLInputElement>('[name="locale"]')?.value).toBe(
      routing.defaultLocale,
    );
    expect(container.querySelector<HTMLInputElement>('[name="source"]')?.value).toBe("home");
  });

  it("renders the noscript fallback it was handed, and hides the submit without JS", () => {
    const { container } = renderForm();

    expect(screen.getByTestId("noscript-node")).toBeInTheDocument();
    const styles = [...container.querySelectorAll("noscript")].map((node) => node.innerHTML);
    expect(styles.some((html) => html.includes("[data-inquiry-submit]"))).toBe(true);
  });

  it("offers the month options plus the two keywords, and no month is a raw id", () => {
    renderForm();

    const options = [...control(visitForm.fields.desiredStart.label).querySelectorAll("option")];
    // Placeholder + asap + flexible + twelve months.
    expect(options).toHaveLength(15);
    expect(options[1]).toHaveTextContent(visitForm.fields.desiredStart.options.asap);
    expect(options[2]).toHaveTextContent(visitForm.fields.desiredStart.options.flexible);
    expect(options[3]?.textContent ?? "").not.toMatch(/^\d{4}-\d{2}$/u);
  });
});

/* -------------------------------------------------------------------------- *
 * Validation and focus
 * -------------------------------------------------------------------------- */

describe("validation (07 D-07.4)", () => {
  it("shows a field's error on blur, once touched", async () => {
    renderForm();

    const email = control(visitForm.fields.email.label);
    fireEvent.change(email, { target: { value: "not-an-address" } });
    expect(screen.queryByText(visitForm.fields.email.errors.invalid)).toBeNull();

    fireEvent.blur(email);
    await waitFor(() => {
      expect(screen.getByText(visitForm.fields.email.errors.invalid)).toBeInTheDocument();
    });
    expect(email).toHaveAttribute("aria-invalid", "true");
  });

  it("clears the error as the parent fixes it", async () => {
    renderForm();

    const email = control(visitForm.fields.email.label);
    fireEvent.change(email, { target: { value: "nope" } });
    fireEvent.blur(email);
    await waitFor(() => {
      expect(screen.getByText(visitForm.fields.email.errors.invalid)).toBeInTheDocument();
    });

    fireEvent.change(email, { target: { value: VALID.email } });
    await waitFor(() => {
      expect(screen.queryByText(visitForm.fields.email.errors.invalid)).toBeNull();
    });
  });

  it("validates every field on submit and sends nothing", async () => {
    renderForm();
    submit();

    await waitFor(() => {
      expect(screen.getByText(visitForm.fields.parentName.errors.required)).toBeInTheDocument();
    });
    expect(screen.getByText(visitForm.fields.email.errors.required)).toBeInTheDocument();
    expect(screen.getByText(visitForm.fields.childAge.errors.required)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("moves focus to the first invalid control, in the order the design draws them", async () => {
    renderForm();
    submit();

    await waitFor(() => {
      expect(control(visitForm.fields.parentName.label)).toHaveFocus();
    });
  });

  it("moves focus past the fields that are already valid", async () => {
    renderForm();

    fireEvent.change(control(visitForm.fields.parentName.label), {
      target: { value: VALID.parentName },
    });
    submit();

    await waitFor(() => {
      expect(control(visitForm.fields.email.label)).toHaveFocus();
    });
  });

  it("announces the failed submit politely, without a second copy of the banner", async () => {
    const { container } = renderForm();
    submit();

    await waitFor(() => {
      expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(
        visitForm.status.error.title,
      );
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

/* -------------------------------------------------------------------------- *
 * Submitting
 * -------------------------------------------------------------------------- */

describe("the pending state (07 D-07.4: never `disabled`)", () => {
  it("keeps the button focusable and marks it busy instead", async () => {
    let release: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );

    renderForm();
    fillValid();
    submit();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: visitForm.status.submitting })).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: visitForm.status.submitting });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");

    release?.(jsonResponse(200, { ok: true }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: visitForm.status.success.title })).toBeVisible();
    });
  });

  it("refuses a duplicate submit while one is in flight", async () => {
    let release: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );

    renderForm();
    fillValid();
    submit();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    submit();
    submit();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release?.(jsonResponse(200, { ok: true }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: visitForm.status.success.title })).toBeVisible();
    });
  });
});

describe("a successful submission", () => {
  it("sends the typed values, the technical fields and the token as JSON", async () => {
    const { container } = renderForm();
    fillValid();
    await waitFor(() => {
      expect(
        container.querySelector<HTMLInputElement>('[name="submissionId"]')?.value,
      ).toBeTruthy();
    });
    submit();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/inquiry");
    expect(init?.method).toBe("POST");

    const body = JSON.parse(typeof init?.body === "string" ? init.body : "") as Record<
      string,
      unknown
    >;
    expect(body.parentName).toBe(VALID.parentName);
    expect(body.email).toBe(VALID.email);
    expect(body.childAge).toBe(VALID.childAge);
    expect(body.locale).toBe(routing.defaultLocale);
    expect(body.source).toBe("home");
    expect(body[HONEYPOT_FIELD]).toBe("");
    expect(body[TURNSTILE_TOKEN_FIELD]).toBe("test-token");
    expect(String(body.submissionId)).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it("replaces the form with the panel and puts focus on its heading", async () => {
    renderForm();
    fillValid();
    submit();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: visitForm.status.success.title })).toHaveFocus();
    });
    expect(screen.queryByLabelText(new RegExp(visitForm.fields.email.label, "u"))).toBeNull();
  });

  it("comes back empty, with a fresh submissionId, when the parent sends another", async () => {
    const { container } = renderForm();
    fillValid();
    const before = container.querySelector<HTMLInputElement>('[name="submissionId"]')?.value;
    submit();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: visitForm.status.success.title })).toBeVisible();
    });

    fireEvent.click(screen.getByRole("button", { name: visitForm.status.success.reset }));

    await waitFor(() => {
      expect(control(visitForm.fields.parentName.label)).toHaveValue("");
    });
    expect(container.querySelector<HTMLInputElement>('[name="submissionId"]')?.value).not.toBe(
      before,
    );
  });
});

/* -------------------------------------------------------------------------- *
 * Failures — 07 §1's table, row by row
 * -------------------------------------------------------------------------- */

describe("failures keep every typed value and allow a retry (07 §1)", () => {
  it("maps a 400 with per-field codes back onto the fields, and focuses the first", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { ok: false, fields: { email: "invalid_email" } }),
    );

    renderForm();
    fillValid();
    submit();

    await waitFor(() => {
      expect(screen.getByText(visitForm.fields.email.errors.invalid)).toBeInTheDocument();
    });
    expect(control(visitForm.fields.email.label)).toHaveFocus();
    // Typed values survive.
    expect(control(visitForm.fields.parentName.label)).toHaveValue(VALID.parentName);
  });

  it("renders the banner for a form-level code the server names", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { ok: false, code: "turnstile_failed" }));

    renderForm();
    fillValid();
    submit();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(visitForm.errors.turnstileFailed);
    });
    // 07 §1: after any failed attempt the widget re-executes before a retry.
    expect(turnstile.reset).toHaveBeenCalled();
  });

  it("maps the WAF's opaque 429 to rate_limited", async () => {
    fetchMock.mockResolvedValue(opaqueResponse(429));

    renderForm();
    fillValid();
    submit();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(visitForm.errors.rateLimited);
    });
  });

  it("maps a 403 to the generic forbidden banner", async () => {
    fetchMock.mockResolvedValue(opaqueResponse(403));

    renderForm();
    fillValid();
    submit();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(visitForm.errors.forbidden);
    });
  });

  it("shows the direct-contact fallback when the provider failed", async () => {
    fetchMock.mockResolvedValue(jsonResponse(502, { ok: false, code: "email_failed" }));

    renderForm();
    fillValid();
    submit();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(visitForm.errors.emailFailed);
    });
    expect(screen.getByRole("link", { name: CONTACT.email })).toHaveAttribute(
      "href",
      `mailto:${CONTACT.email}`,
    );
  });

  it("falls back to the catch-all banner for an answer it cannot read", async () => {
    fetchMock.mockResolvedValue(opaqueResponse(418));

    renderForm();
    fillValid();
    submit();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(visitForm.errors.unknown);
    });
  });

  it("carries whatever a bot typed into the honeypot, so the decoy can see it", async () => {
    const { container } = renderForm();
    fillValid();
    fireEvent.change(container.querySelector(`[name="${HONEYPOT_FIELD}"]`) as HTMLInputElement, {
      target: { value: "https://spam.example" },
    });
    submit();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "") as Record<
      string,
      unknown
    >;
    expect(body[HONEYPOT_FIELD]).toBe("https://spam.example");
  });

  it("raises `network` when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    renderForm();
    fillValid();
    submit();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(visitForm.errors.network);
    });
  });

  it("fails closed with the direct contact when Turnstile never loads", async () => {
    turnstile.unavailable = true;
    turnstile.token = "";

    renderForm();
    fillValid();
    submit();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(visitForm.errors.turnstileUnavailable);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: CONTACT.phoneDisplay })).toHaveAttribute(
      "href",
      `tel:${CONTACT.phone}`,
    );
  });
});
