// Describes what a plan change did (budget, schedule, follow-ups) by diffing two plans.
import { formatDate } from "@/lib/format";
import { computeBudget } from "@/lib/plan/budget";
import { scheduleTasks } from "@/lib/plan/timeline";
import type { BudgetSummary, CategoryId, ChangeSummary, Plan, ScheduledTask, TaskFlag } from "@/lib/types";

const weddingDate = (plan: Plan) => plan.profile.functions.find((f) => f.kind === "wedding")?.date ?? "";

/** Titles of tasks that carry `flag` after the change but did not before. */
function newlyFlagged(before: ScheduledTask[], after: ScheduledTask[], flag: TaskFlag): string[] {
  const hadFlag = new Set(before.filter((t) => t.flags.includes(flag)).map((t) => t.id));
  return after.filter((t) => t.flags.includes(flag) && !hadFlag.has(t.id)).map((t) => t.title);
}

function changeNotes(before: Plan, after: Plan, afterBudget: BudgetSummary): string[] {
  const notes: string[] = [];
  const { guests } = after.profile;
  if (weddingDate(before) !== weddingDate(after)) {
    notes.push(`Wedding moved from ${formatDate(weddingDate(before))} to ${formatDate(weddingDate(after))}`);
  }
  if (guests > before.profile.guests) {
    const isBooked = (category: CategoryId) =>
      afterBudget.lines.some((l) => l.category === category && l.status !== "estimate");
    if (isBooked("venue")) notes.push(`Check your venue holds ${guests} guests`);
    if (isBooked("catering")) notes.push("Send your caterer the new headcount");
  }
  return notes;
}

/**
 * What a change did: changed budget lines, totals, newly flagged tasks and follow-up notes.
 * Pure; both schedules are computed against the injected `today`.
 */
export function summarizeChange(before: Plan, after: Plan, today: string): ChangeSummary {
  const budgetBefore = computeBudget(before);
  const budgetAfter = computeBudget(after);
  const tasksBefore = scheduleTasks(before, today);
  const tasksAfter = scheduleTasks(after, today);
  const lines = budgetAfter.lines.flatMap((line, i) => {
    const before = budgetBefore.lines[i]?.amount;
    return before === undefined || before === line.amount
      ? []
      : [{ category: line.category, before, after: line.amount }];
  });
  return {
    lines,
    totalBefore: budgetBefore.total,
    totalAfter: budgetAfter.total,
    budgetBefore: budgetBefore.budget,
    budgetAfter: budgetAfter.budget,
    newlyUrgent: newlyFlagged(tasksBefore, tasksAfter, "urgent"),
    newlyAtRisk: newlyFlagged(tasksBefore, tasksAfter, "at_risk"),
    newlyClashing: newlyFlagged(tasksBefore, tasksAfter, "clash"),
    notes: changeNotes(before, after, budgetAfter),
  };
}
