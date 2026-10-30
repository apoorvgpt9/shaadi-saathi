// The shared POST handler for every AI route: rate limiting, validation, error mapping and logging.
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { ApiError, ApiErrorCode } from "@/lib/types";
import { AiOutputError, RefusalError, type AiResult, type Meta, type RouteName } from "./client";

const WINDOW_MS = 10 * 60_000;
const LIMIT = 40;
const MAX_BODY_CHARS = 100_000;
const MAX_TRACKED_IPS = 5000;
// Auth, permission, payment, rate limit and overload all mean "AI is not available right now".
const UNAVAILABLE_STATUSES = new Set([401, 402, 403, 429, 503, 529]);

// Limit: per-instance memory, so counts reset on a cold start and are not shared between instances.
// Upgrade path: a shared store such as Upstash.
const hits = new Map<string, number[]>();

/** Thrown by a route's `run` when the request parses but is still not acceptable. */
export class InvalidInputError extends Error {}

// Vercel overwrites both headers with the real client address (checked on the live site, 30 Oct), so clients cannot spoof them.
function clientIp(request: Request): string {
  const candidates = [request.headers.get("x-real-ip"), request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()];
  // Empty values count as missing, hence find() rather than ??.
  return candidates.find((ip) => ip) ?? "unknown";
}

function rateLimited(request: Request, now: number): boolean {
  const ip = clientIp(request);
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  hits.set(ip, [...recent, now]);
  if (hits.size > MAX_TRACKED_IPS) {
    for (const [key, times] of hits) if (now - (times.at(-1) ?? 0) >= WINDOW_MS) hits.delete(key);
    // Limit: a flood of fresh keys resets every counter, which trades accuracy for bounded memory.
    // Upgrade path: a shared store such as Upstash.
    if (hits.size > MAX_TRACKED_IPS) hits.clear();
  }
  return false;
}

// Maps any thrown error to an HTTP status, API code and user-safe message; SDK error text is never passed through.
function classify(err: unknown): { status: number; code: ApiErrorCode; message: string } {
  if (err instanceof InvalidInputError) return { status: 400, code: "invalid_input", message: err.message };
  if (err instanceof RefusalError) {
    return { status: 422, code: "refused", message: "I can't help with that request. Try rephrasing it." };
  }
  if (err instanceof AiOutputError) return { status: 502, code: "ai_error", message: err.message };
  if (
    err instanceof Anthropic.APIConnectionError ||
    (err instanceof Anthropic.APIError &&
      (UNAVAILABLE_STATUSES.has(Number(err.status)) ||
        // Exhausted credit arrives as a 400 invalid_request_error.
        (err.status === 400 && /credit balance/i.test(err.message))))
  ) {
    return {
      status: 503,
      code: "ai_unavailable",
      message: "The AI assistant is unavailable right now. Your plan still works; please try again shortly.",
    };
  }
  return { status: 502, code: "ai_error", message: "Something went wrong with the AI assistant. Please try again." };
}

/**
 * Shared POST handler: rate limit, body validation, the AI call, response validation, error mapping and one log
 * line per request. Never throws, and never logs user content.
 */
export async function handleAi<Req, Res>(
  request: Request,
  route: RouteName,
  requestSchema: z.ZodType<Req>,
  responseSchema: z.ZodType<Res>,
  run: (input: Req) => Promise<AiResult<unknown>>,
): Promise<Response> {
  const started = Date.now();
  let meta: Partial<Meta> = {};
  const respond = (status: number, body: unknown) => {
    console.log(JSON.stringify({ route, status, ms: Date.now() - started, ...meta }));
    return Response.json(body, { status });
  };
  const fail = (status: number, code: ApiErrorCode, message: string) =>
    respond(status, { error: { code, message } } satisfies ApiError);

  try {
    if (rateLimited(request, started)) {
      return fail(429, "rate_limited", "Too many requests. Please wait a few minutes and try again.");
    }
    // Refuse a declared oversize body before buffering it; a chunked body is still checked after reading.
    const declared = Number(request.headers.get("content-length"));
    const raw = declared > MAX_BODY_CHARS ? "" : await request.text();
    let json: unknown;
    try {
      json = raw.length <= MAX_BODY_CHARS ? JSON.parse(raw) : undefined;
    } catch {
      json = undefined;
    }
    const input = requestSchema.safeParse(json);
    if (!input.success) return fail(400, "invalid_input", "That request was not valid. Please check it and try again.");

    const result = await run(input.data);
    meta = result.meta;
    const output = responseSchema.safeParse(result.data);
    if (!output.success) return fail(502, "ai_error", "The AI answered in an unexpected format. Please try again.");
    return respond(200, output.data);
  } catch (err) {
    const { status, code, message } = classify(err);
    return fail(status, code, message);
  }
}
