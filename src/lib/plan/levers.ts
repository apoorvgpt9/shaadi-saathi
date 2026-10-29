import { STYLES } from "@/lib/types";
import type { CategoryId, FunctionKind, Lever, Plan, PlanChange } from "@/lib/types";
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

type Candidate = Omit<Lever, "saving" | "touchesPriority">;

const percent = (share: number) => `${Math.round(share * 100)}%`;
const trimmed = (guests: number, share: number) => Math.max(1, Math.round(guests * (1 - share)));

function candidateLevers(plan: Plan): Candidate[] {
  const { profile } = plan;
  const trimFunctions = profile.functions
    .filter((f) => f.kind !== "wedding")
    .map((f): Candidate => {
      const count = trimmed(f.guests, TRIM_PER_FUNCTION);
      return {
        id: `trim-guests-${f.kind}`,
        label: `Trim ${FUNCTION_LABELS[f.kind]} guests by ${percent(TRIM_PER_FUNCTION)} (${f.guests} to ${count})`,
        changes: [{ type: "set_guests", function: f.kind, count }],
      };
    });
  const trimAll: Candidate = {
    id: "trim-guests-all",
    label: `Trim every guest list by ${percent(TRIM_ALL)} (${profile.guests} to ${trimmed(profile.guests, TRIM_ALL)} at the wedding)`,
    changes: [{ type: "set_guests", function: "all", count: trimmed(profile.guests, TRIM_ALL) }],
  };
  const stepDowns = STEP_DOWN_CATEGORIES.flatMap((category): Candidate[] => {
    const current = effectiveStyle(profile, category);
    const lower = STYLES[STYLES.indexOf(current) - 1];
    if (!lower) return [];
    return [
      {
        id: `step-down-${category}`,
        label: `Step ${CATEGORY_LABELS[category]} down from ${STYLE_LABELS[current]} to ${STYLE_LABELS[lower]}`,
        changes: [{ type: "set_style", style: lower, category }],
      },
    ];
  });
  const skips = profile.functions
    .filter((f) => OPTIONAL_FUNCTIONS.includes(f.kind))
    .map((f): Candidate => ({
      id: `skip-${f.kind}`,
      label: `Skip the ${FUNCTION_LABELS[f.kind]} function`,
      changes: [{ type: "remove_function", function: f.kind }],
    }));
  return [...trimFunctions, trimAll, ...stepDowns, ...skips];
}

const lowersPriorityStyle = (changes: PlanChange[], priorities: CategoryId[]) =>
  changes.some((c) => c.type === "set_style" && c.category !== null && priorities.includes(c.category));

/** Concrete ways to save money, each with its engine-computed saving, biggest first. */
export function listLevers(plan: Plan): Lever[] {
  const totalBefore = computeBudget(plan).total;
  return candidateLevers(plan)
    .map((candidate) => ({
      ...candidate,
      saving: totalBefore - computeBudget(applyChanges(plan, candidate.changes).plan).total,
      touchesPriority: lowersPriorityStyle(candidate.changes, plan.profile.priorities),
    }))
    .filter((lever) => lever.saving > 0)
    .sort((a, b) => b.saving - a.saving);
}

/** Applies the union of the chosen levers' changes. Unknown ids are ignored. */
export function applyLevers(plan: Plan, ids: string[]): Plan {
  const chosen = candidateLevers(plan).filter((lever) => ids.includes(lever.id));
  return applyChanges(
    plan,
    chosen.flatMap((lever) => lever.changes),
  ).plan;
}
