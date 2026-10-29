"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

/** What the host did with a change request: applied, or it needs a clarification, or it failed. */
export type ChangeOutcome = { kind: "applied" } | { kind: "question"; text: string } | { kind: "error"; message: string };

const MAX_LENGTH = 2000;

export function ChangeBox({ onSubmit }: { onSubmit: (text: string) => Promise<ChangeOutcome> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "question" | "error"; text: string } | null>(null);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setNote(null);
    const outcome = await onSubmit(trimmed);
    setBusy(false);
    if (outcome.kind === "applied") setText("");
    else setNote({ tone: outcome.kind, text: outcome.kind === "question" ? outcome.text : outcome.message });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="card p-5 sm:p-6"
    >
      <label htmlFor="change-input" className="font-serif text-xl tracking-tight">
        What changed?
      </label>
      <p id="change-hint" className="mt-1 text-sm text-muted">
        Say it the way you would to a family member. I will show what moves before anything is saved.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <textarea
          id="change-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_LENGTH}
          rows={3}
          aria-describedby="change-hint"
          placeholder="50 more guests, budget now 7 lakh, wedding two weeks earlier"
          className="min-h-14 flex-1 resize-none rounded-md border border-line bg-canvas px-3 py-2.5 text-[15px] placeholder:text-muted/70"
        />
        <Button type="submit" variant="primary" disabled={busy || !text.trim()} className="sm:w-44">
          {busy ? "Working on it" : "Review changes"}
          {!busy && <Icon name="send" className="size-4 rotate-90" />}
        </Button>
      </div>
      <div aria-live="polite">
        {note && (
          <p className={`mt-3 flex gap-2 text-sm ${note.tone === "error" ? "text-tint-red-ink" : "text-ink"}`}>
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            {note.text}
          </p>
        )}
      </div>
    </form>
  );
}
