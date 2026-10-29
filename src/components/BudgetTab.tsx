"use client";

import { useState, type FormEvent } from "react";
import { LIMITS, type BudgetLine, type BudgetSummary, type Plan, type PriceStatus } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/plan/benchmarks";
import { patchEntry } from "@/lib/plan/edits";
import type { Proposal } from "@/lib/store";
import { TradeoffPanel } from "@/components/TradeoffPanel";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

const STATUS: Record<PriceStatus, { label: string; tone: Tone }> = {
  estimate: { label: "Estimate", tone: "yellow" },
  quoted: { label: "Quoted", tone: "blue" },
  confirmed: { label: "Confirmed", tone: "green" },
};

interface Props {
  plan: Plan;
  summary: BudgetSummary;
  onUpdate: (update: (plan: Plan) => Plan) => void;
  onPropose: (build: Proposal) => void;
}

function Line({ line, plan, onUpdate }: { line: BudgetLine; plan: Plan; onUpdate: Props["onUpdate"] }) {
  const [editing, setEditing] = useState(false);
  const { category } = line;
  const entry = plan.budget[category];
  const label = CATEGORY_LABELS[category];

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const n = Number(new FormData(e.currentTarget).get("amount"));
    // An empty or invalid field returns the line to its benchmark estimate.
    const override = Number.isFinite(n) && n > 0 ? Math.min(LIMITS.budget.max, Math.trunc(n)) : null;
    onUpdate((p) => patchEntry(p, category, { override }));
    setEditing(false);
  }

  return (
    <li className="grid gap-x-6 gap-y-3 py-5 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{label}</h3>
          <Badge tone={STATUS[line.status].tone}>{STATUS[line.status].label}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted wrap-anywhere">{line.source}</p>
      </div>
      <div className="sm:text-right">
        <p className="text-lg font-semibold tabular-nums">{formatINR(line.amount)}</p>
        {line.amount !== line.estimate && <p className="text-xs text-muted tabular-nums">Benchmark {formatINR(line.estimate)}</p>}
      </div>
      <div className="sm:col-span-2">
        {editing ? (
          <form onSubmit={save} className="flex flex-wrap items-end gap-2">
            <Field label={`${label} amount in rupees`} name="amount" type="number" min={0} max={LIMITS.budget.max} step={1000}
              defaultValue={entry?.override ?? ""} placeholder="Blank to use the estimate" className="w-56" />
            <Button type="submit" variant="primary">Save</Button>
            <Button onClick={() => setEditing(false)}>Cancel</Button>
          </form>
        ) : (
          <div className="-ml-3 flex gap-1 text-sm">
            <Button variant="ghost" className="min-h-9 px-3" onClick={() => setEditing(true)} aria-label={`Edit amount for ${label}`}>
              Edit amount
            </Button>
            <Button
              variant="ghost"
              className="min-h-9 px-3"
              aria-pressed={!!entry?.confirmed}
              onClick={() => onUpdate((p) => patchEntry(p, category, { confirmed: !entry?.confirmed }))}
            >
              {entry?.confirmed ? "Confirmed. Undo" : "Mark confirmed"}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

export function BudgetTab({ plan, summary, onUpdate, onPropose }: Props) {
  return (
    <div className="space-y-6">
      {summary.ratio > 1 && <TradeoffPanel plan={plan} total={summary.total} budget={summary.budget} onChoose={onPropose} />}
      <ul className="card divide-y divide-line px-6 sm:px-8">
        {summary.lines.map((line) => (
          <Line key={line.category} line={line} plan={plan} onUpdate={onUpdate} />
        ))}
      </ul>
    </div>
  );
}
