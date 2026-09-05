---
name: ucs503-software-engineering
description: >-
  Applies UCS503 software-engineering practice to Thapar Nexus (SRS, UML, state
  machines, TDD, traceability, NFRs, deny-by-default RBAC, configuration
  management). Use when implementing or reviewing product work, when the user
  mentions software engineering, SDLC, SRS, UML, UCS503, or course deliverables,
  or when changing PRD/Tracker/Schema/AppFlow.
---

# UCS503 on this repo

Read [plan.md](../../../plan.md) first (course concept → artifact → skill). Then `CONTEXT.md`. Do not invent a parallel glossary.

## Steps

1. Name the change in **pipeline** language (opportunity, application, TTA, SLA pledge, attestation). If a synonym is listed under `_Avoid_` in `CONTEXT.md`, drop it.
2. Classify the work:
   - **Requirements / scope** → `docs/PRD.md` + MasterPlan; MoSCoW; explicit non-goals.
   - **State / use case** → `docs/AppFlow.md` state machine; never invent a transition the table forbids.
   - **Persistence / invariant** → `docs/Schema.md` + Prisma; prefer a DB CHECK over a UI-only rule.
   - **Behaviour** → `/tdd` at a domain seam (`src/lib/domain`, services), then the route.
   - **Hard bug** → `/diagnosing-bugs` (tight red loop before hypotheses).
3. Traceability: if the change maps to a Tracker T-id, update that row in the same change. Agent tickets live on GitHub (`docs/agents/issue-tracker.md`).
4. Architecture: keep modules **deep** (`/codebase-design`). IAM reloads role/status from the DB. Application events are append-only. TTA is computed, never typed in by a poster.
5. Done when: `npm run typecheck` and `npm test` are green for the seam you touched, and you did not add feed/likes/follower/DM-unattached-to-application behaviour.

## Pointers

- Process map: [plan.md](../../../plan.md)
- Skills router: `.agents/skills/ask-matt/SKILL.md`
- Human rules: `docs/Rules.md`
