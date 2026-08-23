import { handleInquiry } from "@/lib/inquiry/server/handler";

/**
 * `POST /api/inquiry` — the one form endpoint (07 `D-07.1`, ADR-006).
 *
 * Deliberately four lines. Everything the endpoint does lives in
 * `src/lib/inquiry/server/handler.ts`, which is a pure `Request → Response`
 * function; this file is the App Router's binding to it and nothing else, so
 * the behaviour is unit-testable without a server.
 *
 * Three properties this file is responsible for.
 *
 * - **Node.js runtime.** `node:crypto` and the mail transport are plain Node,
 *   and a store-backed rate limiter later would be too. Nothing here needs the
 *   Edge runtime (07 §2).
 * - **Never cached, never prerendered.** A submission is a side effect.
 * - **The path is fixed and unlocalised**, which is what lets the Vercel WAF
 *   rate-limit rule and the logs target it by path (`D-07.1`). `src/proxy.ts`
 *   already excludes `/api` from the next-intl matcher, so it is never
 *   locale-redirected; the submitter's locale travels in the body instead.
 *
 * Any other method gets Next's own 405 — the App Router answers that for a
 * verb the route file does not export, so there is no handler to write for it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return handleInquiry(request);
}
