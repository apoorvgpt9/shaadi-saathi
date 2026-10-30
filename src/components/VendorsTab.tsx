// The Vendors tab: AI checklists per category, with pasted-quote extraction and comparison.
import { useState, type ReactElement } from "react";
import { api, failureMessage } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/plan/benchmarks";
import {
  LIMITS,
  type BudgetSummary,
  type CategoryId,
  type Plan,
  type VendorChecklist,
} from "@/lib/types";
import { patchEntry, removeQuote } from "@/lib/plan/edits";
import { QuoteCompare } from "@/components/QuoteCompare";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";

const SECTIONS = [
  { key: "needs", title: "What you need" },
  { key: "questions", title: "Questions to ask" },
  { key: "confirmBeforeBooking", title: "Confirm before booking" },
] as const;

interface Props {
  plan: Plan;
  summary: BudgetSummary;
  onUpdate: (update: (plan: Plan) => Plan) => void;
  /** Whether the checklists predate the current profile, and how to regenerate them. */
  refresh: { stale: boolean; busy: boolean; onRefresh: () => void };
}

/** A collapsed form to paste a vendor's quote as text and have the AI extract its details. */
function QuoteForm({
  category,
  plan,
  onUpdate,
}: {
  category: CategoryId;
  plan: Plan;
  onUpdate: Props["onUpdate"];
}): ReactElement {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `quote-${category}`;

  async function extract() {
    setBusy(true);
    setError(null);
    const res = await api.quote({ text, category, guests: plan.profile.guests });
    setBusy(false);
    if (!res.ok) {
      setError(failureMessage(res.error, "Your text is still here."));
      return;
    }
    const quote = { ...res.data.quote, id: crypto.randomUUID() }; // Outside the updater: React may run updaters twice.
    onUpdate((p) => ({ ...p, quotes: [...p.quotes, quote].slice(-LIMITS.quotes) }));
    setText("");
  }

  return (
    <details className="mt-6 border-t border-line pt-4">
      <summary className="cursor-pointer py-1 text-sm font-medium text-maroon">
        Paste a quote
      </summary>
      <div className="mt-3">
        <label htmlFor={id} className="text-sm text-muted">
          Paste the vendor&apos;s message or quote as text
        </label>
        <TextArea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={LIMITS.quoteChars}
          rows={5}
          className="mt-1 block w-full"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            disabled={busy || text.trim().length < LIMITS.quoteMinChars}
            onClick={() => void extract()}
          >
            {busy ? "Reading the quote" : "Extract details"}
          </Button>
          <span className="text-xs text-muted tabular-nums">
            {text.length.toLocaleString("en-IN")} / {LIMITS.quoteChars.toLocaleString("en-IN")}
          </span>
          <span aria-live="polite" className="text-sm text-tint-red-ink wrap-anywhere">
            {error}
          </span>
        </div>
      </div>
    </details>
  );
}

/** The three checklist columns for one category; ticks are stored on the plan by item position. */
function Checklist({
  v,
  plan,
  onUpdate,
}: {
  v: VendorChecklist;
  plan: Plan;
  onUpdate: Props["onUpdate"];
}): ReactElement {
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
                    <input
                      type="checkbox"
                      name={k}
                      checked={!!plan.checked[k]}
                      onChange={() =>
                        onUpdate((p) => ({ ...p, checked: { ...p.checked, [k]: !p.checked[k] } }))
                      }
                      className="mt-1 size-4 shrink-0 accent-maroon"
                    />
                    <span
                      className={`wrap-anywhere ${plan.checked[k] ? "text-muted line-through" : ""}`}
                    >
                      {item}
                    </span>
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

interface StaleNoticeProps {
  busy: boolean;
  onRefresh: () => void;
}

/** Warns that the checklists predate the current profile, and offers to regenerate them. */
function StaleNotice({ busy, onRefresh }: StaleNoticeProps): ReactElement {
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 border-tint-yellow-ink/30 bg-tint-yellow p-4 text-sm text-tint-yellow-ink">
      <p className="min-w-0 flex-1">
        Your plan has changed since these checklists were written. Refreshing replaces them and
        clears the ticks.
      </p>
      <Button disabled={busy} onClick={onRefresh}>
        <Icon name="retry" />
        {busy ? "Refreshing" : "Refresh checklists"}
      </Button>
    </div>
  );
}

interface VendorSectionProps {
  vendor: VendorChecklist;
  plan: Plan;
  summary: BudgetSummary;
  onUpdate: Props["onUpdate"];
}

/** One category: its checklist, any quotes pasted for it compared side by side, and the form to add another. */
function VendorSection({ vendor, plan, summary, onUpdate }: VendorSectionProps): ReactElement {
  const { category } = vendor;
  const quotes = plan.quotes.filter((q) => q.category === category);
  const line = summary.lines.find((l) => l.category === category);

  return (
    <section aria-labelledby={`v-${category}`} className="card p-6 sm:p-8">
      <h2 id={`v-${category}`} className="mb-5 font-serif text-xl tracking-tight">
        {CATEGORY_LABELS[category]}
      </h2>
      <Checklist v={vendor} plan={plan} onUpdate={onUpdate} />
      {quotes.length > 0 && (
        <QuoteCompare
          quotes={quotes}
          needed={plan.profile.guests}
          estimate={line ? formatINR(line.estimate) : ""}
          usedId={plan.budget[category]?.quoteId ?? null}
          onUse={(id) => onUpdate((p) => patchEntry(p, category, { quoteId: id }))}
          onRemove={(id) => onUpdate((p) => removeQuote(p, id))}
        />
      )}
      <QuoteForm category={category} plan={plan} onUpdate={onUpdate} />
    </section>
  );
}

/** The AI vendor checklists by category, with quote extraction and comparison. */
export function VendorsTab({ plan, summary, onUpdate, refresh }: Props): ReactElement {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Quote details are extracted from the text you paste. Confirm with the vendor before booking.
      </p>
      {refresh.stale && <StaleNotice busy={refresh.busy} onRefresh={refresh.onRefresh} />}
      {plan.vendors.map((v) => (
        <VendorSection
          key={v.category}
          vendor={v}
          plan={plan}
          summary={summary}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}
