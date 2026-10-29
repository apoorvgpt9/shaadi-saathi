"use client";

import { useState, type FormEvent } from "react";
import { todayIso } from "@/lib/api";
import { IsoDate, LIMITS, type IntakeDraft } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

interface Props {
  draft: IntakeDraft;
  onSave: (d: IntakeDraft) => void;
  onCancel: () => void;
}

/** Manual entry of the four essentials. The browser enforces the ranges, and the date cannot be in the past. */
export function ProfileEditForm({ draft, onSave, onCancel }: Props) {
  const [today] = useState(todayIso);

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
      <Field label="Wedding date" name="date" type="date" min={today} defaultValue={draft.weddingDate ?? ""} />
      <Field label="City" name="city" maxLength={LIMITS.cityChars} defaultValue={draft.city ?? ""} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Guests"
          name="guests"
          type="number"
          min={LIMITS.guests.min}
          max={LIMITS.guests.max}
          defaultValue={draft.guests ?? ""}
        />
        <Field
          label="Budget (rupees)"
          name="budget"
          type="number"
          min={LIMITS.budget.min}
          max={LIMITS.budget.max}
          step={1000}
          defaultValue={draft.budget ?? ""}
        />
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
