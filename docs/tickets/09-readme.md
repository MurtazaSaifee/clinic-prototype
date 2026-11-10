# 09 README

Estimate: 5m.

## Goal
A screener can run the prototype in one go and understand what was built and what wasn't.

## Contents
- Requirements (Node 26, Postgres running locally) and setup: `npm install`, `npm run db:reset`, `npm run dev`. Test and typecheck commands.
- What was built, by role, mapped to the owner's needs.
- What was left out and why (spec section 4).
- Link to `docs/spec.md` and `docs/tickets/`.
- Known limits: no real auth, no audit log, matching runs in code.

## Acceptance
- Fresh clone into a scratch folder, follow the README exactly, app runs and tests pass.
