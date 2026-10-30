import { CATEGORY_IDS, type BudgetEntry, type CategoryId, type Plan, type TaskStatus } from "@/lib/types";

// Small pure plan edits, applied through the store's `update_plan` action. Each returns a new plan.

/** Merges `patch` into one category's budget entry, creating the entry if it does not exist yet. */
export function patchEntry(plan: Plan, category: CategoryId, patch: Partial<BudgetEntry>): Plan {
  const entry: BudgetEntry = { override: null, quoteId: null, confirmed: false, ...plan.budget[category], ...patch };
  return { ...plan, budget: { ...plan.budget, [category]: entry } };
}

/** Sets a task's status; `delayedTo` is kept only for "delayed" and cleared otherwise. */
export function setTask(plan: Plan, id: string, status: TaskStatus, delayedTo: string | null): Plan {
  return { ...plan, tasks: { ...plan.tasks, [id]: { status, delayedTo: status === "delayed" ? delayedTo : null } } };
}

/** Deletes a quote and detaches it from the budget category using it, which falls back to its estimate. */
export function removeQuote(plan: Plan, id: string): Plan {
  const next = { ...plan, quotes: plan.quotes.filter((q) => q.id !== id) };
  const used = CATEGORY_IDS.find((c) => plan.budget[c]?.quoteId === id);
  return used ? patchEntry(next, used, { quoteId: null }) : next;
}
