// The first screen: the intake chat beside the live profile summary.
import type { ReactElement } from "react";
import type { PlanActions, PlanState } from "@/lib/store";
import { IntakeChat } from "@/components/IntakeChat";
import { ProfilePanel } from "@/components/ProfilePanel";

interface Props {
  state: PlanState;
  actions: PlanActions;
  /** Starts the plan once the profile is ready. */
  onBuild: () => void;
}

/** The landing screen: a short pitch, then the intake chat beside the live profile summary. */
export function IntakeScreen({ state, actions, onBuild }: Props): ReactElement {
  return (
    <>
      <section className="reveal max-w-4xl pb-10 pt-12 sm:pt-16">
        <p className="eyebrow">Step 1 of 2 · Opening questions</p>
        <h1 className="mt-3 font-serif text-balance text-4xl leading-[1.1] tracking-[-0.03em] sm:text-6xl">
          Plan the wedding, <em className="text-maroon">and the budget behind it.</em>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Answer a few questions about your families, dates and guests. You get a budget, a timeline
          and vendor checklists that you can change any time.
        </p>
      </section>
      <div className="grid items-start gap-6 pb-24 lg:grid-cols-[1.2fr_1fr]">
        <IntakeChat
          messages={state.messages}
          draft={state.draft}
          onUserMessage={actions.sendUser}
          onReply={actions.receiveReply}
        />
        <div className="lg:sticky lg:top-6">
          <ProfilePanel draft={state.draft} onDraftChange={actions.editDraft} onBuild={onBuild} />
        </div>
      </div>
    </>
  );
}
