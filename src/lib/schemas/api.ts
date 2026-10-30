// API contracts for the AI routes (request bodies are validated server-side).
import { CategoryId, FunctionKind, Guests, IntakeDraft, IsoDate, Profile, Rupees } from "./domain";
import { LIMITS } from "./limits";
import { FunctionIdeas, PlanChange, Quote, TaskStatus, VendorChecklist } from "./plan";
import { z } from "zod";

export const ChatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(LIMITS.messageChars),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const IntakeRequest = z.object({
  messages: z.array(ChatMessage).min(1).max(LIMITS.chatMessages),
  draft: IntakeDraft.nullable(),
  today: IsoDate,
});
export const IntakeResponse = z.object({ reply: z.string(), draft: IntakeDraft });

export const IdeasRequest = z.object({
  profile: Profile,
  function: FunctionKind.nullable(),
  feedback: z.string().trim().max(LIMITS.messageChars).nullable(),
  previous: z.array(FunctionIdeas),
});
export const IdeasResponse = z.object({ ideas: z.array(FunctionIdeas) });

export const VendorsRequest = z.object({ profile: Profile });
export const VendorsResponse = z.object({ vendors: z.array(VendorChecklist) });

export const ChangeRequest = z.object({
  message: z.string().trim().min(1).max(LIMITS.messageChars),
  profile: Profile,
  tasks: z.array(z.object({ id: z.string(), title: z.string(), status: TaskStatus })).max(60),
  today: IsoDate,
});
export const ChangeResponse = z.object({ changes: z.array(PlanChange), reply: z.string().nullable() });

export const QuoteRequest = z.object({
  text: z.string().trim().min(LIMITS.quoteMinChars).max(LIMITS.quoteChars),
  category: CategoryId,
  guests: Guests,
});
export const QuoteResponse = z.object({ quote: Quote.omit({ id: true }) });

export const TradeoffsRequest = z.object({
  profile: Profile,
  total: Rupees,
  levers: z
    .array(z.object({ id: z.string(), label: z.string(), saving: Rupees, touchesPriority: z.boolean() }))
    .min(1)
    .max(40),
});
export const TradeoffsResponse = z.object({
  options: z.array(z.object({ title: z.string(), leverIds: z.array(z.string()).min(1), why: z.string() })).max(3),
});

export type ApiErrorCode = "invalid_input" | "rate_limited" | "ai_unavailable" | "ai_error" | "refused";
export interface ApiError {
  error: { code: ApiErrorCode; message: string };
}
