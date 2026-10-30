// The scrolling intake conversation, with its replying and retry states.
import { useEffect, useRef, type ReactElement } from "react";
import type { ChatMessage } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Icon, Mark } from "@/components/ui/icons";

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Namaste. Tell me about the wedding you are planning: when, where, roughly how many guests, and what you would like to spend. Hinglish is fine.",
};

interface Props {
  messages: ChatMessage[];
  busy: boolean;
  /** Set when the last message went unanswered: the failure copy, or a note after a reload mid-call. Hidden while busy. */
  notice: string | null;
  onRetry: () => void;
}

/** One chat turn: the assistant's with the app mark on the left, the user's as a bubble on the right. */
function Message({ message }: { message: ChatMessage }): ReactElement {
  if (message.role === "assistant") {
    return (
      <div className="flex max-w-[92%] gap-3">
        <Mark className="mt-0.5 size-6 shrink-0" />
        <p className="min-w-0 leading-relaxed wrap-anywhere">{message.content}</p>
      </div>
    );
  }
  return (
    <p className="ml-auto w-fit max-w-[85%] rounded-lg border border-line bg-sand px-4 py-2.5 leading-relaxed wrap-anywhere">
      <span className="sr-only">You: </span>
      {message.content}
    </p>
  );
}

/** The conversation so far, plus the replying and retry states. Long unbroken text wraps instead of widening the page. */
export function ChatLog({ messages, busy, notice, onRetry }: Props): ReactElement {
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages.length, busy, notice]);

  return (
    <div
      ref={log}
      role="log"
      aria-live="polite"
      aria-label="Conversation"
      tabIndex={0}
      className="max-h-[52vh] min-h-[22rem] space-y-6 overflow-y-auto px-6 py-6 sm:px-8"
    >
      {[GREETING, ...messages].map((message, i) => (
        <Message key={i} message={message} />
      ))}
      {busy && (
        <p role="status" className="flex animate-pulse items-center gap-3 text-sm text-muted">
          <Mark className="size-6 shrink-0" />
          The assistant is replying
        </p>
      )}
      {notice && !busy && (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border border-line bg-tint-yellow p-4 text-tint-yellow-ink"
        >
          <Icon name="alert" className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="wrap-anywhere">
              {notice} Your message is saved. You can also fill in the essentials yourself with Edit
              on the right, and still build your plan.
            </p>
            <Button className="mt-3" onClick={onRetry}>
              <Icon name="retry" />
              Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
