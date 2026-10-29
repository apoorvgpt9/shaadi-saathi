import { addDays } from "../format";
import type { IntakeDraft, Plan, Profile, WeddingFunction } from "../types";

const MIN_GUESTS = 1;
const MAX_GUESTS = 5000;
const MIN_BUDGET = 10_000;
const MAX_BUDGET = 1_000_000_000;
const MAX_CITY_LENGTH = 80;
const MAX_TEXT_LENGTH = 300;
const MAX_PRIORITIES = 5;
const MAX_MUST_HAVES = 10;
const MAX_NOTES = 20;
/** The opening questions already settle these, so they start as done. */
const TASKS_DONE_AT_INTAKE = ["finalise-dates", "agree-budget", "guest-estimate"];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const cleanTexts = (items: string[], max: number) =>
  [...new Set(items.map((s) => s.trim().slice(0, MAX_TEXT_LENGTH)).filter(Boolean))].slice(0, max);

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
      date: addDays(draft.weddingDate, f.dayOffset),
      guests: clamp(f.guests ?? guests, MIN_GUESTS, MAX_GUESTS),
    })),
  ];
}

/** Turns a ready draft into a full profile, applying defaults and clamping to the schema ranges. */
export function draftToProfile(draft: IntakeDraft): Profile {
  if (!isDraftReady(draft)) throw new Error("Draft needs a date, city, guest count and budget before planning");
  const guests = clamp(draft.guests, MIN_GUESTS, MAX_GUESTS);
  return {
    city: draft.city.trim().slice(0, MAX_CITY_LENGTH),
    cityTier: draft.cityTier ?? "tier2",
    guests,
    budget: clamp(draft.budget, MIN_BUDGET, MAX_BUDGET),
    functions: draftFunctions(draft, guests),
    style: draft.style ?? "classic",
    categoryStyles: {},
    priorities: [...new Set(draft.priorities)].slice(0, MAX_PRIORITIES),
    mustHaves: cleanTexts(draft.mustHaves, MAX_MUST_HAVES),
    notes: cleanTexts(draft.notes, MAX_NOTES),
  };
}

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
