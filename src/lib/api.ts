// The browser's typed client for the AI routes: validated replies, timeouts, cancellation and failure copy.
import { z } from "zod";
import {
  ChangeRequest,
  ChangeResponse,
  IdeasRequest,
  IdeasResponse,
  IntakeRequest,
  IntakeResponse,
  QuoteRequest,
  QuoteResponse,
  TradeoffsRequest,
  TradeoffsResponse,
  VendorsRequest,
  VendorsResponse,
  type ApiErrorCode,
} from "@/lib/types";

export type ApiFailureCode = ApiErrorCode | "network" | "timeout" | "aborted";
export interface ApiFailure {
  code: ApiFailureCode;
  /** The server's own words for a failure it described; empty for failures the client made up. */
  message: string;
}
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

const ErrorBody = z.object({
  error: z.object({
    code: z.enum(["invalid_input", "rate_limited", "ai_unavailable", "ai_error", "refused"]),
    message: z.string(),
  }),
});

// Above the server's 100 s per model attempt, so a healthy slow call (vendors, ideas) is not cut off.
const TIMEOUT_MS = 150_000;

function fail(code: ApiFailureCode, message = ""): ApiResult<never> {
  return { ok: false, error: { code, message } };
}

// Every call is tied to this scope. Start over cancels it, so a late answer cannot land on the next plan.
let scope = new AbortController();
/** Aborts every in-flight call and starts a fresh scope for the next ones. Safe to call at any time. */
export function cancelRequests(): void {
  scope.abort();
  scope = new AbortController();
}

/** Reads a non-2xx reply as the server's described failure, or a generic `ai_error` when it is not in our shape. */
function failureFromBody(json: unknown): ApiResult<never> {
  const parsed = ErrorBody.safeParse(json);
  if (!parsed.success) {
    return fail("ai_error");
  }
  return fail(parsed.data.error.code, parsed.data.error.message);
}

/** Why a request that never produced a reply failed: our own timeout, a cancellation, or the network. */
function transportFailure(request: AbortSignal, caller: AbortSignal): ApiFailureCode {
  if (request.reason === "timeout") {
    return "timeout";
  }
  return caller.aborted ? "aborted" : "network";
}

/**
 * POSTs JSON and validates the reply. Never throws: every failure becomes `{ ok: false }`. `signal` cancels it.
 *
 * @example
 * const result = await post("/api/quote", body, QuoteResponse);
 * if (result.ok) {
 *   use(result.data); // validated against QuoteResponse
 * } else {
 *   show(result.error.code); // "invalid_input", "rate_limited", "timeout", "network", ...
 * }
 */
export async function post<Res>(
  path: string,
  body: unknown,
  schema: z.ZodType<Res>,
  signal: AbortSignal = scope.signal,
): Promise<ApiResult<Res>> {
  const request = new AbortController();
  const timer = setTimeout(() => {
    request.abort("timeout");
  }, TIMEOUT_MS);
  if (signal.aborted) {
    request.abort();
  } else {
    signal.addEventListener("abort", () => request.abort(), { once: true });
  }
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: request.signal,
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      return failureFromBody(json);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return fail("ai_error");
    }
    return { ok: true, data: parsed.data };
  } catch {
    return fail(transportFailure(request.signal, signal));
  } finally {
    clearTimeout(timer);
  }
}

/** One typed caller per AI route; each posts the validated request body and returns a validated result. */
export const api = {
  intake: (body: z.infer<typeof IntakeRequest>) => post("/api/intake", body, IntakeResponse),
  ideas: (body: z.infer<typeof IdeasRequest>) => post("/api/ideas", body, IdeasResponse),
  vendors: (body: z.infer<typeof VendorsRequest>) => post("/api/vendors", body, VendorsResponse),
  change: (body: z.infer<typeof ChangeRequest>) => post("/api/change", body, ChangeResponse),
  quote: (body: z.infer<typeof QuoteRequest>) => post("/api/quote", body, QuoteResponse),
  tradeoffs: (body: z.infer<typeof TradeoffsRequest>) =>
    post("/api/tradeoffs", body, TradeoffsResponse),
};

const FAILURE_COPY: Record<ApiFailureCode, { title: string; hint: string }> = {
  rate_limited: {
    title: "That is a lot of requests at once",
    hint: "Give it a few minutes and try again.",
  },
  refused: {
    title: "The assistant could not help with that",
    hint: "Try rewording it, or add the details yourself.",
  },
  invalid_input: {
    title: "That message could not be sent",
    hint: "Shorten it or remove unusual characters, then try again.",
  },
  network: { title: "You appear to be offline", hint: "Check your connection and retry." },
  timeout: { title: "This is taking longer than usual", hint: "Please try again." },
  aborted: { title: "That request was cancelled", hint: "Please try again." },
  ai_unavailable: {
    title: "The planning assistant is unavailable right now",
    hint: "Try again in a moment.",
  },
  ai_error: {
    title: "The planning assistant is unavailable right now",
    hint: "Try again in a moment.",
  },
};

/** Plain-language title and hint for a failure code. */
export function describeFailure(code: ApiFailureCode): { title: string; hint: string } {
  return FAILURE_COPY[code];
}

/** Copy for a failed call. The server's own message wins where it explains the problem (a quote with no total, say). */
export function failureMessage({ code, message }: ApiFailure, suffix = ""): string {
  const { title, hint } = FAILURE_COPY[code];
  const explained =
    message !== "" && (code === "ai_error" || code === "refused" || code === "invalid_input");
  return [explained ? message : `${title}. ${hint}`, suffix].filter(Boolean).join(" ");
}

/** Today's date in the user's own timezone, as YYYY-MM-DD. */
export function todayIso(): string {
  return new Date(Date.now()).toLocaleDateString("en-CA");
}
