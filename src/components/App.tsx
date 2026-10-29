"use client";

import { useCallback, useMemo, useState } from "react";
import { api, cancelRequests } from "@/lib/api";
import { draftToProfile, isDraftReady, newPlan } from "@/lib/plan/profile";
import type { Plan } from "@/lib/types";
import { IntakeScreen } from "@/components/IntakeScreen";
import { PlanScreen } from "@/components/PlanScreen";
import { SiteHeader } from "@/components/SiteHeader";
import { usePlan } from "@/components/usePlan";
import type { AiStatus } from "@/components/ui/AiGate";
import { StartOver } from "@/components/ui/StartOver";

export function App() {
  const { state, actions } = usePlan();
  const [status, setStatus] = useState<AiStatus>("idle");
  // The profile the vendor checklists were generated for; null until this session generates them.
  const [vendorsFor, setVendorsFor] = useState<string | null>(null);
  const { updatePlan } = actions;

  const reset = useCallback(() => {
    cancelRequests();
    setStatus("idle");
    setVendorsFor(null);
    actions.reset();
  }, [actions]);

  const appActions = useMemo(() => ({ ...actions, reset }), [actions, reset]);

  /** Fetches whichever of vendors and ideas the plan still lacks, in parallel. Failures leave the rest usable. */
  const load = useCallback(
    async (plan: Plan, refreshVendors = false) => {
      const profileKey = JSON.stringify(plan.profile);
      setStatus("loading");
      const [vendors, ideas] = await Promise.all([
        refreshVendors || plan.vendors.length === 0 ? api.vendors({ profile: plan.profile }) : null,
        plan.ideas.length === 0 ? api.ideas({ profile: plan.profile, function: null, feedback: null, previous: [] }) : null,
      ]);
      if (vendors?.ok) {
        // Ticks are stored by item position, so they only stay valid for the checklists they were made against.
        updatePlan((p) => ({ ...p, vendors: vendors.data.vendors, checked: refreshVendors ? {} : p.checked }));
        setVendorsFor(profileKey);
      }
      if (ideas?.ok) updatePlan((p) => ({ ...p, ideas: ideas.data.ideas }));
      const failed = [vendors, ideas].find((r) => r && !r.ok);
      if (failed && !failed.ok && failed.error.code === "aborted") return; // Start over cancelled it; the screen has moved on.
      setStatus(failed && !failed.ok ? failed.error.code : "idle");
    },
    [updatePlan],
  );

  if (state.stage === "plan" && state.plan) {
    return (
      <PlanScreen
        plan={state.plan}
        pending={state.pending}
        actions={appActions}
        extras={{
          status,
          reload: (p, refreshVendors) => void load(p, refreshVendors),
          staleVendors: vendorsFor !== null && vendorsFor !== JSON.stringify(state.plan.profile),
        }}
      />
    );
  }

  return (
    <>
      <SiteHeader>{state.messages.length > 0 ? <StartOver onConfirm={reset} /> : undefined}</SiteHeader>
      <main id="main" className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <IntakeScreen
          state={state}
          actions={appActions}
          onBuild={() => {
            if (!state.draft || !isDraftReady(state.draft)) return;
            const plan = newPlan(draftToProfile(state.draft));
            appActions.startPlan(plan);
            void load(plan);
          }}
        />
      </main>
    </>
  );
}
