import { describe, expect, it } from "vitest";
import { applyChanges } from "@/lib/plan/changes";
import { patchEntry, setTask } from "@/lib/plan/edits";
import { awaitingReply, bindActions, initialState, parseStored, reducer, type PlanAction, type PlanState, type Proposal } from "@/lib/store";
import type { IntakeDraft, Plan } from "@/lib/types";
import { makePlan, TODAY } from "./plan-fixtures";

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

const plan = makePlan();
const guests250: Proposal = (p) => applyChanges(p, [{ type: "set_guests", function: "all", count: 250 }]);
const started = (): PlanState => reducer(initialState, { type: "start_plan", plan });

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

  it("propose computes the change from the latest plan, and undo discards it", () => {
    const proposed = reducer(started(), { type: "propose", build: guests250, today: TODAY });
    expect(proposed.pending?.before).toBe(plan);
    expect(proposed.pending?.after.profile.guests).toBe(250);
    expect(proposed.pending?.summary.totalAfter).toBeGreaterThan(proposed.pending?.summary.totalBefore ?? Infinity);
    expect(proposed.plan).toBe(plan);
    expect(reducer(proposed, { type: "undo" })).toMatchObject({ plan, pending: null });
  });

  it("propose reports what the engine ignored and is a no-op without a plan", () => {
    const skipped: Proposal = (p) => applyChanges(p, [{ type: "remove_function", function: "wedding" }]);
    expect(reducer(started(), { type: "propose", build: skipped, today: TODAY }).pending?.ignored).toHaveLength(1);
    expect(reducer(initialState, { type: "propose", build: guests250, today: TODAY })).toBe(initialState);
  });

  it("accept re-applies the change to the plan as it is now, keeping edits made meanwhile", () => {
    const proposed = reducer(started(), { type: "propose", build: guests250, today: TODAY });
    const edited = [
      (p: Plan): Plan => ({ ...p, vendors: [{ category: "venue", needs: ["Power backup"], questions: [], confirmBeforeBooking: [] }] }),
      (p: Plan): Plan => patchEntry(p, "decor", { override: 90_000 }),
      (p: Plan): Plan => setTask(p, "finalise-dates", "done", null),
    ].reduce((s, update) => reducer(s, { type: "update_plan", update }), proposed);
    const accepted = reducer(edited, { type: "accept" });
    expect(accepted.pending).toBeNull();
    expect(accepted.plan?.profile.guests).toBe(250);
    expect(accepted.plan?.vendors).toHaveLength(1);
    expect(accepted.plan?.budget.decor?.override).toBe(90_000);
    expect(accepted.plan?.tasks["finalise-dates"]?.status).toBe("done");
  });

  it("accept without a pending change does nothing", () => {
    const s = started();
    expect(reducer(s, { type: "accept" })).toBe(s);
  });

  it("update_plan edits the plan in place and is a no-op before a plan exists", () => {
    const edit = (p: Plan): Plan => ({ ...p, checked: { "venue:needs:0": true } });
    expect(reducer(initialState, { type: "update_plan", update: edit })).toBe(initialState);
    const s = reducer(reducer(initialState, { type: "start_plan", plan }), { type: "update_plan", update: edit });
    expect(s.plan?.checked).toEqual({ "venue:needs:0": true });
  });

  it("hydrate swaps in the saved state", () => {
    const saved: PlanState = { ...started(), messages: [{ role: "user", content: "hi" }] };
    expect(reducer(initialState, { type: "hydrate", state: saved })).toBe(saved);
  });

  it("reset returns to the empty intake state, even with a change pending", () => {
    const proposed = reducer(started(), { type: "propose", build: guests250, today: TODAY });
    expect(reducer(proposed, { type: "reset" })).toEqual(initialState);
  });

  it("start_plan and edit_draft keep the chat", () => {
    const withChat = reducer(initialState, { type: "user_message", message: { role: "user", content: "hi" } });
    expect(reducer(reducer(withChat, { type: "edit_draft", draft }), { type: "start_plan", plan })).toMatchObject({
      stage: "plan",
      draft,
      messages: [{ content: "hi" }],
    });
  });

  it("keeps an over-long assistant reply within the message limit", () => {
    const s = reducer(initialState, { type: "assistant_reply", reply: `  ${"x".repeat(3000)}`, draft });
    expect(s.messages[0].content).toHaveLength(2000);
  });
});

describe("awaitingReply", () => {
  it("is true only when the user spoke last", () => {
    expect(awaitingReply([])).toBe(false);
    expect(awaitingReply([{ role: "user", content: "hi" }])).toBe(true);
    expect(awaitingReply([{ role: "user", content: "hi" }, { role: "assistant", content: "Hello" }])).toBe(false);
  });
});

describe("bindActions", () => {
  it("turns each operation into the matching action", () => {
    const seen: PlanAction[] = [];
    const a = bindActions((action) => seen.push(action));
    a.hydrate(initialState);
    a.sendUser({ role: "user", content: "hi" });
    a.receiveReply("ok", draft);
    a.editDraft(draft);
    a.startPlan(plan);
    a.updatePlan((p) => p);
    a.propose(guests250, TODAY);
    a.accept();
    a.undo();
    a.reset();
    expect(seen.map((x) => x.type)).toEqual([
      "hydrate", "user_message", "assistant_reply", "edit_draft", "start_plan", "update_plan", "propose", "accept", "undo", "reset",
    ]);
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
