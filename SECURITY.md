# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub private vulnerability reporting (the "Security" tab of this repository). If that is unavailable, open an issue asking for a private contact, without including exploit details.

## Key handling

- `ANTHROPIC_API_KEY` is read server-side only, from environment variables. It is never sent to the browser or committed to the repository.
- Only `.env.example` (no secrets) is tracked; `.env*` files are gitignored.

## User data

- Your plan is stored only in your own browser (localStorage). There are no accounts and no database.
- AI requests are processed per request and not stored by this app. The text needed for each request is sent to the Anthropic API for processing.
- Server logs contain only the route, status, latency, model and token counts, never user content.

## Protections in place

- Every request body is validated with zod and size-capped; invalid input returns `400`.
- AI routes are rate-limited per IP (20 requests per 10 minutes).
- User messages and pasted vendor quotes are passed to the model as tagged, untrusted data that the model is told never to follow as instructions. Model output is re-validated against strict schemas before use.
- Security headers on every response: Content-Security-Policy, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` and `Permissions-Policy`.
