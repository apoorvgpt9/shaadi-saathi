# Evaluation guide

Each claim below names the file that implements it and, where one exists, a command that checks it. Run commands from the repository root after `npm install`. For what has and has not been verified outside the repository, see [What is verified, and what is not](../README.md#what-is-verified-and-what-is-not).

## Code quality

- **The layering rule is enforced by lint.** The engine (`src/lib/plan/`, `src/lib/format.ts`) may not import React, Next, the AI layer, the store, the browser API client or components, and may not read the clock, `localStorage`, `fetch` or `process.env`. The server's AI layer and route handlers may not import the engine, the store, the browser API client or components. [`eslint.config.mjs`](../eslint.config.mjs). Check: `npm run lint`.
- **One shared contract.** Every stored and transported shape is a zod schema, defined once. [`src/lib/schemas/`](../src/lib/schemas), re-exported by [`src/lib/types.ts`](../src/lib/types.ts). All size limits are one constant, [`LIMITS`](../src/lib/schemas/limits.ts).
- **Strict compiler flags.** `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`. [`tsconfig.json`](../tsconfig.json). Check: `npm run typecheck`.
- **Strict lint.** typescript-eslint `strictTypeChecked` and `stylisticTypeChecked`, `jsx-a11y`, `react-hooks`, `curly` (every branch braced), and `no-console` across `src` except the logger. [`eslint.config.mjs`](../eslint.config.mjs). Check: `npm run lint`.
- **No suppressions and no `any`.** Check, which prints nothing: `grep -rnE "eslint-disable|@ts-(ignore|expect-error|nocheck)|: any\b|<any>|\bas any\b" src tests`.
- **No type assertions other than `as const`.** Check, which prints nothing: `grep -rnE "\bas (unknown|any|[A-Z][A-Za-z]*)\b" src tests --include=*.ts --include=*.tsx --exclude=prompts.ts | grep -vE ":\s*(//|\*)"` (`prompts.ts` is excluded because its prompt text contains the word "as").
- **A one-line header on every source file.** Check, which prints nothing: `for f in $(find src -name '*.ts' -o -name '*.tsx'); do head -n1 "$f" | grep -q '^//' || echo "$f"; done`.
- **The AI layer is split by responsibility.** [`route.ts`](../src/lib/ai/route.ts) is the shared handler; [`errors.ts`](../src/lib/ai/errors.ts) maps errors to HTTP failures; [`rate-limit.ts`](../src/lib/ai/rate-limit.ts) is a limiter with an injected clock; [`client-ip.ts`](../src/lib/ai/client-ip.ts) reads the caller's address; [`logger.ts`](../src/lib/ai/logger.ts) is the only code that writes a log line; [`client.ts`](../src/lib/ai/client.ts) is the only code that talks to Claude; [`prompts.ts`](../src/lib/ai/prompts.ts) holds every prompt; [`tools.ts`](../src/lib/ai/tools.ts) builds the tool definitions.
- **Route handlers are thin.** Each [`src/app/api/*/route.ts`](../src/app/api) supplies its schemas, its prompt, one Claude call and its own post-processing, and delegates the rest to `handleAi`.
- **`"use client"` only where needed.** Two files carry it: [`App.tsx`](../src/components/App.tsx), the client root, and [`error.tsx`](../src/app/error.tsx), which Next requires to be a client component. Check: `grep -rl '"use client"' src`.
- **Uniform formatting.** Prettier at print width 100. Check: `npm run format:check`.

## Security

- **The API key stays on the server.** The only reads of `process.env` in `src` are in [`src/lib/ai/client.ts`](../src/lib/ai/client.ts). Check: `grep -rn "process.env" src`. No `.env*` file is tracked and all are gitignored ([`.gitignore`](../.gitignore)). Check: `git ls-files | grep env` prints nothing.
- **Request bodies are validated and size-capped.** Each route has a zod request schema in [`src/lib/schemas/api.ts`](../src/lib/schemas/api.ts); [`handleAi`](../src/lib/ai/route.ts) returns 400 for invalid input and refuses a body over 100,000 characters, including by declared `content-length` before reading it. Tests: [`tests/ai-routes.test.ts`](../tests/ai-routes.test.ts).
- **AI routes are rate limited** at 40 requests per client per 10 minutes. [`rate-limit.ts`](../src/lib/ai/rate-limit.ts), [`client-ip.ts`](../src/lib/ai/client-ip.ts). Tests: [`tests/ai-rate-limit.test.ts`](../tests/ai-rate-limit.test.ts), [`tests/ai-client-ip.test.ts`](../tests/ai-client-ip.test.ts). Counts are kept per server instance; see [SECURITY.md](../SECURITY.md).
- **Errors never leak SDK text.** [`toApiFailure`](../src/lib/ai/errors.ts) maps every error to a fixed status, code and message. Test: [`tests/ai-errors.test.ts`](../tests/ai-errors.test.ts).
- **Logs carry no user content.** [`logRequest`](../src/lib/ai/logger.ts) writes route, status, latency, model and token counts. Test: "logs one JSON line without user content" in [`tests/ai-routes.test.ts`](../tests/ai-routes.test.ts).
- **User text is untrusted data in prompts.** Messages, quotes and feedback are wrapped in tags the model is told never to obey, and the text cannot close the tag. [`prompts.ts`](../src/lib/ai/prompts.ts), [`tests/prompts.test.ts`](../tests/prompts.test.ts).
- **Model output is validated before use.** `handleAi` applies the response schema (502 on failure). The change route drops tool calls that fail the `PlanChange` schema; the trade-off route drops lever ids the engine did not offer. [`src/app/api/change/route.ts`](../src/app/api/change/route.ts), [`src/app/api/tradeoffs/route.ts`](../src/app/api/tradeoffs/route.ts).
- **Stored plans are validated on load.** [`parseStored`](../src/lib/store.ts) returns `null` for corrupt or incompatible data. Tests: [`tests/store.test.ts`](../tests/store.test.ts).
- **Security headers on every response:** Content-Security-Policy, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. [`next.config.ts`](../next.config.ts). Check: `npm run build && npm start`, then `curl -I http://localhost:3000/`.
- **No raw HTML injection.** `grep -rn "innerHTML" src` prints nothing.
- **Dependencies are audited in CI.** `npm audit --omit=dev --audit-level=high`, in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Efficiency

- **The engine runs in the browser with no network.** [`PlanScreen`](../src/components/PlanScreen.tsx) calls the engine directly, and lint forbids `fetch` and the AI layer inside [`src/lib/plan/`](../src/lib/plan).
- **One Claude request per user action.** Each route makes a single `generate` or `callTools` call. `generate` repeats the request once, only when the output does not parse. [`client.ts`](../src/lib/ai/client.ts), [`tests/ai-client.test.ts`](../tests/ai-client.test.ts).
- **Effort and model are chosen per route.** The effort and the output-token cap are in the `ROUTES` table in [`client.ts`](../src/lib/ai/client.ts); the model comes from `ANTHROPIC_MODEL_<ROUTE>`, then `ANTHROPIC_MODEL`, then a default (`modelFor`).
- **Bounded waits.** Each request to Claude has a 100 second timeout with SDK retries off, inside the routes' `maxDuration` of 300 seconds.
- **The first screen is prerendered.** `npm run build` lists `/` as static (`○`), and `.next/server/app/index.html` contains the intake screen's text. [`src/app/page.tsx`](../src/app/page.tsx), [`usePlan.ts`](../src/components/usePlan.ts) (saved state is applied after mount).
- **Five runtime dependencies:** `@anthropic-ai/sdk`, `next`, `react`, `react-dom`, `zod`. [`package.json`](../package.json).
- **Bounded memory in the limiter.** At most 5,000 tracked keys; see `maxTracked` in [`rate-limit.ts`](../src/lib/ai/rate-limit.ts), tested in [`tests/ai-rate-limit.test.ts`](../tests/ai-rate-limit.test.ts).

## Testing

- **296 tests in 27 files, with no network calls.** Two Vitest projects: `unit` (node, 19 files, 187 tests) and `ui` (jsdom, 8 files, 109 tests). [`vitest.config.ts`](../vitest.config.ts). Check: `npm test`.
- **Coverage is gated** at statements 99%, branches 96%, functions 99% and lines 99%, over all of `src` except `src/app/layout.tsx`. Check: `npm run test:coverage`.
- **The engine has a scenario spec.** A table of plain-language stories, each run through the real engine without mocks. [`tests/scenarios.test.ts`](../tests/scenarios.test.ts).
- **Every AI route runs through its real handler** with Claude mocked at the module boundary and the error classes left real. [`tests/ai-routes.test.ts`](../tests/ai-routes.test.ts); the Claude client is tested separately in [`tests/ai-client.test.ts`](../tests/ai-client.test.ts).
- **Components are tested through the user's actions,** with axe run on rendered states. [`tests/ui/`](../tests/ui).
- **CI runs the same gate as local development:** `npm run check`, `npm run build`, `npm audit`. [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Details: [TESTING.md](TESTING.md).

## Accessibility

- **Patterns and where they live** are listed in [ACCESSIBILITY.md](ACCESSIBILITY.md): landmarks and a skip link, WAI-ARIA tabs ([`Tabs.tsx`](../src/components/ui/Tabs.tsx)), a native modal dialog with focus handling ([`ChangeSummaryPanel.tsx`](../src/components/ChangeSummaryPanel.tsx)), live regions, labelled controls, status written in text, visible focus and reduced motion ([`globals.css`](../src/app/globals.css)).
- **Lint:** `jsx-a11y` runs over `src` and `tests`. Check: `npm run lint`.
- **Tests:** vitest-axe runs inside the component suite, and keyboard and focus behaviour is asserted in [`tests/ui/tabs.test.tsx`](../tests/ui/tabs.test.tsx) and [`tests/ui/change-summary.test.tsx`](../tests/ui/change-summary.test.tsx). Check: `npx vitest run --project ui`.
- **Contrast ratios** for every text and background token pair are tabulated in [ACCESSIBILITY.md](ACCESSIBILITY.md#contrast-tokens).
- **Limits:** no screen-reader testing, and no test asserts colour contrast. See [Not covered](ACCESSIBILITY.md#not-covered).

## Problem alignment

| Ask | Where the user finds it | Implementation |
|---|---|---|
| **Budgets** | Budget tab, the budget bar, "Help me get back under budget" | [`budget.ts`](../src/lib/plan/budget.ts), [`benchmarks.ts`](../src/lib/plan/benchmarks.ts), [`levers.ts`](../src/lib/plan/levers.ts), [`options.ts`](../src/lib/plan/options.ts), [`BudgetTab.tsx`](../src/components/BudgetTab.tsx), [`TradeoffPanel.tsx`](../src/components/TradeoffPanel.tsx), [`/api/tradeoffs`](../src/app/api/tradeoffs/route.ts) |
| **Timelines** | Timeline tab, "Next 3 things to do" | [`timeline.ts`](../src/lib/plan/timeline.ts), [`TimelineTab.tsx`](../src/components/TimelineTab.tsx), [`NextTasks.tsx`](../src/components/NextTasks.tsx) |
| **Vendor checklists** | Vendors tab: checklists, pasted quotes, comparison | [`VendorsTab.tsx`](../src/components/VendorsTab.tsx), [`QuoteCompare.tsx`](../src/components/QuoteCompare.tsx), [`/api/vendors`](../src/app/api/vendors/route.ts), [`/api/quote`](../src/app/api/quote/route.ts) |
| **Personalized ideas** | Ideas tab, with feedback to regenerate | [`IdeasTab.tsx`](../src/components/IdeasTab.tsx), [`/api/ideas`](../src/app/api/ideas/route.ts) |
| **Understanding the family** | The intake chat and the "What I've understood" panel | [`IntakeChat.tsx`](../src/components/IntakeChat.tsx), [`ProfilePanel.tsx`](../src/components/ProfilePanel.tsx), [`profile.ts`](../src/lib/plan/profile.ts), [`/api/intake`](../src/app/api/intake/route.ts) |
| **Adapting to change** | The "What changed?" box and the review dialog | [`ChangeBox.tsx`](../src/components/ChangeBox.tsx), [`ChangeSummaryPanel.tsx`](../src/components/ChangeSummaryPanel.tsx), [`changes.ts`](../src/lib/plan/changes.ts), [`summary.ts`](../src/lib/plan/summary.ts), [`/api/change`](../src/app/api/change/route.ts) |

The scenario spec [`tests/scenarios.test.ts`](../tests/scenarios.test.ts) exercises the budget, timeline, change, lever and quote paths together.
