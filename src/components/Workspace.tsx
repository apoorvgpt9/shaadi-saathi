import type { CSSProperties, ReactNode } from "react";
import { formatDate, plural } from "@/lib/format";
import type { BudgetSummary, Profile, ScheduledTask } from "@/lib/types";
import { BudgetMeter } from "@/components/BudgetMeter";
import { NextTasks } from "@/components/NextTasks";
import { StartOver } from "@/components/ui/StartOver";
import { Tabs } from "@/components/ui/Tabs";
import { SiteHeader } from "@/components/SiteHeader";

type TabId = "budget" | "timeline" | "vendors" | "ideas";

const TABS: { id: TabId; label: string }[] = [
  { id: "budget", label: "Budget" },
  { id: "timeline", label: "Timeline" },
  { id: "vendors", label: "Vendors" },
  { id: "ideas", label: "Ideas" },
];

interface Props {
  profile: Profile;
  budget: BudgetSummary;
  nextTasks: ScheduledTask[];
  panels: Record<TabId, ReactNode>;
  /** The "What changed?" box, which owns its request state in PlanScreen. */
  changeBox: ReactNode;
  onReset: () => void;
}

export function Workspace({ profile, budget, nextTasks, panels, changeBox, onReset }: Props) {
  const wedding = profile.functions.find((f) => f.kind === "wedding");
  const meta = [profile.city, wedding && formatDate(wedding.date), plural(profile.guests, "guest")];

  return (
    <>
      <SiteHeader>
        <StartOver onConfirm={onReset} />
      </SiteHeader>
      <main id="main" className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
        <section aria-labelledby="plan-title" className="reveal pb-8 pt-10">
          <p className="eyebrow">Your plan</p>
          <h1
            id="plan-title"
            className="mt-2 font-serif text-3xl leading-[1.1] tracking-[-0.02em] wrap-anywhere sm:text-4xl"
          >
            {meta.filter(Boolean).join(" · ")}
          </h1>
        </section>
        <div className="space-y-6">
          <section
            aria-label="Budget at a glance"
            className="card reveal p-6 sm:p-8"
            style={{ "--i": 1 } as CSSProperties}
          >
            <BudgetMeter summary={budget} />
          </section>
          {changeBox}
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Tabs label="Plan sections" tabs={TABS.map((t) => ({ ...t, panel: panels[t.id] }))} />
            {/* Above the tabs on small screens, where the sidebar would otherwise sit below the whole budget list. */}
            <div className="order-first lg:order-none lg:sticky lg:top-6">
              <NextTasks tasks={nextTasks} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
