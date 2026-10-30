// The engine's menu of concrete money-saving changes, each priced by recomputing the budget.
import { STYLES } from "@/lib/types";
import type { CategoryId, FunctionKind, Lever, Plan, PlanChange, Profile } from "@/lib/types";
import { CATEGORY_LABELS, FUNCTION_LABELS, STYLE_LABELS } from "@/lib/plan/benchmarks";
import { computeBudget, effectiveStyle } from "@/lib/plan/budget";
import { applyChanges } from "@/lib/plan/changes";

const TRIM_PER_FUNCTION = 0.2;
const TRIM_ALL = 0.1;
const STEP_DOWN_CATEGORIES: CategoryId[] = [
  "catering",
  "decor",
  "photography",
  "attire",
  "venue",
  "entertainment",
  "makeup",
];
const OPTIONAL_FUNCTIONS: FunctionKind[] = ["haldi", "mehendi", "sangeet", "reception"];

/** A lever before it is priced: what it does and the changes that do it. */
type Candidate = Omit<Lever, "saving" | "touchesPriority">;

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** A guest count reduced by `share`, never below one guest. */
function trimmed(guests: number, share: number): number {
  return Math.max(1, Math.round(guests * (1 - share)));
}

/** One lever per non-wedding function: invite fewer guests to it. */
function trimFunctionLevers(profile: Profile): Candidate[] {
  const otherFunctions = profile.functions.filter((f) => f.kind !== "wedding");
  return otherFunctions.map((f): Candidate => {
    const count = trimmed(f.guests, TRIM_PER_FUNCTION);
    return {
      id: `trim-guests-${f.kind}`,
      label: `Trim ${FUNCTION_LABELS[f.kind]} guests by ${percent(TRIM_PER_FUNCTION)} (${f.guests} to ${count})`,
      changes: [{ type: "set_guests", function: f.kind, count }],
    };
  });
}

/** One lever that trims every function's guest list, wedding included. */
function trimAllLever(profile: Profile): Candidate {
  const count = trimmed(profile.guests, TRIM_ALL);
  return {
    id: "trim-guests-all",
    label: `Trim every guest list by ${percent(TRIM_ALL)} (${profile.guests} to ${count} at the wedding)`,
    changes: [{ type: "set_guests", function: "all", count }],
  };
}

/** One lever per category that can drop a style tier (Premium to Classic, Classic to Simple). */
function stepDownLevers(profile: Profile): Candidate[] {
  return STEP_DOWN_CATEGORIES.flatMap((category): Candidate[] => {
    const current = effectiveStyle(profile, category);
    const lower = STYLES[STYLES.indexOf(current) - 1];
    if (!lower) {
      return [];
    }
    return [
      {
        id: `step-down-${category}`,
        label: `Step ${CATEGORY_LABELS[category]} down from ${STYLE_LABELS[current]} to ${STYLE_LABELS[lower]}`,
        changes: [{ type: "set_style", style: lower, category }],
      },
    ];
  });
}

/** One lever per optional function in the plan: skip it entirely. */
function skipLevers(profile: Profile): Candidate[] {
  const optional = profile.functions.filter((f) => OPTIONAL_FUNCTIONS.includes(f.kind));
  return optional.map((f): Candidate => ({
    id: `skip-${f.kind}`,
    label: `Skip the ${FUNCTION_LABELS[f.kind]} function`,
    changes: [{ type: "remove_function", function: f.kind }],
  }));
}

function candidateLevers(plan: Plan): Candidate[] {
  const { profile } = plan;
  return [...trimFunctionLevers(profile), trimAllLever(profile), ...stepDownLevers(profile), ...skipLevers(profile)];
}

/** True when a change lowers the style of a category the couple marked as a priority. */
function lowersPriorityStyle(changes: PlanChange[], priorities: CategoryId[]): boolean {
  return changes.some((c) => c.type === "set_style" && c.category !== null && priorities.includes(c.category));
}

/**
 * Concrete ways to save money, each with its engine-computed saving, biggest first.
 * Levers that save nothing are omitted.
 *
 * @example
 * // The Rs 8,00,000 example wedding (total 9,58,000):
 * const levers = listLevers(plan);
 * // levers[0] is { id: "skip-mehendi", saving: 193_000 }, levers[1] is { id: "step-down-catering", saving: 122_000 }
 */
export function listLevers(plan: Plan): Lever[] {
  const totalBefore = computeBudget(plan).total;
  return candidateLevers(plan)
    .map((candidate) => {
      const totalAfter = computeBudget(applyChanges(plan, candidate.changes).plan).total;
      const touchesPriority = lowersPriorityStyle(candidate.changes, plan.profile.priorities);
      return { ...candidate, saving: totalBefore - totalAfter, touchesPriority };
    })
    .filter((lever) => lever.saving > 0)
    .sort((a, b) => b.saving - a.saving);
}

/**
 * Applies the union of the chosen levers' changes. Unknown ids are ignored.
 *
 * @example
 * // Choosing "trim-guests-all" trims the wedding from 200 to 180 guests:
 * applyLevers(plan, ["trim-guests-all"]).profile.guests; // 180
 */
export function applyLevers(plan: Plan, ids: string[]): Plan {
  const chosen = candidateLevers(plan).filter((lever) => ids.includes(lever.id));
  const changes = chosen.flatMap((lever) => lever.changes);
  return applyChanges(plan, changes).plan;
}
