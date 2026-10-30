import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartOver } from "@/components/ui/StartOver";
import { Tabs } from "@/components/ui/Tabs";
import { expectAccessible } from "./helpers";

const TABS = [
  { id: "budget", label: "Budget", panel: <input aria-label="Budget note" /> },
  { id: "timeline", label: "Timeline", panel: <p>Timeline content</p> },
  { id: "vendors", label: "Vendors", panel: <p>Vendors content</p> },
];

const renderTabs = () => render(<Tabs label="Plan sections" tabs={TABS} />);
const tab = (name: string) => screen.getByRole("tab", { name });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Tabs", () => {
  it("selects the first tab and names the tablist", async () => {
    const { container } = renderTabs();
    expect(screen.getByRole("tablist", { name: "Plan sections" })).toBeInTheDocument();
    expect(tab("Budget")).toHaveAttribute("aria-selected", "true");
    expect(tab("Timeline")).toHaveAttribute("aria-selected", "false");
    await expectAccessible(container);
  });

  it("makes only the selected tab a tab stop, and links each tab to its panel", () => {
    renderTabs();
    expect(tab("Budget")).toHaveAttribute("tabindex", "0");
    expect(tab("Timeline")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel", { name: "Budget" })).toBeVisible();
  });

  it("moves focus and selection together with the arrow keys, wrapping at both ends", async () => {
    const user = userEvent.setup();
    const { container } = renderTabs();

    tab("Budget").focus();
    await user.keyboard("{ArrowRight}");
    expect(tab("Timeline")).toHaveFocus();
    expect(tab("Timeline")).toHaveAttribute("aria-selected", "true");
    expect(tab("Budget")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel", { name: "Timeline" })).toBeVisible();
    await expectAccessible(container);

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(tab("Budget")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(tab("Vendors")).toHaveFocus();
    expect(tab("Vendors")).toHaveAttribute("aria-selected", "true");
  });

  it("jumps to the first and last tab with Home and End", async () => {
    const user = userEvent.setup();
    renderTabs();

    tab("Budget").focus();
    await user.keyboard("{End}");
    expect(tab("Vendors")).toHaveFocus();
    expect(tab("Vendors")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(tab("Budget")).toHaveFocus();
    expect(tab("Budget")).toHaveAttribute("aria-selected", "true");
  });

  it("selects a tab on click, and leaves other keys alone", async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(tab("Vendors"));
    expect(tab("Vendors")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(tab("Vendors")).toHaveAttribute("aria-selected", "true");
    expect(tab("Vendors")).toHaveFocus();
  });

  it("keeps every panel mounted, hiding the inactive ones, so typed text survives a switch", async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.type(screen.getByLabelText("Budget note"), "Ask about the venue");
    await user.click(tab("Timeline"));

    expect(screen.getByLabelText("Budget note", { selector: "input" })).not.toBeVisible();
    expect(screen.getByText("Timeline content")).toBeVisible();
    expect(screen.getByText("Vendors content")).not.toBeVisible();
    await user.click(tab("Budget"));
    expect(screen.getByLabelText("Budget note")).toHaveValue("Ask about the venue");
  });
});

describe("StartOver", () => {
  it("asks before it clears anything, and moves focus to the safe choice", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<StartOver onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Start over" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Confirm start over" })).toBeInTheDocument();
    expect(screen.getByText("This clears your plan from this browser.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep my plan" })).toHaveFocus();
    await expectAccessible(container);
  });

  it("clears only on the second, confirming click", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<StartOver onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.click(screen.getByRole("button", { name: "Start over" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("goes back to the first button on Keep my plan and returns focus to it", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<StartOver onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.click(screen.getByRole("button", { name: "Keep my plan" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Confirm start over" })).not.toBeInTheDocument();
    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: "Start over" })).toHaveFocus();
    });
  });

  it("backs out on Escape", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<StartOver onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.keyboard("a");
    expect(screen.getByRole("group", { name: "Confirm start over" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Confirm start over" })).not.toBeInTheDocument();
  });
});
