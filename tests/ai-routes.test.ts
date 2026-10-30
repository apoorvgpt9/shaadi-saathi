import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { callTools, generate } from "@/lib/ai/client";
import { RefusalError } from "@/lib/ai/errors";
import { CHANGE_TOOLS } from "@/lib/ai/tools";
import { POST as change } from "@/app/api/change/route";
import { POST as ideas } from "@/app/api/ideas/route";
import { POST as intake } from "@/app/api/intake/route";
import { POST as quote } from "@/app/api/quote/route";
import { POST as tradeoffs } from "@/app/api/tradeoffs/route";
import { POST as vendors } from "@/app/api/vendors/route";
import { BASE_PROFILE as profile } from "./plan-fixtures";

// Mock only the network calls; everything else, including the error classes, stays real.
vi.mock("@/lib/ai/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/client")>()),
  generate: vi.fn(),
  callTools: vi.fn(),
}));

const generateMock = vi.mocked(generate);
const callToolsMock = vi.mocked(callTools);
// Every field any route returns, so assertions read the body without `any`. Unknown keys are kept for toEqual.
const Body = z
  .looseObject({
    error: z.object({ code: z.string(), message: z.string() }),
    draft: z.object({ city: z.string().nullable() }),
    reply: z.string().nullable(),
    changes: z.array(z.unknown()),
    quote: z.object({ total: z.number(), category: z.string() }),
    options: z.array(z.unknown()),
    ideas: z.array(z.object({ kind: z.string() })),
  })
  .partial();
async function json(res: Response) {
  return Body.parse(await res.json());
}
const meta = { model: "test-model", inputTokens: 10, outputTokens: 5 };

let nextIp = 0;
/** Each request gets its own IP unless one is given, so the rate limiter never leaks between tests. */
function post(handler: (r: Request) => Promise<Response>, body: unknown, ip = `10.0.0.${++nextIp}`) {
  return postWith(handler, body, { "x-forwarded-for": `${ip}, 1.1.1.1` });
}

function postWith(handler: (r: Request) => Promise<Response>, body: unknown, headers: Record<string, string>) {
  return handler(
    new Request("http://localhost/api/x", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
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
const EMPTY_DRAFT = {
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
const handlers = { intake, ideas, vendors, change, quote, tradeoffs };

beforeEach(() => {
  generateMock.mockReset();
  callToolsMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("shared handler", () => {
  it.each(Object.entries(handlers))(
    "%s returns 400 for empty, malformed and invalid bodies",
    async (_name, handler) => {
      for (const body of ["", "{not json", "[]", {}]) {
        const res = await post(handler, body);
        expect(res.status).toBe(400);
        expect((await json(res)).error?.code).toBe("invalid_input");
      }
      expect(generateMock).not.toHaveBeenCalled();
      expect(callToolsMock).not.toHaveBeenCalled();
    },
  );

  it("rejects an oversized body without parsing it", async () => {
    const res = await post(vendors, JSON.stringify({ pad: "x".repeat(100_001) }));
    expect(res.status).toBe(400);
  });

  it("returns 429 after 40 requests from one IP, but not for another IP", async () => {
    generateMock.mockResolvedValue({ data: { vendors: [] }, meta });
    for (let i = 0; i < 40; i++) expect((await post(vendors, validBodies.vendors, "9.9.9.9")).status).toBe(200);
    const blocked = await post(vendors, validBodies.vendors, "9.9.9.9");
    expect(blocked.status).toBe(429);
    expect((await json(blocked)).error?.code).toBe("rate_limited");
    expect((await post(vendors, validBodies.vendors, "8.8.8.8")).status).toBe(200);
  });

  it("rejects a declared oversize body without reading it", async () => {
    const request = new Request("http://localhost/api/x", {
      method: "POST",
      headers: { "x-forwarded-for": "10.9.9.9", "content-length": "100001" },
      body: "{}",
    });
    const text = vi.spyOn(request, "text");
    expect((await vendors(request)).status).toBe(400);
    expect(text).not.toHaveBeenCalled();
  });

  it("keys the limit on x-real-ip first, ignoring a changing x-forwarded-for", async () => {
    for (let i = 0; i < 40; i++) {
      await postWith(vendors, {}, { "x-real-ip": "7.7.7.7", "x-forwarded-for": `spoofed-${i}` });
    }
    const blocked = await postWith(vendors, {}, { "x-real-ip": "7.7.7.7", "x-forwarded-for": "fresh" });
    expect(blocked.status).toBe(429);
  });

  it("shares one bucket when no client address header is present", async () => {
    for (let i = 0; i < 40; i++) await postWith(vendors, {}, {});
    expect((await postWith(vendors, {}, {})).status).toBe(429);
  });

  it("resets the counters if a flood of distinct addresses fills the map", async () => {
    for (let i = 0; i < 40; i++) await post(vendors, {}, "6.6.6.6");
    expect((await post(vendors, {}, "6.6.6.6")).status).toBe(429);
    for (let i = 0; i < 5001; i++) await post(vendors, {}, `flood-${i}`);
    expect((await post(vendors, {}, "6.6.6.6")).status).toBe(400);
  });

  it.each([401, 403, 429, 529])("maps Anthropic status %i to 503 ai_unavailable", async (status) => {
    generateMock.mockRejectedValue(
      Anthropic.APIError.generate(status, { type: "error" }, "upstream says no", new Headers()),
    );
    const res = await post(vendors, validBodies.vendors);
    expect(res.status).toBe(503);
    const body = await json(res);
    expect(body.error?.code).toBe("ai_unavailable");
    expect(body.error?.message).not.toContain("upstream says no");
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
    expect((await json(refused)).error?.code).toBe("refused");

    generateMock.mockRejectedValueOnce(new TypeError("boom"));
    const broken = await post(vendors, validBodies.vendors);
    expect(broken.status).toBe(502);
    expect((await json(broken)).error?.code).toBe("ai_error");
  });

  it("returns 502 when the model output breaks the response contract", async () => {
    generateMock.mockResolvedValue({ data: { vendors: "nope" }, meta });
    expect((await post(vendors, validBodies.vendors)).status).toBe(502);
  });

  it("logs one JSON line without user content", async () => {
    generateMock.mockResolvedValue({ data: { vendors: [] }, meta });
    await post(vendors, validBodies.vendors);
    const logged: unknown = vi.mocked(console.log).mock.calls[0]?.[0];
    const line: unknown = JSON.parse(String(logged));
    expect(line).toMatchObject({
      route: "vendors",
      status: 200,
      model: "test-model",
      inputTokens: 10,
      outputTokens: 5,
    });
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
    expect((await json(res)).draft?.city).toBe("Jaipur");
  });

  it("trims the reply, caps its length, and falls back when it is blank", async () => {
    const draft = { ...EMPTY_DRAFT };
    const ask = async (reply: string) => {
      generateMock.mockResolvedValueOnce({ data: { reply, draft }, meta });
      return (await json(await post(intake, validBodies.intake))).reply ?? "";
    };
    expect(await ask("  Lovely.  ")).toBe("Lovely.");
    expect(await ask("x".repeat(3000))).toHaveLength(2000);
    expect(await ask("   ")).toMatch(/noted/i);
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
    expect(await json(res)).toEqual({
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
      data: {
        calls: [{ name: "set_budget", input: { type: "remove_function", function: "wedding", amount: 500000 } }],
        text: "",
      },
      meta,
    });
    const body = await json(await post(change, validBodies.change));
    expect(body.changes).toEqual([{ type: "set_budget", amount: 500000 }]);
  });

  it("returns text alone as a clarifying question", async () => {
    callToolsMock.mockResolvedValue({ data: { calls: [], text: "How many more guests?" }, meta });
    expect(await json(await post(change, validBodies.change))).toEqual({
      changes: [],
      reply: "How many more guests?",
    });
  });

  it("asks the user to rephrase when there is nothing to apply and nothing said", async () => {
    callToolsMock.mockResolvedValue({ data: { calls: [{ name: "set_budget", input: {} }], text: "" }, meta });
    const body = await json(await post(change, validBodies.change));
    expect(body.changes).toEqual([]);
    expect(body.reply).toMatch(/say it/i);
  });
});

describe("change tools", () => {
  it("has one strict tool per PlanChange variant, without the discriminator in the input", () => {
    expect(CHANGE_TOOLS.map((t) => t.name).sort()).toEqual(
      [
        "set_guests",
        "set_budget",
        "shift_dates",
        "set_function_date",
        "add_function",
        "remove_function",
        "set_style",
        "set_priorities",
        "set_task_status",
        "add_note",
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
    expect((await json(res)).quote?.total).toBe(240000);
  });

  it("files the quote under the requested category, whatever the model returned", async () => {
    generateMock.mockResolvedValue({ data: { quote: { ...extracted.quote, category: "venue" } }, meta });
    const res = await post(quote, validBodies.quote);
    expect((await json(res)).quote?.category).toBe("catering");
  });

  it("refuses a quote with no total instead of returning zero", async () => {
    generateMock.mockResolvedValue({ data: { quote: { ...extracted.quote, total: 0 } }, meta });
    const res = await post(quote, validBodies.quote);
    expect(res.status).toBe(502);
    expect((await json(res)).error?.message).toMatch(/total price/);
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
    expect((await json(res)).options).toEqual([{ title: "Gentle", leverIds: ["trim-all-10"], why: "Keeps the food." }]);
  });

  it("fails cleanly when no option survives", async () => {
    generateMock.mockResolvedValue({ data: { options: [{ title: "X", leverIds: ["invented"], why: "Y" }] }, meta });
    expect((await post(tradeoffs, validBodies.tradeoffs)).status).toBe(502);
  });
});

describe("ideas", () => {
  it("returns only the requested function when regenerating one", async () => {
    const idea = {
      title: "Folk music night",
      description: "Rajasthani folk artists.",
      costImpact: "within",
      fitsBecause: "Elders enjoy it.",
    };
    generateMock.mockResolvedValue({
      data: {
        ideas: [
          { kind: "mehendi", ideas: [idea] },
          { kind: "wedding", ideas: [idea] },
        ],
      },
      meta,
    });
    const res = await post(ideas, {
      ...validBodies.ideas,
      function: "mehendi",
      feedback: "suitable for kids and elders",
    });
    expect((await json(res)).ideas?.map((i) => i.kind)).toEqual(["mehendi"]);
  });
});
