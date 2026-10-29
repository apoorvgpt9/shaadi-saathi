import { describe, expect, it } from "vitest";
import { draftToProfile, isDraftReady, newPlan } from "@/lib/plan/profile";
import { Plan } from "@/lib/types";
import type { IntakeDraft } from "@/lib/types";

describe("profile helpers", () => {
  const draft: IntakeDraft = {
    weddingDate: "2027-03-01",
    city: " Jaipur ",
    cityTier: null,
    guests: 200,
    budget: 800_000,
    functions: [
      { kind: "mehendi", dayOffset: -1, guests: 120 },
      { kind: "sangeet", dayOffset: -2, guests: null },
      { kind: "mehendi", dayOffset: -3, guests: 10 },
    ],
    style: null,
    priorities: ["catering", "catering"],
    mustHaves: [" live music ", ""],
    notes: [],
  };

  it("is ready only with date, city, guests and budget", () => {
    expect(isDraftReady(draft)).toBe(true);
    expect(isDraftReady({ ...draft, budget: null })).toBe(false);
    expect(isDraftReady({ ...draft, city: "  " })).toBe(false);
    expect(isDraftReady({ ...draft, weddingDate: null })).toBe(false);
    expect(isDraftReady({ ...draft, guests: null })).toBe(false);
  });

  it("builds a valid profile with defaults, offsets and clamped numbers", () => {
    const profile = draftToProfile(draft);
    expect(profile).toMatchObject({ city: "Jaipur", cityTier: "tier2", style: "classic", guests: 200 });
    expect(profile.functions).toEqual([
      { kind: "wedding", date: "2027-03-01", guests: 200 },
      { kind: "mehendi", date: "2027-02-28", guests: 120 },
      { kind: "sangeet", date: "2027-02-27", guests: 200 },
    ]);
    expect(profile.priorities).toEqual(["catering"]);
    expect(profile.mustHaves).toEqual(["live music"]);
    expect(Plan.safeParse(newPlan(profile)).success).toBe(true);
  });

  it("defaults to a wedding-only plan and clamps out-of-range values", () => {
    const profile = draftToProfile({ ...draft, functions: [], guests: 99_999, budget: 5 });
    expect(profile.functions).toEqual([{ kind: "wedding", date: "2027-03-01", guests: 5000 }]);
    expect(profile.budget).toBe(10_000);
  });

  it("keeps functions within a week of the wedding, whatever offset the model gave", () => {
    const far = draftToProfile({
      ...draft,
      functions: [
        { kind: "mehendi", dayOffset: 1e10, guests: null },
        { kind: "sangeet", dayOffset: -3_000_000, guests: null },
        { kind: "haldi", dayOffset: -3, guests: null },
      ],
    });
    expect(far.functions.map((f) => f.date)).toEqual(["2027-03-01", "2027-03-08", "2027-02-22", "2027-02-26"]);
    expect(Plan.safeParse(newPlan(far)).success).toBe(true);
  });

  it("refuses to build a profile from an unready draft", () => {
    expect(() => draftToProfile({ ...draft, budget: null })).toThrow();
  });

  it("marks the questions the intake already answered as done", () => {
    const plan = newPlan(draftToProfile(draft));
    expect(Object.keys(plan.tasks).sort()).toEqual(["agree-budget", "finalise-dates", "guest-estimate"]);
  });
});
