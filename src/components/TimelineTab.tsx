"use client";

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
  new Date(`${iso.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

function Task({ task, onSet }: { task: ScheduledTask; onSet: Props["onSet"] }) {
  const done = task.status === "done";
  return (
    <li className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <p className={`font-medium leading-snug wrap-anywhere ${done ? "text-muted line-through" : ""}`}>{task.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
          <span>{done ? "Done" : `Due ${formatDate(task.due)}`}</span>
          {task.category && <span>{CATEGORY_LABELS[task.category]}</span>}
          <Flags flags={task.flags} />
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {task.status === "delayed" && (
          <label className="text-sm text-muted">
            <span className="sr-only">New date for {task.title}</span>
            <input type="date" defaultValue={task.due} onChange={(e) => e.target.value && onSet(task.id, "delayed", e.target.value)}
              className="min-h-9 rounded-md border border-line bg-surface px-2 text-sm" />
          </label>
        )}
        <div role="group" aria-label={`Status of ${task.title}`} className="inline-flex rounded-md border border-line bg-surface p-0.5">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={task.status === s.value}
              onClick={() => task.status !== s.value && onSet(task.id, s.value, addDays(task.due, 14))}
              className={`min-h-8 rounded px-3 text-sm transition-colors ${task.status === s.value ? s.selected : "text-muted hover:bg-sand hover:text-ink"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </li>
  );
}

interface Props {
  tasks: ScheduledTask[];
  onSet: (id: string, status: TaskStatus, delayedTo: string | null) => void;
}

export function TimelineTab({ tasks, onSet }: Props) {
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
