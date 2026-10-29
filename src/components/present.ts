import type { CategoryId, FunctionKind } from "@/lib/types";

// PHASE 2: replace these with formatINR/formatLakh/formatDate from "@/lib/format" and the labels from
// "@/lib/plan/benchmarks" once the engine is merged. They exist only because the engine is not on this branch yet.

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const inr = (n: number): string => rupees.format(n);

/** Compact lakh/crore form: Rs 8L, Rs 9.6L, Rs 1.2Cr. */
export function lakh(n: number): string {
  const trim = (x: number) => x.toFixed(1).replace(/\.0$/, "");
  if (n >= 1e7) return `₹${trim(n / 1e7)}Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5)}L`;
  return inr(n);
}

export const shortDate = (iso: string, withYear = false): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(withYear && { year: "numeric" }),
    timeZone: "UTC",
  });

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  venue: "Venue",
  catering: "Catering",
  decor: "Decor",
  photography: "Photography",
  attire: "Attire",
  makeup: "Makeup and mehendi",
  entertainment: "Entertainment",
  rituals: "Rituals",
  invitations: "Invitations",
  transport: "Transport",
  contingency: "Contingency",
};

export const FUNCTION_LABEL: Record<FunctionKind, string> = {
  haldi: "Haldi",
  mehendi: "Mehendi",
  sangeet: "Sangeet",
  wedding: "Wedding",
  reception: "Reception",
};
