// Derived views (computed by the engine, never stored).
import type { CategoryId, FunctionKind } from "./domain";
import type { PlanChange, PriceStatus, TaskStatus } from "./plan";

export interface BudgetLine {
  category: CategoryId;
  amount: number;
  /** The benchmark estimate, kept even when overridden or quoted, for comparison. */
  estimate: number;
  status: PriceStatus;
  /** Human-readable basis, e.g. "Benchmark (Tier-2, Classic): ₹1,000/plate × 200 at Wedding". */
  source: string;
}

export interface BudgetSummary {
  lines: BudgetLine[];
  total: number;
  budget: number;
  /** total / budget, e.g. 1.2 = 20% over. */
  ratio: number;
}

export type TaskFlag = "urgent" | "at_risk" | "clash";

export interface ScheduledTask {
  id: string;
  title: string;
  category: CategoryId | null;
  anchor: FunctionKind;
  dependsOn: string[];
  due: string;
  status: TaskStatus;
  flags: TaskFlag[];
}

export interface Lever {
  id: string;
  label: string;
  changes: PlanChange[];
  saving: number;
  /** True when the lever lowers the style of one of the user's priority categories. */
  touchesPriority: boolean;
}

export interface ChangeSummary {
  lines: { category: CategoryId; before: number; after: number }[];
  totalBefore: number;
  totalAfter: number;
  budgetBefore: number;
  budgetAfter: number;
  newlyUrgent: string[];
  newlyAtRisk: string[];
  newlyClashing: string[];
  notes: string[];
}
