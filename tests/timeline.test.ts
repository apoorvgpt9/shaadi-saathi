import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/format";
import { nextTasks, scheduleTasks, TASK_TEMPLATES } from "@/lib/plan/timeline";
import type { Plan, ScheduledTask } from "@/lib/types";
import { makePlan, TODAY } from "./plan-fixtures";

const withWeddingIn = (days: number, plan: Plan = makePlan()): Plan => ({
  ...plan,
  profile: {
    ...plan.profile,
    functions: [{ kind: "wedding", date: addDays(TODAY, days), guests: 200 }],
  },
});

const find = (tasks: ScheduledTask[], id: string) => {
  const found = tasks.find((t) => t.id === id);
  if (!found) throw new Error(`no task ${id}`);
  return found;
};

describe("TASK_TEMPLATES", () => {
  it("has 27 tasks, each listed after its dependencies", () => {
    expect(TASK_TEMPLATES).toHaveLength(27);
    const seen = new Set<string>();
    for (const t of TASK_TEMPLATES) {
      expect(t.dependsOn.every((d) => seen.has(d))).toBe(true);
      seen.add(t.id);
    }
  });
});

describe("scheduleTasks", () => {
  it("sets due = anchor - lead time and flags nothing for a far-off wedding", () => {
    const tasks = scheduleTasks(withWeddingIn(300), TODAY);
    expect(find(tasks, "book-venue").due).toBe(addDays(TODAY, 150));
    expect(tasks.every((t) => t.flags.length === 0)).toBe(true);
  });

  it("marks overdue tasks urgent and spreads them over at most a week", () => {
    const tasks = scheduleTasks(withWeddingIn(60), TODAY);
    const urgent = tasks.filter((t) => t.flags.includes("urgent"));
    expect(urgent.map((t) => t.id)).toContain("book-venue");
    expect(urgent.every((t) => t.due >= TODAY)).toBe(true);
    expect(find(tasks, "book-venue").due).toBe(TODAY);
    expect(find(tasks, "book-transport").flags).not.toContain("urgent");
  });

  it("staggers urgent tasks two per day, capped at six days out", () => {
    const tasks = scheduleTasks(withWeddingIn(5), TODAY);
    const urgent = tasks.filter((t) => t.flags.includes("urgent"));
    expect(urgent.length).toBeGreaterThan(14);
    const latestOwnDue = urgent.filter((t) => !t.flags.includes("at_risk")).map((t) => t.due);
    expect(latestOwnDue.every((d) => d <= addDays(TODAY, 6))).toBe(true);
    expect(find(tasks, "book-venue").due).toBe(TODAY);
  });

  it("does not flag done tasks and keeps their ideal date", () => {
    const plan = withWeddingIn(60);
    plan.tasks["book-venue"] = { status: "done", delayedTo: null };
    const venue = find(scheduleTasks(plan, TODAY), "book-venue");
    expect(venue.flags).toEqual([]);
    expect(venue.due).toBe(addDays(TODAY, 60 - 150));
  });

  it("flags dependents at risk when a prerequisite is delayed past their due date", () => {
    const plan = withWeddingIn(300);
    const delayedTo = addDays(TODAY, 280);
    plan.tasks["book-venue"] = { status: "delayed", delayedTo };
    const tasks = scheduleTasks(plan, TODAY);
    expect(find(tasks, "book-venue")).toMatchObject({ due: delayedTo, status: "delayed" });
    expect(find(tasks, "book-caterer")).toMatchObject({ due: addDays(delayedTo, 1) });
    expect(find(tasks, "book-caterer").flags).toContain("at_risk");
    // Pushes cascade down the chain.
    expect(find(tasks, "menu-tasting").flags).toContain("at_risk");
  });

  it("flags a task that lands on or after its anchor date as a clash", () => {
    const plan = withWeddingIn(300);
    plan.tasks["book-venue"] = { status: "delayed", delayedTo: addDays(TODAY, 300) };
    const tasks = scheduleTasks(plan, TODAY);
    expect(find(tasks, "book-venue").flags).toContain("clash");
    expect(find(tasks, "book-caterer").flags).toEqual(expect.arrayContaining(["at_risk", "clash"]));
  });

  it("treats a delayed task as the user's choice, not urgent", () => {
    const plan = withWeddingIn(60);
    const delayedTo = addDays(TODAY, 21);
    plan.tasks["book-venue"] = { status: "delayed", delayedTo };
    const venue = find(scheduleTasks(plan, TODAY), "book-venue");
    expect(venue.due).toBe(delayedTo);
    expect(venue.flags).not.toContain("urgent");
  });

  it("omits tasks for functions the plan does not have", () => {
    const ids = (plan: Plan) => scheduleTasks(plan, TODAY).map((t) => t.id);
    expect(ids(makePlan())).toContain("book-mehendi-artist");
    expect(ids(makePlan())).not.toContain("haldi-prep");
    expect(ids(makePlan())).not.toContain("sangeet-rehearsals");
    expect(ids(withWeddingIn(300))).toHaveLength(24);
    const withSangeet = makePlan();
    withSangeet.profile.functions.push({ kind: "sangeet", date: "2027-02-27", guests: 150 });
    expect(ids(withSangeet)).toContain("sangeet-rehearsals");
  });

  it("returns tasks soonest first", () => {
    const dues = scheduleTasks(makePlan(), TODAY).map((t) => t.due);
    expect(dues).toEqual([...dues].sort());
  });
});

describe("nextTasks", () => {
  it("lists ready tasks (all dependencies done) first, soonest first", () => {
    const next = nextTasks(scheduleTasks(makePlan(), TODAY));
    expect(next).toHaveLength(3);
    // finalise-dates, agree-budget and guest-estimate are done at intake, so book-venue is ready.
    expect(next[0].id).toBe("book-venue");
    // book-caterer is due soon too but is blocked until the venue is done.
    expect(next.map((t) => t.id)).not.toContain("book-caterer");
  });

  it("tops up with blocked tasks when fewer than the requested number are ready", () => {
    const tasks: ScheduledTask[] = scheduleTasks(makePlan(), TODAY).map((t) => ({
      ...t,
      status: t.id === "book-venue" ? "todo" : "done",
    }));
    const next = nextTasks(tasks, 3);
    expect(next.map((t) => t.id)).toEqual(["book-venue"]);
    expect(nextTasks(scheduleTasks(makePlan(), TODAY), 8)).toHaveLength(8);
  });

  it("returns nothing when every task is done", () => {
    const tasks = scheduleTasks(makePlan(), TODAY).map((t) => ({ ...t, status: "done" as const }));
    expect(nextTasks(tasks)).toEqual([]);
  });
});
