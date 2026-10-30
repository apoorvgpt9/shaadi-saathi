// Benchmark rates, multipliers and display labels: the single home of the cost assumptions.
import type { CategoryId, CityTier, FunctionKind, Style } from "@/lib/types";

// Labelled assumptions: Tier-2 base values in rupees, October 2026. Not quotes from any vendor.

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  venue: "Venue",
  catering: "Catering",
  decor: "Decor",
  photography: "Photography",
  attire: "Attire",
  makeup: "Makeup and mehendi artist",
  entertainment: "Entertainment",
  rituals: "Rituals and pandit",
  invitations: "Invitations",
  transport: "Transport",
  contingency: "Contingency",
};

export const FUNCTION_LABELS: Record<FunctionKind, string> = {
  haldi: "Haldi",
  mehendi: "Mehendi",
  sangeet: "Sangeet",
  wedding: "Wedding",
  reception: "Reception",
};

export const STYLE_LABELS: Record<Style, string> = {
  simple: "Simple",
  classic: "Classic",
  premium: "Premium",
};
export const CITY_TIER_LABELS: Record<CityTier, string> = {
  metro: "Metro",
  tier2: "Tier-2",
  town: "Town",
};

export const TIER_MULTIPLIER: Record<CityTier, number> = { metro: 1.5, tier2: 1, town: 0.7 };
export const CONTINGENCY_RATE = 0.07;
/** Every budget line is rounded to this many rupees. */
export const ROUNDING_STEP = 1000;
/** Each function beyond the wedding day adds this share of the photography base. */
export const EXTRA_FUNCTION_PHOTO_SHARE = 0.25;

export type WeightKind = "menu" | "size" | "entertainment";

export const FUNCTION_WEIGHTS: Record<WeightKind, Record<FunctionKind, number>> = {
  menu: { haldi: 0.5, mehendi: 0.7, sangeet: 0.9, wedding: 1, reception: 1 },
  size: { haldi: 0.3, mehendi: 0.5, sangeet: 0.8, wedding: 1, reception: 0.9 },
  entertainment: { haldi: 0, mehendi: 0, sangeet: 1, wedding: 0.6, reception: 0.6 },
};

type Rates = Record<Style, number>;

interface ModelBase {
  /** False for categories that do not vary with the city (rituals). */
  tiered: boolean;
  /** Shown after the source line when the category has a known exclusion. */
  note?: string;
}

export type CostModel = ModelBase &
  (
    | { kind: "per_guest_per_function"; rates: Rates; weight: WeightKind; unit: string }
    | { kind: "per_function"; rates: Rates; weight: WeightKind }
    | { kind: "photography"; rates: Rates }
    | {
        kind: "flat";
        rates: Rates;
        addOn?: { function: FunctionKind; label: string; rates: Rates };
      }
    | { kind: "per_wedding_guest"; rates: Rates }
  );

export const BENCHMARKS: Record<Exclude<CategoryId, "contingency">, CostModel> = {
  catering: {
    kind: "per_guest_per_function",
    tiered: true,
    unit: "plate",
    weight: "menu",
    rates: { simple: 600, classic: 1000, premium: 1800 },
  },
  venue: {
    kind: "per_guest_per_function",
    tiered: true,
    unit: "guest",
    weight: "size",
    rates: { simple: 150, classic: 350, premium: 800 },
  },
  decor: {
    kind: "per_function",
    tiered: true,
    weight: "size",
    rates: { simple: 30_000, classic: 75_000, premium: 200_000 },
  },
  photography: {
    kind: "photography",
    tiered: true,
    rates: { simple: 40_000, classic: 100_000, premium: 250_000 },
  },
  attire: {
    kind: "flat",
    tiered: true,
    note: "Excludes gold jewellery.",
    rates: { simple: 50_000, classic: 120_000, premium: 300_000 },
  },
  makeup: {
    kind: "flat",
    tiered: true,
    rates: { simple: 15_000, classic: 35_000, premium: 80_000 },
    addOn: {
      function: "mehendi",
      label: "mehendi artist",
      rates: { simple: 5000, classic: 12_000, premium: 30_000 },
    },
  },
  entertainment: {
    kind: "per_function",
    tiered: true,
    weight: "entertainment",
    rates: { simple: 15_000, classic: 40_000, premium: 120_000 },
  },
  rituals: {
    kind: "flat",
    tiered: false,
    rates: { simple: 11_000, classic: 21_000, premium: 51_000 },
  },
  invitations: {
    kind: "per_wedding_guest",
    tiered: true,
    rates: { simple: 60, classic: 150, premium: 400 },
  },
  transport: {
    kind: "flat",
    tiered: true,
    rates: { simple: 15_000, classic: 40_000, premium: 100_000 },
  },
};
