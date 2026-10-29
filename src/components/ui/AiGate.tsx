import type { ReactNode } from "react";
import { describeFailure, type ApiFailureCode } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export type AiStatus = "idle" | "loading" | ApiFailureCode;

interface Props {
  /** True once the AI-generated content exists. */
  ready: boolean;
  status: AiStatus;
  noun: string;
  onRetry: () => void;
  children: ReactNode;
}

/** Shows the content, or a skeleton while it loads, or a calm retry prompt when the AI could not provide it. */
export function AiGate({ ready, status, noun, onRetry, children }: Props) {
  if (ready) return children;
  if (status === "loading") {
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">Loading {noun}</span>
        {[0, 1, 2].map((n) => (
          <div key={n} className="h-28 animate-pulse rounded-xl border border-line bg-sand" />
        ))}
      </div>
    );
  }
  const { title, hint } = describeFailure(status === "idle" ? "ai_unavailable" : status);
  return (
    <div role="status" className="card flex flex-col items-start gap-3 p-6 sm:p-8">
      <Icon name="alert" className="size-5 text-tint-yellow-ink" />
      <div>
        <p className="font-medium">{status === "idle" ? `${noun} have not loaded yet` : title}</p>
        <p className="mt-1 text-sm text-muted">
          {status === "idle" ? "Budget and timeline work without them." : `${hint} Budget and timeline still work.`}
        </p>
      </div>
      <Button onClick={onRetry}>
        <Icon name="retry" />
        {status === "idle" ? `Load ${noun}` : "Retry"}
      </Button>
    </div>
  );
}
