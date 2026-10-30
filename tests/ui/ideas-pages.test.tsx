import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdeasTab } from "@/components/IdeasTab";
import { SiteHeader } from "@/components/SiteHeader";
import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";
import Home from "@/app/page";
import { api } from "@/lib/api";
import { STORAGE_KEY } from "@/lib/store";
import type { FunctionIdeas, Idea, Plan } from "@/lib/types";
import { makePlan } from "../plan-fixtures";
import { expectAccessible, failed, freezeToday, ok } from "./helpers";

const MANDAP: Idea = {
  title: "Marigold mandap",
  description: "Seasonal flowers.",
  costImpact: "saves",
  fitsBecause: "It cuts decor.",
};

const WEDDING: FunctionIdeas = {
  kind: "wedding",
  ideas: [
    MANDAP,
    { title: "Live ghazal night", description: "A small band.", costImpact: "adds", fitsBecause: "You like music." },
  ],
};

function IdeasHarness({ initial }: { initial: Plan }) {
  const [plan, setPlan] = useState(initial);
  return <IdeasTab plan={plan} onUpdate={setPlan} />;
}

const refreshButton = () =>
  within(screen.getByRole("region", { name: "Wedding" })).getByRole("button", { name: "Refresh ideas" });

beforeEach(freezeToday);
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("IdeasTab", () => {
  it("shows each idea with a cost-impact label in words and why it fits", async () => {
    const { container } = render(<IdeasHarness initial={{ ...makePlan(), ideas: [WEDDING] }} />);
    expect(screen.getByRole("heading", { name: "Marigold mandap" })).toBeInTheDocument();
    expect(screen.getByText("Saves money")).toBeInTheDocument();
    expect(screen.getByText("Adds cost")).toBeInTheDocument();
    expect(screen.getByText("It cuts decor.")).toBeInTheDocument();
    expect(screen.getByText("No ideas yet for this function.")).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("fetches ideas for a function that has none", async () => {
    const ideas = vi
      .spyOn(api, "ideas")
      .mockResolvedValue(ok({ ideas: [{ kind: "mehendi", ideas: [{ ...MANDAP, title: "Henna lounge" }] }] }));
    const user = userEvent.setup();
    render(<IdeasHarness initial={{ ...makePlan(), ideas: [WEDDING] }} />);

    await user.click(screen.getByRole("button", { name: "Get ideas for Mehendi" }));

    expect(await screen.findByRole("heading", { name: "Henna lounge" })).toBeInTheDocument();
    expect(ideas.mock.lastCall?.[0]).toMatchObject({ function: "mehendi", feedback: null });
  });

  it("refreshes a function's ideas from the user's feedback, then clears the box", async () => {
    const ideas = vi
      .spyOn(api, "ideas")
      .mockResolvedValue(ok({ ideas: [{ kind: "wedding", ideas: [{ ...MANDAP, title: "Paper lanterns" }] }] }));
    const user = userEvent.setup();
    render(<IdeasHarness initial={{ ...makePlan(), ideas: [WEDDING] }} />);

    const feedback = screen.getByLabelText("Feedback on the wedding ideas");
    await user.type(feedback, "Too expensive");
    await user.click(refreshButton());

    expect(await screen.findByRole("heading", { name: "Paper lanterns" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Marigold mandap" })).not.toBeInTheDocument();
    expect(ideas.mock.lastCall?.[0]).toMatchObject({ function: "wedding", feedback: "Too expensive" });
    expect(feedback).toHaveValue("");
  });

  it("ignores empty feedback, and keeps the current ideas with a note when the request fails", async () => {
    const ideas = vi.spyOn(api, "ideas").mockResolvedValue(failed("network"));
    const user = userEvent.setup();
    const { container } = render(<IdeasHarness initial={{ ...makePlan(), ideas: [WEDDING] }} />);
    const refresh = refreshButton();

    await user.click(refresh);
    expect(ideas).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Feedback on the wedding ideas"), "More colour");
    await user.click(refresh);
    expect(
      await screen.findByText(
        /You appear to be offline\. Check your connection and retry\. Your ideas are unchanged\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Marigold mandap" })).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("says so when the reply holds nothing for the function", async () => {
    vi.spyOn(api, "ideas").mockResolvedValue(ok({ ideas: [] }));
    const user = userEvent.setup();
    render(<IdeasHarness initial={{ ...makePlan(), ideas: [WEDDING] }} />);

    await user.type(screen.getByLabelText("Feedback on the wedding ideas"), "Anything");
    await user.click(refreshButton());

    expect(await screen.findByText("No new ideas came back. Try describing it differently.")).toBeInTheDocument();
  });
});

describe("pages", () => {
  it("SiteHeader shows the privacy note unless it is given something else", async () => {
    const { container } = render(<SiteHeader />);
    expect(screen.getByText("ShaadiSaathi")).toBeInTheDocument();
    expect(screen.getByText("Saved only in this browser. No account needed.")).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("the home page renders the app", () => {
    render(<Home />);
    expect(screen.getByRole("button", { name: "Build my plan" })).toBeInTheDocument();
  });

  it("the not-found page links back home", async () => {
    const { container } = render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This page is not part of the plan.");
    expect(screen.getByRole("link", { name: "Back to ShaadiSaathi" })).toHaveAttribute("href", "/");
    await expectAccessible(container);
  });

  it("the error page retries, and can clear the saved plan", async () => {
    const reset = vi.fn();
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    window.localStorage.setItem(STORAGE_KEY, "{}");
    const user = userEvent.setup();
    const { container } = render(<ErrorPage error={new Error("boom")} reset={reset} />);
    await expectAccessible(container);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Clear saved plan" }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });
});
