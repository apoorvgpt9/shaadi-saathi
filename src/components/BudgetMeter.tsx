// The budget bar: estimated total against budget, with the state also written in words.
import type { ReactElement } from "react";
import type { BudgetSummary } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { cssVars } from "@/components/ui/cssVars";
import { Icon } from "@/components/ui/icons";
import { formatLakh as lakh, pct } from "@/lib/format";

/**
 * Estimated total against budget. One bar, one axis: the part within budget is marigold, the
 * overage is maroon, and a tick marks the budget. State is also stated in words, so the bar never
 * carries it alone.
 */
export function BudgetMeter({ summary }: { summary: BudgetSummary }): ReactElement {
  const { total, budget } = summary;
  const over = total > budget;
  const scale = Math.max(total, budget) || 1;
  const within = (Math.min(total, budget) / scale) * 100;
  const percent = pct(total, budget);
  const description = `Estimated ${lakh(total)} against a budget of ${lakh(budget)}, ${percent}% of budget`;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="eyebrow">Estimated total</p>
          <p className="mt-1 text-5xl font-semibold leading-none tracking-tight">{lakh(total)}</p>
        </div>
        <div className="text-sm text-muted sm:text-right">
          <p>
            of <span className="font-medium text-ink">{lakh(budget)}</span> budget
          </p>
          <p className="mt-2">
            {over ? (
              <Badge tone="red">
                <Icon name="alert" className="size-3.5" />
                {percent - 100}% over · {lakh(total - budget)}
              </Badge>
            ) : (
              <Badge tone="green">
                <Icon name="check" className="size-3.5" />
                Within budget · {lakh(budget - total)} spare
              </Badge>
            )}
          </p>
        </div>
      </div>
      <div role="img" aria-label={description} className="relative mt-6">
        <div
          style={cssVars({ "--from": "scaleX(0.85)" })}
          className="reveal flex h-2 origin-left gap-0.5 overflow-hidden rounded-[4px] bg-sand"
        >
          <div
            className="rounded-[4px] bg-marigold ring-1 ring-inset ring-marigold-deep"
            style={{ flexBasis: `${within}%` }}
          />
          {over && (
            <div className="rounded-[4px] bg-maroon" style={{ flexBasis: `${100 - within}%` }} />
          )}
        </div>
        {over && (
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -top-1 w-0.5 rounded-full bg-ink"
            style={{ left: `${within}%` }}
          />
        )}
      </div>
    </div>
  );
}
