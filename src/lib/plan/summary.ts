// Describes what a plan change did (budget, schedule, follow-ups) by diffing two plans.
import { formatDate } from "@/lib/format";
import { computeBudget } from "@/lib/plan/budget";
import { scheduleTasks } from "@/lib/plan/timeline";
import type {
  BudgetSummary,
  CategoryId,
  ChangeSummary,
  Plan,
  ScheduledTask,
  TaskFlag,
} from "@/lib/types";

type LineChange = ChangeSummary["lines"][number];

function weddingDate(plan: Plan): string {
  return plan.profile.functions.find((f) => f.kind === "wedding")?.date ?? "";
}

/** Titles of tasks that carry `flag` after the change but did not before. */
function newlyFlagged(before: ScheduledTask[], after: ScheduledTask[], flag: TaskFlag): string[] {
  const hadFlag = new Set(before.filter((t) => t.flags.includes(flag)).map((t) => t.id));
  return after.filter((t) => t.flags.includes(flag) && !hadFlag.has(t.id)).map((t) => t.title);
}

/** Budget lines whose amount differs between the two budgets, in category order. */
function changedLines(before: BudgetSummary, after: BudgetSummary): LineChange[] {
  return after.lines.flatMap((line, index): LineChange[] => {
    const amountBefore = before.lines[index]?.amount;
    if (amountBefore === undefined || amountBefore === line.amount) {
      return [];
    }
    return [{ category: line.category, before: amountBefore, after: line.amount }];
  });
}

/** Follow-ups for the couple: a moved wedding date, and vendors to tell when the headcount grew. */
function changeNotes(before: Plan, after: Plan, afterBudget: BudgetSummary): string[] {
  const notes: string[] = [];
  const { guests } = after.profile;
  if (weddingDate(before) !== weddingDate(after)) {
    notes.push(
      `Wedding moved from ${formatDate(weddingDate(before))} to ${formatDate(weddingDate(after))}`,
    );
  }
  if (guests > before.profile.guests) {
    const isBooked = (category: CategoryId) =>
      afterBudget.lines.some((l) => l.category === category && l.status !== "estimate");
    if (isBooked("venue")) {
      notes.push(`Check your venue holds ${guests} guests`);
    }
    if (isBooked("catering")) {
      notes.push("Send your caterer the new headcount");
    }
  }
  return notes;
}

/**
 * What a change did: changed budget lines, totals, newly flagged tasks and follow-up notes.
 * Pure; both schedules are computed against the injected `today`.
 *
 * @example
 * // The README example (+50 guests, budget Rs 7,00,000, two weeks earlier) from the Rs 8,00,000 plan:
 * const summary = summarizeChange(before, after, "2026-10-29");
 * // summary.totalBefore === 958_000, summary.totalAfter === 1_067_000, summary.budgetAfter === 700_000,
 * // summary.notes is ["Wedding moved from 1 Mar 2027 to 15 Feb 2027"]
 */
export function summarizeChange(before: Plan, after: Plan, today: string): ChangeSummary {
  const budgetBefore = computeBudget(before);
  const budgetAfter = computeBudget(after);
  const tasksBefore = scheduleTasks(before, today);
  const tasksAfter = scheduleTasks(after, today);
  return {
    lines: changedLines(budgetBefore, budgetAfter),
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
