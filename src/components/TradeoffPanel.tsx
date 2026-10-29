"use client";

import { useMemo, useState } from "react";
import { api, failureMessage } from "@/lib/api";
import { formatINR, pct } from "@/lib/format";
import { applyLevers, listLevers } from "@/lib/plan/levers";
import { previewOption, usableOptions, type TradeoffOption } from "@/lib/plan/options";
import type { Proposal } from "@/lib/store";
import type { Plan } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type State = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done"; options: TradeoffOption[] };

interface Props {
  plan: Plan;
  total: number;
  budget: number;
  onChoose: (build: Proposal) => void;
}

/** The AI picks and explains option bundles; every figure shown here comes from the engine, against the plan as it is now. */
export function TradeoffPanel({ plan, total, budget, onChoose }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const options = state.kind === "done" ? state.options : null;
  const previews = useMemo(() => options?.map((o) => previewOption(plan, o.ids)), [plan, options]);

  async function ask() {
    const levers = listLevers(plan);
    if (levers.length === 0) return setState({ kind: "error", message: "There is nothing left to trim automatically. Try editing lines yourself." });
    setState({ kind: "loading" });
    const res = await api.tradeoffs({
      profile: plan.profile,
      total,
      levers: levers.map(({ id, label, saving, touchesPriority }) => ({ id, label, saving, touchesPriority })),
    });
    if (!res.ok) return setState({ kind: "error", message: failureMessage(res.error) });
    const usable = usableOptions(res.data.options, levers);
    setState(usable.length ? { kind: "done", options: usable } : { kind: "error", message: "No usable options came back. Try again." });
  }

  return (
    <section aria-labelledby="tradeoff-title" className="card border-tint-red-ink/20 bg-tint-red/40 p-6 sm:p-8">
      <h2 id="tradeoff-title" className="font-serif text-xl tracking-tight">
        {pct(total, budget) - 100}% over budget
      </h2>
      <p className="mt-1 text-sm text-muted">Pick one of a few concrete ways to trim. Nothing changes until you review and accept it.</p>
      {!options && (
        <Button variant="primary" className="mt-4" disabled={state.kind === "loading"} onClick={() => void ask()}>
          {state.kind === "loading" ? "Finding options" : "Help me get back under budget"}
        </Button>
      )}
      <div aria-live="polite">{state.kind === "error" && <p className="mt-3 text-sm text-tint-red-ink">{state.message}</p>}</div>
      {options && previews && (
        <ul className="mt-5 grid gap-4 md:grid-cols-3">
          {options.map((o, i) => (
            <li key={o.title} className="card flex flex-col p-5">
              <h3 className="font-medium leading-snug wrap-anywhere">{o.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted wrap-anywhere">{o.why}</p>
              <p className="mt-4 text-sm tabular-nums">
                Saves <strong>{formatINR(previews[i].saving)}</strong>
              </p>
              <p className="mt-1">
                <Badge tone={previews[i].within ? "green" : "yellow"}>
                  {previews[i].within ? "Within budget" : "Still over"} · {previews[i].percent}%
                </Badge>
              </p>
              <Button className="mt-4" onClick={() => onChoose((p) => ({ plan: applyLevers(p, o.ids), ignored: [] }))}>
                Choose this
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
