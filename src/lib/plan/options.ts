// Validates the AI's trade-off options against the engine's levers and previews their effect.
import { pct } from "@/lib/format";
import { computeBudget } from "@/lib/plan/budget";
import { applyLevers } from "@/lib/plan/levers";
import type { Plan } from "@/lib/types";

export interface TradeoffOption {
  title: string;
  why: string;
  /** Engine lever ids; every figure shown for the option is recomputed from them. */
  ids: string[];
}

/** The AI's options with unknown lever ids dropped; an option left with no levers is dropped too. */
export function usableOptions(
  raw: { title: string; why: string; leverIds: string[] }[],
  levers: { id: string }[],
): TradeoffOption[] {
  const known = new Set(levers.map((l) => l.id));
  return raw.flatMap((o) => {
    const ids = o.leverIds.filter((id) => known.has(id));
    return ids.length > 0 ? [{ title: o.title, why: o.why, ids }] : [];
  });
}

/** What choosing an option would do to the plan as it stands now: money saved, % of budget used, and whether it fits. Pure. */
export function previewOption(plan: Plan, ids: string[]) {
  const now = computeBudget(plan);
  const next = computeBudget(applyLevers(plan, ids));
  return { saving: now.total - next.total, percent: pct(next.total, next.budget), within: next.total <= next.budget };
}
