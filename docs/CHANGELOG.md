# Changelog

All notable changes to ShaadiSaathi. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow the `version` field in [`package.json`](../package.json).

## [0.3.0]

### Added

- AI layer modules with one job each: [`rate-limit.ts`](../src/lib/ai/rate-limit.ts) (a limiter with an injected clock), [`client-ip.ts`](../src/lib/ai/client-ip.ts), [`errors.ts`](../src/lib/ai/errors.ts) (error types and the mapping to HTTP failures) and [`logger.ts`](../src/lib/ai/logger.ts), with tests for each.
- A table-driven scenario spec for the planning engine, [`tests/scenarios.test.ts`](../tests/scenarios.test.ts), where each row is a plain-language story run through the real engine.
- A lint gate for the dependency rule: `no-restricted-imports` blocks keep the engine free of UI, store, network and AI imports (and of clock, storage and environment reads), and keep server code free of engine and UI imports. See [`eslint.config.mjs`](../eslint.config.mjs).
- The review guide in the README (pillar table, five files to start with, an annotated file tree, a verified and not-verified table), [EVALUATION.md](EVALUATION.md) and this changelog.

### Changed

- The shared route handler, `handleAi`, is now a short function over the new modules; behaviour, status codes and messages are unchanged.
- Every source file starts with a one-line header stating its responsibility, and exported components and engine functions carry JSDoc, with `@example` blocks on the engine.
- Engine and library code reads plainly: braced branches (enforced by the `curly` lint rule), named intermediate values, one-idea functions.
- Components are typed with explicit return types, and the type casts around CSS custom properties are gone, replaced by the `cssVars` helper.
- `"use client"` is declared only at the client root and the error boundary; imported components become client code automatically.
- Prettier print width is 100.
- Setup now uses a `.env.local` file created by hand, and the variables are documented in the README table.
- SECURITY.md describes the rate limiter as a design note: which headers it keys on, and that counts are per server instance.

## [0.2.0]

### Added

- Strict static analysis: typescript-eslint `strictTypeChecked` and `stylisticTypeChecked`, `jsx-a11y` and `react-hooks`, with a stricter [`tsconfig.json`](../tsconfig.json) (`noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`).
- Component tests with Testing Library and user-event, axe accessibility checks on rendered states, and a jsdom model of the native `<dialog>`.
- Coverage measured over all of `src` and enforced by thresholds in [`vitest.config.ts`](../vitest.config.ts).
- The docs set: [ARCHITECTURE.md](ARCHITECTURE.md), [TESTING.md](TESTING.md), [ACCESSIBILITY.md](ACCESSIBILITY.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).
- A single `npm run check` command (format check, lint, typecheck, tests with coverage), run by CI before the build and the dependency audit.

### Changed

- The shared contract is split from one large file into schema modules (limits, domain, plan, views, api) behind the [`src/lib/types.ts`](../src/lib/types.ts) barrel.
- Contract JSDoc and module headers were added.

### Fixed

- The budget tab has a valid heading outline, and every form field has an accessible name.
- Schema modules import zod directly, so the bundler tree-shakes it again.

## [0.1.0]

The first complete app.

### Added

- A deterministic planning engine that runs in the browser: bottom-up budget estimates with Estimate, Quoted and Confirmed statuses; a dependency-ordered timeline of 27 tasks with urgent, at-risk and clash flags; application of structured plan changes; savings levers priced by the engine; and a diff-based "what changed" summary.
- Six stateless AI routes (intake, change, tradeoffs, vendors, ideas, quote) using structured output and function calling, with per-route effort and model configuration, zod validation of every request and response, a body-size cap, a per-client rate limit, mapped error responses, and logs that carry no user content.
- The interface: an intake chat with a live profile panel, the plan workspace with Budget, Timeline, Vendors and Ideas tabs, quote paste and comparison, a trade-off panel, and a native-dialog review of every proposed change with Accept and Undo.
- Plans saved only in the browser, with no account.
- Proposals that are functions of the plan, re-applied on Accept, so edits made while a review is open are kept.
- A server-rendered first screen, with saved state applied after mount.
- Security headers on every response and a health route.
