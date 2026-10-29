"use client";

import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { IsoDate, type IntakeDraft } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { CATEGORY_LABEL, FUNCTION_LABEL, inr, shortDate } from "@/components/present";

export const EMPTY_DRAFT: IntakeDraft = {
  weddingDate: null,
  city: null,
  cityTier: null,
  guests: null,
  budget: null,
  functions: [],
  style: null,
  priorities: [],
  mustHaves: [],
  notes: [],
};

const TIER_LABEL = { metro: "Metro", tier2: "Tier 2", town: "Smaller town" } as const;

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
  const field = "mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-3 text-sm tabular-nums";
  return (
    <form onSubmit={submit} className="grid gap-4 py-2">
      <label className="text-sm text-muted">
        Wedding date
        <input name="date" type="date" defaultValue={draft.weddingDate ?? ""} className={field} />
      </label>
      <label className="text-sm text-muted">
        City
        <input name="city" type="text" maxLength={80} defaultValue={draft.city ?? ""} className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-muted">
          Guests
          <input name="guests" type="number" min={1} max={5000} defaultValue={draft.guests ?? ""} className={field} />
        </label>
        <label className="text-sm text-muted">
          Budget (rupees)
          <input name="budget" type="number" min={10000} max={1000000000} step={1000} defaultValue={draft.budget ?? ""} className={field} />
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary">
          Save details
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

interface Props {
  draft: IntakeDraft | null;
  onDraftChange: (d: IntakeDraft) => void;
  onBuild: () => void;
  building?: boolean;
}

/** "What I've understood": the live profile, with the four required fields marked and the build gate. */
export function ProfilePanel({ draft, onDraftChange, onBuild, building = false }: Props) {
  const [editing, setEditing] = useState(false);
  const d = draft ?? EMPTY_DRAFT;
  const missing = [
    d.weddingDate === null && "wedding date",
    d.city === null && "city",
    d.guests === null && "guest count",
    d.budget === null && "budget",
  ].filter(Boolean);
  const ready = missing.length === 0;

  return (
    <section aria-labelledby="profile-title" className="card reveal p-6 sm:p-8" style={{ "--i": 2 } as CSSProperties}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Live summary</p>
          <h2 id="profile-title" className="mt-1 font-serif text-2xl tracking-tight">
            What I&apos;ve understood
          </h2>
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
          <Row label="Wedding date" required value={d.weddingDate && shortDate(d.weddingDate, true)} />
          <Row label="City" required value={d.city && (d.cityTier ? `${d.city} · ${TIER_LABEL[d.cityTier]}` : d.city)} />
          <Row label="Guests" required value={d.guests?.toLocaleString("en-IN")} />
          <Row label="Budget" required value={d.budget && inr(d.budget)} />
        </dl>
      )}

      <div className="mt-6 space-y-5 border-t border-line pt-6 text-sm">
        <div>
          <h3 className="eyebrow">Functions</h3>
          {d.functions.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {d.functions.map((f) => (
                <li key={f.kind} className="flex justify-between gap-4">
                  <span className="font-medium">{FUNCTION_LABEL[f.kind]}</span>
                  <span className="text-right text-muted">
                    {offsetText(f.dayOffset)}
                    {f.guests ? ` · ${f.guests} guests` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted">Wedding day only, unless you mention others.</p>
          )}
        </div>
        <div>
          <h3 className="eyebrow">Priorities, in order</h3>
          {d.priorities.length > 0 ? (
            <ol className="mt-2 flex flex-wrap gap-2">
              {d.priorities.map((p, i) => (
                <li key={p} className="rounded-md bg-sand px-2.5 py-1">
                  <span className="mr-1.5 font-mono text-xs text-muted">{i + 1}</span>
                  {CATEGORY_LABEL[p]}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-muted">Tell me what matters most, such as food or photography.</p>
          )}
        </div>
        <div>
          <h3 className="eyebrow">Style, must-haves and notes</h3>
          <p className="mt-2">
            <span className="capitalize">{d.style ?? "Classic"}</span>
            {d.style ? "" : <span className="text-muted"> (default)</span>}
          </p>
          {[...d.mustHaves, ...d.notes].length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-muted">
              {[...d.mustHaves, ...d.notes].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <Button variant="primary" className="w-full" disabled={!ready || building} aria-describedby="build-hint" onClick={onBuild}>
          {building ? "Building your plan" : "Build my plan"}
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
