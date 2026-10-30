// The Timeline tab: tasks grouped by month, each with a To do / Done / Delayed control.
import type { ReactElement } from "react";
import type { ScheduledTask, TaskStatus } from "@/lib/types";
import { addDays, formatDate, groupByMonth } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/plan/benchmarks";
import { Flags } from "@/components/NextTasks";

// Selected "To do" is quiet, since most tasks are; Done is the emphasised state and Delayed asks for a look.
const STATUSES: { value: TaskStatus; label: string; selected: string }[] = [
  { value: "todo", label: "To do", selected: "bg-sand text-ink ring-1 ring-inset ring-line" },
  { value: "done", label: "Done", selected: "bg-maroon text-white" },
  { value: "delayed", label: "Delayed", selected: "bg-tint-yellow text-tint-yellow-ink" },
];

const monthOf = (iso: string) =>
  new Date(`${iso.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

interface Props {
  tasks: ScheduledTask[];
  /** Sets a task's status; `delayedTo` is the new due date, or null to keep it. */
  onSet: (id: string, status: TaskStatus, delayedTo: string | null) => void;
}

/** The new-date picker that appears only for a delayed task. */
function DelayedDate({ task, onSet }: { task: ScheduledTask; onSet: Props["onSet"] }): ReactElement {
  function changeDate(date: string) {
    if (date) {
      onSet(task.id, "delayed", date);
    }
  }

  return (
    <label className="text-sm text-muted">
      <span className="sr-only">New date for {task.title}</span>
      <input
        type="date"
        name={`delay-${task.id}`}
        defaultValue={task.due}
        onChange={(e) => changeDate(e.target.value)}
        className="min-h-9 rounded-md border border-line bg-surface px-2 text-sm"
      />
    </label>
  );
}

/** The To do / Done / Delayed segmented control; choosing a different status moves the due date 14 days on. */
function StatusToggle({ task, onSet }: { task: ScheduledTask; onSet: Props["onSet"] }): ReactElement {
  function choose(status: TaskStatus) {
    if (task.status !== status) {
      onSet(task.id, status, addDays(task.due, 14));
    }
  }

  return (
    <div
      role="group"
      aria-label={`Status of ${task.title}`}
      className="inline-flex rounded-md border border-line bg-surface p-0.5"
    >
      {STATUSES.map((s) => (
        <button
          key={s.value}
          type="button"
          aria-pressed={task.status === s.value}
          onClick={() => choose(s.value)}
          className={`min-h-8 rounded px-3 text-sm transition-colors ${task.status === s.value ? s.selected : "text-muted hover:bg-sand hover:text-ink"}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

/** One task row: title, due date and flags on the left, its controls on the right. */
function Task({ task, onSet }: { task: ScheduledTask; onSet: Props["onSet"] }): ReactElement {
  const done = task.status === "done";
  return (
    <li className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <p className={`font-medium leading-snug wrap-anywhere ${done ? "text-muted line-through" : ""}`}>
          {task.title}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
          <span>{done ? "Done" : `Due ${formatDate(task.due)}`}</span>
          {task.category && <span>{CATEGORY_LABELS[task.category]}</span>}
          <Flags flags={task.flags} />
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {task.status === "delayed" && <DelayedDate task={task} onSet={onSet} />}
        <StatusToggle task={task} onSet={onSet} />
      </div>
    </li>
  );
}

/** Every task, grouped under its month, with controls to mark each done or delayed. */
export function TimelineTab({ tasks, onSet }: Props): ReactElement {
  return (
    <div className="space-y-8">
      {groupByMonth(tasks).map(([month, items]) => (
        <section key={month} aria-labelledby={`m-${month}`}>
          <h2 id={`m-${month}`} className="font-serif text-xl tracking-tight">
            {monthOf(month)}
          </h2>
          <ul className="card mt-3 divide-y divide-line px-5 sm:px-6">
            {items.map((t) => (
              <Task key={t.id} task={t} onSet={onSet} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
