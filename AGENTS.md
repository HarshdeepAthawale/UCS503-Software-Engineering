# Thapar Nexus — agent harness

A verified **opportunity pipeline** for the institute: an application must reach a **decision**, and silence must be visible. Not a network. Not a feed.

Course docs (`docs/PRD.md`, `docs/Tracker.md`, `docs/Rules.md`) are human artifacts. This file is the pointer layer for agents.

**UCS503 map:** [plan.md](plan.md) — course concept → repo artifact → skill. Apply it on every product change (`/ucs503-software-engineering`).

## Before you explore

Read `CONTEXT.md` (glossary). Then `docs/agents/domain.md`. If the work touches a recorded trade-off, read matching ADRs in `docs/adr/` and the historical log in `docs/Tracker.md` §9.

## Feedback loops

- Types: `npm run typecheck`
- Tests: `npm test` (Vitest). A new behaviour needs a test that would have gone red without the change.
- Dev server: `npm run dev`

Do not invent mock users or seed data; the project forbids mock accounts (see `CONTEXT.md`).

## Agent skills

Skills are installed from [mattpocock/skills](https://github.com/mattpocock/skills) into `.agents/skills/`. Cursor discovers them at `.cursor/skills` (junction, gitignored). Recreate with `node scripts/link-cursor-skills.mjs`. Update with `npx skills update`. Do not copy skill folders.

**Idea → ship (main flow):** `/grill-with-docs` → (`/prototype` if the question must be run) → `/to-spec` → `/to-tickets` → `/implement` (drives `/tdd`, then `/code-review`). Unsure which skill? `/ask-matt`.

**Something broken:** `/diagnosing-bugs` — no hypothesis until a *tight* loop already goes red on this bug.

**Incoming issues you didn't write:** `/triage`. Tickets from `/to-tickets` are already agent-ready; do not triage those.

### Issue tracker

GitHub Issues on `HarshdeepAthawale/UCS503-Software-Engineering`, via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical five: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Coding standards (this repo)

`docs/Rules.md` is the human standard. Short version for agents:

- Deny-by-default RBAC; never treat JWT role/status as authoritative — reload from the DB.
- Parameterized queries only. Soft-delete, never hard-delete.
- Application state transitions are append-only events. TTA is computed from timestamps, never self-reported.
- No `any`. No engagement mechanics (likes, feeds, follower counts, free-form DMs).
