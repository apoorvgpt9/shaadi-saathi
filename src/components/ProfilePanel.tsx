"use client";

import { useState, type CSSProperties, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { IsoDate, type IntakeDraft } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { formatDate, formatINR } from "@/lib/format";
import { CATEGORY_LABELS, CITY_TIER_LABELS, FUNCTION_LABELS, STYLE_LABELS } from "@/lib/plan/benchmarks";
import { isDraftReady } from "@/lib/plan/profile";

export const EMPTY_DRAFT: IntakeDraft = {
  weddingDate: null, city: null, cityTier: null, guests: null, budget: null,
  functions: [], style: null, priorities: [], mustHaves: [], notes: [],
};

const offsetText = (n: number) =>
  n === 0 ? "wedding day" : `${Math.abs(n)} day${Math.abs(n) === 1 ? "" : "s"} ${n < 0 ? "before" : "after"}`;

function Row({ label, value, required }: { label: string; value: ReactNode; required?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium tabular-nums">
        {value ?? (required ? <Badge tone="yellow">Needed</Badge> : <span className="font-normal text-muted">Not yet</span>)}
      </dd>
    </div>
  );
}

function Section({ title, empty, items, children }: { title: string; empty: string; items: unknown[]; children: ReactNode }) {
  return (
    <div>
      <h3 className="eyebrow">{title}</h3>
      {items.length > 0 ? children : <p className="mt-2 text-muted">{empty}</p>}
    </div>
  );
}

function Field({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="text-sm text-muted">
      {label}
      <input {...input} className="mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-3 text-sm tabular-nums" />
    </label>
  );
}

function EditForm({ draft, onSave, onCancel }: { draft: IntakeDraft; onSave: (d: IntakeDraft) => void; onCancel: () => void }) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const date = IsoDate.safeParse(f.get("date"));
    const city = String(f.get("city") ?? "").trim();
    const int = (k: string) => (f.get(k) ? Math.trunc(Number(f.get(k))) : null);
    onSave({
      ...draft,
      weddingDate: date.success ? date.data : null,
      city: city || null,
      // A changed city invalidates the tier the AI inferred; the engine falls back to tier 2.
      cityTier: city === draft.city ? draft.cityTier : null,
      guests: int("guests"),
      budget: int("budget"),
    });
  }
  return (
    <form onSubmit={submit} className="grid gap-4 py-2">
      <Field label="Wedding date" name="date" type="date" defaultValue={draft.weddingDate ?? ""} />
      <Field label="City" name="city" maxLength={80} defaultValue={draft.city ?? ""} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Guests" name="guests" type="number" min={1} max={5000} defaultValue={draft.guests ?? ""} />
        <Field label="Budget (rupees)" name="budget" type="number" min={10000} max={1000000000} step={1000} defaultValue={draft.budget ?? ""} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary">Save details</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

interface Props {
  draft: IntakeDraft | null;
  onDraftChange: (d: IntakeDraft) => void;
  onBuild: () => void;
}

/** "What I've understood": the live profile, with the four required fields marked and the build gate. */
export function ProfilePanel({ draft, onDraftChange, onBuild }: Props) {
  const [editing, setEditing] = useState(false);
  const d = draft ?? EMPTY_DRAFT;
  const missing = [
    d.weddingDate === null && "wedding date",
    d.city === null && "city",
    d.guests === null && "guest count",
    d.budget === null && "budget",
  ].filter(Boolean);
  const ready = isDraftReady(d);

  return (
    <section aria-labelledby="profile-title" className="card reveal p-6 sm:p-8" style={{ "--i": 2 } as CSSProperties}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Live summary</p>
          <h2 id="profile-title" className="mt-1 font-serif text-2xl tracking-tight">What I&apos;ve understood</h2>
        </div>
        {!editing && (
          <Button variant="ghost" className="-mr-2 px-3" onClick={() => setEditing(true)}>
            <Icon name="edit" />
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <EditForm
          draft={d}
          onSave={(next) => {
            onDraftChange(next);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <dl className="mt-4">
          <Row label="Wedding date" required value={d.weddingDate && formatDate(d.weddingDate)} />
          <Row label="City" required value={d.city && (d.cityTier ? `${d.city} · ${CITY_TIER_LABELS[d.cityTier]}` : d.city)} />
          <Row label="Guests" required value={d.guests?.toLocaleString("en-IN")} />
          <Row label="Budget" required value={d.budget && formatINR(d.budget)} />
          <Row label="Style" value={STYLE_LABELS[d.style ?? "classic"] + (d.style ? "" : " (default)")} />
        </dl>
      )}
      <div className="mt-6 space-y-5 border-t border-line pt-6 text-sm">
        <Section title="Functions" empty="Wedding day only, unless you mention others." items={d.functions}>
          <ul className="mt-2 space-y-1.5">
            {d.functions.map((f) => (
              <li key={f.kind} className="flex justify-between gap-4">
                <span className="font-medium">{FUNCTION_LABELS[f.kind]}</span>
                <span className="text-right text-muted">
                  {offsetText(f.dayOffset)}
                  {f.guests ? ` · ${f.guests} guests` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Priorities, in order" empty="Tell me what matters most, such as food or photography." items={d.priorities}>
          <ol className="mt-2 flex flex-wrap gap-2">
            {d.priorities.map((p, i) => (
              <li key={p} className="rounded-md bg-sand px-2.5 py-1">
                <span className="mr-1.5 font-mono text-xs text-muted">{i + 1}</span>
                {CATEGORY_LABELS[p]}
              </li>
            ))}
          </ol>
        </Section>
        <Section title="Must-haves and notes" empty="Culture, ages, accessibility or atmosphere: anything I should respect." items={[...d.mustHaves, ...d.notes]}>
          <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-muted">
            {[...d.mustHaves, ...d.notes].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Section>
      </div>
      <div className="mt-8 border-t border-line pt-6">
        <Button variant="primary" className="w-full" disabled={!ready} aria-describedby="build-hint" onClick={onBuild}>
          Build my plan
        </Button>
        <p id="build-hint" className="mt-3 flex items-start gap-2 text-sm text-muted">
          {ready ? (
            <>
              <Icon name="check" className="mt-0.5 size-4 shrink-0 text-tint-green-ink" />
              The four essentials are in. Keep chatting to add more detail.
            </>
          ) : (
            <>Still needed: {missing.join(", ")}.</>
          )}
        </p>
      </div>
    </section>
  );
}
