// Every size limit in the contract, as one constant.

/** Every size limit in the contract, so schemas, engine and UI never disagree. */
export const LIMITS = {
  guests: { min: 1, max: 5000 },
  budget: { min: 10_000, max: 1_000_000_000 },
  functions: 5,
  cityChars: 80,
  textChars: 300,
  mustHaves: 10,
  notes: 20,
  priorities: 5,
  quotes: 30,
  quoteChars: 6000,
  quoteMinChars: 20,
  messageChars: 2000,
  chatMessages: 20,
  /** Functions sit within a week of the wedding day; anything further is out of scope. */
  functionOffsetDays: 7,
} as const;
