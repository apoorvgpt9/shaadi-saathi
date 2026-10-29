import { describe, expect, it } from "vitest";
import { initialState, parseStored, reducer, type Pending } from "@/lib/store";
import type { IntakeDraft, Plan } from "@/lib/types";

const draft: IntakeDraft = {
  weddingDate: "2027-02-15",
  city: "Jaipur",
  cityTier: "tier2",
  guests: 200,
  budget: 800_000,
  functions: [],
  style: null,
  priorities: ["catering"],
  mustHaves: [],
  notes: [],
};

const plan: Plan = {
  version: 1,
  profile: {
    city: "Jaipur",
    cityTier: "tier2",
    guests: 200,
    budget: 800_000,
    functions: [{ kind: "wedding", date: "2027-02-15", guests: 200 }],
    style: "classic",
    categoryStyles: {},
    priorities: [],
    mustHaves: [],
    notes: [],
  },
  budget: {},
  tasks: {},
  quotes: [],
  vendors: [],
  checked: {},
  ideas: [],
};

describe("reducer", () => {
  it("appends user and assistant messages and keeps the latest draft", () => {
    let s = reducer(initialState, { type: "user_message", message: { role: "user", content: "hi" } });
    s = reducer(s, { type: "assistant_reply", reply: "Where is the wedding?", draft });
    expect(s.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(s.draft).toEqual(draft);
  });

  it("falls back to a placeholder when the model replies with an empty string", () => {
    const s = reducer(initialState, { type: "assistant_reply", reply: "", draft });
    expect(s.messages[0].content).toBe("Noted.");
  });

  it("accept commits the pending plan; undo discards it", () => {
    const after: Plan = { ...plan, profile: { ...plan.profile, guests: 250 } };
    const pending: Pending = {
      before: plan,
      after,
      summary: { lines: [], totalBefore: 0, totalAfter: 0, budgetBefore: 0, budgetAfter: 0, newlyUrgent: [], newlyAtRisk: [], newlyClashing: [], notes: [] },
    };
    const base = reducer(initialState, { type: "start_plan", plan });
    const proposed = reducer(base, { type: "propose", pending });
    expect(reducer(proposed, { type: "accept" })).toMatchObject({ plan: after, pending: null });
    expect(reducer(proposed, { type: "undo" })).toMatchObject({ plan, pending: null });
  });

  it("reset returns to the empty intake state", () => {
    expect(reducer(reducer(initialState, { type: "start_plan", plan }), { type: "reset" })).toEqual(initialState);
  });
});

describe("parseStored", () => {
  it("round-trips valid state and drops pending", () => {
    const raw = JSON.stringify({ stage: "plan", messages: [], draft, plan });
    expect(parseStored(raw)).toEqual({ stage: "plan", messages: [], draft, plan, pending: null });
  });

  it.each([
    ["null", null],
    ["not JSON", "{oops"],
    ["wrong shape", JSON.stringify({ stage: "intake" })],
    ["plan stage without a plan", JSON.stringify({ stage: "plan", messages: [], draft: null, plan: null })],
    ["invalid plan", JSON.stringify({ stage: "plan", messages: [], draft: null, plan: { version: 2 } })],
  ])("rejects %s", (_name, raw) => {
    expect(parseStored(raw)).toBeNull();
  });
});
