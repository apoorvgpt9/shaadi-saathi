"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { draftToProfile, isDraftReady, newPlan } from "@/lib/plan/profile";
import { usePlan } from "@/lib/store";
import type { Plan } from "@/lib/types";
import { IntakeScreen } from "@/components/IntakeScreen";
import { PlanScreen } from "@/components/PlanScreen";
import { SiteHeader } from "@/components/SiteHeader";
import type { AiStatus } from "@/components/ui/AiGate";

export function App() {
  const { state, ready, actions } = usePlan();
  const [status, setStatus] = useState<AiStatus>("idle");
  const { updatePlan } = actions;

  /** Fetches whichever of vendors and ideas the plan still lacks, in parallel. Failures leave the rest usable. */
  const load = useCallback(
    async (plan: Plan) => {
      setStatus("loading");
      const [vendors, ideas] = await Promise.all([
        plan.vendors.length === 0 ? api.vendors({ profile: plan.profile }) : null,
        plan.ideas.length === 0 ? api.ideas({ profile: plan.profile, function: null, feedback: null, previous: [] }) : null,
      ]);
      if (vendors?.ok) updatePlan((p) => ({ ...p, vendors: vendors.data.vendors }));
      if (ideas?.ok) updatePlan((p) => ({ ...p, ideas: ideas.data.ideas }));
      const failed = [vendors, ideas].find((r) => r && !r.ok);
      setStatus(failed && !failed.ok ? failed.error.code : "idle");
    },
    [updatePlan],
  );

  // Server and first client render match: header only, until localStorage has been read.
  if (!ready) return <SiteHeader />;

  if (state.stage === "plan" && state.plan) {
    return <PlanScreen plan={state.plan} pending={state.pending} actions={actions} extras={{ status, reload: (p) => void load(p) }} />;
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <IntakeScreen
          state={state}
          actions={actions}
          onBuild={() => {
            if (!state.draft || !isDraftReady(state.draft)) return;
            const plan = newPlan(draftToProfile(state.draft));
            actions.startPlan(plan);
            void load(plan);
          }}
        />
      </main>
    </>
  );
}
