"use client";

import { useMemo, useState } from "react";
import { api, describeFailure, todayIso } from "@/lib/api";
import { computeBudget } from "@/lib/plan/budget";
import { applyChanges, summarizeChange } from "@/lib/plan/changes";
import { nextTasks, scheduleTasks } from "@/lib/plan/timeline";
import type { PlanState, usePlan } from "@/lib/store";
import type { Plan } from "@/lib/types";
import { BudgetTab } from "@/components/BudgetTab";
import { ChangeSummaryPanel } from "@/components/ChangeSummaryPanel";
import type { ChangeOutcome } from "@/components/ChangeBox";
import { IdeasTab } from "@/components/IdeasTab";
import { TimelineTab } from "@/components/TimelineTab";
import { VendorsTab } from "@/components/VendorsTab";
import { Workspace } from "@/components/Workspace";
import { AiGate, type AiStatus } from "@/components/ui/AiGate";
import { setTask } from "@/components/edits";

interface Props {
  plan: Plan;
  pending: PlanState["pending"];
  actions: ReturnType<typeof usePlan>["actions"];
  extras: { status: AiStatus; reload: (plan: Plan) => void };
}

/** Connects the engine, the AI routes and the store to the workspace and its tabs. */
export function PlanScreen({ plan, pending, actions, extras }: Props) {
  const [today] = useState(todayIso);
  const summary = useMemo(() => computeBudget(plan), [plan]);
  const tasks = useMemo(() => scheduleTasks(plan, today), [plan, today]);
  const retry = () => extras.reload(plan);

  const propose = (after: Plan, ignored: string[] = []) =>
    actions.propose({ before: plan, after, ignored, summary: summarizeChange(plan, after, today) });

  async function onChange(message: string): Promise<ChangeOutcome> {
    const res = await api.change({
      message,
      profile: plan.profile,
      tasks: tasks.map(({ id, title, status }) => ({ id, title, status })),
      today,
    });
    if (!res.ok) {
      const { title, hint } = describeFailure(res.error.code);
      return { kind: "error", message: `${title}. ${hint}` };
    }
    if (res.data.changes.length === 0) {
      return res.data.reply
        ? { kind: "question", text: res.data.reply }
        : { kind: "error", message: "I could not find a change in that. Try saying what moved, such as guests, budget or dates." };
    }
    const { plan: after, ignored } = applyChanges(plan, res.data.changes);
    propose(after, ignored);
    return { kind: "applied" };
  }

  return (
    <>
      <Workspace
        profile={plan.profile}
        budget={summary}
        nextTasks={nextTasks(tasks, 3)}
        onChange={onChange}
        onReset={actions.reset}
        panels={{
          budget: <BudgetTab plan={plan} summary={summary} onUpdate={actions.updatePlan} onPropose={propose} />,
          timeline: <TimelineTab tasks={tasks} onSet={(id, status, date) => actions.updatePlan((p) => setTask(p, id, status, date))} />,
          vendors: (
            <AiGate ready={plan.vendors.length > 0} status={extras.status} noun="vendor checklists" onRetry={retry}>
              <VendorsTab plan={plan} summary={summary} onUpdate={actions.updatePlan} />
            </AiGate>
          ),
          ideas: (
            <AiGate ready={plan.ideas.length > 0} status={extras.status} noun="ideas" onRetry={retry}>
              <IdeasTab plan={plan} onUpdate={actions.updatePlan} />
            </AiGate>
          ),
        }}
      />
      {pending && <ChangeSummaryPanel pending={pending} onAccept={actions.accept} onUndo={actions.undo} />}
    </>
  );
}
