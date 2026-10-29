"use client";

import { usePlan } from "@/lib/store";
import { IntakeScreen } from "@/components/IntakeScreen";
import { SiteHeader } from "@/components/SiteHeader";

export function App() {
  const { state, ready, actions } = usePlan();

  // Server and first client render match: header only, until localStorage has been read.
  if (!ready) return <SiteHeader />;

  // PHASE 2: when state.stage === "plan", render <Workspace> from the engine's computeBudget/scheduleTasks/nextTasks.
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <IntakeScreen
          messages={state.messages}
          draft={state.draft}
          onUserMessage={actions.sendUser}
          onReply={actions.receiveReply}
          onDraftChange={actions.editDraft}
          onBuild={() => {
            // PHASE 2 INTEGRATION POINT: actions.startPlan(newPlan(draftToProfile(draft))), then call
            // api.vendors and api.ideas in parallel. The engine does not exist on this branch yet.
          }}
        />
      </main>
    </>
  );
}
