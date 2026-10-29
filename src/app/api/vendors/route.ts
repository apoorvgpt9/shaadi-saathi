import { generate } from "@/lib/ai/client";
import { VENDORS_SYSTEM, vendorsMessages } from "@/lib/ai/prompts";
import { handleAi } from "@/lib/ai/route";
import { VendorsRequest, VendorsResponse } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  return handleAi(request, "vendors", VendorsRequest, VendorsResponse, (input) =>
    generate("vendors", VendorsResponse, { system: VENDORS_SYSTEM, messages: vendorsMessages(input) }),
  );
}
