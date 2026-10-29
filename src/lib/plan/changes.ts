import { addDays, formatDate } from "../format";
import { Plan } from "../types";
import type {
  BudgetSummary,
  CategoryId,
  ChangeSummary,
  FunctionKind,
  PlanChange,
  ScheduledTask,
  TaskFlag,
  WeddingFunction,
} from "../types";
import { FUNCTION_LABELS } from "./benchmarks";
import { computeBudget } from "./budget";
import { scheduleTasks, TASK_TEMPLATES } from "./timeline";

const MIN_GUESTS = 1;
const MAX_GUESTS = 5000;
const MAX_NOTES = 20;

type Outcome = { plan: Plan } | { ignored: string };
type ChangeOf<T extends PlanChange["type"]> = Extract<PlanChange, { type: T }>;

const ok = (plan: Plan): Outcome => ({ plan });
const ignore = (reason: string): Outcome => ({ ignored: reason });
const clampGuests = (n: number) => Math.min(MAX_GUESTS, Math.max(MIN_GUESTS, Math.round(n)));
const hasFunction = (plan: Plan, kind: FunctionKind) => plan.profile.functions.some((f) => f.kind === kind);

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
    return ok(setWeddingGuests(withFunctions(plan, (f) => ({ ...f, guests: clampGuests(f.guests * scale) })), count));
  }
  if (target === "wedding") return ok(setWeddingGuests(plan, count));
  if (!hasFunction(plan, target)) return ignore(`${FUNCTION_LABELS[target]} is not in the plan, so its guest count was not changed`);
  return ok(withFunctions(plan, (f) => (f.kind === target ? { ...f, guests: count } : f)));
}

function setFunctionDate(plan: Plan, { function: kind, date }: ChangeOf<"set_function_date">): Outcome {
  if (!hasFunction(plan, kind)) return ignore(`${FUNCTION_LABELS[kind]} is not in the plan, so its date was not changed`);
  return ok(withFunctions(plan, (f) => (f.kind === kind ? { ...f, date } : f)));
}

function addFunction(plan: Plan, { function: kind, date, guests }: ChangeOf<"add_function">): Outcome {
  if (hasFunction(plan, kind)) return ignore(`${FUNCTION_LABELS[kind]} is already in the plan`);
  return ok({ ...plan, profile: { ...plan.profile, functions: [...plan.profile.functions, { kind, date, guests }] } });
}

function removeFunction(plan: Plan, { function: kind }: ChangeOf<"remove_function">): Outcome {
  if (kind === "wedding") return ignore("The wedding function cannot be removed");
  if (!hasFunction(plan, kind)) return ignore(`${FUNCTION_LABELS[kind]} is not in the plan, so nothing was removed`);
  return ok({ ...plan, profile: { ...plan.profile, functions: plan.profile.functions.filter((f) => f.kind !== kind) } });
}

function setStyle(plan: Plan, { style, category }: ChangeOf<"set_style">): Outcome {
  const profile = category
    ? { ...plan.profile, categoryStyles: { ...plan.profile.categoryStyles, [category]: style } }
    : { ...plan.profile, style };
  return ok({ ...plan, profile });
}

function setTaskStatus(plan: Plan, { taskId, status, delayedTo }: ChangeOf<"set_task_status">): Outcome {
  if (!TASK_TEMPLATES.some((t) => t.id === taskId)) return ignore(`Unknown task "${taskId}"`);
  if (status === "delayed" && !delayedTo) return ignore("A delayed task needs a new date");
  const state = { status, delayedTo: status === "delayed" ? delayedTo : null };
  return ok({ ...plan, tasks: { ...plan.tasks, [taskId]: state } });
}

function addNote(plan: Plan, { note }: ChangeOf<"add_note">): Outcome {
  const { notes } = plan.profile;
  if (notes.some((n) => n.toLowerCase() === note.toLowerCase())) return ok(plan);
  if (notes.length >= MAX_NOTES) return ignore("Too many notes already, so the new note was not added");
  return ok({ ...plan, profile: { ...plan.profile, notes: [...notes, note] } });
}

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

/** Applies changes in order to a copy of the plan. Changes that do not fit are reported, never thrown. */
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
    if (checked.success) current = checked.data;
    else ignored.push(`A "${change.type}" change would make the plan invalid, so it was skipped`);
  }
  return { plan: current, ignored };
}

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

/** What a change did: changed budget lines, totals, newly flagged tasks and follow-up notes. */
export function summarizeChange(before: Plan, after: Plan, today: string): ChangeSummary {
  const budgetBefore = computeBudget(before);
  const budgetAfter = computeBudget(after);
  const tasksBefore = scheduleTasks(before, today);
  const tasksAfter = scheduleTasks(after, today);
  const lines = budgetAfter.lines
    .map((line, i) => ({ category: line.category, before: budgetBefore.lines[i].amount, after: line.amount }))
    .filter((line) => line.before !== line.after);
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
