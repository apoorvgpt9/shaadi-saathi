"use client";

import { useState } from "react";
import { api, describeFailure } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { computeBudget } from "@/lib/plan/budget";
import { applyLevers, listLevers } from "@/lib/plan/levers";
import type { Plan } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface Option {
  title: string;
  why: string;
  after: Plan;
  saving: number;
  percent: number;
}

type State = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done"; options: Option[] };

interface Props {
  plan: Plan;
  total: number;
  budget: number;
  onChoose: (after: Plan) => void;
}

/** The AI picks and explains option bundles; every figure shown here comes from the engine. */
export function TradeoffPanel({ plan, total, budget, onChoose }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function ask() {
    setState({ kind: "loading" });
    const levers = listLevers(plan);
    if (levers.length === 0) return setState({ kind: "error", message: "There is nothing left to trim automatically. Try editing lines yourself." });
    const res = await api.tradeoffs({
      profile: plan.profile,
      total,
      levers: levers.map(({ id, label, saving, touchesPriority }) => ({ id, label, saving, touchesPriority })),
    });
    if (!res.ok) {
      const { title, hint } = describeFailure(res.error.code);
      return setState({ kind: "error", message: `${title}. ${hint}` });
    }
    const known = new Set(levers.map((l) => l.id));
    const options = res.data.options.flatMap((o) => {
      const ids = o.leverIds.filter((id) => known.has(id));
      if (ids.length === 0) return [];
      const after = applyLevers(plan, ids);
      const next = computeBudget(after);
      return [{ title: o.title, why: o.why, after, saving: total - next.total, percent: Math.round(next.ratio * 100) }];
    });
    setState(options.length ? { kind: "done", options } : { kind: "error", message: "No usable options came back. Try again." });
  }

  return (
    <section aria-labelledby="tradeoff-title" className="card border-tint-red-ink/20 bg-tint-red/40 p-6 sm:p-8">
      <h2 id="tradeoff-title" className="font-serif text-xl tracking-tight">
        {Math.round((total / budget - 1) * 100)}% over budget
      </h2>
      <p className="mt-1 text-sm text-muted">Pick one of a few concrete ways to trim. Nothing changes until you review and accept it.</p>
      {state.kind !== "done" && (
        <Button variant="primary" className="mt-4" disabled={state.kind === "loading"} onClick={() => void ask()}>
          {state.kind === "loading" ? "Finding options" : "Help me get back under budget"}
        </Button>
      )}
      <div aria-live="polite">
        {state.kind === "error" && <p className="mt-3 text-sm text-tint-red-ink">{state.message}</p>}
      </div>
      {state.kind === "done" && (
        <ul className="mt-5 grid gap-4 md:grid-cols-3">
          {state.options.map((o) => (
            <li key={o.title} className="card flex flex-col p-5">
              <h3 className="font-medium leading-snug">{o.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted">{o.why}</p>
              <p className="mt-4 text-sm tabular-nums">
                Saves <strong>{formatINR(o.saving)}</strong>
              </p>
              <p className="mt-1">
                <Badge tone={o.percent <= 100 ? "green" : "yellow"}>
                  {o.percent <= 100 ? "Within budget" : "Still over"} · {o.percent}%
                </Badge>
              </p>
              <Button className="mt-4" onClick={() => onChoose(o.after)}>Choose this</Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
