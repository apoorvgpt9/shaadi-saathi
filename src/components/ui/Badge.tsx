import type { ReactNode } from "react";

const TONES = {
  neutral: "bg-sand text-muted",
  yellow: "bg-tint-yellow text-tint-yellow-ink",
  blue: "bg-tint-blue text-tint-blue-ink",
  green: "bg-tint-green text-tint-green-ink",
  red: "bg-tint-red text-tint-red-ink",
} as const;

export type Tone = keyof typeof TONES;

/** A status pill. The label always carries the meaning; colour is only reinforcement. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-[0.05em] ${TONES[tone]}`}>
      {children}
    </span>
  );
}
