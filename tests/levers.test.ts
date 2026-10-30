import { describe, expect, it } from "vitest";
import { computeBudget } from "@/lib/plan/budget";
import { applyLevers, listLevers } from "@/lib/plan/levers";
import { makePlan } from "./plan-fixtures";

describe("listLevers", () => {
  const plan = makePlan({ priorities: ["catering"] });
  const levers = listLevers(plan);
  const lever = (id: string) => {
    const found = levers.find((l) => l.id === id);
    if (!found) throw new Error(`no lever ${id}`);
    return found;
  };

  it("lists only levers that save money, biggest saving first", () => {
    expect(levers.length).toBeGreaterThan(0);
    expect(levers.every((l) => l.saving > 0)).toBe(true);
    const savings = levers.map((l) => l.saving);
    expect(savings).toEqual([...savings].sort((a, b) => b - a));
  });

  it("computes each saving as total before minus total after applying the lever", () => {
    const before = computeBudget(plan).total;
    for (const l of levers) {
      expect(l.saving).toBe(before - computeBudget(applyLevers(plan, [l.id])).total);
    }
  });

  it("offers each lever family for this plan", () => {
    expect(lever("trim-guests-mehendi").changes).toEqual([
      { type: "set_guests", function: "mehendi", count: 96 },
    ]);
    expect(lever("trim-guests-all").changes).toEqual([
      { type: "set_guests", function: "all", count: 180 },
    ]);
    expect(lever("step-down-decor").changes).toEqual([
      { type: "set_style", style: "simple", category: "decor" },
    ]);
    expect(lever("skip-mehendi").saving).toBeGreaterThan(lever("trim-guests-mehendi").saving);
    expect(levers.some((l) => l.id === "trim-guests-wedding")).toBe(false);
    expect(levers.some((l) => l.id === "skip-wedding")).toBe(false);
  });

  it("flags only levers that lower a priority category's style", () => {
    expect(lever("step-down-catering").touchesPriority).toBe(true);
    expect(lever("step-down-decor").touchesPriority).toBe(false);
    expect(lever("trim-guests-all").touchesPriority).toBe(false);
    expect(lever("skip-mehendi").touchesPriority).toBe(false);
  });

  it("does not offer a step down for a category already at simple", () => {
    const simple = listLevers(makePlan({ categoryStyles: { decor: "simple" } }));
    expect(simple.some((l) => l.id === "step-down-decor")).toBe(false);
  });

  it("drops levers on lines the user has fixed with an override", () => {
    const fixed = makePlan();
    fixed.budget.decor = { override: 100_000, quoteId: null, confirmed: true };
    expect(listLevers(fixed).some((l) => l.id === "step-down-decor")).toBe(false);
  });
});

describe("applyLevers", () => {
  it("applies the union of the chosen levers", () => {
    const plan = makePlan();
    const result = applyLevers(plan, ["step-down-decor", "skip-mehendi", "no-such-lever"]);
    expect(result.profile.categoryStyles.decor).toBe("simple");
    expect(result.profile.functions.map((f) => f.kind)).toEqual(["wedding"]);
    expect(computeBudget(result).total).toBeLessThan(computeBudget(plan).total);
  });

  it("returns an equal plan for no levers and leaves the input untouched", () => {
    const plan = makePlan();
    const snapshot = structuredClone(plan);
    expect(applyLevers(plan, [])).toEqual(plan);
    applyLevers(plan, ["trim-guests-all"]);
    expect(plan).toEqual(snapshot);
  });
});
