import { afterEach, describe, expect, it, vi } from "vitest";
import { api, describeFailure } from "@/lib/api";
import type { Profile } from "@/lib/types";

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
const reply = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("returns validated data on success", async () => {
    vi.stubGlobal("fetch", reply(200, { vendors: [] }));
    expect(await api.vendors({ profile })).toEqual({ ok: true, data: { vendors: [] } });
  });

  it("maps a structured error body to its code", async () => {
    vi.stubGlobal("fetch", reply(429, { error: { code: "rate_limited", message: "Slow down" } }));
    const res = await api.tradeoffs({ profile, total: 900_000, levers: [{ id: "a", label: "Trim", saving: 1, touchesPriority: false }] });
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

  it("has distinct copy for each failure family", () => {
    const titles = (["rate_limited", "refused", "invalid_input", "network", "ai_unavailable"] as const).map((c) => describeFailure(c).title);
    expect(new Set(titles).size).toBe(5);
  });
});
