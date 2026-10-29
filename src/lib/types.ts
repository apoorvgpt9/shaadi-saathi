import { z } from "zod";

// Shared contract between the planning engine, the AI routes and the UI.
// Stored state is validated with these schemas; derived views are plain types.

export const FUNCTION_KINDS = ["haldi", "mehendi", "sangeet", "wedding", "reception"] as const;
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
export const CITY_TIERS = ["metro", "tier2", "town"] as const;

export const FunctionKind = z.enum(FUNCTION_KINDS);
export const CategoryId = z.enum(CATEGORY_IDS);
export const Style = z.enum(STYLES);
export const CityTier = z.enum(CITY_TIERS);
export const IsoDate = z.iso.date();

const Guests = z.number().int().min(1).max(5000);
const Rupees = z.number().int().min(0).max(1_000_000_000);
const ShortText = z.string().trim().min(1).max(300);

export const WeddingFunction = z.object({
  kind: FunctionKind,
  date: IsoDate,
  guests: Guests,
});

/** A complete profile. `guests` is the wedding-day headcount; a "wedding" function always exists. */
export const Profile = z.object({
  city: z.string().trim().min(1).max(80),
  cityTier: CityTier,
  guests: Guests,
  budget: Rupees.min(10_000),
  functions: z
    .array(WeddingFunction)
    .min(1)
    .max(5)
    .refine((fns) => fns.some((f) => f.kind === "wedding"), "A wedding function is required"),
  style: Style,
  categoryStyles: z.partialRecord(CategoryId, Style),
  priorities: z.array(CategoryId).max(5),
  mustHaves: z.array(ShortText).max(10),
  notes: z.array(ShortText).max(20),
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

export const PriceStatus = z.enum(["estimate", "quoted", "confirmed"]);
export const TaskStatus = z.enum(["todo", "done", "delayed"]);

export const Quote = z.object({
  id: z.string().min(1).max(64),
  category: CategoryId,
  vendorName: z.string().max(120),
  total: Rupees,
  guestsCovered: z.number().int().nullable(),
  inclusions: z.array(z.string().max(300)).max(30),
  extraCharges: z.array(z.object({ item: z.string().max(300), amount: Rupees.nullable() })).max(30),
  openQuestions: z.array(z.string().max(300)).max(20),
});

export const VendorChecklist = z.object({
  category: CategoryId,
  needs: z.array(z.string().max(300)).max(8),
  questions: z.array(z.string().max(300)).max(8),
  confirmBeforeBooking: z.array(z.string().max(300)).max(8),
});

export const Idea = z.object({
  title: z.string().max(120),
  description: z.string().max(600),
  costImpact: z.enum(["saves", "within", "adds"]),
  fitsBecause: z.string().max(300),
});

export const FunctionIdeas = z.object({ kind: FunctionKind, ideas: z.array(Idea).max(5) });

/** User-controlled state for one budget category. */
export const BudgetEntry = z.object({
  override: Rupees.nullable(),
  quoteId: z.string().nullable(),
  confirmed: z.boolean(),
});

export const TaskState = z.object({ status: TaskStatus, delayedTo: IsoDate.nullable() });

/** Everything persisted in localStorage. Budget lines and the schedule are derived from it. */
export const Plan = z.object({
  version: z.literal(1),
  profile: Profile,
  budget: z.partialRecord(CategoryId, BudgetEntry),
  tasks: z.record(z.string(), TaskState),
  quotes: z.array(Quote).max(30),
  vendors: z.array(VendorChecklist),
  /** Ticked checklist items, keyed `${category}:${section}:${index}`. */
  checked: z.record(z.string(), z.boolean()),
  ideas: z.array(FunctionIdeas),
});

/** One structured edit. The change route exposes each variant to Claude as a tool named by `type`. */
export const PlanChange = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_guests"), function: z.union([FunctionKind, z.literal("all")]), count: Guests }),
  z.object({ type: z.literal("set_budget"), amount: Rupees.min(10_000) }),
  z.object({ type: z.literal("shift_dates"), days: z.number().int().min(-365).max(365) }),
  z.object({ type: z.literal("set_function_date"), function: FunctionKind, date: IsoDate }),
  z.object({ type: z.literal("add_function"), function: FunctionKind, date: IsoDate, guests: Guests }),
  z.object({ type: z.literal("remove_function"), function: FunctionKind }),
  z.object({ type: z.literal("set_style"), style: Style, category: CategoryId.nullable() }),
  z.object({ type: z.literal("set_priorities"), priorities: z.array(CategoryId).max(5) }),
  z.object({
    type: z.literal("set_task_status"),
    taskId: z.string().min(1).max(64),
    status: TaskStatus,
    delayedTo: IsoDate.nullable(),
  }),
  z.object({ type: z.literal("add_note"), note: ShortText }),
]);

export type FunctionKind = z.infer<typeof FunctionKind>;
export type CategoryId = z.infer<typeof CategoryId>;
export type Style = z.infer<typeof Style>;
export type CityTier = z.infer<typeof CityTier>;
export type WeddingFunction = z.infer<typeof WeddingFunction>;
export type Profile = z.infer<typeof Profile>;
export type IntakeDraft = z.infer<typeof IntakeDraft>;
export type PriceStatus = z.infer<typeof PriceStatus>;
export type TaskStatus = z.infer<typeof TaskStatus>;
export type Quote = z.infer<typeof Quote>;
export type VendorChecklist = z.infer<typeof VendorChecklist>;
export type Idea = z.infer<typeof Idea>;
export type FunctionIdeas = z.infer<typeof FunctionIdeas>;
export type BudgetEntry = z.infer<typeof BudgetEntry>;
export type TaskState = z.infer<typeof TaskState>;
export type Plan = z.infer<typeof Plan>;
export type PlanChange = z.infer<typeof PlanChange>;

// Derived views (computed by the engine, never stored).

export interface BudgetLine {
  category: CategoryId;
  amount: number;
  /** The benchmark estimate, kept even when overridden or quoted, for comparison. */
  estimate: number;
  status: PriceStatus;
  /** Human-readable basis, e.g. "Benchmark (Tier-2, Classic): ₹1,000/plate × 200 at Wedding". */
  source: string;
}

export interface BudgetSummary {
  lines: BudgetLine[];
  total: number;
  budget: number;
  /** total / budget, e.g. 1.2 = 20% over. */
  ratio: number;
}

export type TaskFlag = "urgent" | "at_risk" | "clash";

export interface ScheduledTask {
  id: string;
  title: string;
  category: CategoryId | null;
  anchor: FunctionKind;
  dependsOn: string[];
  due: string;
  status: TaskStatus;
  flags: TaskFlag[];
}

export interface Lever {
  id: string;
  label: string;
  changes: PlanChange[];
  saving: number;
  /** True when the lever lowers the style of one of the user's priority categories. */
  touchesPriority: boolean;
}

export interface ChangeSummary {
  lines: { category: CategoryId; before: number; after: number }[];
  totalBefore: number;
  totalAfter: number;
  budgetBefore: number;
  budgetAfter: number;
  newlyUrgent: string[];
  newlyAtRisk: string[];
  newlyClashing: string[];
  notes: string[];
}

// API contracts for the AI routes (request bodies are validated server-side).

const ChatMessage = z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) });

export const IntakeRequest = z.object({
  messages: z.array(ChatMessage).min(1).max(20),
  draft: IntakeDraft.nullable(),
  today: IsoDate,
});
export const IntakeResponse = z.object({ reply: z.string(), draft: IntakeDraft });

export const IdeasRequest = z.object({
  profile: Profile,
  function: FunctionKind.nullable(),
  feedback: z.string().trim().max(2000).nullable(),
  previous: z.array(FunctionIdeas),
});
export const IdeasResponse = z.object({ ideas: z.array(FunctionIdeas) });

export const VendorsRequest = z.object({ profile: Profile });
export const VendorsResponse = z.object({ vendors: z.array(VendorChecklist) });

export const ChangeRequest = z.object({
  message: z.string().trim().min(1).max(2000),
  profile: Profile,
  tasks: z.array(z.object({ id: z.string(), title: z.string(), status: TaskStatus })).max(60),
  today: IsoDate,
});
export const ChangeResponse = z.object({ changes: z.array(PlanChange), reply: z.string().nullable() });

export const QuoteRequest = z.object({
  text: z.string().trim().min(20).max(6000),
  category: CategoryId,
  guests: Guests,
});
export const QuoteResponse = z.object({ quote: Quote.omit({ id: true }) });

export const TradeoffsRequest = z.object({
  profile: Profile,
  total: Rupees,
  levers: z
    .array(z.object({ id: z.string(), label: z.string(), saving: Rupees, touchesPriority: z.boolean() }))
    .min(1)
    .max(40),
});
export const TradeoffsResponse = z.object({
  options: z.array(z.object({ title: z.string(), leverIds: z.array(z.string()).min(1), why: z.string() })).max(3),
});

export type ApiErrorCode = "invalid_input" | "rate_limited" | "ai_unavailable" | "ai_error" | "refused";
export interface ApiError {
  error: { code: ApiErrorCode; message: string };
}
