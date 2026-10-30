// Applies the AI's structured PlanChange edits to a plan, validating each result.
import { addDays } from "@/lib/format";
import { LIMITS, Plan } from "@/lib/types";
import type { FunctionKind, PlanChange, WeddingFunction } from "@/lib/types";
import { FUNCTION_LABELS } from "@/lib/plan/benchmarks";
import { setTask } from "@/lib/plan/edits";
import { TASK_TEMPLATES } from "@/lib/plan/timeline";

type Outcome = { plan: Plan } | { ignored: string };
type ChangeOf<T extends PlanChange["type"]> = Extract<PlanChange, { type: T }>;

function ok(plan: Plan): Outcome {
  return { plan };
}

function ignore(reason: string): Outcome {
  return { ignored: reason };
}

/** A guest count rounded to a whole number within the schema's limits. */
function clampGuests(count: number): number {
  return Math.min(LIMITS.guests.max, Math.max(LIMITS.guests.min, Math.round(count)));
}

function hasFunction(plan: Plan, kind: FunctionKind): boolean {
  return plan.profile.functions.some((f) => f.kind === kind);
}

function withFunctions(plan: Plan, update: (f: WeddingFunction) => WeddingFunction): Plan {
  return { ...plan, profile: { ...plan.profile, functions: plan.profile.functions.map(update) } };
}

/** The wedding-day headcount lives on both the profile and the wedding function. */
function setWeddingGuests(plan: Plan, count: number): Plan {
  const updated = withFunctions(plan, (f) => (f.kind === "wedding" ? { ...f, guests: count } : f));
  return { ...updated, profile: { ...updated.profile, guests: count } };
}

function setGuests(plan: Plan, { function: target, count }: ChangeOf<"set_guests">): Outcome {
  if (target === "all") {
    const scale = count / plan.profile.guests;
    const scaled = withFunctions(plan, (f) => ({ ...f, guests: clampGuests(f.guests * scale) }));
    return ok(setWeddingGuests(scaled, count));
  }
  if (target === "wedding") {
    return ok(setWeddingGuests(plan, count));
  }
  if (!hasFunction(plan, target)) {
    return ignore(
      `${FUNCTION_LABELS[target]} is not in the plan, so its guest count was not changed`,
    );
  }
  return ok(withFunctions(plan, (f) => (f.kind === target ? { ...f, guests: count } : f)));
}

function setFunctionDate(
  plan: Plan,
  { function: kind, date }: ChangeOf<"set_function_date">,
): Outcome {
  if (!hasFunction(plan, kind)) {
    return ignore(`${FUNCTION_LABELS[kind]} is not in the plan, so its date was not changed`);
  }
  return ok(withFunctions(plan, (f) => (f.kind === kind ? { ...f, date } : f)));
}

function addFunction(
  plan: Plan,
  { function: kind, date, guests }: ChangeOf<"add_function">,
): Outcome {
  if (hasFunction(plan, kind)) {
    return ignore(`${FUNCTION_LABELS[kind]} is already in the plan`);
  }
  const functions = [...plan.profile.functions, { kind, date, guests }];
  return ok({ ...plan, profile: { ...plan.profile, functions } });
}

function removeFunction(plan: Plan, { function: kind }: ChangeOf<"remove_function">): Outcome {
  if (kind === "wedding") {
    return ignore("The wedding function cannot be removed");
  }
  if (!hasFunction(plan, kind)) {
    return ignore(`${FUNCTION_LABELS[kind]} is not in the plan, so nothing was removed`);
  }
  const functions = plan.profile.functions.filter((f) => f.kind !== kind);
  return ok({ ...plan, profile: { ...plan.profile, functions } });
}

function setStyle(plan: Plan, { style, category }: ChangeOf<"set_style">): Outcome {
  const profile = category
    ? { ...plan.profile, categoryStyles: { ...plan.profile.categoryStyles, [category]: style } }
    : { ...plan.profile, style };
  return ok({ ...plan, profile });
}

function setTaskStatus(
  plan: Plan,
  { taskId, status, delayedTo }: ChangeOf<"set_task_status">,
): Outcome {
  if (!TASK_TEMPLATES.some((t) => t.id === taskId)) {
    return ignore(`Unknown task "${taskId}"`);
  }
  if (status === "delayed" && !delayedTo) {
    return ignore("A delayed task needs a new date");
  }
  return ok(setTask(plan, taskId, status, delayedTo));
}

function addNote(plan: Plan, { note }: ChangeOf<"add_note">): Outcome {
  const { notes } = plan.profile;
  const isDuplicate = notes.some((n) => n.toLowerCase() === note.toLowerCase());
  if (isDuplicate) {
    return ok(plan);
  }
  if (notes.length >= LIMITS.notes) {
    return ignore("Too many notes already, so the new note was not added");
  }
  return ok({ ...plan, profile: { ...plan.profile, notes: [...notes, note] } });
}

/** Applies one change, or says why it does not fit. Schema validation happens in `applyChanges`. */
function applyOne(plan: Plan, change: PlanChange): Outcome {
  switch (change.type) {
    case "set_guests":
      return setGuests(plan, change);
    case "set_budget":
      return ok({ ...plan, profile: { ...plan.profile, budget: change.amount } });
    case "shift_dates":
      return ok(withFunctions(plan, (f) => ({ ...f, date: addDays(f.date, change.days) })));
    case "set_function_date":
      return setFunctionDate(plan, change);
    case "add_function":
      return addFunction(plan, change);
    case "remove_function":
      return removeFunction(plan, change);
    case "set_style":
      return setStyle(plan, change);
    case "set_priorities":
      return ok({ ...plan, profile: { ...plan.profile, priorities: change.priorities } });
    case "set_task_status":
      return setTaskStatus(plan, change);
    case "add_note":
      return addNote(plan, change);
  }
}

/**
 * Applies changes in order to a copy of the plan; the input is never mutated. A change that does
 * not fit, or would leave the plan failing its schema, is skipped and reported in `ignored`. Never
 * throws.
 *
 * @example
 * // The README example: 50 more guests, budget down to Rs 7,00,000, wedding two weeks earlier.
 * const { plan: after, ignored } = applyChanges(plan, [
 *   { type: "set_guests", function: "all", count: 250 },
 *   { type: "set_budget", amount: 700_000 },
 *   { type: "shift_dates", days: -14 },
 * ]);
 * // ignored is [], after.profile.guests is 250 and after.profile.budget is 700_000
 */
export function applyChanges(plan: Plan, changes: PlanChange[]): { plan: Plan; ignored: string[] } {
  let current = plan;
  const ignored: string[] = [];
  for (const change of changes) {
    const outcome = applyOne(current, change);
    if ("ignored" in outcome) {
      ignored.push(outcome.ignored);
      continue;
    }
    const checked = Plan.safeParse(outcome.plan);
    if (checked.success) {
      current = checked.data;
    } else {
      ignored.push(`A "${change.type}" change would make the plan invalid, so it was skipped`);
    }
  }
  return { plan: current, ignored };
}
