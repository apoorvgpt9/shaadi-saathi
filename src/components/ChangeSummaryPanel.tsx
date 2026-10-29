"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { formatINR } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/plan/benchmarks";
import type { Pending } from "@/lib/store";
import { Button } from "@/components/ui/Button";

const pct = (total: number, budget: number) => `${Math.round((total / budget) * 100)}%`;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${formatINR(Math.abs(n))}`;

function Group({ title, items }: { title: string; items: string[] }): ReactNode {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="eyebrow">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm marker:text-muted">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/** Slide-in review of a proposed change. Nothing is saved until Accept. */
export function ChangeSummaryPanel({ pending, onAccept, onUndo }: { pending: Pending; onAccept: () => void; onUndo: () => void }) {
  const { summary: s, ignored } = pending;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <aside
      role="dialog"
      aria-labelledby="summary-title"
      onKeyDown={(e) => e.key === "Escape" && onUndo()}
      className="card fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col rounded-none border-y-0 border-r-0 reveal [--from:translateX(24px)]"
    >
      <div className="flex-1 space-y-6 overflow-y-auto p-6 sm:p-8" aria-live="polite">
        <div>
          <p className="eyebrow">Review before saving</p>
          <h2 id="summary-title" ref={heading} tabIndex={-1} className="mt-1 font-serif text-2xl tracking-tight outline-none">
            What changed
          </h2>
        </div>
        <dl className="space-y-2 text-sm tabular-nums">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Estimated total</dt>
            <dd className="text-right font-medium">
              {formatINR(s.totalBefore)} to {formatINR(s.totalAfter)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Of budget</dt>
            <dd className="text-right font-medium">
              {pct(s.totalBefore, s.budgetBefore)} to {pct(s.totalAfter, s.budgetAfter)}
              {s.budgetBefore !== s.budgetAfter && <span className="block font-normal text-muted">Budget now {formatINR(s.budgetAfter)}</span>}
            </dd>
          </div>
        </dl>
        {s.lines.length > 0 && (
          <div>
            <h3 className="eyebrow">Budget lines</h3>
            <ul className="mt-2 divide-y divide-line text-sm tabular-nums">
              {s.lines.map((l) => (
                <li key={l.category} className="flex flex-wrap justify-between gap-x-4 py-2">
                  <span>{CATEGORY_LABELS[l.category]}</span>
                  <span className="text-right">
                    {formatINR(l.before)} to {formatINR(l.after)} <strong className="ml-1">({signed(l.after - l.before)})</strong>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Group title="Newly urgent" items={s.newlyUrgent} />
        <Group title="Newly at risk" items={s.newlyAtRisk} />
        <Group title="Now clashing with the wedding" items={s.newlyClashing} />
        <Group title="Worth checking" items={s.notes} />
        <Group title="Not applied" items={ignored} />
      </div>
      <div className="flex gap-3 border-t border-line p-4 sm:px-8">
        <Button variant="primary" className="flex-1" onClick={onAccept}>Accept</Button>
        <Button className="flex-1" onClick={onUndo}>Undo</Button>
      </div>
    </aside>
  );
}
