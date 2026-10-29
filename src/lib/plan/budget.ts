import { formatINR } from "../format";
import { CATEGORY_IDS } from "../types";
import type { BudgetLine, BudgetSummary, CategoryId, Plan, PriceStatus, Profile, Style } from "../types";
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
} from "./benchmarks";
import type { CostModel, WeightKind } from "./benchmarks";

type BenchmarkCategory = keyof typeof BENCHMARKS;
interface Estimate {
  amount: number;
  source: string;
}

const roundToStep = (n: number) => Math.round(n / ROUNDING_STEP) * ROUNDING_STEP;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function effectiveStyle(profile: Profile, category: CategoryId): Style {
  return profile.categoryStyles[category] ?? profile.style;
}

type RateFor = (rates: Record<Style, number>) => number;

/** Functions with a non-zero weight for this cost driver, with that weight. */
function weightedFunctions(profile: Profile, weight: WeightKind) {
  return profile.functions
    .map((f) => ({ f, weight: FUNCTION_WEIGHTS[weight][f.kind] }))
    .filter((p) => p.weight > 0);
}

/** Raw (unrounded) cost and a plain-words basis for one category. */
function applyModel(model: CostModel, rateFor: RateFor, profile: Profile): { raw: number; basis: string } {
  const rate = rateFor(model.rates);
  switch (model.kind) {
    case "per_guest_per_function": {
      const parts = weightedFunctions(profile, model.weight);
      const text = parts.map(({ f, weight }) => {
        const weightNote = weight < 1 ? ` (×${weight})` : "";
        return `${plural(f.guests, model.unit)} at ${FUNCTION_LABELS[f.kind]}${weightNote}`;
      });
      return {
        raw: sum(parts.map(({ f, weight }) => rate * f.guests * weight)),
        basis: `${formatINR(rate)}/${model.unit} × ${text.join(" + ")}`,
      };
    }
    case "per_function": {
      const parts = weightedFunctions(profile, model.weight);
      const text = parts.map(({ f, weight }) => `${FUNCTION_LABELS[f.kind]} (×${weight})`);
      return {
        raw: sum(parts.map(({ weight }) => rate * weight)),
        basis: `${formatINR(rate)} per function, scaled by size: ${text.join(", ")}`,
      };
    }
    case "photography": {
      const extras = profile.functions.length - 1;
      const share = EXTRA_FUNCTION_PHOTO_SHARE * 100;
      return {
        raw: rate * (1 + EXTRA_FUNCTION_PHOTO_SHARE * extras),
        basis: `${formatINR(rate)} for the wedding day + ${share}% for each of ${plural(extras, "other function")}`,
      };
    }
    case "flat": {
      const { addOn } = model;
      if (!addOn || !profile.functions.some((f) => f.kind === addOn.function)) {
        return { raw: rate, basis: `${formatINR(rate)} flat` };
      }
      const addOnRate = rateFor(addOn.rates);
      return { raw: rate + addOnRate, basis: `${formatINR(rate)} flat + ${formatINR(addOnRate)} ${addOn.label}` };
    }
    case "per_wedding_guest":
      return { raw: rate * profile.guests, basis: `${formatINR(rate)}/guest × ${profile.guests} wedding guests` };
  }
}

function estimateCategory(category: BenchmarkCategory, profile: Profile): Estimate {
  const model = BENCHMARKS[category];
  const style = effectiveStyle(profile, category);
  const multiplier = model.tiered ? TIER_MULTIPLIER[profile.cityTier] : 1;
  const { raw, basis } = applyModel(model, (rates) => rates[style] * multiplier, profile);
  const scope = model.tiered ? `${CITY_TIER_LABELS[profile.cityTier]}, ${STYLE_LABELS[style]}` : STYLE_LABELS[style];
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
  if (entry?.confirmed) status = "confirmed";
  return { category, amount, estimate: estimate.amount, status, source };
}

export function computeBudget(plan: Plan): BudgetSummary {
  const benchmarked = CATEGORY_IDS.filter((c): c is BenchmarkCategory => c !== "contingency").map((category) =>
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
