// Builds the Claude tool definitions for plan changes from the PlanChange schema.
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { PlanChange } from "@/lib/types";

const DESCRIPTIONS: Record<PlanChange["type"], string> = {
  set_guests:
    "Set the guest count. Use function 'all' to scale every function proportionally to a new wedding-day headcount.",
  set_budget: "Set the total budget in rupees (for example 7 lakh = 700000).",
  shift_dates:
    "Move every function by a number of days. Negative means earlier, positive means later.",
  set_function_date: "Move one function to a specific date (YYYY-MM-DD).",
  add_function:
    "Add a function (haldi, mehendi, sangeet, wedding, reception) with a date and guest count.",
  remove_function: "Remove a function from the plan.",
  set_style:
    "Change the style level. category null changes everything; otherwise only that category.",
  set_priorities:
    "Replace the ranked list of categories the family cares about most, most important first.",
  set_task_status:
    "Mark one checklist task done, to do, or delayed. Use a task id from the provided list.",
  add_note:
    "Record a preference or constraint (culture, ages, accessibility, atmosphere) as a short note.",
};

/**
 * One strict tool per PlanChange variant, named by its `type`, which therefore is not part of the
 * input.
 */
export const CHANGE_TOOLS: Anthropic.Beta.BetaTool[] = PlanChange.options.map((variant) => {
  const name = variant.shape.type.value;
  const input = z.object(
    Object.fromEntries(Object.entries(variant.shape).filter(([key]) => key !== "type")),
  );
  const { schema } = zodOutputFormat(input);
  return {
    name,
    description: DESCRIPTIONS[name],
    strict: true,
    input_schema: { ...schema, type: "object" as const },
  };
});
