// Manual smoke test for the AI routes. Needs a running server with a real key:
//   npm run dev            (with ANTHROPIC_API_KEY in .env.local)
//   node scripts/smoke.mjs [baseUrl]      default http://localhost:3000
// It makes real API calls (about 7), so it is not part of `npm test`.

const base = process.argv[2] ?? "http://localhost:3000";
const day = 86_400_000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
const today = iso(0);

// The explainer scenario: Tier-2 city, 200 guests, 8 lakh, about four months away, mehendi the day before.
const profile = {
  city: "Jaipur",
  cityTier: "tier2",
  guests: 200,
  budget: 800000,
  functions: [
    { kind: "mehendi", date: iso(119), guests: 120 },
    { kind: "wedding", date: iso(120), guests: 200 },
  ],
  style: "classic",
  categoryStyles: {},
  priorities: ["catering", "photography"],
  mustHaves: [],
  notes: [],
};

const quoteText = `Shree Caterers, Jaipur. Veg wedding menu for 200 guests at Rs 1,200 per plate: Rs 2,40,000.
Includes two live counters, service staff and crockery. GST 5% extra. Tasting charged separately.`;

const checks = [
  ["intake", {
    messages: [{ role: "user", content: `We're planning our wedding in Jaipur on ${iso(120)}, around 200 guests, budget 8 lakh. Mehendi the day before with about 120 people. Food matters most to us, then photography.` }],
    draft: null,
    today,
  }, (r) => r.draft?.city && r.draft?.budget === 800000 && typeof r.reply === "string"],
  ["vendors", { profile }, (r) => r.vendors?.length > 0],
  ["ideas", { profile, function: null, feedback: null, previous: [] }, (r) => r.ideas?.length > 0],
  ["change", { message: "50 more guests, budget down to 7 lakh, and the wedding two weeks earlier", profile, tasks: [], today },
    (r) =>
      r.changes?.some((c) => c.type === "set_budget" && c.amount === 700000) &&
      r.changes.some((c) => c.type === "set_guests" && c.count === 250) &&
      r.changes.some((c) => c.type === "shift_dates" && c.days === -14)],
  ["quote", { text: quoteText, category: "catering", guests: 200 }, (r) => r.quote?.total === 240000],
  ["tradeoffs", {
    profile,
    total: 958000,
    levers: [
      { id: "trim-nonwedding-20", label: "Trim guests at every non-wedding function by 20%", saving: 30000, touchesPriority: false },
      { id: "trim-all-10", label: "Trim all guests by 10%", saving: 70000, touchesPriority: false },
      { id: "decor-simple", label: "Step decor down to Simple", saving: 90000, touchesPriority: false },
      { id: "catering-simple", label: "Step catering down to Simple", saving: 120000, touchesPriority: true },
    ],
  }, (r) => r.options?.length > 0 && r.options.every((o) => o.leverIds.length > 0)],
];

let failed = 0;
for (const [route, body, ok] of checks) {
  const started = Date.now();
  try {
    const res = await fetch(`${base}/api/${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    const pass = res.status === 200 && ok(json);
    if (!pass) failed++;
    console.log(`${pass ? "PASS" : "FAIL"} ${route} ${res.status} ${Date.now() - started}ms${pass ? "" : ` ${JSON.stringify(json).slice(0, 300)}`}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${route} ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
