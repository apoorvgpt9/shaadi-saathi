import { callTools } from "@/lib/ai/client";
import { CHANGE_SYSTEM, changeMessages } from "@/lib/ai/prompts";
import { handleAi } from "@/lib/ai/route";
import { CHANGE_TOOLS } from "@/lib/ai/tools";
import { ChangeRequest, ChangeResponse, PlanChange } from "@/lib/types";

export const maxDuration = 60;

const NOT_SURE = "I wasn't sure what to change. Could you say it a little differently?";

export async function POST(request: Request) {
  return handleAi(request, "change", ChangeRequest, ChangeResponse, async (input) => {
    const result = await callTools("change", CHANGE_TOOLS, { system: CHANGE_SYSTEM, messages: changeMessages(input) });
    // The tool name is the variant's `type`; anything that fails the contract is dropped, never applied.
    const changes = result.data.calls.flatMap((call) => {
      const parsed = PlanChange.safeParse(Object.assign({}, call.input, { type: call.name }));
      return parsed.success ? [parsed.data] : [];
    });
    // Text alone is a clarifying question; with no changes and no text, ask the user to rephrase.
    const reply = result.data.text || (changes.length === 0 ? NOT_SURE : null);
    return { ...result, data: { changes, reply } };
  });
}
