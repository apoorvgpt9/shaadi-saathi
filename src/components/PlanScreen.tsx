// Wires the engine, the AI routes and the store to the workspace, its tabs and the change review.
import { useMemo, useState, type ReactElement } from "react";
import { api, failureMessage, todayIso } from "@/lib/api";
import { computeBudget } from "@/lib/plan/budget";
import { applyChanges } from "@/lib/plan/changes";
import { setTask } from "@/lib/plan/edits";
import { nextTasks, scheduleTasks } from "@/lib/plan/timeline";
import type { PlanActions, PlanState, Proposal } from "@/lib/store";
import type { Plan } from "@/lib/types";
import { BudgetTab } from "@/components/BudgetTab";
import { ChangeBox, type ChangeOutcome } from "@/components/ChangeBox";
import { ChangeSummaryPanel } from "@/components/ChangeSummaryPanel";
import { IdeasTab } from "@/components/IdeasTab";
import { TimelineTab } from "@/components/TimelineTab";
import { VendorsTab } from "@/components/VendorsTab";
import { Workspace } from "@/components/Workspace";
import { AiGate, type AiStatus } from "@/components/ui/AiGate";

interface Props {
  plan: Plan;
  /** A proposed change awaiting review, if any. */
  pending: PlanState["pending"];
  actions: PlanActions;
  /** The App-level AI loading state, passed through to the vendor and idea tabs. */
  extras: {
    status: AiStatus;
    /** Fetches what the plan lacks; with `refreshVendors`, regenerates the vendor checklists too. */
    reload: (plan: Plan, refreshVendors?: boolean) => void;
    /** True when the plan's profile has changed since the vendor checklists were generated. */
    staleVendors: boolean;
  };
}

/** Connects the engine, the AI routes and the store to the workspace and its tabs. */
export function PlanScreen({ plan, pending, actions, extras }: Props): ReactElement {
  const [today] = useState(todayIso);
  const [changeText, setChangeText] = useState("");
  const summary = useMemo(() => computeBudget(plan), [plan]);
  const tasks = useMemo(() => scheduleTasks(plan, today), [plan, today]);

  const propose = (build: Proposal) => actions.propose(build, today);

  async function onChange(message: string): Promise<ChangeOutcome> {
    const res = await api.change({
      message,
      profile: plan.profile,
      tasks: tasks.map(({ id, title, status }) => ({ id, title, status })),
      today,
    });
    if (!res.ok) {
      return { kind: "error", message: failureMessage(res.error) };
    }
    const { changes, reply } = res.data;
    if (changes.length === 0) {
      return reply
        ? { kind: "question", text: reply }
        : {
            kind: "error",
            message: "I could not find a change in that. Try saying what moved, such as guests, budget or dates.",
          };
    }
    propose((p) => applyChanges(p, changes));
    return { kind: "applied" };
  }

  return (
    <>
      <Workspace
        profile={plan.profile}
        budget={summary}
        nextTasks={nextTasks(tasks, 3)}
        changeBox={<ChangeBox text={changeText} onTextChange={setChangeText} onSubmit={onChange} />}
        onReset={actions.reset}
        panels={{
          budget: <BudgetTab plan={plan} summary={summary} onUpdate={actions.updatePlan} onPropose={propose} />,
          timeline: (
            <TimelineTab
              tasks={tasks}
              onSet={(id, status, date) => actions.updatePlan((p) => setTask(p, id, status, date))}
            />
          ),
          vendors: (
            <AiGate
              ready={plan.vendors.length > 0}
              status={extras.status}
              noun="vendor checklists"
              onRetry={() => extras.reload(plan)}
            >
              <VendorsTab
                plan={plan}
                summary={summary}
                onUpdate={actions.updatePlan}
                refresh={{
                  stale: extras.staleVendors,
                  busy: extras.status === "loading",
                  onRefresh: () => extras.reload(plan, true),
                }}
              />
            </AiGate>
          ),
          ideas: (
            <AiGate
              ready={plan.ideas.length > 0}
              status={extras.status}
              noun="ideas"
              onRetry={() => extras.reload(plan)}
            >
              <IdeasTab plan={plan} onUpdate={actions.updatePlan} />
            </AiGate>
          ),
        }}
      />
      {pending && (
        <ChangeSummaryPanel
          pending={pending}
          onAccept={() => {
            actions.accept();
            setChangeText("");
          }}
          onUndo={actions.undo}
        />
      )}
    </>
  );
}
