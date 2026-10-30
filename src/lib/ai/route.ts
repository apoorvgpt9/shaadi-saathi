// The shared POST handler for every AI route: rate limiting, validation, error mapping and logging.
import type { z } from "zod";
import type { ApiError, ApiErrorCode } from "@/lib/types";
import type { AiResult, Meta, RouteName } from "./client";
import { clientIp } from "./client-ip";
import { toApiFailure } from "./errors";
import { logRequest } from "./logger";
import { aiRateLimiter } from "./rate-limit";

const MAX_BODY_CHARS = 100_000;

/** The parsed JSON body, or undefined when it is oversized or not valid JSON. */
async function readJsonBody(request: Request): Promise<unknown> {
  // Refuse a declared oversize body before buffering it; a chunked body is still checked after reading.
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_BODY_CHARS) {
    return undefined;
  }

  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
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
  const startedAt = Date.now();
  let meta: Partial<Meta> = {};

  const respond = (status: number, body: unknown) => {
    logRequest({ route, status, ms: Date.now() - startedAt, ...meta });
    return Response.json(body, { status });
  };
  const fail = (status: number, code: ApiErrorCode, message: string) =>
    respond(status, { error: { code, message } } satisfies ApiError);

  try {
    if (aiRateLimiter.isLimited(clientIp(request))) {
      return fail(429, "rate_limited", "Too many requests. Please wait a few minutes and try again.");
    }

    const input = requestSchema.safeParse(await readJsonBody(request));
    if (!input.success) {
      return fail(400, "invalid_input", "That request was not valid. Please check it and try again.");
    }

    const result = await run(input.data);
    meta = result.meta;

    const output = responseSchema.safeParse(result.data);
    if (!output.success) {
      return fail(502, "ai_error", "The AI answered in an unexpected format. Please try again.");
    }
    return respond(200, output.data);
  } catch (err) {
    const { status, code, message } = toApiFailure(err);
    return fail(status, code, message);
  }
}
