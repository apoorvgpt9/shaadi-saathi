import { newPlan } from "@/lib/plan/profile";
import type { Plan, Profile, Quote } from "@/lib/types";

export const TODAY = "2026-10-29";
/** About four months after TODAY, like the explainer's scenario. */
export const WEDDING_DATE = "2027-03-01";

export const BASE_PROFILE: Profile = {
  city: "Jaipur",
  cityTier: "tier2",
  guests: 200,
  budget: 800_000,
  functions: [
    { kind: "wedding", date: WEDDING_DATE, guests: 200 },
    { kind: "mehendi", date: "2027-02-28", guests: 120 },
  ],
  style: "classic",
  categoryStyles: {},
  priorities: ["catering"],
  mustHaves: [],
  notes: [],
};

/** The sanity scenario: Tier-2, Classic, wedding for 200 plus mehendi for 120, budget 8 lakh. */
export function makePlan(profile: Partial<Profile> = {}): Plan {
  return newPlan({ ...BASE_PROFILE, ...profile });
}

export function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "q1",
    category: "catering",
    vendorName: "Sharma Caterers",
    total: 250_000,
    guestsCovered: 200,
    inclusions: [],
    extraCharges: [],
    openQuestions: [],
    ...overrides,
  };
}
