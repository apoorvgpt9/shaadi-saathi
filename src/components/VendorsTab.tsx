"use client";

import { useState } from "react";
import { api, describeFailure } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/plan/benchmarks";
import type { BudgetSummary, CategoryId, Plan, VendorChecklist } from "@/lib/types";
import { patchEntry, removeQuote } from "@/lib/plan/edits";
import { QuoteCompare } from "@/components/QuoteCompare";
import { Button } from "@/components/ui/Button";

const MAX_QUOTE = 6000;
const SECTIONS = [
  { key: "needs", title: "What you need" },
  { key: "questions", title: "Questions to ask" },
  { key: "confirmBeforeBooking", title: "Confirm before booking" },
] as const;

interface Props {
  plan: Plan;
  summary: BudgetSummary;
  onUpdate: (update: (plan: Plan) => Plan) => void;
}

function QuoteForm({ category, plan, onUpdate }: { category: CategoryId; plan: Plan; onUpdate: Props["onUpdate"] }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `quote-${category}`;

  async function extract() {
    setBusy(true);
    setError(null);
    const res = await api.quote({ text, category, guests: plan.profile.guests });
    setBusy(false);
    if (!res.ok) return setError(`${describeFailure(res.error.code).title}. Your text is still here.`);
    onUpdate((p) => ({ ...p, quotes: [...p.quotes, { ...res.data.quote, id: crypto.randomUUID() }].slice(-30) }));
    setText("");
  }

  return (
    <details className="mt-6 border-t border-line pt-4">
      <summary className="cursor-pointer text-sm font-medium text-maroon">Paste a quote</summary>
      <div className="mt-3">
        <label htmlFor={id} className="text-sm text-muted">Paste the vendor&apos;s message or quote as text</label>
        <textarea id={id} value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_QUOTE} rows={5}
          className="mt-1 block w-full rounded-md border border-line bg-canvas px-3 py-2.5 text-sm" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={busy || text.trim().length < 20} onClick={() => void extract()}>
            {busy ? "Reading the quote" : "Extract details"}
          </Button>
          <span className="text-xs text-muted tabular-nums">
            {text.length.toLocaleString("en-IN")} / {MAX_QUOTE.toLocaleString("en-IN")}
          </span>
          <span aria-live="polite" className="text-sm text-tint-red-ink">
            {error}
          </span>
        </div>
      </div>
    </details>
  );
}

function Checklist({ v, plan, onUpdate }: { v: VendorChecklist; plan: Plan; onUpdate: Props["onUpdate"] }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {SECTIONS.map(({ key, title }) => (
        <fieldset key={key}>
          <legend className="eyebrow">{title}</legend>
          <ul className="mt-3 space-y-2.5">
            {v[key].map((item, i) => {
              const k = `${v.category}:${key}:${i}`;
              return (
                <li key={k}>
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <input type="checkbox" checked={!!plan.checked[k]}
                      onChange={() => onUpdate((p) => ({ ...p, checked: { ...p.checked, [k]: !p.checked[k] } }))}
                      className="mt-1 size-4 shrink-0 accent-maroon" />
                    <span className={plan.checked[k] ? "text-muted line-through" : ""}>{item}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}

export function VendorsTab({ plan, summary, onUpdate }: Props) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">Quote details are extracted from the text you paste. Confirm with the vendor before booking.</p>
      {plan.vendors.map((v) => {
        const quotes = plan.quotes.filter((q) => q.category === v.category);
        const line = summary.lines.find((l) => l.category === v.category);
        return (
          <section key={v.category} aria-labelledby={`v-${v.category}`} className="card p-6 sm:p-8">
            <h2 id={`v-${v.category}`} className="mb-5 font-serif text-xl tracking-tight">
              {CATEGORY_LABELS[v.category]}
            </h2>
            <Checklist v={v} plan={plan} onUpdate={onUpdate} />
            {quotes.length > 0 && (
              <QuoteCompare
                quotes={quotes}
                needed={plan.profile.guests}
                estimate={line ? formatINR(line.estimate) : ""}
                usedId={plan.budget[v.category]?.quoteId ?? null}
                onUse={(id) => onUpdate((p) => patchEntry(p, v.category, { quoteId: id }))}
                onRemove={(id) => onUpdate((p) => removeQuote(p, id))}
              />
            )}
            <QuoteForm category={v.category} plan={plan} onUpdate={onUpdate} />
          </section>
        );
      })}
    </div>
  );
}
