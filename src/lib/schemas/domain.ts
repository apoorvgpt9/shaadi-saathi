// The wedding itself: enums, the validated profile, and what the intake AI extracts to build one.
import { LIMITS } from "./limits";
import { z } from "zod";

const FUNCTION_KINDS = ["haldi", "mehendi", "sangeet", "wedding", "reception"] as const;
export const CATEGORY_IDS = [
  "venue",
  "catering",
  "decor",
  "photography",
  "attire",
  "makeup",
  "entertainment",
  "rituals",
  "invitations",
  "transport",
  "contingency",
] as const;
export const STYLES = ["simple", "classic", "premium"] as const;
const CITY_TIERS = ["metro", "tier2", "town"] as const;

export const FunctionKind = z.enum(FUNCTION_KINDS);
export const CategoryId = z.enum(CATEGORY_IDS);
export const Style = z.enum(STYLES);
export const CityTier = z.enum(CITY_TIERS);
export const IsoDate = z.iso.date();

// Shared field shapes; plan.ts and api.ts build on them.
export const Guests = z.number().int().min(LIMITS.guests.min).max(LIMITS.guests.max);
export const Rupees = z.number().int().min(0).max(LIMITS.budget.max);
export const ShortText = z.string().trim().min(1).max(LIMITS.textChars);

export const WeddingFunction = z.object({
  kind: FunctionKind,
  date: IsoDate,
  guests: Guests,
});

/** A complete profile. `guests` is the wedding-day headcount; a "wedding" function always exists. */
export const Profile = z.object({
  city: z.string().trim().min(1).max(LIMITS.cityChars),
  cityTier: CityTier,
  guests: Guests,
  budget: Rupees.min(LIMITS.budget.min),
  functions: z
    .array(WeddingFunction)
    .min(1)
    .max(LIMITS.functions)
    .refine((fns) => fns.some((f) => f.kind === "wedding"), "A wedding function is required"),
  style: Style,
  categoryStyles: z.partialRecord(CategoryId, Style),
  priorities: z.array(CategoryId).max(LIMITS.priorities),
  mustHaves: z.array(ShortText).max(LIMITS.mustHaves),
  notes: z.array(ShortText).max(LIMITS.notes),
});

/** What the intake AI extracts each turn. Nullable rather than optional to suit structured outputs. */
export const IntakeDraft = z.object({
  weddingDate: IsoDate.nullable(),
  city: z.string().nullable(),
  cityTier: CityTier.nullable(),
  guests: z.number().int().nullable(),
  budget: z.number().int().nullable(),
  /** dayOffset is relative to the wedding day, e.g. mehendi the day before = -1. */
  functions: z.array(
    z.object({ kind: FunctionKind, dayOffset: z.number().int(), guests: z.number().int().nullable() }),
  ),
  style: Style.nullable(),
  priorities: z.array(CategoryId),
  mustHaves: z.array(z.string()),
  notes: z.array(z.string()),
});

export type FunctionKind = z.infer<typeof FunctionKind>;
export type CategoryId = z.infer<typeof CategoryId>;
export type Style = z.infer<typeof Style>;
export type CityTier = z.infer<typeof CityTier>;
export type WeddingFunction = z.infer<typeof WeddingFunction>;
export type Profile = z.infer<typeof Profile>;
export type IntakeDraft = z.infer<typeof IntakeDraft>;
