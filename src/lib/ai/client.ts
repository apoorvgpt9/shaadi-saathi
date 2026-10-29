import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export type RouteName = "intake" | "ideas" | "vendors" | "change" | "quote" | "tradeoffs";

const ROUTES = {
  intake: { effort: "low", maxTokens: 8000 },
  change: { effort: "medium", maxTokens: 8000 },
  quote: { effort: "low", maxTokens: 8000 },
  vendors: { effort: "medium", maxTokens: 16000 },
  ideas: { effort: "medium", maxTokens: 16000 },
  tradeoffs: { effort: "medium", maxTokens: 8000 },
} as const satisfies Record<RouteName, { effort: "low" | "medium"; maxTokens: number }>;

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export interface Meta {
  model: string;
  inputTokens: number;
  outputTokens: number;
}
export interface AiResult<T> {
  data: T;
  meta: Meta;
}
interface Call {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
}

/** The model declined the request for safety reasons. */
export class RefusalError extends Error {}
/** The model answered, but not in a usable shape. The message is safe to show the user. */
export class AiOutputError extends Error {}

let singleton: Anthropic | undefined;
// Lazy so that building or testing without a key never touches the network.
// One 100s attempt per call (plus the single parse retry) stays inside the routes' 300s limit; the UI offers retry.
function getClient(): Anthropic {
  singleton ??= new Anthropic({ timeout: 100_000, maxRetries: 0 });
  return singleton;
}

export function modelFor(route: RouteName): string {
  return process.env[`ANTHROPIC_MODEL_${route.toUpperCase()}`] ?? process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
}

function baseParams(route: RouteName, call: Call) {
  const model = modelFor(route);
  return {
    model,
    max_tokens: ROUTES[route].maxTokens,
    system: call.system,
    messages: call.messages,
    // Adaptive only: disabled and budget_tokens are rejected by current models.
    thinking: { type: "adaptive" } as const,
    // Haiku models do not support server-side fallback.
    ...(/haiku/i.test(model) ? {} : { betas: [FALLBACK_BETA], fallbacks: "default" as const }),
  };
}

function checkUsable(message: Anthropic.Beta.BetaMessage) {
  if (message.stop_reason === "refusal") throw new RefusalError("The model declined this request.");
  if (message.stop_reason === "max_tokens") throw new AiOutputError("The answer was cut off. Please try again.");
}

function meta(model: string, usage: Anthropic.Beta.BetaUsage[]): Meta {
  return {
    model,
    inputTokens: usage.reduce((n, u) => n + u.input_tokens, 0),
    outputTokens: usage.reduce((n, u) => n + u.output_tokens, 0),
  };
}

/** Structured output validated against a zod schema; one retry when the model's output does not parse. */
export async function generate<S extends z.ZodType>(
  route: RouteName,
  schema: S,
  call: Call,
): Promise<AiResult<z.infer<S>>> {
  const params = baseParams(route, call);
  const usage: Anthropic.Beta.BetaUsage[] = [];
  for (let attempt = 0; ; attempt++) {
    try {
      const message = await getClient().beta.messages.parse({
        ...params,
        output_config: { effort: ROUTES[route].effort, format: zodOutputFormat(schema) },
      });
      usage.push(message.usage);
      checkUsable(message);
      if (message.parsed_output == null) throw new AiOutputError("The answer was empty. Please try again.");
      return { data: message.parsed_output, meta: meta(params.model, usage) };
    } catch (err) {
      // The SDK throws a plain AnthropicError (not an APIError) when the output fails schema validation.
      const retryable =
        err instanceof AiOutputError || (err instanceof Anthropic.AnthropicError && !(err instanceof Anthropic.APIError));
      if (attempt === 0 && retryable) continue;
      throw err;
    }
  }
}

/** One tool-calling turn with `tool_choice: auto`. Returns every tool call plus any text. */
export async function callTools(
  route: RouteName,
  tools: Anthropic.Beta.BetaTool[],
  call: Call,
): Promise<AiResult<{ calls: { name: string; input: unknown }[]; text: string }>> {
  const params = baseParams(route, call);
  const message = await getClient().beta.messages.create({
    ...params,
    output_config: { effort: ROUTES[route].effort },
    tools,
    tool_choice: { type: "auto" },
  });
  checkUsable(message);
  const calls = message.content.flatMap((b) => (b.type === "tool_use" ? [{ name: b.name, input: b.input }] : []));
  const text = message.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("\n")
    .trim();
  return { data: { calls, text }, meta: meta(params.model, [message.usage]) };
}
