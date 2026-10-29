import type { ScheduledTask, TaskFlag } from "@/lib/types";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";

const FLAG: Record<TaskFlag, { label: string; tone: Tone }> = {
  urgent: { label: "Urgent, this week", tone: "red" },
  at_risk: { label: "At risk", tone: "yellow" },
  clash: { label: "Clash", tone: "red" },
};

export function Flags({ flags }: { flags: TaskFlag[] }) {
  return flags.map((f) => (
    <Badge key={f} tone={FLAG[f].tone}>
      {FLAG[f].label}
    </Badge>
  ));
}

export function NextTasks({ tasks }: { tasks: ScheduledTask[] }) {
  return (
    <aside aria-labelledby="next-title" className="card p-6">
      <p className="eyebrow">Ready to start</p>
      <h2 id="next-title" className="mt-1 font-serif text-2xl tracking-tight">Next 3 things to do</h2>
      {tasks.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nothing is waiting on you. Everything open depends on a task still in progress.</p>
      ) : (
        <ol className="mt-4 divide-y divide-line">
          {tasks.slice(0, 3).map((t, i) => (
            <li key={t.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
              <span className="mt-0.5 font-mono text-xs text-muted" aria-hidden="true">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-medium leading-snug">{t.title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <Icon name="clock" className="size-3.5" />
                  Due {formatDate(t.due)}
                </p>
                {t.flags.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    <Flags flags={t.flags} />
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
