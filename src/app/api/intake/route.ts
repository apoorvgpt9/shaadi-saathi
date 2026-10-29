import { generate } from "@/lib/ai/client";
import { INTAKE_SYSTEM, intakeMessages } from "@/lib/ai/prompts";
import { handleAi, InvalidInputError } from "@/lib/ai/route";
import { IntakeRequest, IntakeResponse } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  return handleAi(request, "intake", IntakeRequest, IntakeResponse, (input) => {
    // The model must answer a user turn; a trailing assistant turn would be treated as a prefill.
    if (input.messages.at(-1)?.role !== "user") throw new InvalidInputError("The last message must be from the user.");
    return generate("intake", IntakeResponse, { system: INTAKE_SYSTEM, messages: intakeMessages(input) });
  });
}
