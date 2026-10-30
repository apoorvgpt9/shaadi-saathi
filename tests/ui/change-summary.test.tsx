import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangeBox, type ChangeOutcome } from "@/components/ChangeBox";
import { ChangeSummaryPanel } from "@/components/ChangeSummaryPanel";
import { applyChanges } from "@/lib/plan/changes";
import { summarizeChange } from "@/lib/plan/summary";
import type { Pending } from "@/lib/store";
import { EXAMPLE_CHANGES, makePlan, TODAY } from "../plan-fixtures";
import { expectAccessible, freezeToday } from "./helpers";

beforeEach(freezeToday);
afterEach(() => {
  vi.useRealTimers();
});

function pendingFor(ignored: string[] = []): Pending {
  const before = makePlan();
  const { plan: after } = applyChanges(before, EXAMPLE_CHANGES);
  return {
    build: (p) => ({ plan: applyChanges(p, EXAMPLE_CHANGES).plan, ignored }),
    before,
    after,
    ignored,
    summary: summarizeChange(before, after, TODAY),
  };
}

describe("ChangeSummaryPanel", () => {
  it("opens as a labelled dialog and moves focus to its heading", async () => {
    const { container } = render(<ChangeSummaryPanel pending={pendingFor()} onAccept={vi.fn()} onUndo={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "What changed" });
    expect(dialog).toBeVisible();
    expect(screen.getByRole("heading", { name: "What changed" })).toHaveFocus();
    await expectAccessible(container);
  });

  it("summarises the totals, the budget change and each moved line", async () => {
    const { container } = render(<ChangeSummaryPanel pending={pendingFor()} onAccept={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.getByText("Budget now ₹7,00,000")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Budget lines" })).toBeInTheDocument();
    expect(screen.getByText("Estimated total")).toBeInTheDocument();
    expect(screen.getByText("Of budget")).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("lists newly urgent tasks, notes and the changes that were not applied", async () => {
    const pending = pendingFor(["Cannot remove the wedding function"]);
    pending.summary = {
      ...pending.summary,
      newlyUrgent: ["Book venue"],
      newlyAtRisk: ["Order outfits"],
      newlyClashing: ["Mehendi falls after the wedding"],
      notes: ["Send your caterer the new headcount"],
    };
    const { container } = render(<ChangeSummaryPanel pending={pending} onAccept={vi.fn()} onUndo={vi.fn()} />);

    for (const [title, item] of [
      ["Newly urgent", "Book venue"],
      ["Newly at risk", "Order outfits"],
      ["Now clashing with the wedding", "Mehendi falls after the wedding"],
      ["Worth checking", "Send your caterer the new headcount"],
      ["Not applied", "Cannot remove the wedding function"],
    ] as const) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getByText(item)).toBeInTheDocument();
    }
    await expectAccessible(container);
  });

  it("leaves out the lists that are empty", () => {
    const pending = pendingFor();
    pending.summary = { ...pending.summary, newlyUrgent: [], newlyAtRisk: [], newlyClashing: [], notes: [] };
    render(<ChangeSummaryPanel pending={pending} onAccept={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.queryByRole("heading", { name: "Newly urgent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Not applied" })).not.toBeInTheDocument();
  });

  it("calls onAccept for Accept and onUndo for Undo", async () => {
    const onAccept = vi.fn();
    const onUndo = vi.fn();
    const user = userEvent.setup();
    render(<ChangeSummaryPanel pending={pendingFor()} onAccept={onAccept} onUndo={onUndo} />);

    await user.click(screen.getByRole("button", { name: "Accept" }));
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onUndo).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("undoes on Escape, and never accepts", async () => {
    const onAccept = vi.fn();
    const onUndo = vi.fn();
    const user = userEvent.setup();
    render(<ChangeSummaryPanel pending={pendingFor()} onAccept={onAccept} onUndo={onUndo} />);

    await user.keyboard("{Escape}");

    expect(onUndo).toHaveBeenCalledOnce();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("undoes when the scrim behind the panel is clicked, but not when the panel is", async () => {
    const onUndo = vi.fn();
    const user = userEvent.setup();
    render(<ChangeSummaryPanel pending={pendingFor()} onAccept={vi.fn()} onUndo={onUndo} />);

    await user.click(screen.getByRole("heading", { name: "What changed" }));
    expect(onUndo).not.toHaveBeenCalled();
    await user.click(screen.getByRole("dialog"));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("keeps Tab inside the dialog by wrapping at both ends", async () => {
    const user = userEvent.setup();
    render(<ChangeSummaryPanel pending={pendingFor()} onAccept={vi.fn()} onUndo={vi.fn()} />);
    const undo = screen.getByRole("button", { name: "Undo" });

    undo.focus();
    await user.tab();
    expect(screen.getByRole("region", { name: "Proposed changes" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(undo).toHaveFocus();
  });

  it("returns focus to the element that opened it once it closes", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(<ChangeSummaryPanel pending={pendingFor()} onAccept={vi.fn()} onUndo={vi.fn()} />);
    expect(opener).not.toHaveFocus();

    unmount();

    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("falls back to the change box when the opener is gone", () => {
    const field = document.createElement("textarea");
    field.id = "change-input";
    document.body.append(field);
    const { unmount } = render(<ChangeSummaryPanel pending={pendingFor()} onAccept={vi.fn()} onUndo={vi.fn()} />);

    unmount();

    expect(field).toHaveFocus();
    field.remove();
  });
});

describe("ChangeBox", () => {
  const renderBox = (onSubmit: (text: string) => Promise<ChangeOutcome>, text = "50 more guests") => {
    const onTextChange = vi.fn();
    return { onTextChange, ...render(<ChangeBox text={text} onTextChange={onTextChange} onSubmit={onSubmit} />) };
  };

  it("keeps Review changes disabled until there is text", async () => {
    const { container } = renderBox(vi.fn(), "  ");
    expect(screen.getByRole("button", { name: "Review changes" })).toBeDisabled();
    expect(screen.getByLabelText("What changed?")).toHaveAccessibleDescription(/Say it the way you would/);
    await expectAccessible(container);
  });

  it("submits the trimmed request", async () => {
    const onSubmit = vi.fn<(text: string) => Promise<ChangeOutcome>>().mockResolvedValue({ kind: "applied" });
    const user = userEvent.setup();
    renderBox(onSubmit, "  50 more guests ");
    await user.click(screen.getByRole("button", { name: "Review changes" }));
    expect(onSubmit).toHaveBeenCalledWith("50 more guests");
  });

  it("reports what the user typed to its owner", () => {
    const { onTextChange } = renderBox(vi.fn(), "");
    fireEvent.change(screen.getByLabelText("What changed?"), { target: { value: "budget 7 lakh" } });
    expect(onTextChange).toHaveBeenCalledWith("budget 7 lakh");
  });

  it("shows a clarifying question or an error as a polite note", async () => {
    const onSubmit = vi
      .fn<(text: string) => Promise<ChangeOutcome>>()
      .mockResolvedValueOnce({ kind: "question", text: "Which function do you mean?" })
      .mockResolvedValueOnce({ kind: "error", message: "The assistant is unavailable." });
    const user = userEvent.setup();
    const { container } = renderBox(onSubmit);

    await user.click(screen.getByRole("button", { name: "Review changes" }));
    expect(await screen.findByText("Which function do you mean?")).toBeInTheDocument();
    await expectAccessible(container);

    await user.click(screen.getByRole("button", { name: "Review changes" }));
    expect(await screen.findByText("The assistant is unavailable.")).toBeInTheDocument();
    expect(screen.queryByText("Which function do you mean?")).not.toBeInTheDocument();
  });
});
