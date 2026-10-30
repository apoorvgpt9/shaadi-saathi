// POST /api/ideas: generates ideas for the wedding functions, or for one function when regenerating.
import { generate } from "@/lib/ai/client";
import { IDEAS_SYSTEM, ideasMessages } from "@/lib/ai/prompts";
import { handleAi } from "@/lib/ai/route";
import { IdeasRequest, IdeasResponse } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  return handleAi(request, "ideas", IdeasRequest, IdeasResponse, async (input) => {
    const result = await generate("ideas", IdeasResponse, { system: IDEAS_SYSTEM, messages: ideasMessages(input) });
    // When regenerating one function, never overwrite the others.
    const ideas = input.function ? result.data.ideas.filter((i) => i.kind === input.function) : result.data.ideas;
    return { ...result, data: { ideas } };
  });
}
