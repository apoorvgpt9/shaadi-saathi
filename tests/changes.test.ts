import { describe, expect, it } from "vitest";
import { applyChanges } from "@/lib/plan/changes";
import { Plan } from "@/lib/types";
import { EXAMPLE_CHANGES, makePlan } from "./plan-fixtures";

const guestsAt = (plan: Plan, kind: string) =>
  plan.profile.functions.find((f) => f.kind === kind)?.guests;

describe("applyChanges", () => {
  it("applies the example scenario: +50 guests, budget 7 lakh, two weeks earlier", () => {
    const before = makePlan();
    const { plan, ignored } = applyChanges(before, EXAMPLE_CHANGES);
    expect(ignored).toEqual([]);
    expect(plan.profile.guests).toBe(250);
    expect(plan.profile.budget).toBe(700_000);
    expect(plan.profile.functions.map((f) => f.date)).toEqual(["2027-02-15", "2027-02-14"]);
    expect(guestsAt(plan, "mehendi")).toBe(150); // scaled by 250/200
    expect(Plan.safeParse(plan).success).toBe(true);
  });

  it("does not mutate the input plan", () => {
    const before = makePlan();
    const snapshot = structuredClone(before);
    applyChanges(before, EXAMPLE_CHANGES);
    expect(before).toEqual(snapshot);
  });

  it("sets wedding guests without touching other functions", () => {
    const { plan } = applyChanges(makePlan(), [
      { type: "set_guests", function: "wedding", count: 300 },
    ]);
    expect(plan.profile.guests).toBe(300);
    expect(guestsAt(plan, "wedding")).toBe(300);
    expect(guestsAt(plan, "mehendi")).toBe(120);
  });

  it("sets a global style, or one category's style", () => {
    const global = applyChanges(makePlan(), [
      { type: "set_style", style: "premium", category: null },
    ]).plan;
    expect(global.profile.style).toBe("premium");
    const one = applyChanges(makePlan(), [
      { type: "set_style", style: "simple", category: "decor" },
    ]).plan;
    expect(one.profile.style).toBe("classic");
    expect(one.profile.categoryStyles.decor).toBe("simple");
  });

  it("ignores removing the wedding, with a reason", () => {
    const { plan, ignored } = applyChanges(makePlan(), [
      { type: "remove_function", function: "wedding" },
    ]);
    expect(plan.profile.functions).toHaveLength(2);
    expect(ignored).toHaveLength(1);
    expect(ignored[0]).toMatch(/wedding/i);
  });

  it("removes and adds optional functions, ignoring duplicates and missing ones", () => {
    const removed = applyChanges(makePlan(), [{ type: "remove_function", function: "mehendi" }]);
    expect(removed.plan.profile.functions.map((f) => f.kind)).toEqual(["wedding"]);
    const { plan, ignored } = applyChanges(makePlan(), [
      { type: "add_function", function: "sangeet", date: "2027-02-27", guests: 150 },
      { type: "add_function", function: "mehendi", date: "2027-02-27", guests: 50 },
      { type: "remove_function", function: "haldi" },
      { type: "set_function_date", function: "haldi", date: "2027-02-26" },
      { type: "set_guests", function: "haldi", count: 20 },
    ]);
    expect(plan.profile.functions.map((f) => f.kind)).toEqual(["wedding", "mehendi", "sangeet"]);
    expect(ignored).toHaveLength(4);
  });

  it("dedupes notes and caps them at 20", () => {
    const first = applyChanges(makePlan(), [
      { type: "add_note", note: "Elders need seating" },
      { type: "add_note", note: "elders need seating" },
    ]).plan;
    expect(first.profile.notes).toEqual(["Elders need seating"]);
    const full = makePlan({ notes: Array.from({ length: 20 }, (_, i) => `note ${i}`) });
    const { plan, ignored } = applyChanges(full, [{ type: "add_note", note: "one more" }]);
    expect(plan.profile.notes).toHaveLength(20);
    expect(ignored).toHaveLength(1);
  });

  it("updates task status, rejecting unknown tasks and delays without a date", () => {
    const { plan, ignored } = applyChanges(makePlan(), [
      { type: "set_task_status", taskId: "book-venue", status: "delayed", delayedTo: "2026-12-01" },
      { type: "set_task_status", taskId: "book-caterer", status: "delayed", delayedTo: null },
      { type: "set_task_status", taskId: "nonsense", status: "done", delayedTo: null },
    ]);
    expect(plan.tasks["book-venue"]).toEqual({ status: "delayed", delayedTo: "2026-12-01" });
    expect(plan.tasks["book-caterer"]).toBeUndefined();
    expect(ignored).toHaveLength(2);
  });

  it("skips a change that would make the plan invalid instead of throwing", () => {
    const { plan, ignored } = applyChanges(makePlan(), [
      { type: "shift_dates", days: 365 },
      { type: "set_function_date", function: "wedding", date: "not-a-date" },
    ]);
    expect(plan.profile.functions[0]?.date).toBe("2028-02-29");
    expect(ignored).toHaveLength(1);
  });
});
