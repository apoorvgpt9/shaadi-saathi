import { describe, expect, it } from "vitest";
import { applyChanges, summarizeChange } from "@/lib/plan/changes";
import { computeBudget } from "@/lib/plan/budget";
import { draftToProfile, isDraftReady, newPlan } from "@/lib/plan/profile";
import { Plan } from "@/lib/types";
import type { IntakeDraft, PlanChange } from "@/lib/types";
import { makePlan, makeQuote, TODAY } from "./plan-fixtures";

const EXPLAINER_CHANGES: PlanChange[] = [
  { type: "set_guests", function: "all", count: 250 },
  { type: "set_budget", amount: 700_000 },
  { type: "shift_dates", days: -14 },
];

const guestsAt = (plan: Plan, kind: string) => plan.profile.functions.find((f) => f.kind === kind)?.guests;

describe("applyChanges", () => {
  it("applies the explainer scenario: +50 guests, budget 7 lakh, two weeks earlier", () => {
    const before = makePlan();
    const { plan, ignored } = applyChanges(before, EXPLAINER_CHANGES);
    expect(ignored).toEqual([]);
    expect(plan.profile.guests).toBe(250);
    expect(plan.profile.budget).toBe(700_000);
    expect(plan.profile.functions.map((f) => f.date)).toEqual(["2027-02-15", "2027-02-14"]);
    expect(guestsAt(plan, "mehendi")).toBe(150); // scaled by 250/200
    expect(Plan.safeParse(plan).success).toBe(true);
  });

  it("does not mutate the input plan", () => {
    const before = makePlan();
    const snapshot = structuredClone(before);
    applyChanges(before, EXPLAINER_CHANGES);
    expect(before).toEqual(snapshot);
  });

  it("sets wedding guests without touching other functions", () => {
    const { plan } = applyChanges(makePlan(), [{ type: "set_guests", function: "wedding", count: 300 }]);
    expect(plan.profile.guests).toBe(300);
    expect(guestsAt(plan, "wedding")).toBe(300);
    expect(guestsAt(plan, "mehendi")).toBe(120);
  });

  it("sets a global style, or one category's style", () => {
    const global = applyChanges(makePlan(), [{ type: "set_style", style: "premium", category: null }]).plan;
    expect(global.profile.style).toBe("premium");
    const one = applyChanges(makePlan(), [{ type: "set_style", style: "simple", category: "decor" }]).plan;
    expect(one.profile.style).toBe("classic");
    expect(one.profile.categoryStyles.decor).toBe("simple");
  });

  it("ignores removing the wedding, with a reason", () => {
    const { plan, ignored } = applyChanges(makePlan(), [{ type: "remove_function", function: "wedding" }]);
    expect(plan.profile.functions).toHaveLength(2);
    expect(ignored).toHaveLength(1);
    expect(ignored[0]).toMatch(/wedding/i);
  });

  it("removes and adds optional functions, ignoring duplicates and missing ones", () => {
    const removed = applyChanges(makePlan(), [{ type: "remove_function", function: "mehendi" }]);
    expect(removed.plan.profile.functions.map((f) => f.kind)).toEqual(["wedding"]);
    const { plan, ignored } = applyChanges(makePlan(), [
      { type: "add_function", function: "sangeet", date: "2027-02-27", guests: 150 },
      { type: "add_function", function: "mehendi", date: "2027-02-27", guests: 50 },
      { type: "remove_function", function: "haldi" },
      { type: "set_function_date", function: "haldi", date: "2027-02-26" },
      { type: "set_guests", function: "haldi", count: 20 },
    ]);
    expect(plan.profile.functions.map((f) => f.kind)).toEqual(["wedding", "mehendi", "sangeet"]);
    expect(ignored).toHaveLength(4);
  });

  it("dedupes notes and caps them at 20", () => {
    const first = applyChanges(makePlan(), [
      { type: "add_note", note: "Elders need seating" },
      { type: "add_note", note: "elders need seating" },
    ]).plan;
    expect(first.profile.notes).toEqual(["Elders need seating"]);
    const full = makePlan({ notes: Array.from({ length: 20 }, (_, i) => `note ${i}`) });
    const { plan, ignored } = applyChanges(full, [{ type: "add_note", note: "one more" }]);
    expect(plan.profile.notes).toHaveLength(20);
    expect(ignored).toHaveLength(1);
  });

  it("updates task status, rejecting unknown tasks and delays without a date", () => {
    const { plan, ignored } = applyChanges(makePlan(), [
      { type: "set_task_status", taskId: "book-venue", status: "delayed", delayedTo: "2026-12-01" },
      { type: "set_task_status", taskId: "book-caterer", status: "delayed", delayedTo: null },
      { type: "set_task_status", taskId: "nonsense", status: "done", delayedTo: null },
    ]);
    expect(plan.tasks["book-venue"]).toEqual({ status: "delayed", delayedTo: "2026-12-01" });
    expect(plan.tasks["book-caterer"]).toBeUndefined();
    expect(ignored).toHaveLength(2);
  });

  it("skips a change that would make the plan invalid instead of throwing", () => {
    const { plan, ignored } = applyChanges(makePlan(), [
      { type: "shift_dates", days: 365 },
      { type: "set_function_date", function: "wedding", date: "not-a-date" },
    ]);
    expect(plan.profile.functions[0].date).toBe("2028-02-29");
    expect(ignored).toHaveLength(1);
  });
});

describe("summarizeChange", () => {
  const before = makePlan();
  const after = applyChanges(before, EXPLAINER_CHANGES).plan;

  it("shows a deeper over-budget ratio and higher catering for the explainer scenario", () => {
    const summary = summarizeChange(before, after, TODAY);
    expect(summary.totalAfter).toBeGreaterThan(summary.totalBefore);
    expect(summary.budgetBefore).toBe(800_000);
    expect(summary.budgetAfter).toBe(700_000);
    expect(summary.totalAfter / summary.budgetAfter).toBeGreaterThan(summary.totalBefore / summary.budgetBefore);
    const catering = summary.lines.find((l) => l.category === "catering");
    expect(catering).toBeDefined();
    expect(catering!.after).toBeGreaterThan(catering!.before);
  });

  it("lists only the lines that changed", () => {
    const summary = summarizeChange(before, after, TODAY);
    expect(summary.lines.every((l) => l.before !== l.after)).toBe(true);
    const unchanged = computeBudget(before).lines.find((l) => l.category === "rituals");
    expect(summary.lines.some((l) => l.category === unchanged?.category)).toBe(false);
    expect(summarizeChange(before, before, TODAY).lines).toEqual([]);
  });

  it("names tasks that newly became urgent when the wedding moves earlier", () => {
    const summary = summarizeChange(before, after, TODAY);
    expect(summary.newlyUrgent).toEqual(expect.arrayContaining(["Book caterer", "Book photographer and videographer"]));
    expect(summary.newlyUrgent).not.toContain("Shortlist and book venue(s)"); // already urgent before
  });

  it("notes the new wedding date, and venue and caterer follow-ups only when quoted or confirmed", () => {
    const plain = summarizeChange(before, after, TODAY);
    expect(plain.notes).toEqual(["Wedding moved from 1 Mar 2027 to 15 Feb 2027"]);

    const booked = makePlan();
    booked.quotes = [makeQuote({ category: "catering" }), makeQuote({ id: "q2", category: "venue" })];
    booked.budget.catering = { override: null, quoteId: "q1", confirmed: false };
    booked.budget.venue = { override: null, quoteId: "q2", confirmed: true };
    const bookedAfter = applyChanges(booked, EXPLAINER_CHANGES).plan;
    expect(summarizeChange(booked, bookedAfter, TODAY).notes).toEqual(
      expect.arrayContaining(["Check your venue holds 250 guests", "Send your caterer the new headcount"]),
    );
  });

  it("adds no capacity notes when guests fall", () => {
    const fewer = applyChanges(before, [{ type: "set_guests", function: "all", count: 150 }]).plan;
    expect(summarizeChange(before, fewer, TODAY).notes).toEqual([]);
  });
});

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

  it("refuses to build a profile from an unready draft", () => {
    expect(() => draftToProfile({ ...draft, budget: null })).toThrow();
  });

  it("marks the questions the intake already answered as done", () => {
    const plan = newPlan(draftToProfile(draft));
    expect(Object.keys(plan.tasks).sort()).toEqual(["agree-budget", "finalise-dates", "guest-estimate"]);
  });
});
