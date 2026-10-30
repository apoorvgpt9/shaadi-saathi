# Testing

No test makes a network call: the Claude client is mocked, and the UI tests stub the API client. A real-API check is a separate manual script (below).

## Suites

Vitest runs two projects, defined in `vitest.config.ts`. Counts are from `npx vitest run --project unit` and `--project ui` at the current commit.

| Project | Environment | Files | Tests | Location |
|---|---|---|---|---|
| `unit` | node | 15 | 152 | `tests/*.test.ts` |
| `ui` | jsdom | 8 | 108 | `tests/ui/**/*.test.tsx` |
| Total | | 23 | 260 | `npm test` |

What each area proves:

| Area | Files | What it proves |
|---|---|---|
| Planning engine | `budget`, `changes`, `edits`, `levers`, `options`, `profile`, `summary`, `timeline`, `format` | Budget maths and status rules, scheduling flags and delay propagation, change application (skips and reports what does not fit, never mutates its input), lever savings, the change summary diff, intake-to-plan clamping, money and date formatting. Date-dependent code takes an injected `today`; fixtures share one date (`TODAY` in `tests/plan-fixtures.ts`). |
| AI routes | `ai-routes`, `prompts`, `health` | Each route through its real handler with `generate` and `callTools` mocked at the module boundary (the error classes stay real so error mapping is genuine). Covers rate limiting, the body cap, validation, 400/422/429/502/503 mapping, one log line without user content, tool-call parsing, and each route's own post-processing. `prompts` checks that user text is wrapped in tags and cannot close them; `health` checks the health route. |
| Claude client | `ai-client` | `modelFor` precedence; adaptive thinking, effort and the refusal fallback in the request (omitted for Haiku); one retry when output does not parse, with tokens summed; no retry on API errors or refusals; truncation stops tool calls. The SDK is exercised through spies on its prototype; no request leaves the process. |
| Client state | `store` | Every reducer action, `Pending` proposals computed from the latest plan, Accept re-applying to the current plan, and `parseStored` rejecting damaged or incompatible storage. |
| API client | `api` | Validated success, error-code mapping, timeout versus offline versus cancelled, and the failure copy. |
| UI components | `tests/ui/*.test.tsx` (8 files) | Behaviour through Testing Library and user-event with `api` calls stubbed: the intake flow, building a plan, tabs and their keyboard handling, budget editing and trade-offs, the timeline, vendors and quotes, ideas, the review dialog (focus, Escape, scrim, Tab wrap, focus return), and Start over. Each file also runs axe on rendered states (57 `expectAccessible` calls in total; see [ACCESSIBILITY.md](ACCESSIBILITY.md)). |

The UI setup (`tests/ui/setup.ts`) adds a small `<dialog>` model for jsdom, which has no modal dialog: `showModal`, `close`, the `close` event and Escape. This means the tests exercise the component's own handlers, not the browser's native modality.

## Coverage

`npm run test:coverage` runs both projects with V8 coverage over all of `src/**`, excluding `src/app/layout.tsx` (it loads `next/font`, which exists only inside the Next build). `vitest.config.ts` fails the run if a threshold is missed:

| Metric | Threshold (config) | Measured at this commit |
|---|---|---|
| Statements | 99% | 99.32% (1030/1037) |
| Branches | 96% | 96.54% (615/637) |
| Functions | 99% | 99.19% (370/373) |
| Lines | 99% | 99.66% (883/886) |

The measured column is the output of `npm run test:coverage` and will drift as code changes; the thresholds are what the gate enforces. Coverage shows which lines ran, not that every behaviour is asserted.

## Commands

```bash
npm test                # all 260 tests, both projects
npx vitest run --project unit   # engine, routes, store, API client (node)
npx vitest run --project ui     # components with jsdom and axe
npm run test:coverage   # the same, with the coverage gate
npm run check           # format check, lint, typecheck, then test:coverage
```

## Real-API smoke test

`scripts/smoke.mjs` is not part of `npm test`. It needs a running server with a real key (`npm run dev` with `ANTHROPIC_API_KEY` in `.env.local`), then:

```bash
node scripts/smoke.mjs http://localhost:3000
```

It sends one request per AI route (six real Claude calls) using the example scenario, checks for HTTP 200 and a route-specific property of the answer (for example, the change route returning the budget, guest and date edits for the example sentence, and the quote route extracting a total of 240000), prints PASS or FAIL per route with latency, and exits non-zero if any fail. Use it after changing prompts, schemas or models.

## What CI enforces

`.github/workflows/ci.yml` runs on pushes to `main` and `attempt-2` and on pull requests, with Node 22:

1. `npm ci`
2. `npm run check`: `format:check` (Prettier over `src`, `tests`, `scripts` and root `*.ts`/`*.mjs`), `lint` (ESLint), `typecheck` (`next typegen && tsc --noEmit`), `test:coverage` (the thresholds above).
3. `npm run build`
4. `npm audit --omit=dev --audit-level=high`

## Not automated

- Colour contrast: axe's `color-contrast` rule is switched off in jsdom, which has no layout. The contrast of the design tokens is not asserted by any test.
- A real browser and real screen readers: nothing runs in a browser engine. Focus return, tab order and dialog behaviour are tested against jsdom, with the dialog modelled as described above.
- There is no end-to-end browser test; `scripts/smoke.mjs` covers the server routes only.
- Answer quality: the suites check shapes, validation and error handling, not whether Claude's advice is good.
