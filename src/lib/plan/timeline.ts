// The task schedule: dated, dependency-ordered, flagged tasks derived from the plan's function dates.
import { addDays } from "@/lib/format";
import type {
  CategoryId,
  FunctionKind,
  Plan,
  ScheduledTask,
  TaskFlag,
  TaskState,
} from "@/lib/types";

interface TaskTemplate {
  id: string;
  title: string;
  category: CategoryId | null;
  /** Ideal days before the anchor function. */
  leadDays: number;
  dependsOn: string[];
  /** The task is omitted when the plan has no such function. */
  anchor: FunctionKind;
}

const MAX_URGENT_STAGGER_DAYS = 6;
const URGENT_TASKS_PER_DAY = 2;
const OPEN_TASK: TaskState = { status: "todo", delayedTo: null };

function task(
  id: string,
  title: string,
  category: CategoryId | null,
  leadDays: number,
  dependsOn: string[],
  anchor: FunctionKind = "wedding",
): TaskTemplate {
  return { id, title, category, leadDays, dependsOn, anchor };
}

/** Listed in dependency order: every task appears after the tasks it depends on. */
export const TASK_TEMPLATES: TaskTemplate[] = [
  task("finalise-dates", "Fix dates and muhurat with family", null, 180, []),
  task("agree-budget", "Agree total budget and top priorities", null, 175, []),
  task("guest-estimate", "Draft guest estimate per function", null, 170, ["agree-budget"]),
  task("book-venue", "Shortlist and book venue(s)", "venue", 150, [
    "finalise-dates",
    "guest-estimate",
  ]),
  task("book-caterer", "Book caterer", "catering", 120, ["book-venue"]),
  task("book-photographer", "Book photographer and videographer", "photography", 120, [
    "finalise-dates",
  ]),
  task("book-decorator", "Book decorator", "decor", 100, ["book-venue"]),
  task("book-pandit", "Book pandit for the ceremonies", "rituals", 90, ["finalise-dates"]),
  task("book-makeup", "Book bridal makeup artist", "makeup", 90, ["finalise-dates"]),
  task("order-outfits", "Order bridal and groom outfits", "attire", 90, ["agree-budget"]),
  task("book-mehendi-artist", "Book mehendi artist", "makeup", 60, ["finalise-dates"], "mehendi"),
  task("book-entertainment", "Book DJ, band or dhol", "entertainment", 75, ["book-venue"]),
  task("finalise-guest-list", "Finalise the guest list", null, 75, ["guest-estimate"]),
  task("order-invitations", "Design and print invitations", "invitations", 60, [
    "finalise-guest-list",
    "book-venue",
  ]),
  task("guest-stay", "Block rooms for outstation guests", null, 60, [
    "finalise-guest-list",
    "book-venue",
  ]),
  task("book-transport", "Arrange transport for baraat and guests", "transport", 45, [
    "book-venue",
  ]),
  task("menu-tasting", "Menu tasting and final menu", "catering", 45, ["book-caterer"]),
  task("finalise-decor", "Finalise decor theme and mock-up", "decor", 40, ["book-decorator"]),
  task("send-invitations", "Send invitations", "invitations", 40, ["order-invitations"]),
  task(
    "sangeet-rehearsals",
    "Start sangeet choreography and rehearsals",
    "entertainment",
    21,
    ["book-entertainment"],
    "sangeet",
  ),
  task("outfit-fittings", "Final outfit fittings", "attire", 20, ["order-outfits"]),
  task("final-headcount", "Chase RSVPs and send final headcount to caterer", "catering", 14, [
    "send-invitations",
    "menu-tasting",
  ]),
  task("vendor-contracts", "Confirm contracts and payment schedule with all vendors", null, 14, [
    "book-caterer",
    "book-decorator",
    "book-photographer",
  ]),
  task("haldi-prep", "Arrange haldi items and seating", "rituals", 7, [], "haldi"),
  task("day-of-plan", "Prepare day-of schedule and assign family coordinators", null, 7, [
    "vendor-contracts",
  ]),
  task("vendor-final-calls", "Final confirmation call with every vendor", null, 3, ["day-of-plan"]),
  task("emergency-kit", "Pack emergency kit, cash envelopes and shagun", null, 2, []),
];

/** A template placed on this plan's calendar, before dependencies and urgency are applied. */
interface Entry {
  template: TaskTemplate;
  anchorDate: string;
  /** The date the task would ideally be done: its lead time before the anchor function. */
  ideal: string;
  status: TaskState["status"];
  delayedTo: string | null;
}

/** One entry per template whose anchor function is in the plan, carrying the user's saved status. */
function entriesFor(plan: Plan): Entry[] {
  const functionDates = new Map(plan.profile.functions.map((f) => [f.kind, f.date]));
  return TASK_TEMPLATES.flatMap((template) => {
    const anchorDate = functionDates.get(template.anchor);
    if (anchorDate === undefined) {
      return [];
    }
    const { status, delayedTo } = plan.tasks[template.id] ?? OPEN_TASK;
    return [
      { template, anchorDate, ideal: addDays(anchorDate, -template.leadDays), status, delayedTo },
    ];
  });
}

/** Overdue open tasks are ranked earliest-ideal first, so they can be spread over the coming days. */
function urgentRanks(entries: Entry[], today: string): Map<string, number> {
  const overdue = entries
    .filter((e) => e.status === "todo" && e.ideal < today)
    .sort((a, b) => a.ideal.localeCompare(b.ideal));
  return new Map(overdue.map((e, rank) => [e.template.id, rank]));
}

/** Where the overdue task of a given rank lands: two per day, none later than MAX_URGENT_STAGGER_DAYS out. */
function staggeredDue(today: string, rank: number): string {
  const daysOut = Math.min(MAX_URGENT_STAGGER_DAYS, Math.floor(rank / URGENT_TASKS_PER_DAY));
  return addDays(today, daysOut);
}

/** Prerequisites that are still open and due on or after `due`, so they push this task back. */
function blockingDependencies(
  template: TaskTemplate,
  due: string,
  scheduled: Map<string, ScheduledTask>,
): ScheduledTask[] {
  return template.dependsOn.flatMap((id) => {
    const dependency = scheduled.get(id);
    if (dependency === undefined) {
      return [];
    }
    const blocks = dependency.status !== "done" && dependency.due >= due;
    return blocks ? [dependency] : [];
  });
}

/** Only a reported delay upstream is a risk; ties from spreading urgent tasks are just sequencing. */
function isRiskyBlocker(dependency: ScheduledTask): boolean {
  return dependency.status === "delayed" || dependency.flags.includes("at_risk");
}

/** The due date and flags of a task that is not done yet. */
function dueAndFlags(
  entry: Entry,
  today: string,
  urgentRank: Map<string, number>,
  scheduled: Map<string, ScheduledTask>,
): { due: string; flags: TaskFlag[] } {
  const { template, anchorDate, ideal, status, delayedTo } = entry;
  let due = ideal;
  const flags: TaskFlag[] = [];

  if (status === "delayed" && delayedTo) {
    due = delayedTo;
    // A postponed task whose new date has also passed is overdue.
    if (delayedTo < today) {
      flags.push("urgent");
    }
  }

  const rank = urgentRank.get(template.id);
  if (rank !== undefined) {
    due = staggeredDue(today, rank);
    flags.push("urgent");
  }

  const blockers = blockingDependencies(template, due, scheduled);
  const latestBlocker = blockers
    .map((dependency) => dependency.due)
    .sort()
    .at(-1);
  if (latestBlocker !== undefined) {
    due = addDays(latestBlocker, 1);
    if (blockers.some(isRiskyBlocker)) {
      flags.push("at_risk");
    }
  }

  if (due >= anchorDate) {
    flags.push("clash");
  }
  return { due, flags };
}

/**
 * Dated, flagged tasks for the plan's functions, soonest first.
 * Pure: "today" is injected, so the same plan and date always give the same schedule.
 * Flags: urgent (overdue, re-staggered over the coming days), at_risk (pushed back by a delayed or at-risk
 * prerequisite), clash (due on or after its function).
 *
 * @example
 * // Wedding on 2027-03-01, today 2026-10-29: "book-venue" (150 days before) is due 2026-10-02, already
 * // overdue, so it is flagged urgent and moved to today.
 * const tasks = scheduleTasks(plan, "2026-10-29");
 * tasks.find((t) => t.id === "book-venue"); // { due: "2026-10-29", flags: ["urgent"], ... }
 */
export function scheduleTasks(plan: Plan, today: string): ScheduledTask[] {
  const entries = entriesFor(plan);
  const urgentRank = urgentRanks(entries, today);
  const scheduled = new Map<string, ScheduledTask>();

  for (const entry of entries) {
    const { id, title, category, anchor, dependsOn } = entry.template;
    const { status } = entry;
    const isOpen = status !== "done";
    const { due, flags } = isOpen
      ? dueAndFlags(entry, today, urgentRank, scheduled)
      : { due: entry.ideal, flags: [] };
    scheduled.set(id, { id, title, category, anchor, dependsOn, due, status, flags });
  }
  return [...scheduled.values()].sort((a, b) => a.due.localeCompare(b.due));
}

/**
 * The next `count` open tasks: ready ones (all prerequisites done) first, topped up with blocked ones.
 * Keeps input order.
 *
 * @example
 * // The example plan on 2026-10-29, with the three intake tasks already done:
 * nextTasks(scheduleTasks(plan, "2026-10-29")).map((t) => t.id); // ["book-venue", "book-photographer", "book-pandit"]
 */
export function nextTasks(tasks: ScheduledTask[], count = 3): ScheduledTask[] {
  const open = tasks.filter((t) => t.status !== "done");
  const openIds = new Set(open.map((t) => t.id));
  const isReady = (t: ScheduledTask) => t.dependsOn.every((id) => !openIds.has(id));
  const ready = open.filter(isReady);
  const blocked = open.filter((t) => !isReady(t));
  return [...ready, ...blocked].slice(0, count);
}
