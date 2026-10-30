import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import { NextTasks } from "@/components/NextTasks";
import { TimelineTab } from "@/components/TimelineTab";
import { AiGate, type AiStatus } from "@/components/ui/AiGate";
import { setTask } from "@/lib/plan/edits";
import { nextTasks, scheduleTasks } from "@/lib/plan/timeline";
import type { Plan, ScheduledTask, TaskStatus } from "@/lib/types";
import { makePlan, TODAY } from "../plan-fixtures";
import { expectAccessible, freezeToday } from "./helpers";

beforeEach(freezeToday);
afterEach(() => {
  vi.useRealTimers();
});

/** Holds the plan so a status change reschedules the tasks like it does in the app. */
function TimelineHarness({
  onSet = vi.fn(),
}: {
  onSet?: (id: string, status: TaskStatus, date: string | null) => void;
}) {
  const [plan, setPlan] = useState<Plan>(makePlan());
  return (
    <TimelineTab
      tasks={scheduleTasks(plan, TODAY)}
      onSet={(id, status, date) => {
        onSet(id, status, date);
        setPlan((p) => setTask(p, id, status, date));
      }}
    />
  );
}

const statusGroup = (title: string) => screen.getByRole("group", { name: `Status of ${title}` });

describe("TimelineTab", () => {
  it("groups tasks under month headings, each with a status group", async () => {
    const { container } = render(<TimelineHarness />);
    expect(screen.getByRole("heading", { name: "September 2026" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(statusGroup("Shortlist and book venue(s)")).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("states flags as text, not colour alone", () => {
    render(<TimelineHarness />);
    const row = statusGroup("Shortlist and book venue(s)").closest("li");
    assert(row !== null);
    expect(within(row).getByText("Urgent, this week")).toBeInTheDocument();
  });

  it("marks the current status with aria-pressed", () => {
    render(<TimelineHarness />);
    // The opening questions settle the first three tasks, so they start as done.
    const done = within(statusGroup("Fix dates and muhurat with family"));
    expect(done.getByRole("button", { name: "Done" })).toHaveAttribute("aria-pressed", "true");
    expect(done.getByRole("button", { name: "To do" })).toHaveAttribute("aria-pressed", "false");
    const open = within(statusGroup("Book caterer"));
    expect(open.getByRole("button", { name: "To do" })).toHaveAttribute("aria-pressed", "true");
  });

  it("marks a task done, replacing its due date with Done", async () => {
    const onSet = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<TimelineHarness onSet={onSet} />);

    await user.click(within(statusGroup("Book caterer")).getByRole("button", { name: "Done" }));

    expect(onSet).toHaveBeenCalledWith("book-caterer", "done", "2026-11-15");
    expect(within(statusGroup("Book caterer")).getByRole("button", { name: "Done" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const row = statusGroup("Book caterer").closest("li");
    assert(row !== null);
    expect(within(row).getByText("Done", { selector: "span" })).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("ignores a click on the status that is already selected", async () => {
    const onSet = vi.fn();
    const user = userEvent.setup();
    render(<TimelineHarness onSet={onSet} />);
    await user.click(within(statusGroup("Book caterer")).getByRole("button", { name: "To do" }));
    expect(onSet).not.toHaveBeenCalled();
  });

  it("reveals a date input only for a delayed task, and reschedules from it", async () => {
    const user = userEvent.setup();
    const { container } = render(<TimelineHarness />);
    expect(screen.queryByLabelText(/New date for/)).not.toBeInTheDocument();

    await user.click(within(statusGroup("Book caterer")).getByRole("button", { name: "Delayed" }));
    const date = screen.getByLabelText("New date for Book caterer");
    expect(date).toHaveAttribute("type", "date");
    expect(date).toHaveValue("2026-11-15");
    await expectAccessible(container);

    await user.clear(date);
    await user.type(date, "2026-12-20");
    expect(screen.getByLabelText("New date for Book caterer")).toBeInTheDocument();
    expect(within(statusGroup("Book caterer")).getByRole("button", { name: "Delayed" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(within(statusGroup("Book caterer")).getByRole("button", { name: "To do" }));
    expect(screen.queryByLabelText("New date for Book caterer")).not.toBeInTheDocument();
  });
});

describe("NextTasks", () => {
  const tasks = nextTasks(scheduleTasks(makePlan(), TODAY), 3);

  it("lists the next three things with due dates and flags as text", async () => {
    const { container } = render(<NextTasks tasks={tasks} />);
    expect(screen.getByRole("complementary", { name: "Next 3 things to do" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Shortlist and book venue(s)")).toBeInTheDocument();
    expect(screen.getByText("Urgent, this week")).toBeInTheDocument();
    expect(screen.getAllByText(/^Due \d+ \w+ \d{4}$/)).toHaveLength(3);
    await expectAccessible(container);
  });

  it("shows at most three tasks", () => {
    const many: ScheduledTask[] = scheduleTasks(makePlan(), TODAY).filter((t) => t.status === "todo");
    render(<NextTasks tasks={many} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("explains when nothing is waiting", async () => {
    const { container } = render(<NextTasks tasks={[]} />);
    expect(screen.getByText(/Nothing is waiting on you/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    await expectAccessible(container);
  });
});

describe("AiGate", () => {
  const gate = (status: AiStatus, ready = false, onRetry = vi.fn()) =>
    render(
      <AiGate ready={ready} status={status} noun="vendor checklists" onRetry={onRetry}>
        <p>The checklists</p>
      </AiGate>,
    );

  it("shows the content once it is ready, whatever the status", () => {
    gate("network", true);
    expect(screen.getByText("The checklists")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("announces loading to screen readers", async () => {
    const { container } = gate("loading");
    expect(screen.getByRole("status")).toHaveTextContent("Loading vendor checklists");
    expect(screen.queryByText("The checklists")).not.toBeInTheDocument();
    await expectAccessible(container);
  });

  it("offers to load content that has not been requested yet", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    const { container } = gate("idle", false, onRetry);
    expect(screen.getByText("vendor checklists have not loaded yet")).toBeInTheDocument();
    expect(screen.getByText("Budget and timeline work without them.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load vendor checklists" }));
    expect(onRetry).toHaveBeenCalledOnce();
    await expectAccessible(container);
  });

  it("explains a failure in plain words, reassures that budget and timeline work, and retries", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    const { container } = gate("rate_limited", false, onRetry);
    expect(screen.getByText("That is a lot of requests at once")).toBeInTheDocument();
    expect(
      screen.getByText(/Give it a few minutes and try again\. Budget and timeline still work\./),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
    await expectAccessible(container);
  });
});
