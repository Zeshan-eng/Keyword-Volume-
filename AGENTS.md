# AGENTS.md — rules for AI coding agents working on this repo

Read this file, then [PRD.md](PRD.md), before making meaningful changes.

## Product rules (non-negotiable)

- Never fabricate data: search volumes, related keywords, domain ages or ratings come from a
  provider or are shown as unavailable (`null`, "Data unavailable", `N/A`). Never use `0` for
  missing data.
- Never substitute one metric for another (for example DA or DataForSEO rank for Ahrefs DR).
  Name every metric after its real provider and definition.
- Each metric loads and fails independently. One failing source must not hide the others.
- Do not change Google's own result title, URL or description. Do not obstruct results.
- Stay in scope. PRD §10 lists what is out of scope. Do not add paid integrations without
  confirming access and cost with the user first.

## Engineering rules

- Manifest V3; least-privilege permissions; no remote code; no `innerHTML`-style sinks in extension
  code (ESLint enforces this). Render untrusted text with `textContent`.
- Secrets live only in `backend/.env` (gitignored). Never commit or print credentials. Never put
  real values in `.env.example` or docs.
- Validate all input on the backend even if the extension already validated it.
- Keep frontend (`extension/`) and backend (`backend/`) separate. Providers go behind adapters
  in `backend/src/providers/`.
- Prefer pure, injectable modules so logic is unit-testable with `node:test`.
- Avoid new dependencies. If one is needed, verify it is maintained, pin it, and run `npm audit`.
- Use the design tokens in `extension/styles/tokens.css` and the bundled Inter font.

## Workflow

1. Understand the requirement and inspect existing code.
2. Plan; identify security and compatibility risks.
3. Implement in small steps.
4. Run `npm run check` (lint + format + tests). All must pass.
5. Review the diff for bugs, security issues and unnecessary complexity.
6. Commit with a Conventional Commit message (`feat:`, `fix:`, `docs:`, `security:` …).
7. Report what was implemented, what was tested (and how), and what remains unverified.

Never claim something works without testing it. Say clearly what could not be verified (for
example live Google pages, which block automated browsers).
