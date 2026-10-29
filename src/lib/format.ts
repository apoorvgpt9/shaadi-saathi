const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const MS_PER_DAY = 86_400_000;
const LAKH = 100_000;
const CRORE = 10_000_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Full rupee amount with Indian digit grouping, e.g. ₹8,00,000. */
export function formatINR(n: number): string {
  return INR.format(n);
}

const oneDecimal = (n: number) => String(Number(n.toFixed(1)));

/** Compact amount for headers, e.g. ₹8L, ₹9.6L, ₹1.2Cr. */
export function formatLakh(n: number): string {
  // Choose the unit from the rounded lakh value, so ₹99.95L reads ₹1Cr rather than ₹100L.
  if (n >= CRORE || Number((n / LAKH).toFixed(1)) >= 100) return `₹${oneDecimal(n / CRORE)}Cr`;
  if (n >= LAKH) return `₹${oneDecimal(n / LAKH)}L`;
  return formatINR(n);
}

// Dates are ISO strings (YYYY-MM-DD) handled in UTC so the user's timezone never shifts a day.
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function addDays(iso: string, n: number): string {
  return new Date(toMs(iso) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

/** e.g. "15 Feb 2027". */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Share of the budget used, as a whole percent. Over budget it rounds up, so it never reads 100% while still over. */
export function pct(total: number, budget: number): number {
  const share = (total * 100) / budget;
  return total > budget ? Math.ceil(share) : Math.round(share);
}

/** A rupee difference with an explicit sign, e.g. +₹4,000. */
export function signed(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}${formatINR(Math.abs(n))}`;
}

/** "1 guest", "250 guests". */
export function plural(n: number, word: string): string {
  return `${n.toLocaleString("en-IN")} ${word}${n === 1 ? "" : "s"}`;
}

/** Items grouped by the YYYY-MM of their `due` date, in first-seen order. */
export function groupByMonth<T extends { due: string }>(items: T[]): [month: string, items: T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const month = item.due.slice(0, 7);
    groups.set(month, [...(groups.get(month) ?? []), item]);
  }
  return [...groups];
}
