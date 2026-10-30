// The Ideas tab: AI ideas per wedding function, with a feedback loop to refresh them.
import { useState, type ReactElement, type SubmitEvent } from "react";
import { api, failureMessage } from "@/lib/api";
import { FUNCTION_LABELS } from "@/lib/plan/benchmarks";
import { LIMITS, type FunctionKind, type Idea, type Plan } from "@/lib/types";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

const IMPACT: Record<Idea["costImpact"], { label: string; tone: Tone }> = {
  saves: { label: "Saves money", tone: "green" },
  within: { label: "Within budget", tone: "blue" },
  adds: { label: "Adds cost", tone: "yellow" },
};

interface Props {
  plan: Plan;
  onUpdate: (update: (plan: Plan) => Plan) => void;
}

/** The ideas for one wedding function, with a form to ask for different ones. */
function FunctionIdeasBlock({
  kind,
  plan,
  onUpdate,
}: {
  kind: FunctionKind;
  plan: Plan;
  onUpdate: Props["onUpdate"];
}): ReactElement {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ideas = plan.ideas.find((i) => i.kind === kind)?.ideas ?? [];
  const name = FUNCTION_LABELS[kind];

  /**
   * Asks for this function's ideas, with the user's feedback on the current ones when there is any.
   */
  async function request(feedback: string | null): Promise<boolean> {
    setBusy(true);
    setError(null);
    const res = await api.ideas({
      profile: plan.profile,
      function: kind,
      feedback,
      previous: plan.ideas,
    });
    setBusy(false);
    const fresh = res.ok ? res.data.ideas.find((i) => i.kind === kind) : undefined;
    if (!fresh) {
      setError(
        res.ok
          ? "No new ideas came back. Try describing it differently."
          : failureMessage(res.error, "Your ideas are unchanged."),
      );
      return false;
    }
    onUpdate((p) => ({ ...p, ideas: [...p.ideas.filter((i) => i.kind !== kind), fresh] }));
    return true;
  }

  async function refresh(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const entry = new FormData(form).get("feedback");
    const feedback = (typeof entry === "string" ? entry : "").trim();
    if (feedback && (await request(feedback))) {
      form.reset();
    }
  }

  return (
    <section aria-labelledby={`i-${kind}`} className="card p-6 sm:p-8">
      <h2 id={`i-${kind}`} className="font-serif text-xl tracking-tight">
        {name}
      </h2>
      {ideas.length === 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">No ideas yet for this function.</p>
          <Button disabled={busy} onClick={() => void request(null)}>
            {busy ? "Thinking" : `Get ideas for ${name}`}
          </Button>
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {ideas.map((idea) => (
            <li
              key={idea.title}
              className="flex flex-col rounded-lg border border-line bg-canvas p-5 wrap-anywhere"
            >
              <span className="self-start">
                <Badge tone={IMPACT[idea.costImpact].tone}>{IMPACT[idea.costImpact].label}</Badge>
              </span>
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
      <form
        onSubmit={(e) => void refresh(e)}
        className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <Field
          label={`Feedback on the ${name.toLowerCase()} ideas`}
          name="feedback"
          maxLength={LIMITS.messageChars}
          placeholder="Too expensive, or suitable for kids and elders"
          className="flex-1"
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Thinking" : "Refresh ideas"}
        </Button>
      </form>
      <p aria-live="polite" className="mt-2 text-sm text-tint-red-ink wrap-anywhere">
        {error}
      </p>
    </section>
  );
}

/** AI ideas for every function in the plan, one card group each. */
export function IdeasTab({ plan, onUpdate }: Props): ReactElement {
  return (
    <div className="space-y-6">
      {plan.profile.functions.map((f) => (
        <FunctionIdeasBlock key={f.kind} kind={f.kind} plan={plan} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
