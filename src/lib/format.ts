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
