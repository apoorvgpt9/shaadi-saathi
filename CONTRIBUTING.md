# Contributing

## Setup

Requires Node.js 20 or newer (`engines` in `package.json`; CI uses 22).

```bash
npm install
cp .env.example .env.local   # then set ANTHROPIC_API_KEY (server-side only)
npm run dev                  # http://localhost:3000
```

The tests need no key and make no network calls. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first; it explains the layers and the dependency rule.

## Where code goes

| You are adding | It goes in | Notes |
|---|---|---|
| A shared shape, limit or enum | `src/lib/schemas/` | Import it through `@/lib/types`, and `z` only from `src/lib/schemas/zod.ts`. Changing the persisted `Plan` shape must keep stored plans parseable or bump `version` in `plan.ts`. |
| Budget, schedule or edit logic | `src/lib/plan/` | Pure functions of their arguments. Import only schemas and other engine modules. |
| Reducer actions, persisted state | `src/lib/store.ts` | No I/O. `usePlan.ts` owns localStorage. |
| A call to an AI route from the browser | `src/lib/api.ts` | Validate the reply; never throw. |
| A prompt, a tool, a Claude call | `src/lib/ai/` | `client.ts` is the only code that talks to Claude. |
| A new AI route | `src/app/api/<name>/route.ts` | Wrap the call in `handleAi`; add the route to `RouteName` and `ROUTES` in `client.ts`. |
| UI | `src/components/` (shared primitives in `ui/`) | Components call the engine for numbers; they never compute money themselves. |
| Cost assumptions | `src/lib/plan/benchmarks.ts` | The single home of rates, multipliers and labels. |
| A test | `tests/` (engine, routes, store, API client), `tests/ui/` (components) | See [docs/TESTING.md](docs/TESTING.md). Shared fixtures are in `tests/plan-fixtures.ts`. |

## Rules that do not bend

- **No `any`, no suppressions.** Lint runs typescript-eslint `strictTypeChecked` and `stylisticTypeChecked` with `jsx-a11y` and `react-hooks`, and no code uses `any`, `@ts-ignore`, `@ts-expect-error` or `eslint-disable`. Fix the type or the code; do not silence the check. The tsconfig adds `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` and `noFallthroughCasesInSwitch`.
- **The engine stays pure.** No React, no AI layer, no I/O, no clock: take `today` as a parameter. Check it with the greps in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#the-dependency-rule).
- **Claude never sets a rupee amount used in a calculation.** Money is computed by the engine. The one place a model reads a number is extracting a total from a quote the user pasted; the user then chooses to use it. AI proposals go through the engine and the review dialog.
- **Keys stay on the server.** `ANTHROPIC_API_KEY` is read from the server environment by the SDK client built in `src/lib/ai/client.ts`, and no browser code references it. Never commit `.env*` files other than `.env.example`, and never log user content.
- **Validate at every boundary** with the zod schemas: request bodies, model output, API replies and localStorage.
- **Accessibility is part of done.** Follow the patterns in [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) and add an axe check for new UI states.
- **Comments say why, not what.** One line, and only where the code cannot show the reason.

## Before every commit

```bash
npm run check
```

It runs, in order: `format:check` (Prettier), `lint`, `typecheck` (`next typegen && tsc --noEmit`) and `test:coverage`, which also enforces the coverage thresholds in `vitest.config.ts`. CI runs the same command, then `npm run build` and `npm audit --omit=dev --audit-level=high`. Run `npm run format` to fix formatting. Markdown is outside Prettier's scope, so keep it tidy by hand.

If a prompt, schema or model changes, also run `node scripts/smoke.mjs` against a running server with a real key.

## Commit style

Conventional Commits: `type(scope): summary`, lowercase, imperative, no trailing full stop. Types in use: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`. The scope is optional, for example `fix(ui): ...` or `docs(lib): ...`. One logical change per commit.
