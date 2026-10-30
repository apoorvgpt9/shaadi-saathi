// POST /api/intake: turns one chat turn into a reply and an updated wedding-profile draft.
import { generate } from "@/lib/ai/client";
import { InvalidInputError } from "@/lib/ai/errors";
import { INTAKE_SYSTEM, intakeMessages } from "@/lib/ai/prompts";
import { handleAi } from "@/lib/ai/route";
import { IntakeRequest, IntakeResponse, LIMITS } from "@/lib/types";

export const maxDuration = 300;

const EMPTY_REPLY = "Thanks, noted. Tell me more about the wedding whenever you are ready.";

export async function POST(request: Request) {
  return handleAi(request, "intake", IntakeRequest, IntakeResponse, async (input) => {
    // The model must answer a user turn; a trailing assistant turn would be treated as a prefill.
    if (input.messages.at(-1)?.role !== "user")
      throw new InvalidInputError("The last message must be from the user.");
    const result = await generate("intake", IntakeResponse, {
      system: INTAKE_SYSTEM,
      messages: intakeMessages(input),
    });
    // The reply becomes a stored chat message, which must be non-empty and within the message cap.
    const reply = result.data.reply.trim().slice(0, LIMITS.messageChars).trim() || EMPTY_REPLY;
    return { ...result, data: { ...result.data, reply } };
  });
}
