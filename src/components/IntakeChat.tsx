"use client";

import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { api, failureMessage, todayIso } from "@/lib/api";
import { addDays } from "@/lib/format";
import { awaitingReply } from "@/lib/store";
import { LIMITS, type ChatMessage, type IntakeDraft } from "@/lib/types";
import { ChatLog } from "@/components/ChatLog";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";

/** The sample brief, dated four months out so the plan always has urgent and comfortable tasks. */
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
  const [error, setError] = useState<string | null>(null);

  async function ask(history: ChatMessage[]) {
    setBusy(true);
    setError(null);
    const res = await api.intake({ messages: history.slice(-LIMITS.chatMessages), draft, today: todayIso() });
    setBusy(false);
    if (res.ok) onReply(res.data.reply, res.data.draft);
    else if (res.error.code !== "aborted") setError(failureMessage(res.error));
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

  // After a failure, or a reload mid-call, the last stored message is the user's and nothing has answered it.
  const unanswered = awaitingReply(messages);
  const notice = unanswered ? (error ?? "That message did not get a reply.") : null;

  return (
    <section aria-labelledby="chat-title" className="card reveal flex flex-col" style={{ "--i": 1 } as CSSProperties}>
      <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4 sm:px-8">
        <h2 id="chat-title" className="font-serif text-2xl tracking-tight">Opening questions</h2>
        <Button onClick={() => send(exampleMessage())} disabled={busy}>Try an example</Button>
      </div>
      <ChatLog messages={messages} busy={busy} notice={notice} onRetry={() => void ask(messages)} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex items-end gap-3 border-t border-line p-4 sm:px-6"
      >
        <label htmlFor="chat-input" className="sr-only">Your message</label>
        <TextArea id="chat-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} maxLength={LIMITS.messageChars}
          rows={2} placeholder="Shaadi 15 February ko Jaipur mein, 200 log, budget 8 lakh..." className="min-h-14 flex-1 resize-none" />
        <Button type="submit" variant="primary" disabled={busy || !text.trim()} aria-label="Send message" className="size-10 shrink-0 px-0">
          <Icon name="send" className="size-5" />
        </Button>
      </form>
    </section>
  );
}
