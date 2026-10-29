import { addDays } from "@/lib/format";
import type { CategoryId, FunctionKind, Plan, ScheduledTask, TaskFlag, TaskState } from "@/lib/types";

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

const task = (
  id: string,
  title: string,
  category: CategoryId | null,
  leadDays: number,
  dependsOn: string[],
  anchor: FunctionKind = "wedding",
): TaskTemplate => ({ id, title, category, leadDays, dependsOn, anchor });

/** Listed in dependency order: every task appears after the tasks it depends on. */
export const TASK_TEMPLATES: TaskTemplate[] = [
  task("finalise-dates", "Fix dates and muhurat with family", null, 180, []),
  task("agree-budget", "Agree total budget and top priorities", null, 175, []),
  task("guest-estimate", "Draft guest estimate per function", null, 170, ["agree-budget"]),
  task("book-venue", "Shortlist and book venue(s)", "venue", 150, ["finalise-dates", "guest-estimate"]),
  task("book-caterer", "Book caterer", "catering", 120, ["book-venue"]),
  task("book-photographer", "Book photographer and videographer", "photography", 120, ["finalise-dates"]),
  task("book-decorator", "Book decorator", "decor", 100, ["book-venue"]),
  task("book-pandit", "Book pandit for the ceremonies", "rituals", 90, ["finalise-dates"]),
  task("book-makeup", "Book bridal makeup artist", "makeup", 90, ["finalise-dates"]),
  task("order-outfits", "Order bridal and groom outfits", "attire", 90, ["agree-budget"]),
  task("book-mehendi-artist", "Book mehendi artist", "makeup", 60, ["finalise-dates"], "mehendi"),
  task("book-entertainment", "Book DJ, band or dhol", "entertainment", 75, ["book-venue"]),
  task("finalise-guest-list", "Finalise the guest list", null, 75, ["guest-estimate"]),
  task("order-invitations", "Design and print invitations", "invitations", 60, ["finalise-guest-list", "book-venue"]),
  task("guest-stay", "Block rooms for outstation guests", null, 60, ["finalise-guest-list", "book-venue"]),
  task("book-transport", "Arrange transport for baraat and guests", "transport", 45, ["book-venue"]),
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
  task("day-of-plan", "Prepare day-of schedule and assign family coordinators", null, 7, ["vendor-contracts"]),
  task("vendor-final-calls", "Final confirmation call with every vendor", null, 3, ["day-of-plan"]),
  task("emergency-kit", "Pack emergency kit, cash envelopes and shagun", null, 2, []),
];

/** Dated, flagged tasks for the plan's functions, soonest first. */
export function scheduleTasks(plan: Plan, today: string): ScheduledTask[] {
  const functionDates = new Map(plan.profile.functions.map((f) => [f.kind, f.date]));
  const entries = TASK_TEMPLATES.flatMap((template) => {
    const anchorDate = functionDates.get(template.anchor);
    if (anchorDate === undefined) return [];
    const { status, delayedTo } = plan.tasks[template.id] ?? OPEN_TASK;
    return [{ template, anchorDate, ideal: addDays(anchorDate, -template.leadDays), status, delayedTo }];
  });

  // Overdue open tasks are spread over the coming days, earliest-ideal first, so "this week" stays doable.
  const urgentRank = new Map(
    entries
      .filter((e) => e.status === "todo" && e.ideal < today)
      .sort((a, b) => a.ideal.localeCompare(b.ideal))
      .map((e, rank) => [e.template.id, rank]),
  );

  const scheduled = new Map<string, ScheduledTask>();
  for (const { template, anchorDate, ideal, status, delayedTo } of entries) {
    let due = ideal;
    const flags: TaskFlag[] = [];

    if (status !== "done") {
      if (status === "delayed" && delayedTo) {
        due = delayedTo;
        // A postponed task whose new date has also passed is overdue.
        if (delayedTo < today) flags.push("urgent");
      }
      const rank = urgentRank.get(template.id);
      if (rank !== undefined) {
        due = addDays(today, Math.min(MAX_URGENT_STAGGER_DAYS, Math.floor(rank / URGENT_TASKS_PER_DAY)));
        flags.push("urgent");
      }
      const blockers = template.dependsOn.flatMap((id) => {
        const dep = scheduled.get(id);
        return dep && dep.status !== "done" && dep.due >= due ? [dep] : [];
      });
      const latestBlocker = blockers
        .map((dep) => dep.due)
        .sort()
        .at(-1);
      if (latestBlocker !== undefined) {
        due = addDays(latestBlocker, 1);
        // Only a reported delay upstream is a risk; ties from spreading urgent tasks are just sequencing.
        if (blockers.some((dep) => dep.status === "delayed" || dep.flags.includes("at_risk"))) flags.push("at_risk");
      }
      if (due >= anchorDate) flags.push("clash");
    }

    const { id, title, category, anchor, dependsOn } = template;
    scheduled.set(id, { id, title, category, anchor, dependsOn, due, status, flags });
  }
  return [...scheduled.values()].sort((a, b) => a.due.localeCompare(b.due));
}

/** The next few open tasks: ready ones (all prerequisites done) first, topped up with blocked ones. */
export function nextTasks(tasks: ScheduledTask[], count = 3): ScheduledTask[] {
  const open = tasks.filter((t) => t.status !== "done");
  const openIds = new Set(open.map((t) => t.id));
  const isReady = (t: ScheduledTask) => t.dependsOn.every((id) => !openIds.has(id));
  return [...open.filter(isReady), ...open.filter((t) => !isReady(t))].slice(0, count);
}
