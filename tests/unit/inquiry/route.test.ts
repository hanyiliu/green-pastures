import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as route from "@/app/api/inquiry/route";

import { NOW, jsonRequest, rawSubmission } from "./fixtures";

/**
 * The App Router binding (07 `D-07.1`).
 *
 * The route file is deliberately thin, so this file is too: it proves the two
 * segment exports the runtime depends on and that `POST` delegates to the
 * handler. Everything the endpoint *does* is asserted in `handler.test.ts`.
 */

const handleInquiry = vi.hoisted(() => vi.fn());

vi.mock("@/lib/inquiry/server/handler", () => ({ handleInquiry }));

beforeEach(() => {
  handleInquiry.mockResolvedValue(new Response(null, { status: 204 }));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the route segment config", () => {
  it("runs on Node, because the transport and node:crypto are plain Node", () => {
    expect(route.runtime).toBe("nodejs");
  });

  it("is never prerendered or cached — a submission is a side effect", () => {
    expect(route.dynamic).toBe("force-dynamic");
  });

  it("exports POST and no other verb, so Next answers 405 for the rest", () => {
    expect(Object.keys(route).filter((key) => /^[A-Z]+$/.test(key))).toStrictEqual(["POST"]);
  });
});

describe("POST", () => {
  it("hands the request straight to the handler", async () => {
    const request = jsonRequest(rawSubmission());
    const response = await route.POST(request);

    expect(handleInquiry).toHaveBeenCalledExactlyOnceWith(request);
    expect(response.status).toBe(204);
  });
});
