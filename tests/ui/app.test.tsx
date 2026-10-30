import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/components/App";
import { api } from "@/lib/api";
import { STORAGE_KEY } from "@/lib/store";
import type { FunctionIdeas, IntakeDraft, Plan, PlanChange, VendorChecklist } from "@/lib/types";
import { makePlan } from "../plan-fixtures";
import { expectAccessible, failed, freezeToday, ok } from "./helpers";

const DRAFT: IntakeDraft = {
  weddingDate: "2027-03-01",
  city: "Jaipur",
  cityTier: "tier2",
  guests: 200,
  budget: 800_000,
  functions: [{ kind: "mehendi", dayOffset: -1, guests: 120 }],
  style: "classic",
  priorities: ["catering"],
  mustHaves: [],
  notes: [],
};

const CHECKLIST: VendorChecklist = {
  category: "catering",
  needs: ["Veg and Jain menus"],
  questions: ["Is tasting included?"],
  confirmBeforeBooking: ["Staff count"],
};

const IDEAS: FunctionIdeas[] = [
  {
    kind: "wedding",
    ideas: [
      {
        title: "Marigold mandap",
        description: "Seasonal flowers.",
        costImpact: "saves",
        fitsBecause: "Cuts decor.",
      },
    ],
  },
  { kind: "mehendi", ideas: [] },
];

const savedPlan = (extra: Partial<Plan> = {}): Plan => ({
  ...makePlan(),
  vendors: [CHECKLIST],
  ideas: IDEAS,
  ...extra,
});

const save = (plan: Plan) => {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ stage: "plan", messages: [], draft: null, plan }),
  );
};

const mockLoad = () => ({
  vendors: vi.spyOn(api, "vendors").mockResolvedValue(ok({ vendors: [CHECKLIST] })),
  ideas: vi.spyOn(api, "ideas").mockResolvedValue(ok({ ideas: IDEAS })),
});

const setBudget = (amount: number): PlanChange[] => [{ type: "set_budget", amount }];

async function submitChange(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByLabelText("What changed?"), text);
  await user.click(screen.getByRole("button", { name: "Review changes" }));
}

beforeEach(() => {
  freezeToday();
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("App intake", () => {
  it("starts on the intake screen with Build disabled", async () => {
    const { container } = render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Plan the wedding");
    expect(screen.getByRole("button", { name: "Build my plan" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Start over" })).not.toBeInTheDocument();
    await expectAccessible(container);
  });

  it("chats, builds the plan, loads vendors and ideas, and saves it in the browser", async () => {
    vi.spyOn(api, "intake").mockResolvedValue(
      ok({ reply: "Lovely, I have the essentials.", draft: DRAFT }),
    );
    const { vendors, ideas } = mockLoad();
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole("button", { name: "Try an example" }));
    expect(await screen.findByText("Lovely, I have the essentials.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Build my plan" }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Jaipur · 1 Mar 2027 · 200 guests",
    );
    expect(vendors).toHaveBeenCalledOnce();
    expect(ideas).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("tab", { name: "Vendors" }));
    expect(await screen.findByRole("checkbox", { name: "Veg and Jain menus" })).toBeInTheDocument();
    const stored = window.localStorage.getItem(STORAGE_KEY);
    assert(stored !== null);
    expect(stored).toContain('"stage":"plan"');
    await expectAccessible(container);
  });

  it("offers Start over once the chat has begun, and clears the conversation after confirming", async () => {
    vi.spyOn(api, "intake").mockResolvedValue(ok({ reply: "Noted.", draft: DRAFT }));
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Your message"), "Jaipur{Enter}");
    expect(await screen.findByText("Noted.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.click(screen.getByRole("button", { name: "Start over" }));

    expect(screen.queryByText("Noted.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build my plan" })).toBeDisabled();
  });
});

describe("App plan", () => {
  it("opens a saved plan straight away and ignores damaged storage", async () => {
    save(savedPlan());
    const { container, unmount } = render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: /Jaipur/ })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Next 3 things to do" })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Estimated ₹9\.6L against a budget of ₹8L/ }),
    ).toBeInTheDocument();
    await expectAccessible(container);
    unmount();

    window.localStorage.setItem(STORAGE_KEY, '{"stage":"plan"');
    render(<App />);
    expect(screen.getByRole("button", { name: "Build my plan" })).toBeInTheDocument();
  });

  it("opens the four tabs with the budget first, and every panel mounted", async () => {
    save(savedPlan());
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Budget",
      "Timeline",
      "Vendors",
      "Ideas",
    ]);
    expect(screen.getByRole("tab", { name: "Budget" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Ideas" }));
    expect(screen.getByRole("heading", { name: "Marigold mandap" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get ideas for Mehendi" })).toBeInTheDocument();
  });

  it("shows a calm retry when vendors and ideas could not load, then recovers", async () => {
    save(savedPlan({ vendors: [], ideas: [] }));
    const user = userEvent.setup();
    const vendors = vi.spyOn(api, "vendors").mockResolvedValue(failed("network"));
    vi.spyOn(api, "ideas").mockResolvedValue(failed("network"));
    const { container } = render(<App />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getByRole("tab", { name: "Vendors" }));
    const panel = screen.getByRole("tabpanel", { name: "Vendors" });
    expect(within(panel).getByText("vendor checklists have not loaded yet")).toBeInTheDocument();
    vendors.mockResolvedValue(ok({ vendors: [CHECKLIST] }));
    vi.spyOn(api, "ideas").mockResolvedValue(ok({ ideas: IDEAS }));
    await user.click(within(panel).getByRole("button", { name: "Load vendor checklists" }));

    expect(await within(panel).findByRole("checkbox", { name: "Staff count" })).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("reports a failed load in plain words", async () => {
    save(savedPlan({ vendors: [], ideas: [] }));
    const user = userEvent.setup();
    vi.spyOn(api, "vendors").mockResolvedValue(failed("network"));
    vi.spyOn(api, "ideas").mockResolvedValue(failed("network"));
    render(<App />);
    await screen.findByRole("heading", { level: 1 });
    await user.click(screen.getByRole("tab", { name: "Vendors" }));
    await user.click(screen.getByRole("button", { name: "Load vendor checklists" }));

    const panel = screen.getByRole("tabpanel", { name: "Vendors" });
    expect(await within(panel).findByText("You appear to be offline")).toBeInTheDocument();
    expect(within(panel).getByText(/Budget and timeline still work\./)).toBeInTheDocument();
  });

  it("marks a task done from the timeline", async () => {
    save(savedPlan());
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getByRole("tab", { name: "Timeline" }));
    const status = within(screen.getByRole("group", { name: "Status of Book caterer" }));
    await user.click(status.getByRole("button", { name: "Done" }));

    expect(status.getByRole("button", { name: "Done" })).toHaveAttribute("aria-pressed", "true");
  });

  it("loads ideas from their own tab when they are missing", async () => {
    save(savedPlan({ ideas: [] }));
    const ideas = vi.spyOn(api, "ideas").mockResolvedValue(ok({ ideas: IDEAS }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getByRole("tab", { name: "Ideas" }));
    await user.click(screen.getByRole("button", { name: "Load ideas" }));

    expect(await screen.findByRole("heading", { name: "Marigold mandap" })).toBeInTheDocument();
    expect(ideas).toHaveBeenCalledOnce();
  });

  it("stays quiet when a load was cancelled by Start over", async () => {
    save(savedPlan({ vendors: [], ideas: [] }));
    vi.spyOn(api, "vendors").mockResolvedValue(failed("aborted"));
    vi.spyOn(api, "ideas").mockResolvedValue(failed("aborted"));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getByRole("tab", { name: "Vendors" }));
    await user.click(screen.getByRole("button", { name: "Load vendor checklists" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Loading vendor checklists");
    expect(screen.queryByText("That request was cancelled")).not.toBeInTheDocument();
  });

  it("proposes a change, shows it for review and applies it only on Accept", async () => {
    save(savedPlan());
    vi.spyOn(api, "change").mockResolvedValue(ok({ changes: setBudget(1_200_000), reply: null }));
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText(/20% over ·/)).toBeInTheDocument();

    await submitChange(user, "budget now 12 lakh");
    const dialog = await screen.findByRole("dialog", { name: "What changed" });
    expect(within(dialog).getByText("Budget now ₹12,00,000")).toBeInTheDocument();
    expect(screen.getByText(/20% over ·/)).toBeInTheDocument();
    await expectAccessible(container);

    await user.click(within(dialog).getByRole("button", { name: "Accept" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/Within budget/)).toBeInTheDocument();
    expect(screen.getByLabelText("What changed?")).toHaveValue("");
  });

  it("leaves the plan alone on Undo and keeps the request for editing", async () => {
    save(savedPlan());
    vi.spyOn(api, "change").mockResolvedValue(ok({ changes: setBudget(1_200_000), reply: null }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { level: 1 });

    await submitChange(user, "budget now 12 lakh");
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Undo" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/20% over ·/)).toBeInTheDocument();
    expect(screen.getByLabelText("What changed?")).toHaveValue("budget now 12 lakh");
  });

  it("relays the assistant's question, or says nothing was understood", async () => {
    save(savedPlan());
    const change = vi
      .spyOn(api, "change")
      .mockResolvedValueOnce(
        ok({ changes: [], reply: "Which function should have 50 more guests?" }),
      )
      .mockResolvedValueOnce(ok({ changes: [], reply: null }))
      .mockResolvedValueOnce(failed("timeout"));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { level: 1 });
    await user.type(screen.getByLabelText("What changed?"), "more guests");

    await user.click(screen.getByRole("button", { name: "Review changes" }));
    expect(
      await screen.findByText("Which function should have 50 more guests?"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review changes" }));
    expect(await screen.findByText(/I could not find a change in that/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review changes" }));
    expect(await screen.findByText(/This is taking longer than usual/)).toBeInTheDocument();
    expect(change).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("flags the vendor checklists as stale after the profile changes, and refreshes them on request", async () => {
    vi.spyOn(api, "intake").mockResolvedValue(ok({ reply: "Ready.", draft: DRAFT }));
    const { vendors } = mockLoad();
    vi.spyOn(api, "change").mockResolvedValue(
      ok({ changes: [{ type: "set_guests", function: "all", count: 250 }], reply: null }),
    );
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Try an example" }));
    await screen.findByText("Ready.");
    await user.click(screen.getByRole("button", { name: "Build my plan" }));
    await user.click(screen.getByRole("tab", { name: "Vendors" }));
    await user.click(await screen.findByRole("checkbox", { name: "Staff count" }));
    expect(
      screen.queryByText(/Your plan has changed since these checklists/),
    ).not.toBeInTheDocument();

    await submitChange(user, "250 guests");
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Accept" }),
    );
    expect(
      await screen.findByText(/Your plan has changed since these checklists/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh checklists" }));

    expect(vendors).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("checkbox", { name: "Staff count" })).not.toBeChecked();
    expect(
      screen.queryByText(/Your plan has changed since these checklists/),
    ).not.toBeInTheDocument();
  });

  it("returns to the intake screen after Start over is confirmed", async () => {
    save(savedPlan());
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: /Jaipur/ });

    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.click(screen.getByRole("button", { name: "Start over" }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Plan the wedding");
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"stage":"intake"');
  });
});
