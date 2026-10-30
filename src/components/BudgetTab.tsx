// The Budget tab: one editable line per category, plus the trade-off helper when over budget.
import { useState, type ReactElement, type SubmitEvent } from "react";
import {
  LIMITS,
  type BudgetLine,
  type BudgetSummary,
  type CategoryId,
  type Plan,
  type PriceStatus,
} from "@/lib/types";
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
  /**
   * Starts a reviewable change; used by the trade-off panel, which only appears when over budget.
   */
  onPropose: (build: Proposal) => void;
}

interface LineEditorProps {
  category: CategoryId;
  label: string;
  /** The amount the user typed earlier, if any; the field starts with it. */
  startingAmount: number | null | undefined;
  onUpdate: Props["onUpdate"];
  onDone: () => void;
}

/**
 * The inline amount form for one budget line. An empty or invalid amount returns the line to its
 * estimate.
 */
function LineEditor({
  category,
  label,
  startingAmount,
  onUpdate,
  onDone,
}: LineEditorProps): ReactElement {
  function save(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const n = Number(new FormData(e.currentTarget).get("amount"));
    const override =
      Number.isFinite(n) && n > 0 ? Math.min(LIMITS.budget.max, Math.trunc(n)) : null;
    onUpdate((p) => patchEntry(p, category, { override }));
    onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-2">
      <Field
        label={`${label} amount in rupees`}
        name="amount"
        type="number"
        min={0}
        max={LIMITS.budget.max}
        step={1000}
        defaultValue={startingAmount ?? ""}
        placeholder="Blank to use the estimate"
        className="w-56"
      />
      <Button type="submit" variant="primary">
        Save
      </Button>
      <Button onClick={onDone}>Cancel</Button>
    </form>
  );
}

interface LineActionsProps {
  category: CategoryId;
  label: string;
  confirmed: boolean;
  onEdit: () => void;
  onUpdate: Props["onUpdate"];
}

/** The two quiet actions under a budget line: edit its amount, or toggle it confirmed. */
function LineActions({
  category,
  label,
  confirmed,
  onEdit,
  onUpdate,
}: LineActionsProps): ReactElement {
  return (
    <div className="-ml-3 flex gap-1 text-sm">
      <Button
        variant="ghost"
        className="min-h-9 px-3"
        onClick={onEdit}
        aria-label={`Edit amount for ${label}`}
      >
        Edit amount
      </Button>
      <Button
        variant="ghost"
        className="min-h-9 px-3"
        aria-pressed={confirmed}
        onClick={() => onUpdate((p) => patchEntry(p, category, { confirmed: !confirmed }))}
      >
        {confirmed ? "Confirmed. Undo" : "Mark confirmed"}
      </Button>
    </div>
  );
}

/** One budget category: its label, status and amount, then either the edit form or the actions. */
function Line({
  line,
  plan,
  onUpdate,
}: {
  line: BudgetLine;
  plan: Plan;
  onUpdate: Props["onUpdate"];
}): ReactElement {
  const [editing, setEditing] = useState(false);
  const { category } = line;
  const entry = plan.budget[category];
  const label = CATEGORY_LABELS[category];

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
        {line.amount !== line.estimate && (
          <p className="text-xs text-muted tabular-nums">Benchmark {formatINR(line.estimate)}</p>
        )}
      </div>
      <div className="sm:col-span-2">
        {editing ? (
          <LineEditor
            category={category}
            label={label}
            startingAmount={entry?.override}
            onUpdate={onUpdate}
            onDone={() => setEditing(false)}
          />
        ) : (
          <LineActions
            category={category}
            label={label}
            confirmed={!!entry?.confirmed}
            onEdit={() => setEditing(true)}
            onUpdate={onUpdate}
          />
        )}
      </div>
    </li>
  );
}

/**
 * The budget breakdown, one editable line per category, with the trade-off helper above it when
 * over budget.
 */
export function BudgetTab({ plan, summary, onUpdate, onPropose }: Props): ReactElement {
  return (
    <div className="space-y-6">
      {summary.ratio > 1 && (
        <TradeoffPanel
          plan={plan}
          total={summary.total}
          budget={summary.budget}
          onChoose={onPropose}
        />
      )}
      {/* Keeps the outline h1 > h2 > h3 when no trade-off panel (h2) sits above the lines. */}
      <h2 className="sr-only">Budget by category</h2>
      <ul className="card divide-y divide-line px-6 sm:px-8">
        {summary.lines.map((line) => (
          <Line key={line.category} line={line} plan={plan} onUpdate={onUpdate} />
        ))}
      </ul>
    </div>
  );
}
