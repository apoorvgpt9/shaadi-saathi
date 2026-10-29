import { describe, expect, it } from "vitest";
import { computeBudget } from "@/lib/plan/budget";
import type { CategoryId, Plan } from "@/lib/types";
import { makePlan, makeQuote } from "./plan-fixtures";

const line = (plan: Plan, category: CategoryId) => {
  const found = computeBudget(plan).lines.find((l) => l.category === category);
  if (!found) throw new Error(`no ${category} line`);
  return found;
};

describe("computeBudget", () => {
  it("lands the example scenario at about 9.58 lakh, a ratio between 1.15 and 1.25", () => {
    const summary = computeBudget(makePlan());
    expect(summary.total).toBe(958_000);
    expect(summary.ratio).toBeGreaterThan(1.15);
    expect(summary.ratio).toBeLessThan(1.25);
    expect(summary.budget).toBe(800_000);
  });

  it("estimates catering, venue and decor per function with weights", () => {
    const plan = makePlan();
    expect(line(plan, "catering").amount).toBe(1000 * 200 + 1000 * 120 * 0.7);
    expect(line(plan, "venue").amount).toBe(350 * 200 + 350 * 120 * 0.5);
    expect(line(plan, "decor").amount).toBe(113_000); // 75,000 + 37,500 rounded to the nearest 1,000
  });

  it("adds the mehendi artist to makeup only when mehendi is in the plan", () => {
    expect(line(makePlan(), "makeup").amount).toBe(47_000);
    const wedding = { kind: "wedding" as const, date: "2027-03-01", guests: 200 };
    expect(line(makePlan({ functions: [wedding] }), "makeup").amount).toBe(35_000);
  });

  it("applies the tier multiplier to every category except rituals", () => {
    const tier2 = computeBudget(makePlan());
    const metro = computeBudget(makePlan({ cityTier: "metro" }));
    const town = computeBudget(makePlan({ cityTier: "town" }));
    expect(line(makePlan({ cityTier: "metro" }), "catering").amount).toBe(1.5 * line(makePlan(), "catering").amount);
    expect(line(makePlan({ cityTier: "town" }), "transport").amount).toBe(28_000);
    for (const summary of [metro, town]) {
      expect(summary.lines.find((l) => l.category === "rituals")?.amount).toBe(21_000);
    }
    expect(metro.total).toBeGreaterThan(tier2.total);
    expect(town.total).toBeLessThan(tier2.total);
  });

  it("uses a per-category style over the global style", () => {
    const plan = makePlan({ categoryStyles: { catering: "premium" } });
    expect(line(plan, "catering").amount).toBe(511_000); // 1,800 x (200 + 120 x 0.7) = 511,200, rounded
    expect(line(plan, "decor").amount).toBe(line(makePlan(), "decor").amount);
    expect(line(makePlan({ style: "simple" }), "attire").amount).toBe(50_000);
  });

  it("charges photography a quarter of the base for each extra function", () => {
    expect(line(makePlan(), "photography").amount).toBe(125_000);
  });

  it("sets contingency to 7% of the other lines' amounts", () => {
    const plan = makePlan();
    plan.budget.catering = { override: 400_000, quoteId: null, confirmed: false };
    const summary = computeBudget(plan);
    const others = summary.lines.filter((l) => l.category !== "contingency").reduce((s, l) => s + l.amount, 0);
    expect(line(plan, "contingency").amount).toBe(Math.round((others * 0.07) / 1000) * 1000);
    expect(line(plan, "contingency").source).toMatch(/^7% of all other lines/);
  });

  it("keeps an override as an estimate and remembers the benchmark", () => {
    const plan = makePlan();
    const benchmark = line(plan, "catering").estimate;
    plan.budget.catering = { override: 300_000, quoteId: null, confirmed: false };
    expect(line(plan, "catering")).toMatchObject({ amount: 300_000, status: "estimate", estimate: benchmark });
  });

  it("uses a matching quote as quoted, and confirmed when confirmed", () => {
    const plan = makePlan();
    plan.quotes = [makeQuote()];
    plan.budget.catering = { override: 111_000, quoteId: "q1", confirmed: false };
    expect(line(plan, "catering")).toMatchObject({ amount: 250_000, status: "quoted" });
    plan.budget.catering = { override: null, quoteId: "q1", confirmed: true };
    expect(line(plan, "catering")).toMatchObject({ amount: 250_000, status: "confirmed" });
  });

  it("falls back to the estimate when the quote id matches nothing", () => {
    const plan = makePlan();
    plan.budget.catering = { override: null, quoteId: "missing", confirmed: false };
    expect(line(plan, "catering").status).toBe("estimate");
  });

  it("marks an overridden line confirmed when confirmed", () => {
    const plan = makePlan();
    plan.budget.venue = { override: 90_000, quoteId: null, confirmed: true };
    expect(line(plan, "venue")).toMatchObject({ amount: 90_000, status: "confirmed" });
  });

  it("explains each benchmark line in plain words", () => {
    const { source } = line(makePlan(), "catering");
    expect(source).toContain("Tier-2, Classic");
    expect(source).toContain("₹1,000/plate");
    expect(line(makePlan(), "attire").source).toContain("Excludes gold jewellery");
  });
});
