import { assert, describe, expect, it } from "vitest";
import { computeBudget } from "@/lib/plan/budget";
import { applyChanges } from "@/lib/plan/changes";
import { summarizeChange } from "@/lib/plan/summary";
import { EXAMPLE_CHANGES, makePlan, makeQuote, TODAY } from "./plan-fixtures";

describe("summarizeChange", () => {
  const before = makePlan();
  const after = applyChanges(before, EXAMPLE_CHANGES).plan;

  it("shows a deeper over-budget ratio and higher catering for the example scenario", () => {
    const summary = summarizeChange(before, after, TODAY);
    expect(summary.totalAfter).toBeGreaterThan(summary.totalBefore);
    expect(summary.budgetBefore).toBe(800_000);
    expect(summary.budgetAfter).toBe(700_000);
    expect(summary.totalAfter / summary.budgetAfter).toBeGreaterThan(summary.totalBefore / summary.budgetBefore);
    const catering = summary.lines.find((l) => l.category === "catering");
    assert(catering);
    expect(catering.after).toBeGreaterThan(catering.before);
  });

  it("lists only the lines that changed", () => {
    const summary = summarizeChange(before, after, TODAY);
    expect(summary.lines.every((l) => l.before !== l.after)).toBe(true);
    const unchanged = computeBudget(before).lines.find((l) => l.category === "rituals");
    expect(summary.lines.some((l) => l.category === unchanged?.category)).toBe(false);
    expect(summarizeChange(before, before, TODAY).lines).toEqual([]);
  });

  it("names tasks that newly became urgent when the wedding moves earlier", () => {
    const summary = summarizeChange(before, after, TODAY);
    expect(summary.newlyUrgent).toEqual(expect.arrayContaining(["Book caterer", "Book photographer and videographer"]));
    expect(summary.newlyUrgent).not.toContain("Shortlist and book venue(s)"); // already urgent before
  });

  it("notes the new wedding date, and venue and caterer follow-ups only when quoted or confirmed", () => {
    const plain = summarizeChange(before, after, TODAY);
    expect(plain.notes).toEqual(["Wedding moved from 1 Mar 2027 to 15 Feb 2027"]);

    const booked = makePlan();
    booked.quotes = [makeQuote({ category: "catering" }), makeQuote({ id: "q2", category: "venue" })];
    booked.budget.catering = { override: null, quoteId: "q1", confirmed: false };
    booked.budget.venue = { override: null, quoteId: "q2", confirmed: true };
    const bookedAfter = applyChanges(booked, EXAMPLE_CHANGES).plan;
    expect(summarizeChange(booked, bookedAfter, TODAY).notes).toEqual(
      expect.arrayContaining(["Check your venue holds 250 guests", "Send your caterer the new headcount"]),
    );
  });

  it("adds no capacity notes when guests fall", () => {
    const fewer = applyChanges(before, [{ type: "set_guests", function: "all", count: 150 }]).plan;
    expect(summarizeChange(before, fewer, TODAY).notes).toEqual([]);
  });
});
