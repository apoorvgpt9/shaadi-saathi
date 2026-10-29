import { afterEach, describe, expect, it, vi } from "vitest";
import { api, cancelRequests, describeFailure, failureMessage, post } from "@/lib/api";
import { VendorsResponse, type Profile } from "@/lib/types";

const profile: Profile = {
  city: "Jaipur",
  cityTier: "tier2",
  guests: 200,
  budget: 800_000,
  functions: [{ kind: "wedding", date: "2027-02-15", guests: 200 }],
  style: "classic",
  categoryStyles: {},
  priorities: [],
  mustHaves: [],
  notes: [],
};
const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

/** A fetch that never answers and rejects when its signal aborts, like the real one. */
const hangingFetch = () =>
  vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(new DOMException("aborted", "AbortError"));
        if (init.signal?.aborted) abort();
        else init.signal?.addEventListener("abort", abort);
      }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("api client", () => {
  it("returns validated data on success", async () => {
    vi.stubGlobal("fetch", reply(200, { vendors: [] }));
    expect(await api.vendors({ profile })).toEqual({ ok: true, data: { vendors: [] } });
  });

  it("maps a structured error body to its code", async () => {
    vi.stubGlobal("fetch", reply(429, { error: { code: "rate_limited", message: "Slow down" } }));
    const res = await api.tradeoffs({
      profile,
      total: 900_000,
      levers: [{ id: "a", label: "Trim", saving: 1, touchesPriority: false }],
    });
    expect(res).toEqual({ ok: false, error: { code: "rate_limited", message: "Slow down" } });
  });

  it("treats an unexpected success shape as ai_error", async () => {
    vi.stubGlobal("fetch", reply(200, { nope: true }));
    const res = await api.ideas({ profile, function: null, feedback: null, previous: [] });
    expect(res.ok === false && res.error.code).toBe("ai_error");
  });

  it("treats an unparseable error body as ai_error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 500 })));
    const res = await api.vendors({ profile });
    expect(res.ok === false && res.error.code).toBe("ai_error");
  });

  it("never throws when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const res = await api.vendors({ profile });
    expect(res.ok === false && res.error.code).toBe("network");
  });

  it("reports a call that takes too long as a timeout, not as being offline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const pending = api.vendors({ profile });
    await vi.advanceTimersByTimeAsync(150_000);
    expect(await pending).toEqual({ ok: false, error: { code: "timeout", message: "" } });
  });

  it("reports a call cancelled by Start over as aborted", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const midFlight = api.vendors({ profile });
    cancelRequests();
    expect(await midFlight).toEqual({ ok: false, error: { code: "aborted", message: "" } });
    vi.stubGlobal("fetch", reply(200, { vendors: [] }));
    expect(await api.vendors({ profile })).toMatchObject({ ok: true });
  });

  it("honours a signal that was already aborted", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const res = await post("/api/vendors", { profile }, VendorsResponse, AbortSignal.abort());
    expect(res.ok === false && res.error.code).toBe("aborted");
  });

  it("has distinct copy for each failure family", () => {
    const titles = (["rate_limited", "refused", "invalid_input", "network", "timeout", "ai_unavailable"] as const).map(
      (c) => describeFailure(c).title,
    );
    expect(new Set(titles).size).toBe(6);
  });
});

describe("failureMessage", () => {
  it("uses the server's own words when it explained the problem", () => {
    const quote = "I could not find a total price in that quote. Check the text and try again.";
    expect(failureMessage({ code: "ai_error", message: quote })).toBe(quote);
    expect(failureMessage({ code: "refused", message: "Try rephrasing." })).toBe("Try rephrasing.");
    expect(failureMessage({ code: "invalid_input", message: "Too long." }, "Your text is still here.")).toBe(
      "Too long. Your text is still here.",
    );
  });

  it("uses standard copy when the message is empty, and for codes the server's text does not replace", () => {
    expect(failureMessage({ code: "ai_error", message: "" })).toBe(
      "The planning assistant is unavailable right now. Try again in a moment.",
    );
    expect(failureMessage({ code: "rate_limited", message: "Too many requests." })).toBe(
      "That is a lot of requests at once. Give it a few minutes and try again.",
    );
    expect(failureMessage({ code: "network", message: "" })).toBe(
      "You appear to be offline. Check your connection and retry.",
    );
  });

  it("gives a timeout its own copy", () => {
    expect(failureMessage({ code: "timeout", message: "" })).toBe(
      "This is taking longer than usual. Please try again.",
    );
  });
});
