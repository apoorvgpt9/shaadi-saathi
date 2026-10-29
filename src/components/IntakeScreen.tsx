import type { IntakeDraft } from "@/lib/types";
import type { ChatMessage } from "@/lib/store";
import { IntakeChat } from "@/components/IntakeChat";
import { ProfilePanel } from "@/components/ProfilePanel";

interface Props {
  messages: ChatMessage[];
  draft: IntakeDraft | null;
  onUserMessage: (m: ChatMessage) => void;
  onReply: (reply: string, draft: IntakeDraft) => void;
  onDraftChange: (d: IntakeDraft) => void;
  onBuild: () => void;
}

export function IntakeScreen({ messages, draft, onUserMessage, onReply, onDraftChange, onBuild }: Props) {
  return (
    <>
      <section className="reveal max-w-4xl pb-10 pt-12 sm:pt-16">
        <p className="eyebrow">Step 1 of 2 · Opening questions</p>
        <h1 className="mt-3 font-serif text-balance text-4xl leading-[1.1] tracking-[-0.03em] sm:text-6xl">
          Plan the wedding, <em className="text-maroon">and the budget behind it.</em>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Answer a few questions about your families, dates and guests. You get a budget, a timeline and vendor checklists
          that you can change any time.
        </p>
      </section>
      <div className="grid items-start gap-6 pb-24 lg:grid-cols-[1.2fr_1fr]">
        <IntakeChat messages={messages} draft={draft} onUserMessage={onUserMessage} onReply={onReply} />
        <div className="lg:sticky lg:top-6">
          <ProfilePanel draft={draft} onDraftChange={onDraftChange} onBuild={onBuild} />
        </div>
      </div>
    </>
  );
}
