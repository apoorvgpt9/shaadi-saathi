import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AiOutputError, InvalidInputError, RefusalError, toApiFailure } from "@/lib/ai/errors";

const UNAVAILABLE = {
  status: 503,
  code: "ai_unavailable",
  message: "The AI assistant is unavailable right now. Your plan still works; please try again shortly.",
};
const GENERIC = {
  status: 502,
  code: "ai_error",
  message: "Something went wrong with the AI assistant. Please try again.",
};

function apiError(status: number, message?: string) {
  const body = message ? { type: "error", error: { type: "invalid_request_error", message } } : { type: "error" };
  return Anthropic.APIError.generate(status, body, message, new Headers());
}

describe("toApiFailure", () => {
  it.each([
    ["invalid input keeps its message", new InvalidInputError("Bad turn."), 400, "invalid_input", "Bad turn."],
    [
      "a refusal gets the fixed rephrase message",
      new RefusalError("raw model text"),
      422,
      "refused",
      "I can't help with that request. Try rephrasing it.",
    ],
    ["an output error keeps its message", new AiOutputError("Cut off."), 502, "ai_error", "Cut off."],
  ])("%s", (_name, err, status, code, message) => {
    expect(toApiFailure(err)).toEqual({ status, code, message });
  });

  it.each([401, 402, 403, 429, 503, 529])("maps Anthropic status %i to ai_unavailable", (status) => {
    expect(toApiFailure(apiError(status, "secret upstream text"))).toEqual(UNAVAILABLE);
  });

  it("maps a connection failure to ai_unavailable", () => {
    expect(toApiFailure(new Anthropic.APIConnectionError({ message: "offline" }))).toEqual(UNAVAILABLE);
  });

  it("maps exhausted credit (400) to ai_unavailable", () => {
    expect(toApiFailure(apiError(400, "Your credit balance is too low"))).toEqual(UNAVAILABLE);
  });

  it.each([
    ["another 400", apiError(400, "max_tokens too large")],
    ["a 500", apiError(500, "server exploded")],
    ["a plain SDK error", new Anthropic.AnthropicError("schema mismatch")],
    ["a plain Error", new Error("boom")],
    ["a non-error value", "boom"],
  ])("maps %s to the generic ai_error", (_name, err) => {
    expect(toApiFailure(err)).toEqual(GENERIC);
  });
});
