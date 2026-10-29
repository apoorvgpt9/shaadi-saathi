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

export type ApiFailureCode = ApiErrorCode | "network";
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code: ApiFailureCode; message: string } };

const ErrorBody = z.object({
  error: z.object({
    code: z.enum(["invalid_input", "rate_limited", "ai_unavailable", "ai_error", "refused"]),
    message: z.string(),
  }),
});

const TIMEOUT_MS = 70_000;

const fail = (code: ApiFailureCode, message: string): ApiResult<never> => ({ ok: false, error: { code, message } });

/** POSTs JSON and validates the reply. Never throws: every failure becomes `{ ok: false }`. */
export async function post<Req, Res>(path: string, body: Req, schema: z.ZodType<Res>): Promise<ApiResult<Res>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const parsed = ErrorBody.safeParse(json);
      return parsed.success
        ? fail(parsed.data.error.code, parsed.data.error.message)
        : fail("ai_error", `Request failed (${res.status})`);
    }
    const parsed = schema.safeParse(json);
    return parsed.success ? { ok: true, data: parsed.data } : fail("ai_error", "Unexpected response shape");
  } catch {
    return fail("network", "Could not reach the server");
  }
}

export const api = {
  intake: (body: z.infer<typeof IntakeRequest>) => post("/api/intake", body, IntakeResponse),
  ideas: (body: z.infer<typeof IdeasRequest>) => post("/api/ideas", body, IdeasResponse),
  vendors: (body: z.infer<typeof VendorsRequest>) => post("/api/vendors", body, VendorsResponse),
  change: (body: z.infer<typeof ChangeRequest>) => post("/api/change", body, ChangeResponse),
  quote: (body: z.infer<typeof QuoteRequest>) => post("/api/quote", body, QuoteResponse),
  tradeoffs: (body: z.infer<typeof TradeoffsRequest>) => post("/api/tradeoffs", body, TradeoffsResponse),
};

const FAILURE_COPY: Record<ApiFailureCode, { title: string; hint: string }> = {
  rate_limited: { title: "That is a lot of requests at once", hint: "Give it a few minutes and try again." },
  refused: { title: "The assistant could not help with that", hint: "Try rewording it, or add the details yourself." },
  invalid_input: { title: "That message could not be sent", hint: "Shorten it or remove unusual characters, then try again." },
  network: { title: "You appear to be offline", hint: "Check your connection and retry." },
  ai_unavailable: { title: "The planning assistant is unavailable right now", hint: "Try again in a moment." },
  ai_error: { title: "The planning assistant is unavailable right now", hint: "Try again in a moment." },
};

/** Plain-language copy for a failure, shared by every screen that calls the AI. */
export const describeFailure = (code: ApiFailureCode) => FAILURE_COPY[code];

/** Today's date in the user's own timezone, as YYYY-MM-DD. */
export const todayIso = (): string => new Date(Date.now()).toLocaleDateString("en-CA");
