// End-to-end planning stories as a table of requirements, each run through the real engine (no mocks).
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/format";
import { computeBudget } from "@/lib/plan/budget";
import { applyChanges } from "@/lib/plan/changes";
import { patchEntry } from "@/lib/plan/edits";
import { applyLevers, listLevers } from "@/lib/plan/levers";
import { previewOption } from "@/lib/plan/options";
import { summarizeChange } from "@/lib/plan/summary";
import { scheduleTasks } from "@/lib/plan/timeline";
import type { BudgetSummary, ChangeSummary, Plan, PlanChange, ScheduledTask } from "@/lib/types";
import { EXAMPLE_CHANGES, makePlan, makeQuote, TODAY } from "./plan-fixtures";

/** What the couple starts with, and the edits they then ask for. */
interface Given {
  plan: Plan;
  changes: PlanChange[];
}

/** Everything the engine says about the plan once the changes are applied. */
interface Outcome {
  before: Plan;
  after: Plan;
  ignored: string[];
  budget: BudgetSummary;
  tasks: ScheduledTask[];
  summary: ChangeSummary;
}

interface Scenario {
  story: string;
  given: Given;
  then: (outcome: Outcome) => void;
}

function runEngine({ plan, changes }: Given): Outcome {
  const { plan: after, ignored } = applyChanges(plan, changes);
  return {
    before: plan,
    after,
    ignored,
    budget: computeBudget(after),
    tasks: scheduleTasks(after, TODAY),
    summary: summarizeChange(plan, after, TODAY),
  };
}

function taskIdsWithFlag(tasks: ScheduledTask[], flag: ScheduledTask["flags"][number]): string[] {
  return tasks.filter((t) => t.flags.includes(flag)).map((t) => t.id);
}

function findTask(tasks: ScheduledTask[], id: string): ScheduledTask {
  const found = tasks.find((t) => t.id === id);
  if (!found) {
    throw new Error(`no task ${id}`);
  }
  return found;
}

const weddingOnlyIn = (days: number): Plan => {
  const plan = makePlan();
  const functions: Plan["profile"]["functions"] = [
    { kind: "wedding", date: addDays(TODAY, days), guests: 200 },
  ];
  return { ...plan, profile: { ...plan.profile, functions } };
};

const quotedCatering = patchEntry({ ...makePlan(), quotes: [makeQuote()] }, "catering", {
  quoteId: "q1",
});

const SCENARIOS: Scenario[] = [
  {
    story:
      "The example wedding (Jaipur, Tier-2, Classic, 200 + mehendi 120, Rs 8L) lands at about 120% of budget",
    given: { plan: makePlan(), changes: [] },
    then: ({ budget }) => {
      expect(budget.total).toBe(958_000);
      expect(budget.budget).toBe(800_000);
      expect(budget.ratio).toBeCloseTo(1.2, 1);
    },
  },
  {
    story:
      "+50 guests, budget Rs 7L, two weeks earlier: over budget, catering up, a date note, newly urgent tasks",
    given: { plan: makePlan(), changes: EXAMPLE_CHANGES },
    then: ({ summary, budget }) => {
      expect(budget.ratio).toBeGreaterThan(1.5);
      expect(summary.totalAfter).toBe(1_067_000);
      expect(summary.totalAfter).toBeGreaterThan(summary.budgetAfter);
      expect(summary.lines).toContainEqual({
        category: "catering",
        before: 284_000,
        after: 355_000,
      });
      expect(summary.notes).toEqual(["Wedding moved from 1 Mar 2027 to 15 Feb 2027"]);
      expect(summary.newlyUrgent).toEqual(["Book caterer", "Book photographer and videographer"]);
    },
  },
  {
    story: "Delaying book-venue to 10 Jan flags the tasks that depend on it as at risk",
    given: {
      plan: makePlan(),
      changes: [
        {
          type: "set_task_status",
          taskId: "book-venue",
          status: "delayed",
          delayedTo: "2027-01-10",
        },
      ],
    },
    then: ({ tasks }) => {
      expect(findTask(tasks, "book-venue")).toMatchObject({ due: "2027-01-10", status: "delayed" });
      expect(taskIdsWithFlag(tasks, "at_risk")).toEqual([
        "book-caterer",
        "book-decorator",
        "book-entertainment",
        "order-invitations",
        "guest-stay",
      ]);
      expect(findTask(tasks, "book-caterer").due).toBe("2027-01-11");
    },
  },
  {
    story: "A lever bundle cuts the total by exactly the saving the engine reports for it",
    given: { plan: makePlan(), changes: [] },
    then: ({ before }) => {
      const bundle = ["skip-mehendi", "step-down-catering"];
      const totalBefore = computeBudget(before).total;
      const totalAfter = computeBudget(applyLevers(before, bundle)).total;
      expect(totalBefore - totalAfter).toBe(previewOption(before, bundle).saving);
      expect(totalBefore - totalAfter).toBe(279_000);
    },
  },
  {
    story: "Levers are offered biggest saving first, and skipping the mehendi saves the most",
    given: { plan: makePlan(), changes: [] },
    then: ({ before }) => {
      const levers = listLevers(before);
      expect(levers[0]).toMatchObject({ id: "skip-mehendi", saving: 193_000 });
      expect(levers[1]).toMatchObject({
        id: "step-down-catering",
        saving: 122_000,
        touchesPriority: true,
      });
      expect(levers.map((l) => l.saving)).toEqual(
        [...levers.map((l) => l.saving)].sort((a, b) => b - a),
      );
    },
  },
  {
    story: "A caterer's quote replaces the catering estimate and the line reads as quoted",
    given: { plan: quotedCatering, changes: [] },
    then: ({ budget }) => {
      const catering = budget.lines.find((l) => l.category === "catering");
      expect(catering).toMatchObject({ amount: 250_000, estimate: 284_000, status: "quoted" });
      expect(budget.total).toBeLessThan(958_000);
    },
  },
  {
    story: "The wedding itself cannot be removed, so the plan and its total are left alone",
    given: { plan: makePlan(), changes: [{ type: "remove_function", function: "wedding" }] },
    then: ({ ignored, budget, after, before }) => {
      expect(ignored).toEqual(["The wedding function cannot be removed"]);
      expect(after).toEqual(before);
      expect(budget.total).toBe(958_000);
    },
  },
  {
    story:
      "A wedding 60 days away makes the early bookings urgent, due today, with nothing at risk",
    given: { plan: weddingOnlyIn(60), changes: [] },
    then: ({ tasks }) => {
      expect(findTask(tasks, "book-venue")).toMatchObject({ due: TODAY, flags: ["urgent"] });
      expect(taskIdsWithFlag(tasks, "at_risk")).toEqual([]);
      expect(findTask(tasks, "book-transport").flags).not.toContain("urgent");
    },
  },
];

describe("planning scenarios", () => {
  it.each(SCENARIOS)("$story", ({ given, then }) => {
    then(runEngine(given));
  });
});
