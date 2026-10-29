# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub private vulnerability reporting (the "Security" tab of this repository). If that is unavailable, open an issue asking for a private contact, without including exploit details.

## Key handling

- `ANTHROPIC_API_KEY` is read server-side only, from environment variables. It is never sent to the browser or committed to the repository.
- Only `.env.example` (no secrets) is tracked; `.env*` files are gitignored.

## User data

No user data is stored server-side. Plans are generated per request and are not persisted.
