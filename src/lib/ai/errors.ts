// Error types thrown on the AI path, and the mapping from any thrown error to an HTTP failure.
import Anthropic from "@anthropic-ai/sdk";
import type { ApiErrorCode } from "@/lib/types";

/** Thrown by a route's `run` when the request parses but is still not acceptable. */
export class InvalidInputError extends Error {}
/** The model declined the request for safety reasons. */
export class RefusalError extends Error {}
/** The model answered, but not in a usable shape. The message is safe to show the user. */
export class AiOutputError extends Error {}

export interface ApiFailure {
  status: number;
  code: ApiErrorCode;
  message: string;
}

// Auth, permission, payment, rate limit and overload all mean "AI is not available right now".
const UNAVAILABLE_STATUSES = new Set([401, 402, 403, 429, 503, 529]);

/** Exhausted credit arrives as a 400 invalid_request_error. */
function isCreditExhausted(err: unknown): boolean {
  return err instanceof Anthropic.APIError && err.status === 400 && /credit balance/i.test(err.message);
}

function hasUnavailableStatus(err: unknown): boolean {
  return err instanceof Anthropic.APIError && UNAVAILABLE_STATUSES.has(Number(err.status));
}

function isAiUnavailable(err: unknown): boolean {
  return err instanceof Anthropic.APIConnectionError || hasUnavailableStatus(err) || isCreditExhausted(err);
}

/** Maps any thrown error to an HTTP status, API code and user-safe message; SDK error text is never passed through. */
export function toApiFailure(err: unknown): ApiFailure {
  if (err instanceof InvalidInputError) {
    return { status: 400, code: "invalid_input", message: err.message };
  }
  if (err instanceof RefusalError) {
    return { status: 422, code: "refused", message: "I can't help with that request. Try rephrasing it." };
  }
  if (err instanceof AiOutputError) {
    return { status: 502, code: "ai_error", message: err.message };
  }
  if (isAiUnavailable(err)) {
    return {
      status: 503,
      code: "ai_unavailable",
      message: "The AI assistant is unavailable right now. Your plan still works; please try again shortly.",
    };
  }
  return { status: 502, code: "ai_error", message: "Something went wrong with the AI assistant. Please try again." };
}
