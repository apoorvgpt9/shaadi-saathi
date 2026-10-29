"use client";

import { useState, type CSSProperties } from "react";
import { todayIso } from "@/lib/api";
import { isDraftReady } from "@/lib/plan/profile";
import type { IntakeDraft } from "@/lib/types";
import { Extras, Essentials } from "@/components/ProfileDetails";
import { ProfileEditForm } from "@/components/ProfileEditForm";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

const EMPTY_DRAFT: IntakeDraft = {
  weddingDate: null, city: null, cityTier: null, guests: null, budget: null,
  functions: [], style: null, priorities: [], mustHaves: [], notes: [],
};

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
  // Read lazily: a date exists only after mount, and the clock cannot be read while the page is prerendered.
  const past = d.weddingDate !== null && d.weddingDate < todayIso();
  const ready = isDraftReady(d) && !past;

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
        <ProfileEditForm
          draft={d}
          onSave={(next) => {
            onDraftChange(next);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <Essentials draft={d} />
      )}
      <Extras draft={d} />
      <div className="mt-8 border-t border-line pt-6">
        <Button variant="primary" className="w-full" disabled={!ready} aria-describedby="build-hint" onClick={onBuild}>
          Build my plan
        </Button>
        <p id="build-hint" className="mt-3 flex items-start gap-2 text-sm text-muted">
          {past ? (
            <>
              <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-tint-yellow-ink" />
              That wedding date has already passed. Edit it to a date from today onward.
            </>
          ) : ready ? (
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
