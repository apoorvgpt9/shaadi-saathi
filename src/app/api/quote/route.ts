// POST /api/quote: reads a pasted vendor quote into a priced budget-line entry.
import { generate } from "@/lib/ai/client";
import { AiOutputError } from "@/lib/ai/errors";
import { QUOTE_SYSTEM, quoteMessages } from "@/lib/ai/prompts";
import { handleAi } from "@/lib/ai/route";
import { QuoteRequest, QuoteResponse } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  return handleAi(request, "quote", QuoteRequest, QuoteResponse, async (input) => {
    const result = await generate("quote", QuoteResponse, {
      system: QUOTE_SYSTEM,
      messages: quoteMessages(input),
    });
    // A quote without a total would set a budget line to zero, so refuse rather than guess.
    if (result.data.quote.total <= 0) {
      throw new AiOutputError(
        "I could not find a total price in that quote. Check the text and try again.",
      );
    }
    // The request's category decides which budget line the quote belongs to, whatever the model returned.
    return { ...result, data: { quote: { ...result.data.quote, category: input.category } } };
  });
}
