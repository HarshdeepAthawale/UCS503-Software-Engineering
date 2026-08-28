<div align="center">

# 📊 Project Tracker
## Thapar Nexus — Tasks, Traceability, Standups & Decisions

`UCS503 Software Engineering` · **Document 7 of 8** · **Living document — update daily**

</div>

---

## Table of Contents

1. [Status Legend](#1-status-legend)
2. [Task Board](#2-task-board)
3. [Traceability Matrix](#3-traceability-matrix-) ⭐
4. [Daily Standup Log](#4-daily-standup-log)
5. [Decision Log](#5-decision-log)
6. [Bug Register](#6-bug-register)
7. [Metric Snapshots](#7-metric-snapshots)

---

## 1. Status Legend

| Symbol | Meaning |
|---|---|
| ⬜ | Not started |
| 🟦 | In progress |
| 🟨 | Blocked |
| ✅ | Done |
| 🔁 | In review |

**Owners:** `HA` = Harshdeep Athawale · `AC` = Aakriti Chauhan · `SD` = Sehaj Dhillon

---

## 2. Task Board

| ID | Title | Module | Owner | Tier | Status | Blockers | Est → Act |
|---|---|---|---|---|---|---|---|
| T-01 | Repo + project scaffold (Next 15 + Prisma) | Infra | Shared | Must | 🟦 | — | 0.5d → — |
| T-02 | Auth: register/verify/login/refresh | Identity | HA | Must | ✅ | T-01 | 2d → — |
| T-03 | RBAC: matrix + policy + guard + edge gate | Identity | HA | Must | ✅ | T-02 | 0.5d → — |
| T-04 | Prisma schema (identity + profile) | Data | Shared | Must | ✅ | T-01 | 1d → — |
| T-05 | Admin bootstrap (no mock data) | Data | Shared | Must | ✅ | T-04 | 0.5d → — |
| T-06 | Profile CRUD + field-level privacy | Profile | SD | Must | ✅ | T-02 | 1d → — |
| T-07 | Skill taxonomy + user_skills (schema) | Profile | SD | Must | ✅ | T-04 | 1d → — |
| T-08 | Alumni claim flow | Identity | HA | Must | ✅ | T-02 | 1d → — |
| T-09 | Opportunity CRUD + SLA pledge | Opportunity | AC | Must | ✅ | T-04 | 2d → — |
| T-10 | Deadline expiry job | Opportunity | AC | Must | ✅ | T-09 | 0.5d → — |
| T-11 | FTS + GIN + faceted search | Opportunity | AC | Must | ✅ | T-09 | 1d → — |
| T-12 | Application submit + budget (SERIALIZABLE) | Application | AC | Must | ✅ | T-09 | 1.5d → — |
| T-13 | Pipeline + immutable event log | Application | AC | Must | ✅ | T-12 | 1d → — |
| T-14 | TTA + responsiveness badge | Analytics | AC | Must | ✅ | T-13 | 1d → — |
| T-15 | SLA nudge + AT_RISK job | Opportunity | AC | Must | ✅ | T-14 | 0.5d → — |
| T-16 | Scoped messaging | Messaging | SD | Must | ✅ | T-13 | 1d → — |
| T-17 | Notification digest + prefs | Notification | SD | Must | ✅ | T-13 | 1d → — |
| T-18 | Admin console (claims/flags/taxonomy) | Moderation | HA | Must | ⬜ | T-08 | 1.5d → — |
| T-19 | Attestations (SELECTED-gated) | Profile | SD | Should | ⬜ | T-13 | 1d → — |
| T-20 | Rejection reason codes | Application | AC | Should | ⬜ | T-13 | 0.5d → — |
| T-21 | Explainable matching (Jaccard) | Matching | SD | Should | ⬜ | T-07 | 1d → — |
| T-22 | Team formation (complementarity) | Teams | SD | Should | ⬜ | T-21 | 1d → — |
| T-23 | Saved searches + alerts | Opportunity | AC | Should | ⬜ | T-11 | 0.5d → — |
| T-24 | Verified project artifacts (S7) | Profile | SD | Should | ⬜ | T-06 | 0.5d → — |
| T-25 | Analytics dashboard | Analytics | AC | Must | ⬜ | T-14 | 1d → — |
| T-26 | Readiness meter (C1) | Analytics | AC | Could | ⬜ | T-25 | 0.5d → — |
| T-27 | Interview archive (C2) | Content | SD | Could | ⬜ | T-06 | 0.5d → — |
| T-28 | A11y + perf + hardening pass | Shared | Shared | Must | ⬜ | all | 1d → — |
| T-29 | Pilot run + report | Shared | Shared | Must | ⬜ | T-28 | 1d → — |

---

## 3. Traceability Matrix ⭐

> **Disproportionately valuable for marks relative to effort.** Requirement → user story → module → test case → status. Keep it current.

| Req ID | Requirement | User Story | Module | Test Case | Status |
|---|---|---|---|---|---|
| M1 | Institutional identity & roles | US-M1.1 | Identity | IT-01, E2E-3 | ⬜ |
| M2 | Structured profiles + taxonomy | US-M2.1 | Profile | UT-profile, IT-profile | ⬜ |
| M3 | Structured opportunity postings | US-M3.1 | Opportunity | IT-07, UT-opp | 🔁 |
| M4 | Faceted discovery (<2 min) | US-M4.1 | Opportunity | UT-search, perf-p95 | 🔁 |
| M5 | Application pipeline + event log | US-M5.1 | Application | IT-02, IT-04 | 🔁 |
| M6 | TTA & SLA pledges | US-M6.1 | Analytics | UT-tta, IT-05 | 🔁 |
| M7 | Scoped messaging | US-M7.1 | Messaging | IT-06 | 🔁 |
| M8 | Notification digest | US-M8.1 | Notification | UT-digest | 🔁 |
| M9 | Admin console | US-M9.1 | Moderation | E2E-3 | ⬜ |
| S1 | Attestations anchored to work | US-S1.1 | Profile | IT-03 | ⬜ |
| S2 | Structured rejection feedback | US-S2.1 | Application | UT-reject | ⬜ |
| S3 | Application budget | US-S3.1 | Application | IT-02 | ⬜ |
| S4 | Saved searches & alerts | US-S4.1 | Opportunity | UT-saved | ⬜ |
| S5 | Explainable matching | US-S5.1 | Matching | UT-jaccard | ⬜ |
| S6 | Team formation | US-S6.1 | Teams | UT-team | ⬜ |
| S7 | Verified project artifacts | US-S7.1 | Profile | UT-repo-verify | ⬜ |
| C1 | Readiness meter | US-C1.1 | Analytics | UT-readiness | ⬜ |
| C2 | Interview archive | US-C2.1 | Content | UT-archive | ⬜ |

---

## 4. Daily Standup Log

> Format: **Done / Next / Blocked**, per member, dated. (Convert relative dates to absolute.)

### 2026-08-26 (Kickoff)
| Member | Done | Next | Blocked |
|---|---|---|---|
| HA | Baselined 8 docs; repo created | CI skeleton, auth scaffold | — |
| AC | Reviewed opportunity/application scope | Prisma schema for opportunities | — |
| SD | Reviewed profile/matching scope | Wireframes for profile + search | — |

### 2026-08-26 (Phase 1 — IAM foundation)
| Member | Done | Next | Blocked |
|---|---|---|---|
| HA | Scaffolded Next 15 + Prisma; built auth (register/OTP/login/refresh w/ rotation+reuse detection), deny-by-default RBAC (matrix→policy→guard→edge middleware), profile + alumni-claim routes, audit log, security headers; matrix + OTP tests; `docs/Security.md`. Removed all mock data — admin bootstraps from env only. | CI workflow (lint→typecheck→test→migrate); wire skill-taxonomy admin routes | Prisma migration needs a live Postgres URL |
| AC | — | Opportunity schema (Phase 2) | — |
| SD | — | Profile UI + skill assignment endpoint | — |

### 2026-08-27 (Phase 1 — skill taxonomy complete)
| Member | Done | Next | Blocked |
|---|---|---|---|
| HA | Wired T-07 end to end: `Skill.updatedAt/deletedAt` + `UserSkill.updatedAt` (soft delete per Rules.md), strict Zod DTOs (no free-text skills, no mass assignment), `skill.service.ts` (taxonomy CRUD + replace/add/remove own skills, all audited), routes: `GET /api/skills` (any role), `GET/POST /api/admin/skills` + `PATCH/DELETE /api/admin/skills/:id` (ADMIN), `PUT/POST /api/profiles/me/skills` + `DELETE /api/profiles/me/skills/:skillId` (self, ownership-scoped); matrix + validation tests (48 total); vitest env setup so tests run without a live DB. | Phase 2 — Opportunity CRUD (T-09) | Postgres URL still needed for `db:migrate` |
| AC | — | Opportunity schema (Phase 2) | — |
| SD | — | Profile UI in warm-dark style (Fable/Figma) + wire skill assignment endpoint | — |

### 2026-08-28 (Phase 2 — The Spine complete, G2 gate)
| Member | Done | Next | Blocked |
|---|---|---|---|
| HA | Closed the entire Phase 2 loop end to end. **T-10** cron expiry (`/api/cron/*` guarded by `CRON_SECRET`, constant-time). **T-11** FTS discovery: GIN tsvector index + injection-safe `Prisma.sql` keyset query with `q`/type/domain/stipend/skill facets. **T-12/T-13** application pipeline: race-safe budget + partial-unique one-per-student, SERIALIZABLE seat allocation that can't exceed `seat_count`, immutable `ApplicationEvent` log, `first_transition_at` stamp, poster/student views, state-machine module. **T-14** TTA + responsiveness badge (public on postings; poster/admin analytics). **T-15** SLA sweep → `AT_RISK` + poster nudge. **T-16** scoped messaging (thread bound to an application; membership-enforced). **T-17** notifications feed + prefs + cadence digest job, wired into every lifecycle event. 118 tests green; prod build clean (26 API routes, middleware 53.2 kB edge). | Phase 3 (attestations, matching, admin console, analytics dashboard) | `db:migrate` still needs a live Postgres URL |
| AC | (covered under HA this cycle) | Saved searches + alerts (T-23) | — |
| SD | (covered under HA this cycle) | Attestations UI + messaging UI in warm-dark style | — |

### _(Template for future days)_
```
### YYYY-MM-DD
| Member | Done | Next | Blocked |
|---|---|---|---|
| HA |  |  |  |
| AC |  |  |  |
| SD |  |  |  |
```

---

## 5. Decision Log

| Date | Decision | Alternatives considered | Rationale |
|---|---|---|---|
| 2026-08-26 | Postgres FTS + pg_trgm over Elasticsearch | Elasticsearch, Meilisearch | Pilot scale; avoids sync/ops failure mode; documented 300ms/50k migration trigger |
| 2026-08-26 | Polling/SSE over WebSockets (v1) | Socket.io | Low message volume, high latency tolerance; behind an interface for later swap |
| 2026-08-26 | Custom JWT over managed auth | Auth0, Clerk | Course expects auth built, not delegated |
| 2026-08-26 | Attestation gated by SELECTED in DB CHECK | Service-layer enforcement | Makes competency unfarmable at the strongest layer |
| 2026-08-26 | Alumni claim-and-approve flow | `@thapar.edu`-only signup | Alumni lose institute email; naive rule makes role unreachable |
| 2026-08-26 | No mock data/accounts; admin bootstraps from env only | Seeded demo users/skills | Keeps pilot TTA/analytics honest; avoids committed credentials |
| 2026-08-26 | Authoritative role/status re-loaded from DB each request | Trust JWT claims | A stolen/stale token cannot outrun a suspension or role change |
| 2026-08-26 | Deny-by-default RBAC enforced at 4 layers | Single middleware check | Defense-in-depth; matrix-driven CI tests block widening access |
| 2026-08-28 | Scheduled jobs authed by `CRON_SECRET` (constant-time), not the RBAC matrix | A privileged service account | Jobs have no user principal; fail-closed when the secret is unset (endpoint 404s) |
| 2026-08-28 | FTS via Postgres GIN tsvector + `websearch_to_tsquery` | `ILIKE`, Elasticsearch | Sub-linear keyword search inside the DB; injection-safe bound params; matches the M4 <300ms budget |
| 2026-08-28 | Application budget + seat allocation in SERIALIZABLE txns; seats via conditional UPDATE | Advisory locks, app-level mutex | DB is the arbiter: partial-unique blocks double-apply, conditional increment can't exceed `seat_count` |
| 2026-08-28 | Messaging threads bound 1:1 to an application; membership-checked | Open DM inbox | Scoping prevents cold-contact; admin may read (moderation) but not post |
| 2026-08-28 | Notifications delivered via in-app feed + cadence digest; email is a future seam | Immediate email only | No email infra in pilot; `deliveredAt` makes the digest idempotent and email pluggable |

---

## 6. Bug Register

| ID | Severity | Title | Module | Found | Status | Resolution |
|---|---|---|---|---|---|---|
| B-01 | S1 | CI blocked: account billing — Actions never start ("recent account payments have failed…") | Infra | 2026-08-27 | 🟨 | **External** — fix in GitHub Settings → Billing & plans; not a repo issue |
| B-02 | S1 | CI `db:deploy` would fail: no `prisma/migrations` and missing `citext` extension for `@db.Citext` | Infra | 2026-08-27 | ✅ | Added initial migration `20260826191437_init` (patched `CREATE EXTENSION citext`); verified deploy against postgres:16 |

**Severity scale:** S1 Blocker · S2 Major · S3 Minor · S4 Cosmetic.

---

## 7. Metric Snapshots

> Populated once the pilot starts (see `ImplementationPlan.md` §10). Targets from `PRD.md` §8.

| Date | Median TTA | Discovery time | Resolution rate | Status clarity | Attestation adoption | Uptime |
|---|---|---|---|---|---|---|
| _target_ | ≤ 48h | < 2 min | ≥ 80% | ≥ 4.0 | ≥ 25% | ≥ 99% |
| _(pilot day)_ | — | — | — | — | — | — |

---

<div align="center">

[← ImplementationPlan](ImplementationPlan.md) &nbsp;·&nbsp; **Tracker** &nbsp;·&nbsp; [Rules →](Rules.md)

_Update this file at every standup — the traceability matrix is where the marks hide._

</div>
