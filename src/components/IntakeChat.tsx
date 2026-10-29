"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { api, describeFailure, todayIso, type ApiFailureCode } from "@/lib/api";
import { addDays } from "@/lib/format";
import type { ChatMessage } from "@/lib/store";
import type { IntakeDraft } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Icon, Mark } from "@/components/ui/icons";

const GREETING =
  "Namaste. Tell me about the wedding you are planning: when, where, roughly how many guests, and what you would like to spend. Hinglish is fine.";

const MAX_LENGTH = 2000;

/** The explainer's scenario, dated four months out so the plan always has urgent and comfortable tasks. */
function exampleMessage(): string {
  const date = addDays(todayIso(), 120);
  return `We're planning our wedding in Jaipur on ${date}, around 200 guests, budget 8 lakh. Mehendi the day before with about 120 people. Food matters most to us, then photography.`;
}

interface Props {
  messages: ChatMessage[];
  draft: IntakeDraft | null;
  onUserMessage: (m: ChatMessage) => void;
  onReply: (reply: string, draft: IntakeDraft) => void;
}

export function IntakeChat({ messages, draft, onUserMessage, onReply }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailureCode | null>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages.length, busy, failure]);

  async function ask(history: ChatMessage[]) {
    setBusy(true);
    setFailure(null);
    const res = await api.intake({ messages: history.slice(-20), draft, today: todayIso() });
    setBusy(false);
    if (res.ok) onReply(res.data.reply, res.data.draft);
    else setFailure(res.error.code);
  }

  function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || busy) return;
    const message: ChatMessage = { role: "user", content: trimmed };
    onUserMessage(message);
    setText("");
    void ask([...messages, message]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(text);
    }
  }

  const failed = failure && describeFailure(failure);
  // A retry only makes sense while the last stored message is the user's unanswered one.
  const canRetry = messages.at(-1)?.role === "user";

  return (
    <section aria-labelledby="chat-title" className="card reveal flex flex-col" style={{ "--i": 1 } as CSSProperties}>
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4 sm:px-8">
        <h2 id="chat-title" className="font-serif text-2xl tracking-tight">Opening questions</h2>
        <Button onClick={() => send(exampleMessage())} disabled={busy}>Try an example</Button>
      </div>
      <div
        ref={log}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        tabIndex={0}
        className="max-h-[52vh] min-h-[22rem] space-y-6 overflow-y-auto px-6 py-6 sm:px-8"
      >
        {[{ role: "assistant", content: GREETING } as ChatMessage, ...messages].map((m, i) =>
          m.role === "assistant" ? (
            <div key={i} className="flex max-w-[92%] gap-3">
              <Mark className="mt-0.5 size-6 shrink-0" />
              <p className="leading-relaxed">{m.content}</p>
            </div>
          ) : (
            <p key={i} className="ml-auto w-fit max-w-[85%] rounded-lg border border-line bg-sand px-4 py-2.5 leading-relaxed">
              <span className="sr-only">You: </span>
              {m.content}
            </p>
          ),
        )}
        {busy && (
          <p role="status" className="flex animate-pulse items-center gap-3 text-sm text-muted">
            <Mark className="size-6 shrink-0" />
            The assistant is replying
          </p>
        )}
        {failed && (
          <div role="alert" className="flex gap-3 rounded-lg border border-line bg-tint-yellow p-4 text-tint-yellow-ink">
            <Icon name="alert" className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{failed.title}</p>
              <p className="mt-1">
                {failed.hint} Your message is saved. You can also fill in the essentials yourself with Edit on the right, and still build your plan.
              </p>
              {canRetry && (
                <Button className="mt-3" onClick={() => void ask(messages)}>
                  <Icon name="retry" />
                  Retry
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex items-end gap-3 border-t border-line p-4 sm:px-6"
      >
        <label htmlFor="chat-input" className="sr-only">Your message</label>
        <textarea id="chat-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} maxLength={MAX_LENGTH}
          rows={2} placeholder="Shaadi 15 February ko Jaipur mein, 200 log, budget 8 lakh..."
          className="min-h-14 flex-1 resize-none rounded-md border border-line bg-canvas px-3 py-2.5 text-[15px] placeholder:text-muted/70" />
        <Button type="submit" variant="primary" disabled={busy || !text.trim()} aria-label="Send message" className="size-10 shrink-0 px-0">
          <Icon name="send" className="size-5" />
        </Button>
      </form>
    </section>
  );
}
