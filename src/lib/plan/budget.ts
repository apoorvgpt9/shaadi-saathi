// The budget engine: benchmark estimates per category, overlaid with the user's quotes, overrides and confirmations.
import { formatINR } from "@/lib/format";
import { CATEGORY_IDS } from "@/lib/types";
import type {
  BudgetLine,
  BudgetSummary,
  CategoryId,
  Plan,
  PriceStatus,
  Profile,
  Style,
} from "@/lib/types";
import {
  BENCHMARKS,
  CITY_TIER_LABELS,
  CONTINGENCY_RATE,
  EXTRA_FUNCTION_PHOTO_SHARE,
  FUNCTION_LABELS,
  FUNCTION_WEIGHTS,
  ROUNDING_STEP,
  STYLE_LABELS,
  TIER_MULTIPLIER,
} from "@/lib/plan/benchmarks";
import type { CostModel, WeightKind } from "@/lib/plan/benchmarks";

type BenchmarkCategory = keyof typeof BENCHMARKS;
type AddOn = NonNullable<Extract<CostModel, { kind: "flat" }>["addOn"]>;
type RateFor = (rates: Record<Style, number>) => number;

interface Estimate {
  amount: number;
  source: string;
}

/** A raw (unrounded) cost with the plain-words basis shown to the user. */
interface Costed {
  raw: number;
  basis: string;
}

/** Rounds a rupee amount to the nearest ROUNDING_STEP. */
function roundToStep(amount: number): number {
  return Math.round(amount / ROUNDING_STEP) * ROUNDING_STEP;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** "1 plate", "3 plates". Unlike format.plural it adds no digit grouping, which the basis text relies on. */
function plural(count: number, word: string): string {
  const suffix = count === 1 ? "" : "s";
  return `${count} ${word}${suffix}`;
}

/** The style in force for a category: its own override if set, otherwise the profile's style. */
export function effectiveStyle(profile: Profile, category: CategoryId): Style {
  return profile.categoryStyles[category] ?? profile.style;
}

/** Functions with a non-zero weight for this cost driver, with that weight. */
function weightedFunctions(profile: Profile, weight: WeightKind) {
  const weighted = profile.functions.map((f) => ({ f, weight: FUNCTION_WEIGHTS[weight][f.kind] }));
  return weighted.filter((part) => part.weight > 0);
}

/** Rate x guests x weight, summed over the weighted functions (catering plates, venue seats). */
function perGuestPerFunction(
  rate: number,
  weight: WeightKind,
  unit: string,
  profile: Profile,
): Costed {
  const parts = weightedFunctions(profile, weight);
  const text = parts.map(({ f, weight: partWeight }) => {
    const weightNote = partWeight < 1 ? ` (×${partWeight})` : "";
    return `${plural(f.guests, unit)} at ${FUNCTION_LABELS[f.kind]}${weightNote}`;
  });
  return {
    raw: sum(parts.map(({ f, weight: partWeight }) => rate * f.guests * partWeight)),
    basis: `${formatINR(rate)}/${unit} × ${text.join(" + ")}`,
  };
}

/** One rate per function, scaled by that function's weight (decor, rituals). */
function perFunction(rate: number, weight: WeightKind, profile: Profile): Costed {
  const parts = weightedFunctions(profile, weight);
  const text = parts.map(
    ({ f, weight: partWeight }) => `${FUNCTION_LABELS[f.kind]} (×${partWeight})`,
  );
  return {
    raw: sum(parts.map(({ weight: partWeight }) => rate * partWeight)),
    basis: `${formatINR(rate)} per function, scaled by size: ${text.join(", ")}`,
  };
}

/** The wedding day at full rate, plus a share of it for each other function. */
function photography(rate: number, profile: Profile): Costed {
  const extras = profile.functions.length - 1;
  const share = EXTRA_FUNCTION_PHOTO_SHARE * 100;
  return {
    raw: rate * (1 + EXTRA_FUNCTION_PHOTO_SHARE * extras),
    basis: `${formatINR(rate)} for the wedding day + ${share}% for each of ${plural(extras, "other function")}`,
  };
}

/** A flat rate, plus an add-on that applies only when its function is in the plan. */
function flat(rate: number, addOn: AddOn | undefined, rateFor: RateFor, profile: Profile): Costed {
  if (!addOn) {
    return { raw: rate, basis: `${formatINR(rate)} flat` };
  }
  const hasAddOnFunction = profile.functions.some((f) => f.kind === addOn.function);
  if (!hasAddOnFunction) {
    return { raw: rate, basis: `${formatINR(rate)} flat` };
  }
  const addOnRate = rateFor(addOn.rates);
  return {
    raw: rate + addOnRate,
    basis: `${formatINR(rate)} flat + ${formatINR(addOnRate)} ${addOn.label}`,
  };
}

/** A rate per wedding-day guest. */
function perWeddingGuest(rate: number, profile: Profile): Costed {
  return {
    raw: rate * profile.guests,
    basis: `${formatINR(rate)}/guest × ${profile.guests} wedding guests`,
  };
}

/** Raw (unrounded) cost and a plain-words basis for one category. */
function applyModel(model: CostModel, rateFor: RateFor, profile: Profile): Costed {
  const rate = rateFor(model.rates);
  switch (model.kind) {
    case "per_guest_per_function":
      return perGuestPerFunction(rate, model.weight, model.unit, profile);
    case "per_function":
      return perFunction(rate, model.weight, profile);
    case "photography":
      return photography(rate, profile);
    case "flat":
      return flat(rate, model.addOn, rateFor, profile);
    case "per_wedding_guest":
      return perWeddingGuest(rate, profile);
  }
}

function estimateCategory(category: BenchmarkCategory, profile: Profile): Estimate {
  const model = BENCHMARKS[category];
  const style = effectiveStyle(profile, category);
  const multiplier = model.tiered ? TIER_MULTIPLIER[profile.cityTier] : 1;
  const { raw, basis } = applyModel(model, (rates) => rates[style] * multiplier, profile);
  const scope = model.tiered
    ? `${CITY_TIER_LABELS[profile.cityTier]}, ${STYLE_LABELS[style]}`
    : STYLE_LABELS[style];
  const note = model.note ? ` ${model.note}` : "";
  return { amount: roundToStep(raw), source: `Benchmark (${scope}): ${basis}.${note}` };
}

/** Applies the user's quote, override and confirmation to a benchmark estimate. */
function resolveLine(plan: Plan, category: CategoryId, estimate: Estimate): BudgetLine {
  const entry = plan.budget[category];
  const quote = plan.quotes.find((q) => q.id === entry?.quoteId);
  let amount = estimate.amount;
  let status: PriceStatus = "estimate";
  let source = estimate.source;
  if (quote) {
    amount = quote.total;
    status = "quoted";
    source = `Quote from ${quote.vendorName || "vendor"}: ${formatINR(quote.total)}`;
  } else if (entry?.override != null) {
    amount = entry.override;
    source = `Your figure. ${estimate.source}`;
  }
  if (entry?.confirmed) {
    status = "confirmed";
  }
  return { category, amount, estimate: estimate.amount, status, source };
}

/**
 * The full budget: one line per category plus a contingency line, rounded to ROUNDING_STEP rupees.
 * Pure and deterministic; every figure is computed here, never by the AI.
 *
 * @example
 * // Jaipur (Tier-2), Classic, wedding for 200 plus mehendi for 120, budget Rs 8,00,000
 * const { total, budget, ratio } = computeBudget(plan);
 * // total === 958_000, budget === 800_000, ratio === 1.1975 (about 120% of budget)
 */
export function computeBudget(plan: Plan): BudgetSummary {
  const benchmarkCategories = CATEGORY_IDS.filter(
    (c): c is BenchmarkCategory => c !== "contingency",
  );
  const benchmarked = benchmarkCategories.map((category) =>
    resolveLine(plan, category, estimateCategory(category, plan.profile)),
  );
  const contingency = resolveLine(plan, "contingency", {
    amount: roundToStep(sum(benchmarked.map((l) => l.amount)) * CONTINGENCY_RATE),
    source: `${Math.round(CONTINGENCY_RATE * 100)}% of all other lines, kept aside for surprises.`,
  });
  const lines = [...benchmarked, contingency];
  const total = sum(lines.map((l) => l.amount));
  return { lines, total, budget: plan.profile.budget, ratio: total / plan.profile.budget };
}
