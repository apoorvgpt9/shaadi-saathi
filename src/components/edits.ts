import { CATEGORY_IDS, type BudgetEntry, type CategoryId, type Plan, type TaskStatus } from "@/lib/types";

/** Pure edits applied through the store's `update_plan` action. */
export function patchEntry(plan: Plan, category: CategoryId, patch: Partial<BudgetEntry>): Plan {
  const entry: BudgetEntry = { override: null, quoteId: null, confirmed: false, ...plan.budget[category], ...patch };
  return { ...plan, budget: { ...plan.budget, [category]: entry } };
}

export function setTask(plan: Plan, id: string, status: TaskStatus, delayedTo: string | null): Plan {
  return { ...plan, tasks: { ...plan.tasks, [id]: { status, delayedTo: status === "delayed" ? delayedTo : null } } };
}

export function removeQuote(plan: Plan, id: string): Plan {
  const next = { ...plan, quotes: plan.quotes.filter((q) => q.id !== id) };
  const used = CATEGORY_IDS.find((c) => plan.budget[c]?.quoteId === id);
  return used ? patchEntry(next, used, { quoteId: null }) : next;
}
