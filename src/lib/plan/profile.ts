// Turns the intake draft into a validated Profile and a fresh Plan.
import { addDays } from "@/lib/format";
import { LIMITS } from "@/lib/types";
import type { IntakeDraft, Plan, Profile, WeddingFunction } from "@/lib/types";

/** The opening questions already settle these, so they start as done. */
const TASKS_DONE_AT_INTAKE = ["finalise-dates", "agree-budget", "guest-estimate"];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const cleanTexts = (items: string[], max: number) =>
  [...new Set(items.map((s) => s.trim().slice(0, LIMITS.textChars)).filter(Boolean))].slice(0, max);

type ReadyDraft = IntakeDraft & {
  weddingDate: string;
  city: string;
  guests: number;
  budget: number;
};

/** True once the four required answers (date, city, guests, budget) are present. */
export function isDraftReady(draft: IntakeDraft): draft is ReadyDraft {
  return draft.weddingDate !== null && !!draft.city?.trim() && draft.guests !== null && draft.budget !== null;
}

function draftFunctions(draft: ReadyDraft, guests: number): WeddingFunction[] {
  // The wedding is always on the wedding date; for any other kind the first mention wins.
  const others = draft.functions.filter(
    (f, i, all) => f.kind !== "wedding" && all.findIndex((o) => o.kind === f.kind) === i,
  );
  const weddingDay: WeddingFunction = { kind: "wedding", date: draft.weddingDate, guests };
  return [
    weddingDay,
    ...others.map((f) => ({
      kind: f.kind,
      date: addDays(draft.weddingDate, clamp(f.dayOffset, -LIMITS.functionOffsetDays, LIMITS.functionOffsetDays)),
      guests: clamp(f.guests ?? guests, LIMITS.guests.min, LIMITS.guests.max),
    })),
  ];
}

/** Turns a ready draft into a full profile, applying defaults and clamping to the schema ranges. Throws if the draft is not ready. */
export function draftToProfile(draft: IntakeDraft): Profile {
  if (!isDraftReady(draft)) throw new Error("Draft needs a date, city, guest count and budget before planning");
  const guests = clamp(draft.guests, LIMITS.guests.min, LIMITS.guests.max);
  return {
    city: draft.city.trim().slice(0, LIMITS.cityChars),
    cityTier: draft.cityTier ?? "tier2",
    guests,
    budget: clamp(draft.budget, LIMITS.budget.min, LIMITS.budget.max),
    functions: draftFunctions(draft, guests),
    style: draft.style ?? "classic",
    categoryStyles: {},
    priorities: [...new Set(draft.priorities)].slice(0, LIMITS.priorities),
    mustHaves: cleanTexts(draft.mustHaves, LIMITS.mustHaves),
    notes: cleanTexts(draft.notes, LIMITS.notes),
  };
}

/** An empty plan around `profile`, with the tasks the opening questions already settle marked done. */
export function newPlan(profile: Profile): Plan {
  return {
    version: 1,
    profile,
    budget: {},
    tasks: Object.fromEntries(TASKS_DONE_AT_INTAKE.map((id) => [id, { status: "done", delayedTo: null }])),
    quotes: [],
    vendors: [],
    checked: {},
    ideas: [],
  };
}
