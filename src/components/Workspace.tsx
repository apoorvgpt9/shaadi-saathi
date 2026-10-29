import type { CSSProperties, ReactNode } from "react";
import type { BudgetSummary, Profile, ScheduledTask } from "@/lib/types";
import { BudgetMeter } from "@/components/BudgetMeter";
import { ChangeBox, type ChangeOutcome } from "@/components/ChangeBox";
import { NextTasks } from "@/components/NextTasks";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { shortDate } from "@/components/present";
import { SiteHeader } from "@/components/SiteHeader";

export type TabId = "budget" | "timeline" | "vendors" | "ideas";

const TABS: { id: TabId; label: string; empty: string }[] = [
  { id: "budget", label: "Budget", empty: "Every budget line, with its basis and status, will list here." },
  { id: "timeline", label: "Timeline", empty: "Your tasks, grouped by month and ordered by what depends on what." },
  { id: "vendors", label: "Vendors", empty: "A checklist per vendor category, and a place to compare quotes." },
  { id: "ideas", label: "Ideas", empty: "Ideas for each function, matched to your budget and your family." },
];

interface Props {
  profile: Profile;
  budget: BudgetSummary;
  nextTasks: ScheduledTask[];
  /** Tab contents; a tab without one shows a short placeholder. */
  panels?: Partial<Record<TabId, ReactNode>>;
  onChange: (text: string) => Promise<ChangeOutcome>;
  onReset: () => void;
}

export function Workspace({ profile, budget, nextTasks, panels = {}, onChange, onReset }: Props) {
  const wedding = profile.functions.find((f) => f.kind === "wedding");
  const meta = [profile.city, wedding && shortDate(wedding.date, true), `${profile.guests.toLocaleString("en-IN")} guests`];

  return (
    <>
      <SiteHeader>
        <Button variant="ghost" onClick={onReset}>
          Start over
        </Button>
      </SiteHeader>
      <main id="main" className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
        <section aria-labelledby="plan-title" className="reveal pb-8 pt-10">
          <p className="eyebrow">Your plan</p>
          <h1 id="plan-title" className="mt-2 font-serif text-3xl leading-[1.1] tracking-[-0.02em] sm:text-4xl">
            {meta.filter(Boolean).join(" · ")}
          </h1>
        </section>
        <div className="space-y-6">
          <section aria-label="Budget at a glance" className="card reveal p-6 sm:p-8" style={{ "--i": 1 } as CSSProperties}>
            <BudgetMeter summary={budget} />
          </section>
          <ChangeBox onSubmit={onChange} />
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Tabs
              label="Plan sections"
              tabs={TABS.map((t) => ({
                id: t.id,
                label: t.label,
                panel: panels[t.id] ?? <p className="card p-8 text-muted">{t.empty}</p>,
              }))}
            />
            <div className="lg:sticky lg:top-6">
              <NextTasks tasks={nextTasks} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
