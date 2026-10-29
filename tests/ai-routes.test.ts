import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callTools, generate, RefusalError } from "@/lib/ai/client";
import { CHANGE_TOOLS } from "@/lib/ai/tools";
import { POST as change } from "@/app/api/change/route";
import { POST as ideas } from "@/app/api/ideas/route";
import { POST as intake } from "@/app/api/intake/route";
import { POST as quote } from "@/app/api/quote/route";
import { POST as tradeoffs } from "@/app/api/tradeoffs/route";
import { POST as vendors } from "@/app/api/vendors/route";

// Mock only the network calls; the error classes stay real so the handler can recognise them.
vi.mock("@/lib/ai/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/client")>()),
  generate: vi.fn(),
  callTools: vi.fn(),
}));

const generateMock = vi.mocked(generate);
const callToolsMock = vi.mocked(callTools);
const meta = { model: "test-model", inputTokens: 10, outputTokens: 5 };

const profile = {
  city: "Jaipur",
  cityTier: "tier2",
  guests: 200,
  budget: 800000,
  functions: [
    { kind: "mehendi", date: "2027-02-14", guests: 120 },
    { kind: "wedding", date: "2027-02-15", guests: 200 },
  ],
  style: "classic",
  categoryStyles: {},
  priorities: ["catering", "photography"],
  mustHaves: [],
  notes: [],
};

let nextIp = 0;
/** Each request gets its own IP unless one is given, so the rate limiter never leaks between tests. */
function post(handler: (r: Request) => Promise<Response>, body: unknown, ip = `10.0.0.${++nextIp}`) {
  return handler(
    new Request("http://localhost/api/x", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `${ip}, 1.1.1.1` },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const validBodies = {
  intake: { messages: [{ role: "user", content: "Wedding in Jaipur" }], draft: null, today: "2026-10-29" },
  ideas: { profile, function: null, feedback: null, previous: [] },
  vendors: { profile },
  change: { message: "50 more guests", profile, tasks: [], today: "2026-10-29" },
  quote: { text: "Catering package for 200 guests, total Rs 2,40,000 plus GST.", category: "catering", guests: 200 },
  tradeoffs: {
    profile,
    total: 960000,
    levers: [{ id: "trim-all-10", label: "Trim all guests by 10%", saving: 50000, touchesPriority: false }],
  },
};
const handlers = { intake, ideas, vendors, change, quote, tradeoffs };

beforeEach(() => {
  generateMock.mockReset();
  callToolsMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("shared handler", () => {
  it.each(Object.entries(handlers))("%s returns 400 for empty, malformed and invalid bodies", async (_name, handler) => {
    for (const body of ["", "{not json", "[]", {}]) {
      const res = await post(handler, body);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("invalid_input");
    }
    expect(generateMock).not.toHaveBeenCalled();
    expect(callToolsMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized body without parsing it", async () => {
    const res = await post(vendors, JSON.stringify({ pad: "x".repeat(100_001) }));
    expect(res.status).toBe(400);
  });

  it("returns 429 after 40 requests from one IP, but not for another IP", async () => {
    generateMock.mockResolvedValue({ data: { vendors: [] }, meta });
    for (let i = 0; i < 40; i++) expect((await post(vendors, validBodies.vendors, "9.9.9.9")).status).toBe(200);
    const blocked = await post(vendors, validBodies.vendors, "9.9.9.9");
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error.code).toBe("rate_limited");
    expect((await post(vendors, validBodies.vendors, "8.8.8.8")).status).toBe(200);
  });

  it.each([401, 403, 429, 529])("maps Anthropic status %i to 503 ai_unavailable", async (status) => {
    generateMock.mockRejectedValue(Anthropic.APIError.generate(status, { type: "error" }, "upstream says no", new Headers()));
    const res = await post(vendors, validBodies.vendors);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("ai_unavailable");
    expect(body.error.message).not.toContain("upstream says no");
  });

  it("maps exhausted credit (400) and connection failures to 503", async () => {
    generateMock.mockRejectedValueOnce(
      Anthropic.APIError.generate(
        400,
        { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low" } },
        undefined,
        new Headers(),
      ),
    );
    expect((await post(vendors, validBodies.vendors)).status).toBe(503);
    generateMock.mockRejectedValueOnce(new Anthropic.APIConnectionError({ message: "offline" }));
    expect((await post(vendors, validBodies.vendors)).status).toBe(503);
  });

  it("maps a refusal to 422 and anything else to 502, never 500", async () => {
    generateMock.mockRejectedValueOnce(new RefusalError("declined"));
    const refused = await post(vendors, validBodies.vendors);
    expect(refused.status).toBe(422);
    expect((await refused.json()).error.code).toBe("refused");

    generateMock.mockRejectedValueOnce(new TypeError("boom"));
    const broken = await post(vendors, validBodies.vendors);
    expect(broken.status).toBe(502);
    expect((await broken.json()).error.code).toBe("ai_error");
  });

  it("returns 502 when the model output breaks the response contract", async () => {
    generateMock.mockResolvedValue({ data: { vendors: "nope" }, meta });
    expect((await post(vendors, validBodies.vendors)).status).toBe(502);
  });

  it("logs one JSON line without user content", async () => {
    generateMock.mockResolvedValue({ data: { vendors: [] }, meta });
    await post(vendors, validBodies.vendors);
    const line = JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string);
    expect(line).toMatchObject({ route: "vendors", status: 200, model: "test-model", inputTokens: 10, outputTokens: 5 });
    expect(JSON.stringify(line)).not.toContain("Jaipur");
  });
});

describe("intake", () => {
  it("rejects a conversation that ends on an assistant turn", async () => {
    const body = { ...validBodies.intake, messages: [{ role: "assistant", content: "Hello!" }] };
    expect((await post(intake, body)).status).toBe(400);
  });

  it("passes through the model's reply and draft", async () => {
    const draft = {
      weddingDate: "2027-02-15",
      city: "Jaipur",
      cityTier: "tier2",
      guests: 200,
      budget: 800000,
      functions: [{ kind: "wedding", dayOffset: 0, guests: null }],
      style: null,
      priorities: ["catering"],
      mustHaves: [],
      notes: [],
    };
    generateMock.mockResolvedValue({ data: { reply: "Lovely. Any must-haves?", draft }, meta });
    const res = await post(intake, validBodies.intake);
    expect(res.status).toBe(200);
    expect((await res.json()).draft.city).toBe("Jaipur");
  });
});

describe("change", () => {
  it("turns tool calls into validated changes and drops invalid ones", async () => {
    callToolsMock.mockResolvedValue({
      data: {
        calls: [
          { name: "set_guests", input: { function: "all", count: 250 } },
          { name: "set_budget", input: { amount: 700000 } },
          { name: "shift_dates", input: { days: -14 } },
          { name: "set_guests", input: { function: "all", count: -5 } },
          { name: "set_budget", input: { amount: "lots" } },
          { name: "not_a_tool", input: {} },
        ],
        text: "",
      },
      meta,
    });
    const res = await post(change, validBodies.change);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      changes: [
        { type: "set_guests", function: "all", count: 250 },
        { type: "set_budget", amount: 700000 },
        { type: "shift_dates", days: -14 },
      ],
      reply: null,
    });
  });

  it("cannot be tricked into a different variant by a `type` inside the tool input", async () => {
    callToolsMock.mockResolvedValue({
      data: { calls: [{ name: "set_budget", input: { type: "remove_function", function: "wedding", amount: 500000 } }], text: "" },
      meta,
    });
    const body = await (await post(change, validBodies.change)).json();
    expect(body.changes).toEqual([{ type: "set_budget", amount: 500000 }]);
  });

  it("returns text alone as a clarifying question", async () => {
    callToolsMock.mockResolvedValue({ data: { calls: [], text: "How many more guests?" }, meta });
    expect(await (await post(change, validBodies.change)).json()).toEqual({
      changes: [],
      reply: "How many more guests?",
    });
  });

  it("asks the user to rephrase when there is nothing to apply and nothing said", async () => {
    callToolsMock.mockResolvedValue({ data: { calls: [{ name: "set_budget", input: {} }], text: "" }, meta });
    const body = await (await post(change, validBodies.change)).json();
    expect(body.changes).toEqual([]);
    expect(body.reply).toMatch(/say it/i);
  });
});

describe("change tools", () => {
  it("has one strict tool per PlanChange variant, without the discriminator in the input", () => {
    expect(CHANGE_TOOLS.map((t) => t.name).sort()).toEqual(
      [
        "set_guests", "set_budget", "shift_dates", "set_function_date", "add_function",
        "remove_function", "set_style", "set_priorities", "set_task_status", "add_note",
      ].sort(),
    );
    for (const tool of CHANGE_TOOLS) {
      expect(tool.strict).toBe(true);
      expect(tool.input_schema.additionalProperties).toBe(false);
      expect(tool.input_schema.properties).not.toHaveProperty("type");
    }
  });
});

describe("quote", () => {
  const extracted = {
    quote: {
      category: "catering",
      vendorName: "Shree Caterers",
      total: 240000,
      guestsCovered: 200,
      inclusions: ["Two live counters"],
      extraCharges: [{ item: "GST", amount: null }],
      openQuestions: ["Is the tasting free?"],
    },
  };

  it("returns a validated extraction", async () => {
    generateMock.mockResolvedValue({ data: extracted, meta });
    const res = await post(quote, validBodies.quote);
    expect(res.status).toBe(200);
    expect((await res.json()).quote.total).toBe(240000);
  });

  it("refuses a quote with no total instead of returning zero", async () => {
    generateMock.mockResolvedValue({ data: { quote: { ...extracted.quote, total: 0 } }, meta });
    const res = await post(quote, validBodies.quote);
    expect(res.status).toBe(502);
    expect((await res.json()).error.message).toMatch(/total price/);
  });

  it("rejects extraction output that fails the schema", async () => {
    generateMock.mockResolvedValue({ data: { quote: { ...extracted.quote, total: -1 } }, meta });
    expect((await post(quote, validBodies.quote)).status).toBe(502);
  });

  it("rejects text that is too short or too long", async () => {
    expect((await post(quote, { ...validBodies.quote, text: "cheap" })).status).toBe(400);
    expect((await post(quote, { ...validBodies.quote, text: "x".repeat(6001) })).status).toBe(400);
  });
});

describe("tradeoffs", () => {
  it("keeps only lever ids the engine offered", async () => {
    generateMock.mockResolvedValue({
      data: {
        options: [
          { title: "Gentle", leverIds: ["trim-all-10", "invented", "trim-all-10"], why: "Keeps the food." },
          { title: "Made up", leverIds: ["invented"], why: "Nope." },
        ],
      },
      meta,
    });
    const res = await post(tradeoffs, validBodies.tradeoffs);
    expect(res.status).toBe(200);
    expect((await res.json()).options).toEqual([{ title: "Gentle", leverIds: ["trim-all-10"], why: "Keeps the food." }]);
  });

  it("fails cleanly when no option survives", async () => {
    generateMock.mockResolvedValue({ data: { options: [{ title: "X", leverIds: ["invented"], why: "Y" }] }, meta });
    expect((await post(tradeoffs, validBodies.tradeoffs)).status).toBe(502);
  });
});

describe("ideas", () => {
  it("returns only the requested function when regenerating one", async () => {
    const idea = { title: "Folk music night", description: "Rajasthani folk artists.", costImpact: "within", fitsBecause: "Elders enjoy it." };
    generateMock.mockResolvedValue({
      data: { ideas: [{ kind: "mehendi", ideas: [idea] }, { kind: "wedding", ideas: [idea] }] },
      meta,
    });
    const res = await post(ideas, { ...validBodies.ideas, function: "mehendi", feedback: "suitable for kids and elders" });
    expect((await res.json()).ideas.map((i: { kind: string }) => i.kind)).toEqual(["mehendi"]);
  });
});
