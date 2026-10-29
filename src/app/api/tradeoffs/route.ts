import { AiOutputError, generate } from "@/lib/ai/client";
import { TRADEOFFS_SYSTEM, tradeoffsMessages } from "@/lib/ai/prompts";
import { handleAi } from "@/lib/ai/route";
import { TradeoffsRequest, TradeoffsResponse } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  return handleAi(request, "tradeoffs", TradeoffsRequest, TradeoffsResponse, async (input) => {
    const result = await generate("tradeoffs", TradeoffsResponse, {
      system: TRADEOFFS_SYSTEM,
      messages: tradeoffsMessages(input),
    });
    // The model may only pick levers the engine offered; drop anything else.
    const known = new Set(input.levers.map((l) => l.id));
    const options = result.data.options
      .map((o) => ({ ...o, leverIds: [...new Set(o.leverIds.filter((id) => known.has(id)))] }))
      .filter((o) => o.leverIds.length > 0);
    if (options.length === 0) throw new AiOutputError("I could not find a good option. Please try again.");
    return { ...result, data: { options } };
  });
}
