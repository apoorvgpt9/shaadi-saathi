"use client";

import { useState, type FormEvent } from "react";
import { api, describeFailure } from "@/lib/api";
import { FUNCTION_LABELS } from "@/lib/plan/benchmarks";
import type { FunctionKind, Idea, Plan } from "@/lib/types";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const IMPACT: Record<Idea["costImpact"], { label: string; tone: Tone }> = {
  saves: { label: "Saves money", tone: "green" },
  within: { label: "Within budget", tone: "blue" },
  adds: { label: "Adds cost", tone: "yellow" },
};

interface Props {
  plan: Plan;
  onUpdate: (update: (plan: Plan) => Plan) => void;
}

function FunctionIdeasBlock({ kind, plan, onUpdate }: { kind: FunctionKind; plan: Plan; onUpdate: Props["onUpdate"] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ideas = plan.ideas.find((i) => i.kind === kind)?.ideas ?? [];

  async function refresh(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const feedback = String(new FormData(form).get("feedback") ?? "").trim();
    if (!feedback) return;
    setBusy(true);
    setError(null);
    const res = await api.ideas({ profile: plan.profile, function: kind, feedback, previous: plan.ideas });
    setBusy(false);
    if (!res.ok) return setError(`${describeFailure(res.error.code).title}. Your ideas are unchanged.`);
    const fresh = res.data.ideas.find((i) => i.kind === kind);
    if (!fresh) return setError("No new ideas came back. Try describing it differently.");
    onUpdate((p) => ({ ...p, ideas: [...p.ideas.filter((i) => i.kind !== kind), fresh] }));
    form.reset();
  }

  return (
    <section aria-labelledby={`i-${kind}`} className="card p-6 sm:p-8">
      <h2 id={`i-${kind}`} className="font-serif text-xl tracking-tight">
        {FUNCTION_LABELS[kind]}
      </h2>
      {ideas.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No ideas yet for this function. Tell me what you have in mind below.</p>
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {ideas.map((idea) => (
            <li key={idea.title} className="flex flex-col rounded-lg border border-line bg-canvas p-5">
              <span className="self-start"><Badge tone={IMPACT[idea.costImpact].tone}>{IMPACT[idea.costImpact].label}</Badge></span>
              <h3 className="mt-3 font-medium leading-snug">{idea.title}</h3>
              <p className="mt-2 text-sm">{idea.description}</p>
              <p className="mt-3 text-sm text-muted">
                <span className="font-medium text-ink">Fits because </span>
                {idea.fitsBecause}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => void refresh(e)} className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm text-muted">
          Feedback on the {FUNCTION_LABELS[kind].toLowerCase()} ideas
          <input name="feedback" maxLength={500} placeholder="Too expensive, or suitable for kids and elders"
            className="mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink" />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Thinking" : "Refresh ideas"}
        </Button>
      </form>
      <p aria-live="polite" className="mt-2 text-sm text-tint-red-ink">
        {error}
      </p>
    </section>
  );
}

export function IdeasTab({ plan, onUpdate }: Props) {
  return (
    <div className="space-y-6">
      {plan.profile.functions.map((f) => (
        <FunctionIdeasBlock key={f.kind} kind={f.kind} plan={plan} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
