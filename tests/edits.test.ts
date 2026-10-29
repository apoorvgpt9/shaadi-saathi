import { describe, expect, it } from "vitest";
import { patchEntry, removeQuote, setTask } from "@/lib/plan/edits";
import { computeBudget } from "@/lib/plan/budget";
import { makePlan, makeQuote } from "./plan-fixtures";

const line = (plan: ReturnType<typeof makePlan>, category: "catering") =>
  computeBudget(plan).lines.find((l) => l.category === category);

describe("plan edits", () => {
  it("patchEntry creates the entry on first use and keeps other fields", () => {
    const plan = patchEntry(makePlan(), "catering", { override: 300_000 });
    expect(plan.budget.catering).toEqual({ override: 300_000, quoteId: null, confirmed: false });
    expect(patchEntry(plan, "catering", { confirmed: true }).budget.catering).toEqual({
      override: 300_000,
      quoteId: null,
      confirmed: true,
    });
  });

  it("an override changes the line, and clearing it returns to the estimate", () => {
    const base = line(makePlan(), "catering");
    const overridden = line(patchEntry(makePlan(), "catering", { override: 123_000 }), "catering");
    expect(overridden).toMatchObject({ amount: 123_000, status: "estimate" });
    expect(
      line(
        patchEntry(patchEntry(makePlan(), "catering", { override: 123_000 }), "catering", { override: null }),
        "catering",
      )?.amount,
    ).toBe(base?.amount);
  });

  it("removeQuote also detaches it from the budget line", () => {
    const withQuote = patchEntry({ ...makePlan(), quotes: [makeQuote()] }, "catering", { quoteId: "q1" });
    expect(line(withQuote, "catering")).toMatchObject({ amount: 250_000, status: "quoted" });
    const removed = removeQuote(withQuote, "q1");
    expect(removed.quotes).toEqual([]);
    expect(removed.budget.catering?.quoteId).toBeNull();
    expect(line(removed, "catering")?.status).toBe("estimate");
  });

  it("returning a task to to-do drops its delayed date", () => {
    const plan = setTask(
      setTask(makePlan(), "book-venue", "delayed", "2027-01-20"),
      "book-venue",
      "todo",
      "2027-01-20",
    );
    expect(plan.tasks["book-venue"]).toEqual({ status: "todo", delayedTo: null });
  });
});
