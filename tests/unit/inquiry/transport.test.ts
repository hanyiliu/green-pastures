import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  IDEMPOTENCY_KEY_LENGTH,
  InquiryTransportError,
  RESEND_SEND_URL,
  idempotencyKeyFor,
  sendEmail,
  sendViaLog,
  sendViaResend,
  type OutgoingEmail,
} from "@/lib/inquiry/server/transport";
import { parseInquiry, type Inquiry } from "@/lib/inquiry/schema";

import { NOW, fakeFetch, rawSubmission, requestBodyOf } from "./fixtures";

/**
 * The transports (07 §2 step 7, §5; 07 §8 *Handler*: idempotency key, tags,
 * "provider failure → 502").
 *
 * Resend is mocked at the `fetch` layer. There is no account and no API key in
 * this repository — every case stubs `RESEND_API_KEY` itself, and one case
 * asserts what happens when it is absent, which is the state the repository
 * actually ships in.
 */

function inquiryOf(overrides: Record<string, string> = {}): Inquiry {
  const parsed = parseInquiry(rawSubmission(overrides));
  if (!parsed.ok) throw new Error("fixture does not parse");
  return parsed.inquiry;
}

function outgoing(overrides: Partial<OutgoingEmail> = {}): OutgoingEmail {
  return {
    from: '"Green Pastures Montessori Daycare" <no-reply@mail.example.com>',
    to: ["hello@example.com"],
    replyTo: "wei.chen@example.com",
    subject: "Tour request from Wei Chen",
    text: "body",
    html: "<p>body</p>",
    tags: { source: "home", locale: "en" },
    idempotencyKey: "a".repeat(IDEMPOTENCY_KEY_LENGTH),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
  vi.stubEnv("INQUIRY_TRANSPORT", "resend");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("the idempotency key (07 §2 step 7)", () => {
  it("is a 64-character hex digest, inside Resend's 256-character cap", () => {
    const key = idempotencyKeyFor(inquiryOf());
    expect(key).toHaveLength(IDEMPOTENCY_KEY_LENGTH);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("collapses an identical retry", () => {
    expect(idempotencyKeyFor(inquiryOf())).toBe(idempotencyKeyFor(inquiryOf()));
  });

  it("is unchanged by a difference normalisation erases", () => {
    expect(idempotencyKeyFor(inquiryOf({ parentName: " Wei   Chen " }))).toBe(
      idempotencyKeyFor(inquiryOf({ parentName: "Wei Chen" })),
    );
  });

  it("changes when the parent edits the submission and sends it again", () => {
    expect(idempotencyKeyFor(inquiryOf({ message: "changed" }))).not.toBe(
      idempotencyKeyFor(inquiryOf()),
    );
    expect(idempotencyKeyFor(inquiryOf({ childAge: "infant" }))).not.toBe(
      idempotencyKeyFor(inquiryOf()),
    );
  });

  it("changes for a different form instance", () => {
    expect(
      idempotencyKeyFor(inquiryOf({ submissionId: "0f2b62d0-6b17-4c9e-9a4f-4f7c0d3b1a22" })),
    ).not.toBe(idempotencyKeyFor(inquiryOf()));
  });
});

describe("sendViaResend", () => {
  it("posts the message Resend expects", async () => {
    const impl = fakeFetch();
    const result = await sendViaResend(outgoing(), { fetchImpl: impl });

    expect(result).toStrictEqual({ transport: "resend", id: "resend-message-id" });

    const call = impl.calls[0];
    expect(call?.url).toBe(RESEND_SEND_URL);

    const headers = call?.init?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer re_test_key");
    expect(headers["idempotency-key"]).toBe("a".repeat(IDEMPOTENCY_KEY_LENGTH));

    const body = requestBodyOf(call!);
    expect(body.reply_to).toBe("wei.chen@example.com");
    expect(body.to).toStrictEqual(["hello@example.com"]);
    expect(body.text).toBe("body");
    expect(body.html).toBe("<p>body</p>");
    expect(body.tags).toStrictEqual([
      { name: "source", value: "home" },
      { name: "locale", value: "en" },
    ]);
  });

  it("tolerates a success body with no id", async () => {
    const result = await sendViaResend(outgoing(), { fetchImpl: fakeFetch({ resend: {} }) });
    expect(result.id).toBeUndefined();
  });

  it("throws on a provider 4xx", async () => {
    await expect(
      sendViaResend(outgoing(), { fetchImpl: fakeFetch({ resend: 422 }) }),
    ).rejects.toBeInstanceOf(InquiryTransportError);
  });

  it("throws on a provider 5xx", async () => {
    await expect(
      sendViaResend(outgoing(), { fetchImpl: fakeFetch({ resend: 503 }) }),
    ).rejects.toMatchObject({ reason: "http-503" });
  });

  it("throws when the provider cannot be reached", async () => {
    await expect(
      sendViaResend(outgoing(), { fetchImpl: fakeFetch({ resend: "unreachable" }) }),
    ).rejects.toMatchObject({ reason: "fetch-failed" });
  });

  it("throws when no API key is configured — the state this repository ships in", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const impl = fakeFetch();
    await expect(sendViaResend(outgoing(), { fetchImpl: impl })).rejects.toMatchObject({
      reason: "missing-api-key",
    });
    expect(impl.calls).toHaveLength(0);
  });

  it("does not fail a send because the success body was not JSON", async () => {
    const impl = (() => Promise.resolve(new Response("ok"))) as typeof fetch;
    await expect(sendViaResend(outgoing(), { fetchImpl: impl })).resolves.toStrictEqual({
      transport: "resend",
      id: undefined,
    });
  });
});

describe("sendViaLog (07 §5, local development)", () => {
  it("prints the rendered mail and calls nobody", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const result = sendViaLog(outgoing());

    expect(result).toStrictEqual({ transport: "log", id: undefined });
    expect(info).toHaveBeenCalledOnce();
    expect(String(info.mock.calls[0]?.[0])).toContain("Tour request from Wei Chen");
    info.mockRestore();
  });
});

describe("sendEmail", () => {
  it("uses the log transport when INQUIRY_TRANSPORT says so", async () => {
    vi.stubEnv("INQUIRY_TRANSPORT", "log");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const impl = fakeFetch();

    await expect(sendEmail(outgoing(), { fetchImpl: impl })).resolves.toMatchObject({
      transport: "log",
    });
    expect(impl.calls).toHaveLength(0);
    info.mockRestore();
  });

  it("uses Resend when the variable is unset", async () => {
    vi.stubEnv("INQUIRY_TRANSPORT", "");
    const impl = fakeFetch();
    await expect(sendEmail(outgoing(), { fetchImpl: impl })).resolves.toMatchObject({
      transport: "resend",
    });
    expect(impl.calls).toHaveLength(1);
  });
});
