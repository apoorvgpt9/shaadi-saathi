import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteCompare } from "@/components/QuoteCompare";
import { VendorsTab } from "@/components/VendorsTab";
import { api } from "@/lib/api";
import { computeBudget } from "@/lib/plan/budget";
import type { Plan, Quote, VendorChecklist } from "@/lib/types";
import { makePlan, makeQuote } from "../plan-fixtures";
import { expectAccessible, failed, freezeToday, ok } from "./helpers";

const CATERING: VendorChecklist = {
  category: "catering",
  needs: ["Veg and Jain menus", "Live counters"],
  questions: ["Is tasting included?"],
  confirmBeforeBooking: ["Staff count"],
};

const withVendors = (extra: Partial<Plan> = {}): Plan => ({
  ...makePlan({ budget: 2_000_000 }),
  vendors: [CATERING],
  ...extra,
});

const noRefresh = { stale: false, busy: false, onRefresh: vi.fn() };

/** Holds the plan so ticks, quotes and removals flow back into the tab like they do in the app. */
function VendorsHarness({ initial, onPlan = vi.fn() }: { initial: Plan; onPlan?: (plan: Plan) => void }) {
  const [plan, setPlan] = useState(initial);
  return (
    <VendorsTab
      plan={plan}
      summary={computeBudget(plan)}
      onUpdate={(update) => {
        const next = update(plan);
        onPlan(next);
        setPlan(next);
      }}
      refresh={noRefresh}
    />
  );
}

beforeEach(freezeToday);
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("VendorsTab checklists", () => {
  it("renders each checklist section as a labelled group and the honesty note", async () => {
    const { container } = render(<VendorsHarness initial={withVendors()} />);
    expect(screen.getByRole("heading", { name: "Catering" })).toBeInTheDocument();
    for (const name of ["What you need", "Questions to ask", "Confirm before booking"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
    expect(screen.getByText(/Confirm with the vendor before booking\./)).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("persists a ticked item through onUpdate and keeps it ticked", async () => {
    const onPlan = vi.fn<(plan: Plan) => void>();
    const user = userEvent.setup();
    const { container } = render(<VendorsHarness initial={withVendors()} onPlan={onPlan} />);

    const box = screen.getByRole("checkbox", { name: "Live counters" });
    expect(box).not.toBeChecked();
    await user.click(box);

    expect(onPlan.mock.lastCall?.[0].checked).toEqual({ "catering:needs:1": true });
    expect(box).toBeChecked();
    await expectAccessible(container);

    await user.click(box);
    expect(onPlan.mock.lastCall?.[0].checked).toEqual({ "catering:needs:1": false });
    expect(box).not.toBeChecked();
  });

  it("shows ticks that were saved earlier", () => {
    render(<VendorsHarness initial={withVendors({ checked: { "catering:questions:0": true } })} />);
    expect(screen.getByRole("checkbox", { name: "Is tasting included?" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Staff count" })).not.toBeChecked();
  });

  it("warns that the checklists are stale and lets the user refresh them", async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <VendorsTab
        plan={withVendors()}
        summary={computeBudget(withVendors())}
        onUpdate={vi.fn()}
        refresh={{ stale: true, busy: false, onRefresh }}
      />,
    );
    expect(screen.getByText(/Your plan has changed since these checklists were written/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh checklists" }));
    expect(onRefresh).toHaveBeenCalledOnce();
    await expectAccessible(container);
  });

  it("disables the refresh button while it is busy", () => {
    render(
      <VendorsTab
        plan={withVendors()}
        summary={computeBudget(withVendors())}
        onUpdate={vi.fn()}
        refresh={{ stale: true, busy: true, onRefresh: vi.fn() }}
      />,
    );
    expect(screen.getByRole("button", { name: "Refreshing" })).toBeDisabled();
  });
});

describe("VendorsTab quotes", () => {
  const cheap = makeQuote({ id: "q1", vendorName: "Sharma Caterers", total: 250_000, guestsCovered: 150 });
  const full = makeQuote({ id: "q2", vendorName: "Verma Foods", total: 300_000, guestsCovered: 200 });

  it("compares quotes, flags a quote that covers too few guests and uses the benchmark as reference", async () => {
    const { container } = render(<VendorsHarness initial={withVendors({ quotes: [cheap, full] })} />);

    const table = screen.getByRole("region", { name: "Quote comparison table" });
    expect(screen.getByText("Benchmark estimate for this line: ₹2,84,000")).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Sharma Caterers" })).toBeInTheDocument();
    expect(within(table).getByText("150 of 200")).toBeInTheDocument();
    expect(within(table).getByText("Short by 50")).toBeInTheDocument();
    expect(within(table).getByText("₹1,667")).toBeInTheDocument();
    expect(within(table).getByText("200 of 200")).toBeInTheDocument();
    expect(within(table).getAllByText("Short by 50")).toHaveLength(1);
    await expectAccessible(container);
  });

  it("switches the chosen quote to In use and moves it when another is picked", async () => {
    const user = userEvent.setup();
    const { container } = render(<VendorsHarness initial={withVendors({ quotes: [cheap, full] })} />);

    expect(screen.queryByRole("button", { name: "In use" })).not.toBeInTheDocument();
    const [first, second] = screen.getAllByRole("button", { name: "Use this quote" });
    assert(first !== undefined && second !== undefined);
    await user.click(first);

    expect(screen.getByRole("button", { name: "In use" })).toBeDisabled();
    expect(screen.getByText("In your budget")).toBeInTheDocument();
    await expectAccessible(container);

    await user.click(screen.getByRole("button", { name: "Use this quote" }));
    expect(screen.getAllByRole("button", { name: "In use" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Use this quote" })).toBeEnabled();
  });

  it("removes a quote, and frees the budget line it was used for", async () => {
    const onPlan = vi.fn<(plan: Plan) => void>();
    const user = userEvent.setup();
    const initial = withVendors({
      quotes: [cheap],
      budget: { catering: { override: null, quoteId: "q1", confirmed: false } },
    });
    const { container } = render(<VendorsHarness initial={initial} onPlan={onPlan} />);

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByText("Sharma Caterers")).not.toBeInTheDocument();
    expect(onPlan.mock.lastCall?.[0].budget.catering?.quoteId).toBeNull();
    await expectAccessible(container);
  });

  it("extracts a pasted quote and adds it to the comparison", async () => {
    const extracted: Omit<Quote, "id"> = { ...makeQuote(), vendorName: "Gupta Catering", total: 275_000 };
    const quote = vi.spyOn(api, "quote").mockResolvedValue(ok({ quote: extracted }));
    const user = userEvent.setup();
    const { container } = render(<VendorsHarness initial={withVendors()} />);

    await user.click(screen.getByText("Paste a quote"));
    const extract = screen.getByRole("button", { name: "Extract details" });
    expect(extract).toBeDisabled();
    await user.type(screen.getByLabelText(/Paste the vendor/), "Gupta Catering: 200 plates, 2.75 lakh all in");
    expect(extract).toBeEnabled();
    await user.click(extract);

    expect(quote.mock.lastCall?.[0]).toMatchObject({ category: "catering", guests: 200 });
    expect(await screen.findByRole("rowheader", { name: "Gupta Catering" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Paste the vendor/)).toHaveValue("");
    await expectAccessible(container);
  });

  it("keeps the pasted text and says what went wrong when extraction fails", async () => {
    vi.spyOn(api, "quote").mockResolvedValue(failed("ai_error", "That text has no total price."));
    const user = userEvent.setup();
    const { container } = render(<VendorsHarness initial={withVendors()} />);

    await user.click(screen.getByText("Paste a quote"));
    await user.type(screen.getByLabelText(/Paste the vendor/), "Please call me back about the menu");
    await user.click(screen.getByRole("button", { name: "Extract details" }));

    expect(await screen.findByText("That text has no total price. Your text is still here.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Paste the vendor/)).toHaveValue("Please call me back about the menu");
    await expectAccessible(container);
  });
});

describe("QuoteCompare", () => {
  const renderCompare = (quotes: Quote[]) =>
    render(
      <QuoteCompare
        quotes={quotes}
        needed={200}
        estimate="₹2,84,000"
        usedId={null}
        onUse={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

  it("says so when a quote leaves things unstated", async () => {
    const vague = makeQuote({
      vendorName: "",
      guestsCovered: null,
      extraCharges: [
        { item: "Corkage", amount: 5_000 },
        { item: "Late-night service", amount: null },
      ],
      openQuestions: ["Is GST included?"],
    });
    const { container } = renderCompare([vague]);

    expect(screen.getByRole("rowheader", { name: "Unnamed vendor" })).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("Not stated")).toBeInTheDocument();
    expect(screen.queryByText(/Short by/)).not.toBeInTheDocument();
    expect(screen.getByText("Corkage: ₹5,000")).toBeInTheDocument();
    expect(screen.getByText("Late-night service")).toBeInTheDocument();
    expect(screen.getByText("Is GST included?")).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("says None listed when there are no extra charges or open questions", () => {
    renderCompare([makeQuote()]);
    expect(screen.getAllByText("None listed")).toHaveLength(2);
  });
});
