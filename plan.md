# UCS503 — how this repo does software engineering

This is the **application plan**: every course concept maps onto an artifact in Thapar Nexus and onto a [mattpocock/skills](https://github.com/mattpocock/skills) loop. It is not a second `MasterPlan.md`. Change requirements in `docs/MasterPlan.md` first; this file only says *how we engineer*.

**Product (ubiquitous language):** opportunity pipeline. Ghosting (F3) is the disease. TTA is computed from the event log. See `CONTEXT.md`.

## Process

Iterative delivery with **tracer-bullet** slices (one posting → apply → decision path that actually runs), not a waterfall of documents then code.

| Course idea | Where it lives | Agent loop |
|---|---|---|
| SDLC / lifecycle | `docs/ImplementationPlan.md` phases + gates G1–G3 | `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement` |
| Requirements engineering | `docs/PRD.md` (SRS): ranked F1–F4, MoSCoW, stories, NFRs, non-goals | `/grill-with-docs`, `/domain-modeling` |
| Ubiquitous language | `CONTEXT.md` | Use glossary terms; `_Avoid_` is binding |
| Analysis & UML | `docs/AppFlow.md` (use cases, state machine, sequence, activity) | Read before changing application states |
| Architecture | `docs/TechSpecifications.md`; layered `src/app` → `src/lib/services` → `src/lib/domain` | `/codebase-design` (deep modules, seams) |
| Data design | `docs/Schema.md`; Prisma in `prisma/` | Invariants in the DB (CHECKs), not only in UI |
| UI design | `docs/Design.md`; tokens in `src/app/globals.css` | `/prototype` only when the question must be *seen* |
| Construction standards | `docs/Rules.md` | `/tdd` at domain seams; `/code-review` before commit |
| SCM | Conventional commits, `feat/`/`fix/` branches, PR ≥ 1 approval | Never AI `Co-Authored-By` (Rules §2.1) |
| SQA / DoD | Rules §7; Tracker traceability | Types + Vitest must stay green |
| Project mgmt | `docs/Tracker.md` (T-ids, risks, bug register) | GitHub Issues = agent queue (`docs/agents/issue-tracker.md`) |
| Risk | ImplementationPlan §8 | Surface contradictions with Tracker D-nn / `docs/adr/` |
| Maintenance | Diagnosing regressions | `/diagnosing-bugs`: tight *red* loop before any hypothesis |

Unsure which skill? `/ask-matt`. Incoming reports you didn't write: `/triage`. Huge fog-of-war work: `/wayfinder`.

## Architecture (keep it this shape)

```
Member (browser)
  → Next.js App Router (pages + `/api`)
    → IAM guard (deny-by-default; reload role/status from DB)
      → domain (state machine, TTA, budget) + services
        → PostgreSQL (append-only application events)
```

**Seams that must stay deep:** `application-state`, responsiveness/TTA, IAM policy, opportunity eligibility. Callers should not re-implement those rules in JSX.

**Hard exclusions (PRD non-goals):** no infinite feed, likes, follower counts, DMs unattached to an application. Those are not “later features”; they invert the success metric.

## Testing (V-model, as shipped)

| Level | Course name | What we actually run |
|---|---|---|
| Unit | Component/unit | Vitest on domain + validation + IAM matrix (`npm test`) |
| Integration | Interface | API route tests where they exist; budget/transition invariants |
| System / E2E | Acceptance | **Gap (T-38):** Playwright / Supertest harness not in yet |
| Types | Static analysis | `npm run typecheck` — no `any` |

A new behaviour needs a test that would have gone **red** without the change. Prefer the domain seam (`src/lib/domain/*`) over snapshotting pages.

## Requirements still open (honest)

These are course-visible gaps, not secret backlog:

| ID | Concept | Status |
|---|---|---|
| T-19 | Attestation (SELECTED-gated competency) | Not built — flagship Should |
| T-38 | Integration + E2E | Not built |
| T-28 | WCAG 2.1 AA + perf pass | Not done |
| T-40 | PRD user-story backfill | Partial |
| C3–C7 | Remaining-Work-Plan Phase C | See `docs/Remaining-Work-Plan.md` |
| Alumni claim **queue UI** | Admin SRS vs console | API exists; console is provision-only |

Pilot honesty: no mock members, no seeded applications. TTA stays honest.

## Agent memory (Cursor)

| Load | File |
|---|---|
| Always | `AGENTS.md`, `.cursor/rules/engineering-harness.mdc` |
| Glossary | `CONTEXT.md` |
| Skills | `.agents/skills/` (same tree as `.cursor/skills`) |
| Tracker config | `docs/agents/issue-tracker.md`, `triage-labels.md`, `domain.md` |
| Irreversible calls | `docs/adr/` + Tracker §9 D-nn |

Update skills with `npx skills update` (canonical tree is `.agents/skills` only). Recreate the Cursor junction with `npm run link:cursor-skills`.
