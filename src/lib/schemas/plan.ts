// Everything stored in localStorage, the vendor and idea payloads in it, and the edits to it.
import {
  CategoryId,
  FunctionKind,
  Guests,
  IsoDate,
  Profile,
  Rupees,
  ShortText,
  Style,
} from "./domain";
import { LIMITS } from "./limits";
import { z } from "zod";

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
  quotes: z.array(Quote).max(LIMITS.quotes),
  vendors: z.array(VendorChecklist),
  /** Ticked checklist items, keyed `${category}:${section}:${index}`. */
  checked: z.record(z.string(), z.boolean()),
  ideas: z.array(FunctionIdeas),
});

/**
 * One structured edit. The change route exposes each variant to Claude as a tool named by `type`.
 */
export const PlanChange = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("set_guests"),
    function: z.union([FunctionKind, z.literal("all")]),
    count: Guests,
  }),
  z.object({ type: z.literal("set_budget"), amount: Rupees.min(LIMITS.budget.min) }),
  z.object({ type: z.literal("shift_dates"), days: z.number().int().min(-365).max(365) }),
  z.object({ type: z.literal("set_function_date"), function: FunctionKind, date: IsoDate }),
  z.object({
    type: z.literal("add_function"),
    function: FunctionKind,
    date: IsoDate,
    guests: Guests,
  }),
  z.object({ type: z.literal("remove_function"), function: FunctionKind }),
  z.object({ type: z.literal("set_style"), style: Style, category: CategoryId.nullable() }),
  z.object({
    type: z.literal("set_priorities"),
    priorities: z.array(CategoryId).max(LIMITS.priorities),
  }),
  z.object({
    type: z.literal("set_task_status"),
    taskId: z.string().min(1).max(64),
    status: TaskStatus,
    delayedTo: IsoDate.nullable(),
  }),
  z.object({ type: z.literal("add_note"), note: ShortText }),
]);

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
