import { describe, expect, it } from "vitest";
import { computeBudget } from "@/lib/plan/budget";
import { listLevers } from "@/lib/plan/levers";
import { previewOption, usableOptions } from "@/lib/plan/options";
import { patchEntry } from "@/lib/plan/edits";
import { makePlan } from "./plan-fixtures";

const overBudget = makePlan({ budget: 500_000 });
const levers = listLevers(overBudget);

describe("usableOptions", () => {
  it("drops unknown lever ids, and options left with none", () => {
    const first = levers[0]?.id ?? "";
    const raw = [
      { title: "Mixed", why: "a", leverIds: [first, "made-up"] },
      { title: "Invented", why: "b", leverIds: ["made-up"] },
    ];
    expect(usableOptions(raw, levers)).toEqual([{ title: "Mixed", why: "a", ids: [first] }]);
    expect(usableOptions([], levers)).toEqual([]);
  });
});

describe("previewOption", () => {
  it("computes the saving and share of budget from the engine, never from the AI", () => {
    const ids = levers.map((l) => l.id);
    const before = computeBudget(overBudget);
    const preview = previewOption(overBudget, ids);
    expect(preview.saving).toBeGreaterThan(0);
    expect(preview.percent).toBeLessThan(Math.round(before.ratio * 100));
  });

  it("reflects the plan as it is now, so an edit made after the options arrived changes the figures", () => {
    const ids = levers.slice(0, 1).map((l) => l.id);
    const edited = patchEntry(overBudget, "decor", { override: 900_000 });
    expect(previewOption(edited, ids).percent).toBeGreaterThan(previewOption(overBudget, ids).percent);
  });

  it("never calls a total over budget within budget, even when it rounds to 100%", () => {
    const plan = makePlan({ budget: 800_000 });
    const total = computeBudget(plan).total;
    const tight = { ...plan, profile: { ...plan.profile, budget: total - 1 } };
    const preview = previewOption(tight, []);
    expect(preview).toMatchObject({ within: false, saving: 0 });
    expect(preview.percent).toBeGreaterThan(100);
  });
});
