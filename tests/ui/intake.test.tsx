import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntakeChat } from "@/components/IntakeChat";
import { ProfilePanel } from "@/components/ProfilePanel";
import { api } from "@/lib/api";
import type { ChatMessage, IntakeDraft } from "@/lib/types";
import { expectAccessible, failed, freezeToday, ok } from "./helpers";

const EMPTY: IntakeDraft = {
  weddingDate: null,
  city: null,
  cityTier: null,
  guests: null,
  budget: null,
  functions: [],
  style: null,
  priorities: [],
  mustHaves: [],
  notes: [],
};

const READY: IntakeDraft = {
  ...EMPTY,
  weddingDate: "2027-03-01",
  city: "Jaipur",
  cityTier: "tier2",
  guests: 200,
  budget: 800_000,
  functions: [{ kind: "mehendi", dayOffset: -1, guests: 120 }],
  priorities: ["catering", "photography"],
  mustHaves: ["Vegetarian menu"],
};

beforeEach(freezeToday);
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ProfilePanel", () => {
  it("keeps Build my plan disabled and names what is still missing", async () => {
    const { container } = render(
      <ProfilePanel draft={EMPTY} onDraftChange={vi.fn()} onBuild={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Build my plan" })).toBeDisabled();
    expect(
      screen.getByText("Still needed: wedding date, city, guest count, budget."),
    ).toBeInTheDocument();
    await expectAccessible(container);
  });

  it.each([
    ["wedding date", { weddingDate: null }, "Still needed: wedding date."],
    ["city", { city: null }, "Still needed: city."],
    ["guest count", { guests: null }, "Still needed: guest count."],
    ["budget", { budget: null }, "Still needed: budget."],
  ])("stays disabled when only the %s is missing", async (_name, gap, hint) => {
    const { container } = render(
      <ProfilePanel draft={{ ...READY, ...gap }} onDraftChange={vi.fn()} onBuild={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Build my plan" })).toBeDisabled();
    expect(screen.getByText(hint)).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("enables Build once date, city, guests and budget exist, and builds on click", async () => {
    const onBuild = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ProfilePanel draft={READY} onDraftChange={vi.fn()} onBuild={onBuild} />,
    );
    const build = screen.getByRole("button", { name: "Build my plan" });
    expect(build).toBeEnabled();
    expect(build).toHaveAccessibleDescription(/The four essentials are in/);
    await user.click(build);
    expect(onBuild).toHaveBeenCalledOnce();
    await expectAccessible(container);
  });

  it("shows what was understood: essentials, functions, priorities and notes", async () => {
    const { container } = render(
      <ProfilePanel draft={READY} onDraftChange={vi.fn()} onBuild={vi.fn()} />,
    );
    expect(screen.getByText("1 Mar 2027")).toBeInTheDocument();
    expect(screen.getByText("Jaipur · Tier-2")).toBeInTheDocument();
    expect(screen.getByText("₹8,00,000")).toBeInTheDocument();
    expect(screen.getByText("1 day before · 120 guests")).toBeInTheDocument();
    expect(screen.getByText("Vegetarian menu")).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("blocks Build for a wedding date in the past and says why", async () => {
    const { container } = render(
      <ProfilePanel
        draft={{ ...READY, weddingDate: "2026-10-28" }}
        onDraftChange={vi.fn()}
        onBuild={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Build my plan" })).toBeDisabled();
    expect(screen.getByText(/That wedding date has already passed/)).toBeInTheDocument();
    await expectAccessible(container);
  });

  it("accepts a wedding date of today", () => {
    render(
      <ProfilePanel
        draft={{ ...READY, weddingDate: "2026-10-29" }}
        onDraftChange={vi.fn()}
        onBuild={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Build my plan" })).toBeEnabled();
  });

  it("lets the user fill the four essentials by hand", async () => {
    const onDraftChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ProfilePanel draft={EMPTY} onDraftChange={onDraftChange} onBuild={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Wedding date")).toHaveAttribute("min", "2026-10-29");
    await user.type(screen.getByLabelText("Wedding date"), "2027-03-01");
    await user.type(screen.getByLabelText("City"), "  Jaipur ");
    await user.type(screen.getByLabelText("Guests"), "200");
    await user.type(screen.getByLabelText("Budget (rupees)"), "800000");
    await expectAccessible(container);
    await user.click(screen.getByRole("button", { name: "Save details" }));

    expect(onDraftChange).toHaveBeenCalledWith({
      ...EMPTY,
      weddingDate: "2027-03-01",
      city: "Jaipur",
      guests: 200,
      budget: 800_000,
    });
    expect(screen.queryByLabelText("City")).not.toBeInTheDocument();
  });

  it("reads a blank manual form as nothing understood, rather than inventing values", async () => {
    const onDraftChange = vi.fn<(d: IntakeDraft) => void>();
    const user = userEvent.setup();
    render(<ProfilePanel draft={READY} onDraftChange={onDraftChange} onBuild={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    for (const label of ["Wedding date", "City", "Guests", "Budget (rupees)"]) {
      await user.clear(screen.getByLabelText(label));
    }
    await user.click(screen.getByRole("button", { name: "Save details" }));

    expect(onDraftChange.mock.lastCall?.[0]).toMatchObject({
      weddingDate: null,
      city: null,
      guests: null,
      budget: null,
    });
  });

  it("describes functions on the day and after it, a city with no tier yet, and the default style", () => {
    const draft: IntakeDraft = {
      ...EMPTY,
      city: "Kota",
      functions: [
        { kind: "haldi", dayOffset: 0, guests: null },
        { kind: "reception", dayOffset: 2, guests: 80 },
      ],
    };
    render(<ProfilePanel draft={draft} onDraftChange={vi.fn()} onBuild={vi.fn()} />);
    expect(screen.getByText("Kota")).toBeInTheDocument();
    expect(screen.getByText("wedding day")).toBeInTheDocument();
    expect(screen.getByText("2 days after · 80 guests")).toBeInTheDocument();
    expect(screen.getByText("Classic (default)")).toBeInTheDocument();
    expect(screen.getAllByText("Needed")).toHaveLength(3);
  });

  it("drops the inferred city tier when the city is edited, and keeps it when it is not", async () => {
    const onDraftChange = vi.fn<(d: IntakeDraft) => void>();
    const user = userEvent.setup();
    render(<ProfilePanel draft={READY} onDraftChange={onDraftChange} onBuild={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save details" }));
    expect(onDraftChange.mock.lastCall?.[0]).toMatchObject({ city: "Jaipur", cityTier: "tier2" });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("City"));
    await user.type(screen.getByLabelText("City"), "Udaipur");
    await user.click(screen.getByRole("button", { name: "Save details" }));
    expect(onDraftChange.mock.lastCall?.[0]).toMatchObject({ city: "Udaipur", cityTier: null });
  });

  it("discards manual edits on Cancel", async () => {
    const onDraftChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ProfilePanel draft={READY} onDraftChange={onDraftChange} onBuild={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("City"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDraftChange).not.toHaveBeenCalled();
    expect(screen.getByText("Jaipur · Tier-2")).toBeInTheDocument();
    await expectAccessible(container);
  });
});

describe("IntakeChat", () => {
  const noop = { onUserMessage: vi.fn(), onReply: vi.fn() };

  it("starts with the greeting and a send button that waits for text", async () => {
    const user = userEvent.setup();
    const { container } = render(<IntakeChat messages={[]} draft={null} {...noop} />);
    expect(screen.getByRole("log", { name: "Conversation" })).toHaveTextContent("Namaste.");
    const send = screen.getByRole("button", { name: "Send message" });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("Your message"), "hello");
    expect(send).toBeEnabled();
    await expectAccessible(container);
  });

  it("sends the example brief, dated four months out, and hands the reply on", async () => {
    const draft: IntakeDraft = { ...EMPTY, city: "Jaipur" };
    const intake = vi.spyOn(api, "intake").mockResolvedValue(ok({ reply: "Lovely.", draft }));
    const onUserMessage = vi.fn<(m: ChatMessage) => void>();
    const onReply = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <IntakeChat messages={[]} draft={null} onUserMessage={onUserMessage} onReply={onReply} />,
    );

    await user.click(screen.getByRole("button", { name: "Try an example" }));

    expect(onUserMessage.mock.lastCall?.[0].content).toContain("Jaipur on 2027-02-26");
    expect(intake.mock.lastCall?.[0]).toMatchObject({ today: "2026-10-29", draft: null });
    expect(onReply).toHaveBeenCalledWith("Lovely.", draft);
    await expectAccessible(container);
  });

  it("sends on Enter, keeps a newline on Shift+Enter, and clears the box", async () => {
    vi.spyOn(api, "intake").mockResolvedValue(ok({ reply: "Noted.", draft: EMPTY }));
    const onUserMessage = vi.fn();
    const user = userEvent.setup();
    render(
      <IntakeChat messages={[]} draft={null} onUserMessage={onUserMessage} onReply={vi.fn()} />,
    );
    const box = screen.getByLabelText("Your message");

    await user.type(box, "first line{Shift>}{Enter}{/Shift}second line");
    expect(onUserMessage).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");

    expect(onUserMessage).toHaveBeenCalledWith({
      role: "user",
      content: "first line\nsecond line",
    });
    expect(box).toHaveValue("");
  });

  it("sends through the real client to /api/intake, with today's date and the history", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ reply: "Hello.", draft: EMPTY }));
    vi.stubGlobal("fetch", fetchMock);
    const onReply = vi.fn();
    const user = userEvent.setup();
    render(<IntakeChat messages={[]} draft={null} onUserMessage={vi.fn()} onReply={onReply} />);

    await user.type(screen.getByLabelText("Your message"), "Jaipur");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await vi.waitFor(() => {
      expect(onReply).toHaveBeenCalledWith("Hello.", EMPTY);
    });
    expect(fetchMock.mock.lastCall?.[0]).toBe("/api/intake");
    expect(fetchMock.mock.lastCall?.[1]?.body).toBe(
      JSON.stringify({
        messages: [{ role: "user", content: "Jaipur" }],
        draft: null,
        today: "2026-10-29",
      }),
    );
  });

  it("does not send an empty message", async () => {
    const intake = vi.spyOn(api, "intake");
    const user = userEvent.setup();
    render(<IntakeChat messages={[]} draft={null} {...noop} />);
    await user.type(screen.getByLabelText("Your message"), "   {Enter}");
    expect(intake).not.toHaveBeenCalled();
  });

  it("shows the failure as an alert with a retry that asks again", async () => {
    const intake = vi.spyOn(api, "intake").mockResolvedValue(ok({ reply: "Back.", draft: EMPTY }));
    const onReply = vi.fn();
    const user = userEvent.setup();
    const messages: ChatMessage[] = [{ role: "user", content: "Jaipur, 200 guests" }];
    const { container } = render(
      <IntakeChat messages={messages} draft={null} onUserMessage={vi.fn()} onReply={onReply} />,
    );

    const note = screen.getByRole("alert");
    expect(note).toHaveTextContent("That message did not get a reply.");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(intake).toHaveBeenCalledTimes(1);
    expect(onReply).toHaveBeenCalledWith("Back.", EMPTY);
    await expectAccessible(container);
  });

  it("explains an offline failure in plain words after a send", async () => {
    vi.spyOn(api, "intake").mockResolvedValue(failed("network"));
    const user = userEvent.setup();
    const messages: ChatMessage[] = [{ role: "user", content: "Jaipur" }];
    const { container, rerender } = render(
      <IntakeChat messages={[]} draft={null} onUserMessage={vi.fn()} onReply={vi.fn()} />,
    );
    await user.type(screen.getByLabelText("Your message"), "Jaipur{Enter}");
    rerender(
      <IntakeChat messages={messages} draft={null} onUserMessage={vi.fn()} onReply={vi.fn()} />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You appear to be offline. Check your connection and retry.",
    );
    await expectAccessible(container);
  });
});
