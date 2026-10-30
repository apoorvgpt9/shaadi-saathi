import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetMeter } from "@/components/BudgetMeter";
import { BudgetTab } from "@/components/BudgetTab";
import { TradeoffPanel } from "@/components/TradeoffPanel";
import { api } from "@/lib/api";
import { computeBudget } from "@/lib/plan/budget";
import { listLevers } from "@/lib/plan/levers";
import type { Proposal } from "@/lib/store";
import type { Plan } from "@/lib/types";
import { makePlan, makeQuote } from "../plan-fixtures";
import { expectAccessible, failed, freezeToday, ok } from "./helpers";

// The default plan estimates about 9.6 lakh against 8 lakh, so it starts over budget.
const OVER = makePlan();
const WITHIN = makePlan({ budget: 2_000_000 });

beforeEach(freezeToday);
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Holds the plan so edits flow back into the tab like they do in the app. */
function BudgetHarness({ initial, onPropose = vi.fn() }: { initial: Plan; onPropose?: (build: Proposal) => void }) {
  const [plan, setPlan] = useState(initial);
  return <BudgetTab plan={plan} summary={computeBudget(plan)} onUpdate={setPlan} onPropose={onPropose} />;
}

function line(name: string): HTMLElement {
  const item = screen.getByRole("heading", { level: 3, name }).closest("li");
  assert(item !== null);
  return item;
}

describe("BudgetMeter", () => {
  it("says in words when the plan is over budget", async () => {
    const { container } = render(<BudgetMeter summary={computeBudget(OVER)} />);
    expect(screen.getByText("20% over · ₹1.6L")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName("Estimated ₹9.6L against a budget of ₹8L, 120% of budget");
    await expectAccessible(container);
  });

  it("says in words when the plan is within budget", async () => {
    const { container } = render(<BudgetMeter summary={computeBudget(WITHIN)} />);
    expect(screen.getByText("Within budget · ₹10.4L spare")).toBeInTheDocument();
    expect(screen.queryByText(/over ·/)).not.toBeInTheDocument();
    await expectAccessible(container);
  });
});

describe("BudgetTab", () => {
  it("labels every line as an estimate until it is quoted or confirmed", async () => {
    const { container } = render(<BudgetHarness initial={WITHIN} />);
    expect(screen.getAllByText("Estimate")).toHaveLength(11);
    expect(screen.queryByText("Quoted")).not.toBeInTheDocument();
    await expectAccessible(container);
  });

  it("shows Quoted for a line that uses a quote and Confirmed once the user confirms it", async () => {
    const plan: Plan = {
      ...WITHIN,
      quotes: [makeQuote({ total: 300_000, vendorName: "Sharma Caterers" })],
      budget: {
        catering: { override: null, quoteId: "q1", confirmed: false },
        venue: { override: null, quoteId: null, confirmed: true },
      },
    };
    const { container } = render(<BudgetHarness initial={plan} />);
    expect(within(line("Catering")).getByText("Quoted")).toBeInTheDocument();
    expect(within(line("Catering")).getByText("Quote from Sharma Caterers: ₹3,00,000")).toBeInTheDocument();
    expect(within(line("Venue")).getByText("Confirmed")).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("saves an override and keeps the benchmark visible for comparison", async () => {
    const user = userEvent.setup();
    const { container } = render(<BudgetHarness initial={WITHIN} />);

    await user.click(screen.getByRole("button", { name: "Edit amount for Venue" }));
    const field = screen.getByLabelText("Venue amount in rupees");
    await user.type(field, "150000");
    await expectAccessible(container);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(within(line("Venue")).getByText("₹1,50,000")).toBeInTheDocument();
    expect(within(line("Venue")).getByText("Benchmark ₹91,000")).toBeInTheDocument();
    expect(screen.queryByLabelText("Venue amount in rupees")).not.toBeInTheDocument();
  });

  it("returns a line to its estimate when the override is saved blank", async () => {
    const user = userEvent.setup();
    const plan: Plan = { ...WITHIN, budget: { venue: { override: 150_000, quoteId: null, confirmed: false } } };
    render(<BudgetHarness initial={plan} />);

    await user.click(screen.getByRole("button", { name: "Edit amount for Venue" }));
    await user.clear(screen.getByLabelText("Venue amount in rupees"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(within(line("Venue")).getByText("₹91,000")).toBeInTheDocument();
    expect(within(line("Venue")).queryByText(/^Benchmark ₹/)).not.toBeInTheDocument();
  });

  it("leaves the amount alone on Cancel", async () => {
    const user = userEvent.setup();
    const { container } = render(<BudgetHarness initial={WITHIN} />);

    await user.click(screen.getByRole("button", { name: "Edit amount for Venue" }));
    await user.type(screen.getByLabelText("Venue amount in rupees"), "999999");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(within(line("Venue")).getByText("₹91,000")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    await expectAccessible(container);
  });

  it("toggles Mark confirmed, announcing the state through aria-pressed", async () => {
    const user = userEvent.setup();
    const { container } = render(<BudgetHarness initial={WITHIN} />);

    const mark = within(line("Venue")).getByRole("button", { name: "Mark confirmed" });
    expect(mark).toHaveAttribute("aria-pressed", "false");
    await user.click(mark);

    const undo = within(line("Venue")).getByRole("button", { name: "Confirmed. Undo" });
    expect(undo).toHaveAttribute("aria-pressed", "true");
    expect(within(line("Venue")).getByText("Confirmed")).toBeInTheDocument();
    await expectAccessible(container);

    await user.click(undo);
    expect(within(line("Venue")).getByText("Estimate")).toBeInTheDocument();
  });

  it("offers the trade-off helper only when the plan is over budget", async () => {
    const { container, unmount } = render(<BudgetHarness initial={OVER} />);
    expect(screen.getByRole("heading", { name: "20% over budget" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Help me get back under budget" })).toBeInTheDocument();
    await expectAccessible(container);
    unmount();

    render(<BudgetHarness initial={WITHIN} />);
    expect(screen.queryByRole("button", { name: "Help me get back under budget" })).not.toBeInTheDocument();
  });
});

describe("TradeoffPanel", () => {
  const levers = listLevers(OVER);
  const total = computeBudget(OVER).total;
  const renderPanel = (onChoose: (build: Proposal) => void = vi.fn()) =>
    render(<TradeoffPanel plan={OVER} total={total} budget={OVER.profile.budget} onChoose={onChoose} />);

  const askFor = (...options: { title: string; leverIds: string[]; why: string }[]) =>
    vi.spyOn(api, "tradeoffs").mockResolvedValue(ok({ options }));

  it("shows each option with the engine's saving and a Within or Still over badge", async () => {
    // Skipping the mehendi saves 1.93 lakh, enough to fit; one catering step-down alone is not.
    askFor(
      { title: "Drop the mehendi", leverIds: ["skip-mehendi"], why: "Fewest guests of any function." },
      { title: "Simpler food", leverIds: ["step-down-catering"], why: "Food is your top priority, so use sparingly." },
    );
    const user = userEvent.setup();
    const { container } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Help me get back under budget" }));

    const drop = (await screen.findByRole("heading", { name: "Drop the mehendi" })).closest("li");
    assert(drop !== null);
    expect(within(drop).getByText("₹1,93,000")).toBeInTheDocument();
    expect(within(drop).getByText(/Within budget · 9\d%/)).toBeInTheDocument();
    const food = screen.getByRole("heading", { name: "Simpler food" }).closest("li");
    assert(food !== null);
    expect(within(food).getByText("₹1,22,000")).toBeInTheDocument();
    expect(within(food).getByText(/Still over · 10\d%/)).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("sends the engine's levers to the AI and proposes the chosen option's edit", async () => {
    const tradeoffs = askFor({ title: "Drop the mehendi", leverIds: ["skip-mehendi"], why: "Smallest function." });
    const onChoose = vi.fn<(build: Proposal) => void>();
    const user = userEvent.setup();
    renderPanel(onChoose);

    await user.click(screen.getByRole("button", { name: "Help me get back under budget" }));
    await user.click(await screen.findByRole("button", { name: "Choose this" }));

    expect(tradeoffs.mock.lastCall?.[0].levers).toHaveLength(levers.length);
    const build = onChoose.mock.lastCall?.[0];
    assert(build !== undefined);
    const { plan, ignored } = build(OVER);
    expect(plan.profile.functions.map((f) => f.kind)).toEqual(["wedding"]);
    expect(ignored).toEqual([]);
  });

  it("drops lever ids the engine does not know and says so when nothing is left", async () => {
    askFor({ title: "Invented saving", leverIds: ["not-a-lever"], why: "Made up." });
    const user = userEvent.setup();
    const { container } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Help me get back under budget" }));

    expect(await screen.findByText("No usable options came back. Try again.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Invented saving" })).not.toBeInTheDocument();
    await expectAccessible(container);
  });

  it("says so when there is nothing left to trim", async () => {
    const lean = makePlan({
      style: "simple",
      guests: 1,
      budget: 10_000,
      functions: [{ kind: "wedding", date: "2027-03-01", guests: 1 }],
    });
    const tradeoffs = vi.spyOn(api, "tradeoffs");
    const user = userEvent.setup();
    render(<TradeoffPanel plan={lean} total={computeBudget(lean).total} budget={10_000} onChoose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Help me get back under budget" }));

    expect(screen.getByText(/There is nothing left to trim automatically/)).toBeInTheDocument();
    expect(tradeoffs).not.toHaveBeenCalled();
  });

  it("explains a failed request and lets the user try again", async () => {
    vi.spyOn(api, "tradeoffs").mockResolvedValue(failed("rate_limited"));
    const user = userEvent.setup();
    const { container } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Help me get back under budget" }));

    expect(await screen.findByText(/That is a lot of requests at once/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Help me get back under budget" })).toBeEnabled();
    await expectAccessible(container);
  });
});
