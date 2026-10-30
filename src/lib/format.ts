// Display formatting (rupees, dates, plurals) and UTC date arithmetic shared by the engine and the UI.
const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const MS_PER_DAY = 86_400_000;
const LAKH = 100_000;
const CRORE = 10_000_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Full rupee amount with Indian digit grouping.
 *
 * @example
 * formatINR(800_000); // "₹8,00,000"
 * formatINR(1_250_000); // "₹12,50,000"
 */
export function formatINR(n: number): string {
  return INR.format(n);
}

/** A number with at most one decimal place, and no trailing ".0". */
function oneDecimal(n: number): string {
  return String(Number(n.toFixed(1)));
}

/**
 * Compact amount for headers: lakh and crore above a lakh, full rupees below.
 *
 * @example
 * formatLakh(800_000); // "₹8L"
 * formatLakh(958_000); // "₹9.6L"
 * formatLakh(12_000_000); // "₹1.2Cr"
 * formatLakh(75_000); // "₹75,000"
 */
export function formatLakh(n: number): string {
  // Choose the unit from the rounded lakh value, so ₹99.95L reads ₹1Cr rather than ₹100L.
  const roundsUpToCrore = Number((n / LAKH).toFixed(1)) >= 100;
  if (n >= CRORE || roundsUpToCrore) {
    return `₹${oneDecimal(n / CRORE)}Cr`;
  }
  if (n >= LAKH) {
    return `₹${oneDecimal(n / LAKH)}L`;
  }
  return formatINR(n);
}

// Dates are ISO strings (YYYY-MM-DD) handled in UTC so the user's timezone never shifts a day.
function toMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

/**
 * Shifts a YYYY-MM-DD date by `n` days (negative for earlier); pure, with no timezone or DST drift.
 *
 * @example
 * addDays("2027-03-01", -14); // "2027-02-15"
 * addDays("2028-02-28", 1); // "2028-02-29"
 */
export function addDays(iso: string, n: number): string {
  return new Date(toMs(iso) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

/** e.g. "15 Feb 2027". */
export function formatDate(iso: string): string {
  const date = new Date(toMs(iso));
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ""} ${date.getUTCFullYear()}`;
}

/** Share of the budget used, as a whole percent. Over budget it rounds up, so it never reads 100% while still over. */
export function pct(total: number, budget: number): number {
  const share = (total * 100) / budget;
  return total > budget ? Math.ceil(share) : Math.round(share);
}

/** A rupee difference with an explicit sign, e.g. +₹4,000. */
export function signed(n: number): string {
  let sign = "";
  if (n > 0) {
    sign = "+";
  } else if (n < 0) {
    sign = "-";
  }
  return `${sign}${formatINR(Math.abs(n))}`;
}

/** "1 guest", "250 guests". */
export function plural(n: number, word: string): string {
  const suffix = n === 1 ? "" : "s";
  return `${n.toLocaleString("en-IN")} ${word}${suffix}`;
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
