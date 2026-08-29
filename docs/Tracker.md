<div align="center">

# 📊 Project Tracker
## Thapar Nexus — Scope Ledger, Traceability, Standups & Decisions

`UCS503 Software Engineering` · **Document 7 of 8** · **Living document — update at every standup**

**Last verified against the codebase:** 2026-08-29 · `main` @ `a6c9c7c`

</div>

---

## Table of Contents

1. [How to Read This Document](#1-how-to-read-this-document)
2. [Build State at a Glance](#2-build-state-at-a-glance)
3. [Scope Ledger — PRD Requirement → Build State](#3-scope-ledger--prd-requirement--build-state-) ⭐
4. [Traceability Matrix](#4-traceability-matrix-) ⭐
5. [NFR Conformance & Deviations from the PRD](#5-nfr-conformance--deviations-from-the-prd)
6. [Task Board](#6-task-board)
7. [Milestone Gates](#7-milestone-gates)
8. [Daily Standup Log](#8-daily-standup-log)
9. [Decision Log](#9-decision-log)
10. [Gap & Bug Register](#10-gap--bug-register)
11. [Metric Snapshots](#11-metric-snapshots)

---

## 1. How to Read This Document

This tracker is subordinate to [`PRD.md`](PRD.md) and [`MasterPlan.md`](MasterPlan.md). **It never introduces a requirement.** Every row here points back to a PRD identifier (`M1`–`M9`, `S1`–`S7`, `C1`–`C9`, `NFR-*`). If work exists that the PRD does not cover, it is recorded in §6 as an **infrastructure or presentation task** with no requirement ID — and that absence is itself the flag to go amend the PRD.

### Status legend

| Symbol | Meaning | Bar for claiming it |
|---|---|---|
| ⬜ | Not started | No schema, no service, no route |
| 🟦 | In progress / **partial** | Some acceptance criteria met, at least one named gap remains |
| 🟨 | Blocked | Named blocker, named owner of the unblock |
| 🔁 | In review | Code merged, verification outstanding |
| ✅ | Done | **All** PRD acceptance criteria met, typecheck + tests + build green |

> **A requirement is 🟦 and not ✅ if even one acceptance criterion in PRD §6 is unmet.** Partial credit is stated, never rounded up. The gap column exists so a 🟦 is actionable rather than vague.

**Owners:** `HA` = Harshdeep Athawale (1024031062) · `AC` = Aakriti Chauhan (1024031055) · `SD` = Sehaj Dhillon (1024030620)

---

## 2. Build State at a Glance

Verified by running the toolchain on 2026-08-29, not by reading the task board.

| Check | Command | Result |
|---|---|---|
| Type safety | `npm run typecheck` | ✅ clean (strict mode, no `any`) |
| Unit tests | `npm test` | ✅ **183 passed** across 13 files |
| Production build | `npm run build` | ✅ green — 50 routes (47 API), middleware 53.4 kB |
| Database | Supabase Postgres 16 | ✅ live, **9/9 migrations applied**, 20 tables |
| Seed state | — | 2 users (1 `ADMIN`, 1 `STUDENT`), all other tables empty — **by design**, see D-06 |
| CI | GitHub Actions | ❌ **no workflow exists** — see G-01 |
| Integration / E2E tests | — | ❌ **none exist** — see G-02 |

**Tier completion against the PRD:**

| Tier | ✅ Done | 🟦 Partial | ⬜ Not started | Total |
|---|---|---|---|---|
| 🟥 **MUST** (M1–M9) | 9 | 0 | 0 | 9 |
| 🟨 **SHOULD** (S1–S7) | 2 | 0 | 5 | 7 |
| 🟩 **COULD** (C1–C9) | 0 | 0 | 9 | 9 |

> **Reading:** the spine is standing and demoable end to end. **Every MUST requirement (M1–M9) is now ✅** — M8, M2, M4 and M9 all closed on 2026-08-29. The remaining work is SHOULD/COULD-tier differentiators, CI (T-34), and the pilot (T-29).

---

## 3. Scope Ledger — PRD Requirement → Build State ⭐

The authoritative answer to *"what did we actually build?"* — one row per PRD feature ID, with the file that proves it and the gap that blocks it.

### 3.1 🟥 MUST — The Spine (PRD §5.1)

| ID | Requirement (PRD §5.1) | Status | Evidence in repo | Remaining gap |
|---|---|---|---|---|
| **M1** | Institutional identity & roles | ✅ | `src/lib/services/auth.service.ts`, `alumni.service.ts`, `src/lib/iam/{policy,guard,permissions}.ts`, `src/middleware.ts`, 10 `/api/auth/*` routes | — |
| **M2** | Structured profiles + controlled skill vocabulary | ✅ | `profile.service.ts`, `skill.service.ts`, `Profile`/`Skill`/`UserSkill` + **`ProfileProject`** models, `cgpaPublic` privacy gate; **projects with repo links** via `profile_projects` table, per-item CRUD under `/api/profiles/me/projects`, http(s)-only URL guard, profile editor UI | — |
| **M3** | Structured opportunity postings | ✅ | `opportunity.service.ts`, `Opportunity`/`OpportunitySkill`, `SlaPledge` enum, `expirePastDeadline()`, `/api/cron/expire-opportunities` | — |
| **M4** | Faceted discovery | ✅ | GIN `tsvector` + `websearch_to_tsquery` in `listOpportunities()`; facets `q`/type/domain/stipend/skill; **user-selectable sort** (newest / closing-soon / most-seats), each keyset-paginated on its own column; **NFR-P1 measured** (`scripts/bench-search.mjs`) | — |
| **M5** | Application pipeline + immutable event log | ✅ | `application.service.ts` (SERIALIZABLE seat allocation, partial-unique one-per-student), `ApplicationEvent` append-only, `src/lib/domain/application-state.ts` | — |
| **M6** | TTA & SLA pledges | ✅ | `src/lib/domain/responsiveness.ts`, `analytics.service.ts`, `sweepSlaBreaches()` → `AT_RISK`, `/api/cron/sla-sweep`, `first_transition_at` stamp | — |
| **M7** | Scoped messaging | ✅ | `message.service.ts`, `MessageThread` bound 1:1 to an application, membership-enforced; **no free-form DM surface exists** | — |
| **M8** | Notification digest | ✅ | `notification.service.ts`, `src/lib/domain/digest.ts` cadence, `NotificationPreference`, `/api/cron/notification-digest`; **deadline reminders at T−72h / T−24h** via `src/lib/domain/deadline-reminder.ts` + `remindUpcomingDeadlines()` + `/api/cron/deadline-reminders` (idempotent set-based sweep, dedup per opportunity×tier) | — |
| **M9** | Admin console | ✅ | `admin.service.ts` + `flag.service.ts` + `analytics.service.ts` + 11 `/api/admin/*` routes + `src/app/admin/page.tsx`: users, roles, faculty allowlist, alumni provisioning, claim queue, taxonomy, **flag queue** (uphold/dismiss/remove-posting), **institute-wide analytics** (resolution rate, median TTA, seat-fill, pipeline/type/status distributions, 14-day trend) | — |

### 3.2 🟨 SHOULD — The Differentiators (PRD §5.2)

| ID | Requirement (PRD §5.2) | Status | Evidence / blocker |
|---|---|---|---|
| **S1** | Skill attestations anchored to `SELECTED` work | ⬜ | **Not started.** No `Attestation` model. PRD §3.3 and §5.2 both say *"lead with this"* — it is the single highest-value unbuilt item. The DB `CHECK` constraint (US-S1.1) is the whole point and must live in the migration, not the service. → **T-19** |
| **S2** | Structured rejection feedback | ✅ | `RejectionCode` enum in schema, carried through `/api/applications/[id]` transition, rendered in `applications/page.tsx` and `opportunities/[id]/applicants/page.tsx`. *(Previously mis-tracked as not started.)* |
| **S3** | Application budget (default 10 non-terminal) | ✅ | Enforced in `application.service.ts` inside the SERIALIZABLE transaction; `APPLICATION_BUDGET` env. *(Previously mis-tracked as not started.)* |
| **S4** | Saved searches & alerts | ⬜ | Not started. No `SavedSearch` model. → **T-23** |
| **S5** | Explainable matching (Jaccard) | ⬜ | Not started. Depends on M2 skill tags (present) — unblocked. → **T-21** |
| **S6** | Team formation (complementarity) | ⬜ | Not started. Depends on S5. → **T-22** |
| **S7** | Verified project artifacts | ⬜ | **Unblocked** — `ProfileProject.repoUrl` now exists (M2 / T-37 done). Verification of the link (e.g. ownership proof) is the remaining work. → **T-24** |

### 3.3 🟩 COULD — Stretch (PRD §5.3)

| ID | Requirement | Status | Note |
|---|---|---|---|
| **C1** | Readiness meter | ⬜ | Only C-tier item with a written user story (US-C1.1). Cheap once S5 exists. → **T-26** |
| **C2** | Interview experience archive | ⬜ | → **T-27** |
| **C3**–**C9** | Referral tokens · transparency board · blind screening · waitlist auto-fill · `.ics` export · QR bridge · rec-letter workflow | ⬜ | Not scheduled. Per PRD §5.3 these are attempted **only if the spine is stable** — i.e. only after every 🟦 in §3.1 is ✅. |

### 3.4 ⬜ WON'T — Boundary Held (PRD §5.4 / §3.2)

Confirmed by inspection of all 14 pages and 38 API routes: **no feed, no likes, no follower counts, no stories, no public comment threads, no unattached DMs, no profile-visit counters.** Messaging exists only bound to an application record. The hard exclusions in PRD §3.2 are intact — this is a **structural** claim, verifiable in the schema, not a stylistic one.

---

## 4. Traceability Matrix ⭐

> Requirement → user story → module → **evidence** → test → status. Disproportionately valuable for marks relative to effort. The **Test** column names real files only; where the PRD or ImplementationPlan promises a test that does not exist, the row says so.

| Req | User story (PRD §6) | Module | Implementation evidence | Test file (real) | Status |
|---|---|---|---|---|---|
| **M1** | US-M1.1 ✔ defined | Identity | `auth.service.ts`, `iam/policy.ts`, `middleware.ts` | `tests/iam/authorization-matrix.test.ts` (55) · `tests/security/otp.test.ts` (4) | ✅ |
| **M2** | ⚠ *no story in PRD §6* | Profile | `profile.service.ts`, `skill.service.ts`, `ProfileProject` | `tests/validation/skill-taxonomy.test.ts` (13) · `tests/validation/project.test.ts` (11) | ✅ |
| **M3** | US-M3.1 ✔ defined | Opportunity | `opportunity.service.ts`, `SlaPledge` | `tests/validation/opportunity.test.ts` (17) | ✅ |
| **M4** | ⚠ *no story in PRD §6* | Opportunity | `listOpportunities()` FTS + facets + sort | `tests/validation/opportunity.test.ts` (query schema + sort) · `scripts/bench-search.mjs` (p95) | ✅ |
| **M5** | US-M5.1 ✔ defined | Application | `application.service.ts`, `ApplicationEvent` | `tests/domain/application-state.test.ts` (9) · `tests/validation/application.test.ts` (9) | ✅ |
| **M6** | US-M6.1 ✔ defined | Analytics | `domain/responsiveness.ts`, `sweepSlaBreaches()` | `tests/domain/responsiveness.test.ts` (8) | ✅ |
| **M7** | ⚠ *no story in PRD §6* | Messaging | `message.service.ts`, `MessageThread` | `tests/validation/messaging-notification.test.ts` (12) | ✅ |
| **M8** | ⚠ *no story in PRD §6* | Notification | `notification.service.ts`, `domain/digest.ts`, `domain/deadline-reminder.ts` | `tests/validation/messaging-notification.test.ts` (cadence) · `tests/domain/deadline-reminder.test.ts` (8) | ✅ |
| **M9** | ⚠ *no story in PRD §6* | Moderation | `admin.service.ts`, `flag.service.ts`, `analytics.service.ts`, `/api/admin/*` | `tests/validation/flag.test.ts` (9) · RBAC matrix flag cases (9) | ✅ |
| **S1** | US-S1.1 ✔ defined | Profile | — | ⚠ **none** | ⬜ |
| **S2** | ⚠ *no story in PRD §6* | Application | `RejectionCode` enum + transition API | ⚠ **no dedicated test** | ✅ |
| **S3** | ⚠ *no story in PRD §6* | Application | budget check in SERIALIZABLE txn | ⚠ **no dedicated test** | ✅ |
| **S4** | ⚠ *no story in PRD §6* | Opportunity | — | ⚠ **none** | ⬜ |
| **S5** | US-S5.1 ✔ defined | Matching | — | ⚠ **none** | ⬜ |
| **S6** | ⚠ *no story in PRD §6* | Teams | — | ⚠ **none** | ⬜ |
| **S7** | ⚠ *no story in PRD §6* | Profile | — | ⚠ **none** | ⬜ |
| **C1** | US-C1.1 ✔ defined | Analytics | — | ⚠ **none** | ⬜ |

### 4.1 Two honest gaps in traceability

**(a) Missing user stories.** Of the **17** requirements tracked above, PRD §6 writes acceptance criteria for only **7** (US-M1.1, M3.1, M5.1, M6.1, S1.1, S5.1, C1.1). The other **ten** — **M2, M4, M7, M8, M9, S2, S3, S4, S6, S7** — have **no Given/When/Then in the PRD**, which means their status is asserted against no written acceptance bar. → **T-40: back-fill user stories into PRD §6** for every Must-tier requirement at minimum. This is a documentation defect, not a code defect, and it is cheap to fix.

**(b) Missing test levels.** `ImplementationPlan.md` §7 defines integration scenarios (IT-01…IT-07) and E2E happy paths (E2E-1…E2E-3); `README.md` advertises **Supertest** and **Playwright**. Neither package is installed and **not one integration or E2E test exists**. All 127 passing tests are unit tests over pure functions and Zod schemas. The earlier version of this matrix cited `IT-01`, `IT-04`, `E2E-3` and similar as if they were real — **those identifiers referred to nothing**. They have been removed rather than restated. → **G-02 / T-38**.

---

## 5. NFR Conformance & Deviations from the PRD

Every non-functional requirement in PRD §7, checked against the code. **Where the build deliberately differs from the PRD's wording, it is recorded as a deviation with a rationale — not silently ignored, and not pretended to be conformant.**

| ID | PRD §7 requirement | Status | Evidence / note |
|---|---|---|---|
| **NFR-P1** | Search p95 ≤ 300 ms | ✅ | **Measured** at 5 000 rows (`npm run bench:search`, seeded in a rolled-back txn): server-side query **p95 ≈ 74 ms**, p50 1.7 ms — well under budget on the GIN `tsvector` path. (Dev→remote-Supabase wall-clock p95 ≈ 378 ms is network RTT, not query time; production co-locates Vercel + Supabase.) |
| **NFR-P2** | Discovery < 2 min | 🔁 | Measurable only during the pilot (T-29) |
| **NFR-S1** | Argon2/bcrypt hashing; secrets never committed | ✅ **with deviation** | **Deviation D-17:** uses **scrypt** (`src/lib/security/password.ts`), not Argon2. Node built-in, memory-hard, OWASP-listed; Argon2 requires native compilation unavailable on the build machine. Secrets: `.env` is git-ignored, `.env.example` holds placeholders only. |
| **NFR-S2** | HTTPS only; JWT 15m access + 7d rotating refresh | ✅ | `access-token.ts`, `tokens.ts` with rotation + reuse detection; `ALLOW_INSECURE_COOKIES` fails closed in production (`src/lib/env.ts:93`) |
| **NFR-S3** | Zod at every boundary; parameterised queries only | ✅ | `src/lib/validation/schemas.ts`; raw SQL uses `Prisma.sql` bound params throughout `listOpportunities()` |
| **NFR-S4** | **Redis** token bucket per user & per IP | 🟦 **deviation** | **In-memory fixed-window limiter only** (`src/lib/security/rate-limit.ts`). The `RateLimiter` interface exists so the swap is call-site-free, but as shipped the limit is **per-instance** — on serverless it does not hold across invocations. Redis is not installed. → **G-03 / T-41** |
| **NFR-A1** | ≥ 99% uptime on login + submission | 🔁 | Pilot-measured (T-29) |
| **NFR-AC1** | WCAG 2.1 AA; never colour-only status | 🟦 | Status is conveyed by label text as well as colour (the design system is monochrome, which forces this). **No axe/Lighthouse audit has been run.** → **T-28** |
| **NFR-PR1** | CGPA + contact private by default | ✅ | `Profile.cgpaPublic` defaults `false`; `profile.service.ts` gates exposure |
| **NFR-PR2** | No personal data in URLs; soft-delete everywhere | ✅ | `deletedAt` on all soft-deletable models; routes key on opaque UUIDs |
| **NFR-M1** | TypeScript strict, no `any`, shared Zod schemas | ✅ | `npm run typecheck` clean; one schema module shared client/server |
| **NFR-O1** | Append-only `audit_log` on every privileged action | ✅ | `src/lib/security/audit.ts`, `AuditLog` model, called from every admin/service mutation |

### 5.1 Stack deviations from the documented architecture

`README.md` and `TechSpecifications.md` describe a stack the repo does not currently install. Stated plainly so the viva answer is honest:

| Documented | Actually shipped | Why it is defensible |
|---|---|---|
| **Redis + BullMQ** for jobs | HTTP cron endpoints under `/api/cron/*`, authed by a constant-time `CRON_SECRET` | No queue infra in the pilot; jobs are idempotent, so at-least-once HTTP triggering is safe (D-09) |
| **Redis** rate limiting | In-memory fixed window | See NFR-S4 — a known, interface-isolated gap, **not** a claim of conformance |
| **Neon/Railway** Postgres | **Supabase** Postgres 16 via `@prisma/adapter-pg` + WASM query compiler | Native Prisma engine unavailable on Windows-ARM64 (D-18) |
| **Supertest + Playwright** | Vitest only | See §4.1(b) — the levels are missing, not the intent |
| Email provider for OTP | No provider wired; OTP surfaced through the dev channel | Blocks the pilot's real-user flow → **T-42** |
| **Object Storage (S3 / Cloudinary)** | **Supabase Storage** — private `resumes` bucket, server-only service-role key, short-lived signed URLs for inline preview + download (T-44) | Already on Supabase; no new vendor. Needs the bucket + `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` set on the deploy, else résumé upload/preview is disabled (fail-closed) |

> **Action:** either install these dependencies or amend `README.md` §Stack and `TechSpecifications.md` to describe what is real. A spec that overstates the build is the more damaging of the two errors. → **T-43**

---

## 6. Task Board

Tasks carry a `Req` column tying them to §3. A task with **no requirement ID** is infrastructure or presentation work — legitimate, but it must not be mistaken for scope progress.

### 6.1 Complete

| ID | Title | Req | Module | Owner | Tier | Status |
|---|---|---|---|---|---|---|
| T-01 | Repo + project scaffold (Next 15 + Prisma) | — | Infra | Shared | Must | ✅ |
| T-02 | Auth: register / verify / login / refresh | M1 | Identity | HA | Must | ✅ |
| T-03 | RBAC: matrix + policy + guard + edge gate | M1 | Identity | HA | Must | ✅ |
| T-04 | Prisma schema (identity + profile) | M1, M2 | Data | Shared | Must | ✅ |
| T-05 | Admin bootstrap (no mock data) | M9 | Data | Shared | Must | ✅ |
| T-06 | Profile CRUD + field-level privacy | M2 | Profile | SD | Must | ✅ |
| T-07 | Skill taxonomy + `user_skills` | M2 | Profile | SD | Must | ✅ |
| T-08 | Alumni claim flow | M1 | Identity | HA | Must | ✅ |
| T-09 | Opportunity CRUD + SLA pledge | M3 | Opportunity | AC | Must | ✅ |
| T-10 | Deadline expiry job | M3 | Opportunity | AC | Must | ✅ |
| T-11 | FTS + GIN + faceted search | M4 | Opportunity | AC | Must | ✅ |
| T-12 | Application submit + budget (SERIALIZABLE) | M5, **S3** | Application | AC | Must | ✅ |
| T-13 | Pipeline + immutable event log | M5 | Application | AC | Must | ✅ |
| T-14 | TTA + responsiveness badge | M6 | Analytics | AC | Must | ✅ |
| T-15 | SLA nudge + `AT_RISK` job | M6 | Opportunity | AC | Must | ✅ |
| T-16 | Scoped messaging | M7 | Messaging | SD | Must | ✅ |
| T-17 | Notification feed + prefs + digest | M8 | Notification | SD | Must | ✅ |
| T-18 | Admin console (users/roles/allowlist/alumni/claims/taxonomy) | M9 | Moderation | HA | Must | ✅ |
| T-25 | Institute-wide analytics dashboard (resolution rate, median TTA, seat-fill, distributions, 14-day trend) | M9 | Analytics | AC | Must | ✅ |
| T-36 | Flag queue + moderation reason codes (uphold/dismiss/remove posting) | M9 | Moderation | HA | Must | ✅ |
| T-20 | Rejection reason codes | **S2** | Application | AC | Should | ✅ |
| T-39 | Search sort control (newest/closing-soon/most-seats) + p95 measurement | M4, NFR-P1 | Opportunity | AC | Must | ✅ |
| T-30 | Identity v2: thapar-only signup, faculty allowlist, admin-provisioned alumni, OTP login | M1 | Identity | HA | Must | ✅ |
| T-31 | Sign in with Google (OAuth, thapar-only) | M1 | Identity | HA | Should | ✅ |
| T-32 | Design system — warm editorial, monochrome light/dark, CSP-safe theme stamp | — | UI | HA | — | ✅ |
| T-33 | 3-page marketing site + split-layout auth pages + floating nav dock | — | UI | HA | — | ✅ |
| T-35 | Deadline reminders at T−72h / T−24h (idempotent cron sweep) | M8 | Notification | SD | Must | ✅ |
| T-37 | Profile projects + repo links (per-item CRUD, http(s) URL guard) | M2 | Profile | SD | Must | ✅ |
| T-44 | Résumé upload + inline preview (Supabase Storage, private bucket, signed URLs) | M2 / Obj-Storage | Profile | SD | — | ✅ |
| T-43 | Reconcile README / TechSpec stack claims with reality | — | Docs | HA | Must | ✅ |

### 6.2 Open — ordered by what unblocks the most

| ID | Title | Req | Module | Owner | Tier | Status | Blocked by | Est |
|---|---|---|---|---|---|---|---|---|
| **T-34** | **CI workflow** (typecheck → test → production build) | — | Infra | HA | Must | 🟨 | GitHub Actions billing (G-01) | 0.5d |
|  | ↳ `.github/workflows/ci.yml` written and the whole sequence verified locally (exit 0). Lint dropped: `next lint` is interactive/deprecated in 15.x. Inert until B-01 clears | | | | | | | | |
| **T-19** | **Attestations, `SELECTED`-gated by DB `CHECK`** | **S1** | Profile | SD | Should | ⬜ | T-13 ✅ | 1d |
| T-38 | Integration + E2E harness (Supertest / Playwright) | — | QA | Shared | Must | ⬜ | T-34 | 1d |
| T-40 | Back-fill user stories into PRD §6 for M2, M4, M7, M8, M9 | — | Docs | HA | Must | ⬜ | — | 0.5d |

| T-41 | Redis token-bucket rate limiter | NFR-S4 | Infra | HA | Should | ⬜ | Redis instance | 0.5d |
| T-42 | Email provider for OTP + digest delivery | M1, M8 | Infra | HA | Must | 🟨 | provider account | 0.5d |
| T-21 | Explainable matching (Jaccard) | S5 | Matching | SD | Should | ⬜ | T-07 ✅ | 1d |
| T-23 | Saved searches + alerts | S4 | Opportunity | AC | Should | ⬜ | T-11 ✅ | 0.5d |
| T-24 | Verified project artifacts | S7 | Profile | SD | Should | ⬜ | **T-37** | 0.5d |
| T-22 | Team formation (complementarity) | S6 | Teams | SD | Should | ⬜ | T-21 | 1d |
| T-26 | Readiness meter | C1 | Analytics | AC | Could | ⬜ | T-25 | 0.5d |
| T-27 | Interview archive | C2 | Content | SD | Could | ⬜ | T-06 ✅ | 0.5d |
| T-28 | A11y (WCAG 2.1 AA audit) + perf + hardening pass | NFR-AC1 | Shared | Shared | Must | ⬜ | all | 1d |
| T-29 | Pilot run + report | §8 metrics | Shared | Shared | Must | ⬜ | T-28, T-42 | 1d |

> **Critical path to G3:** `T-42 (email)` → seed taxonomy → `T-19 (attestations)` → `T-28 (a11y/perf)` → `T-29 (pilot)`. Everything else is parallelisable. **T-42 is the true long pole** — without OTP delivery no pilot participant can log in, and the primary metric (median TTA) cannot be collected at all.

---

## 7. Milestone Gates

Go/No-Go conditions from `ImplementationPlan.md` §5, assessed honestly.

| Gate | Go condition | Assessment |
|---|---|---|
| **G1** (end W1) | Verified registration + profile live on staging | ✅ **Passed.** Auth, RBAC, profile and taxonomy complete; DB live |
| **G2** (end W2) | End-to-end loop demoable; immutable events + TTA correct | ✅ **Passed.** Discover → apply → track → resolve works end to end; `ApplicationEvent` is append-only; TTA computed from `first_transition_at − applied_at` |
| **G3** (end W3) | Pilot ran, metrics collected | 🟨 **At risk.** **All MUST requirements are now ✅** — the remaining risks are external: no pilot data yet and no CI (T-34, GitHub billing). **No-Go action per the plan:** ship the recorded fallback demo and report on partial data |

> Per the G2 no-go rule — *"stop all Should/Could work; harden the spine only"* — G2 **passed**. **With the whole MUST tier now ✅**, Should-tier work is unblocked in priority order: **S1 attestations** (the flagship differentiator) first, then S5/S4. CI (T-34) and the pilot (T-29) remain the path to G3.

---

## 8. Daily Standup Log

> Format: **Done / Next / Blocked**, per member, dated. Absolute dates only.

### 2026-08-26 — Kickoff
| Member | Done | Next | Blocked |
|---|---|---|---|
| HA | Baselined 8 docs; repo created | CI skeleton, auth scaffold | — |
| AC | Reviewed opportunity/application scope | Prisma schema for opportunities | — |
| SD | Reviewed profile/matching scope | Wireframes for profile + search | — |

### 2026-08-26 — Phase 1, IAM foundation
| Member | Done | Next | Blocked |
|---|---|---|---|
| HA | Scaffolded Next 15 + Prisma; auth (register/OTP/login/refresh with rotation + reuse detection); deny-by-default RBAC across 4 layers (matrix → policy → guard → edge middleware); profile + alumni-claim routes; audit log; security headers; matrix + OTP tests; `docs/Security.md`. Removed all mock data — admin bootstraps from env only | CI workflow; wire skill-taxonomy admin routes | Prisma migration needs a live Postgres URL |
| AC | — | Opportunity schema (Phase 2) | — |
| SD | — | Profile UI + skill assignment endpoint | — |

### 2026-08-27 — Phase 1, skill taxonomy complete
| Member | Done | Next | Blocked |
|---|---|---|---|
| HA | Wired **T-07 (M2)** end to end: soft-delete columns per `Rules.md`; strict Zod DTOs (no free-text skills, no mass assignment); `skill.service.ts` taxonomy CRUD, all audited; `GET /api/skills`, admin taxonomy routes, self-scoped `/api/profiles/me/skills`; 48 tests; vitest env setup so tests run without a live DB | Phase 2 — Opportunity CRUD (T-09) | Postgres URL still needed |
| AC | — | Opportunity schema | — |
| SD | — | Profile UI + skill assignment | — |

### 2026-08-28 — Phase 2, The Spine complete → G2 passed
| Member | Done | Next | Blocked |
|---|---|---|---|
| HA | Closed the Phase 2 loop. **T-10 (M3)** cron expiry behind a constant-time `CRON_SECRET`. **T-11 (M4)** GIN tsvector + injection-safe `Prisma.sql` keyset query with facets. **T-12/T-13 (M5, S3)** race-safe budget, partial-unique one-per-student, SERIALIZABLE seat allocation that cannot exceed `seat_count`, immutable event log, `first_transition_at`. **T-14/T-15 (M6)** TTA, responsiveness badge, SLA sweep → `AT_RISK`. **T-16 (M7)** scoped messaging. **T-17 (M8)** notifications + prefs + digest. **T-30/T-31 (M1)** identity v2 + Google OAuth. **T-18 (M9)** admin console. Supabase wired via `@prisma/adapter-pg`; all 6 migrations applied. 118 tests green; prod build clean | Phase 3 | `db:migrate` needed a live Postgres URL *(resolved same day)* |
| AC | (covered under HA this cycle) | Saved searches (T-23) | — |
| SD | (covered under HA this cycle) | Attestations UI + messaging UI | — |

### 2026-08-29 — Design system + landing; tracker reconciled with the PRD
| Member | Done | Next | Blocked |
|---|---|---|---|
| HA | **T-32/T-33** — adopted the warm editorial design system, pure monochrome light/dark palette with a CSP-hash-allowlisted pre-paint theme stamp (fixes the theme flash), official `ti` lettermark, translucent floating nav dock, 3-page marketing site (`/`, `/product`, `/about`), split-layout auth pages, hero headline balancing. Fixed the `.reveal` bug that left landing cards at `opacity:0` (B-03). Hardened `env.ts` to treat a blank env var as unset. **Audited the whole repo against the PRD and rewrote this tracker**: found T-20 (S2) and T-12's budget (S3) shipped but recorded as not started; found M2/M4/M8/M9 recorded as done while each carried a real gap; found the traceability matrix citing `IT-*`/`E2E-*` test IDs that refer to nothing | T-34 (CI) · T-42 (email) · close the four 🟦 Musts | Actions billing (G-01) |
| AC | — | T-25 institute analytics · T-39 search sort + p95 | — |
| SD | — | **T-19 attestations (S1 — the flagship differentiator)** · T-37 profile projects | — |

### 2026-08-29 — M8 closed: deadline reminders
| Member | Done | Next | Blocked |
|---|---|---|---|
| SD | **T-35 (M8)** shipped, closing the last named gap on M8 → ✅. New pure domain module `deadline-reminder.ts` defines the non-overlapping T−72h / T−24h windows (single source of truth, 8 unit tests). `remindUpcomingDeadlines()` is one race-safe set-based `INSERT … SELECT … WHERE NOT EXISTS` that dedups per opportunity×tier (DB is the arbiter, per D-11); new `/api/cron/deadline-reminders` route behind `CRON_SECRET`. Client renders the new notification type. 143 tests green; prod build clean (42 routes) | M2 projects (T-37) · M4 sort (T-39) | — |
| HA | Reviewed T-35; three 🟦 Musts remain (M2, M4, M9). Added **`vercel.json`** scheduling all four `/api/cron/*` jobs (staggered hourly); each route now also exports `GET` since Vercel Cron triggers with GET carrying `Authorization: Bearer $CRON_SECRET`. Documented the `CRON_SECRET` requirement in `.env.example` (D-21) | T-34 (CI) · M9 flag queue (T-36) | Actions billing (G-01) |
| AC | — | T-39 search sort + p95 | — |

### 2026-08-29 — M2 closed: profile projects
| Member | Done | Next | Blocked |
|---|---|---|---|
| SD | **T-37 (M2)** shipped, closing M2's last gap → ✅ and unblocking S7. New `ProfileProject` model + `profile_projects` migration (applied to Supabase); per-item CRUD under `/api/profiles/me/projects[/:id]`, ownership-scoped (a foreign project id 404s, no existence leak); `getProfile` now returns projects so the public profile shows them. Repo/live links are **http(s)-only** (Zod `.url()` accepts `javascript:`/`data:` — hardened against a stored-XSS href). Profile editor gained a projects panel (immediate add/remove). 11 new tests → **154 green**; prod build clean (44 routes) | M4 sort (T-39) · S7 link verification (T-24) | — |
| HA | Reviewed T-37; two 🟦 Musts remain (M4, M9) | T-34 (CI) · M9 flag queue (T-36) | Actions billing (G-01) |

### 2026-08-29 — Résumé upload + inline preview (Supabase Storage)
| Member | Done | Next | Blocked |
|---|---|---|---|
| SD | **T-44** — students upload a PDF résumé; faculty/alumni preview it inline (browser-native PDF in an `<iframe>` on a signed URL) + download, so nobody downloads just to look. New `@supabase/supabase-js` (pure JS), server-only `resume-storage.ts` (private bucket, 5-min signed URLs), pure `domain/resume.ts` validator (PDF magic bytes + 4 MB cap, 7 tests), `profile_resume` migration (applied), upload/remove/view routes, access policy (owner/admin/faculty/alumni; a student can't see another student's), CSP `frame-src` now allows the Supabase origin, profile-page uploader + applicants-page per-card viewer. **161 tests green**; build clean (46 routes) | Wire `SUPABASE_URL` + `service_role` key on the deploy; M4 sort (T-39) | **Résumé preview needs the Supabase `resumes` bucket + keys configured** (G-09) |

### 2026-08-29 — Résumé storage live + M9 flag queue
| Member | Done | Next | Blocked |
|---|---|---|---|
| HA | **T-36 (M9)** — moderation flag queue. New `Flag` model + `flag_queue` migration (applied) with a **partial-unique index** blocking duplicate OPEN flags per reporter; `flag.service.ts` (create / list / resolve, remove-posting soft-deletes the opp and closes sibling flags in one txn); routes `POST /api/opportunities/:id/flag`, `GET /api/admin/flags`, `PATCH /api/admin/flags/:id`; RBAC extended (`flag:create` now also STUDENT; matrix tests updated); admin console **Flags tab** + overview stat; **Report** control on the posting page. Also **configured Supabase Storage** (résumé feature now live: bucket + keys set, verified with a live upload/sign/delete round-trip — G-09 resolved). **179 tests green**; build clean (49 routes) | Set the two `SUPABASE_*` vars on Vercel; M4 sort + p95 (T-39); institute analytics (T-25) closes M9 | — |
| SD | (T-37, T-44 landed earlier today) | S7 link verification (T-24) | — |
| AC | — | T-25 institute analytics · T-39 search sort | — |

### 2026-08-29 — M4 closed: search sort + p95 measured
| Member | Done | Next | Blocked |
|---|---|---|---|
| AC | **T-39 (M4)** — user-selectable sort (**newest / closing-soon / most-seats**), each keyset-paginated on its own column with the cursor carrying the sort so a re-sort resets pagination cleanly; `Prisma.raw` used only on fixed `<`/`>` config literals (no injection surface). **NFR-P1 measured**: `scripts/bench-search.mjs` seeds 5 000 rows in a rolled-back txn (no committed mock data) and reports server-side **p95 ≈ 74 ms** (p50 1.7 ms) — well under the 300 ms budget on the GIN path (D-24). Sort dropdown on the discovery page. **181 tests green**; build clean. M4 → ✅, **MUST tier now 8/9 done** — only M9 analytics remains | T-25 institute analytics (last MUST gap) | — |

### 2026-08-29 — M9 closed: institute analytics → MUST tier complete
| Member | Done | Next | Blocked |
|---|---|---|---|
| AC | **T-25 (M9)** — institute-wide analytics on the admin console. `getInstituteAnalytics()` computes resolution rate, **median TTA via `percentile_cont`** (set-based, scales), seat-fill, and pipeline/type/status distributions + a 14-day application trend — all from the immutable event log, so nothing is self-reported (D-25). New `GET /api/admin/analytics` (`analytics:read`, ADMIN-only); admin **Analytics tab** with stat cards, CSS bar charts and a sparkline. Raw SQL smoke-tested on the live DB. **This closes M9 → the entire MUST tier (M1–M9) is ✅.** 181 tests green; build clean (50 routes) | S1 attestations (flagship SHOULD) · CI (T-34) · pilot (T-29) | Actions billing (G-01) for CI |

### 2026-08-29 — Typed skills on the profile (unblocks empty taxonomy)
| Member | Done | Next | Blocked |
|---|---|---|---|
| SD | The profile Skills picker was an **empty dropdown** (taxonomy unseeded, G-08) — students couldn't add anything. Switched to a **text input + datalist suggestions**, capped at **8**. Server `replaceOwnSkills` now takes skill **names** and find-or-creates the taxonomy row (case-insensitive de-dupe, default domain "General"), so the `UserSkill → Skill` link is preserved and matching/search keep working (D-26, partially reverses D-04). Schema `UserSkillsReplaceSchema` → names + `max 8`; tests updated. **183 tests green**; build clean | Attestations (S1) · admin skill-merge tooling | — |

### _(Template)_
```
### YYYY-MM-DD
| Member | Done | Next | Blocked |
|---|---|---|---|
| HA |  |  |  |
| AC |  |  |  |
| SD |  |  |  |
```

---

## 9. Decision Log

| # | Date | Decision | Alternatives | Rationale |
|---|---|---|---|---|
| D-01 | 2026-08-26 | Postgres FTS + `pg_trgm` over Elasticsearch | Elasticsearch, Meilisearch | Pilot scale; avoids the sync/ops failure mode; documented 300 ms / 50k migration trigger |
| D-02 | 2026-08-26 | Polling/SSE over WebSockets (v1) | Socket.io | Low message volume, high latency tolerance; behind an interface for a later swap |
| D-03 | 2026-08-26 | Custom JWT over managed auth | Auth0, Clerk | The course expects auth built, not delegated |
| D-04 | 2026-08-26 | Attestation gated by `SELECTED` in a DB `CHECK` | Service-layer enforcement | Makes competency unfarmable at the strongest layer (PRD US-S1.1) |
| D-05 | 2026-08-26 | Alumni claim-and-approve flow | `@thapar.edu`-only signup | Alumni lose the institute address; the naive rule makes the role unreachable (PRD §4.5) |
| D-06 | 2026-08-26 | No mock data or accounts; admin bootstraps from env only | Seeded demo users/skills | Keeps pilot TTA honest; avoids committed credentials |
| D-07 | 2026-08-26 | Role/status re-loaded from the DB each request | Trust JWT claims | A stolen or stale token cannot outrun a suspension or role change |
| D-08 | 2026-08-26 | Deny-by-default RBAC at 4 layers | A single middleware check | Defense in depth; matrix-driven tests block accidental widening |
| D-09 | 2026-08-28 | Scheduled jobs authed by a constant-time `CRON_SECRET`, not the RBAC matrix | A privileged service account | Jobs have no user principal; fail closed when the secret is unset (the endpoint 404s) |
| D-10 | 2026-08-28 | FTS via GIN tsvector + `websearch_to_tsquery` | `ILIKE`, Elasticsearch | Sub-linear keyword search inside the DB; bound params; meets the NFR-P1 budget |
| D-11 | 2026-08-28 | Budget + seat allocation in SERIALIZABLE txns; seats via a conditional `UPDATE` | Advisory locks, app-level mutex | The DB is the arbiter: partial-unique blocks a double-apply, a conditional increment cannot exceed `seat_count` |
| D-12 | 2026-08-28 | Message threads bound 1:1 to an application, membership-checked | An open DM inbox | Scoping prevents cold contact; an admin may read for moderation but never post |
| D-13 | 2026-08-28 | Notifications via in-app feed + cadence digest; email is a future seam | Immediate email only | No email infra in the pilot; `deliveredAt` makes the digest idempotent and email pluggable |
| D-14 | 2026-08-28 | Registration is `@thapar.edu`-only; default role `STUDENT` | Open registration | Institutional identity; alumni are the sole non-Thapar accounts |
| D-15 | 2026-08-28 | Faculty via an admin-curated allowlist (auto-promote on login) + a manual toggle | Self-select, email heuristic | A finite known roster; auditable; pre-loadable before deployment |
| D-16 | 2026-08-28 | Exactly one `ADMIN`; the panel can set STUDENT/FACULTY/ALUMNI but never ADMIN | Multiple admins | Single-operator model; prevents privilege escalation through the console |
| **D-17** | 2026-08-28 | **scrypt** for password hashing, not Argon2 | Argon2, bcrypt | Memory-hard and OWASP-listed, built into Node — Argon2 needs native compilation unavailable on the build machine. **Deviates from PRD NFR-S1 wording; recorded rather than hidden** |
| **D-18** | 2026-08-28 | **Supabase** Postgres via `@prisma/adapter-pg` + WASM query compiler | Neon, Railway, the native Prisma engine | The native Prisma engine has no Windows-ARM64 build. Deviates from the PRD §9 dependency list |
| **D-19** | 2026-08-29 | The marketing site is 3 focused pages with a shared nav/footer | One long landing page | The single page had dead vertical space; three pages each stay full and purposeful |
| **D-20** | 2026-08-29 | **A partial requirement is recorded as 🟦 with a named gap, never rounded up to ✅** | Mark the parent task done once the main path works | Four Must requirements were sitting at ✅ with real gaps behind them. A tracker that overstates completion is worse than no tracker — it hides the work remaining before G3 |
| **D-21** | 2026-08-29 | ~~Cron jobs scheduled via `vercel.json`~~ — **SUPERSEDED by D-27**; routes handle GET as well as POST (still true) | External scheduler (cron-job.org), a self-hosted timer | Vercel Cron is zero-infra and native to the deploy target; it triggers with GET and auto-injects `Authorization: Bearer $CRON_SECRET`, so `requireCronSecret` needs no change. Jobs are idempotent (D-09), so at-least-once GET triggering is safe |
| **D-22** | 2026-08-29 | **Résumés on Supabase Storage — private bucket, short-lived signed URLs, magic-byte-validated PDF** | Postgres `bytea`; S3/Cloudinary; a public bucket | Object storage (not the DB) serves files with the least latency and keeps blobs off the serverless path; already on Supabase, so no new vendor. Private + per-request signed URLs keep résumés access-controlled (owner/admin/faculty/alumni); the magic-byte check stops a spoofed content-type, and http(s)-only signing prevents a durable public link |
| **D-23** | 2026-08-29 | **Flags target postings; "remove" is a soft-delete; duplicate OPEN flags blocked by a partial-unique index** | Hard-delete on removal; service-level dedup; flagging users/messages too | A soft-delete drops the posting from every listing yet preserves analytics and the audit trail (Rules.md: nothing hard-deleted). The DB, not the service, guarantees one open flag per reporter per posting (D-11 philosophy). Scope held to postings, matching PRD M9 ("flagged postings") — no new moderation surface |
| **D-24** | 2026-08-29 | **NFR-P1 measured by server-side execution time (EXPLAIN ANALYZE), not dev→remote wall-clock** | Report the raw round-trip; skip measuring | The 300 ms budget is a deployment-local target; a dev machine's RTT to a remote Supabase region (~300 ms) swamps the query and would misreport conformance. The benchmark seeds 5 000 rows in a rolled-back txn (no committed mock data, D-06) and reports both figures — server-side p95 ≈ 74 ms is the honest, in-region number |
| **D-25** | 2026-08-29 | **Institute analytics computed set-based in SQL from the immutable event log; median via `percentile_cont`** | Load all rows and average in JS; a nightly rollup table | Aggregates over `applied_at`/`first_transition_at` cannot be back-dated, so the numbers are trustworthy by construction (same basis as M6). `percentile_cont` gives a true median that scales without pulling every row; no rollup table to keep in sync at pilot scale |
| **D-26** | 2026-08-29 | **Members may TYPE skills on their profile (find-or-create in the taxonomy), capped at 8** | Admin-only curation (D-04, original M2 rule); pure free-text strings | The admin-curated taxonomy started empty (G-08), so students literally could not add a skill. Relaxing to type-to-create keeps the `UserSkill → Skill` FK — so matching (S5) and faceted skill search still work — while free-text strings would have broken both. Case-insensitive de-dupe; new skills default to domain "General"; admin can still merge/curate. **Partially reverses D-04**, recorded openly |
| **D-27** | 2026-08-29 | **Cron triggered externally by cron-job.org, not by the host** | Vercel Cron (D-21); Render Cron Jobs; Supabase `pg_cron` | D-21 assumed the deploy target was Vercel. Production moved to Render, which never reads `vercel.json` — so all four jobs silently did not run (B-06). A trigger that lives outside the host cannot drift from it again. Vercel Cron is also unusable on Hobby: two jobs, daily only, where we need four hourly. `requireCronSecret` is unchanged — the pinger sends the same `Authorization: Bearer $CRON_SECRET` |

---

## 10. Gap & Bug Register

**Severity:** S1 Blocker · S2 Major · S3 Minor · S4 Cosmetic

| ID | Sev | Title | Module | Found | Status | Resolution / next step |
|---|---|---|---|---|---|---|
| B-01 | S1 | CI blocked: account billing — Actions never start | Infra | 2026-08-27 | 🟨 | **External** — GitHub Settings → Billing & plans. Not a repo issue |
| B-02 | S1 | `db:deploy` would fail: no migrations dir, missing `citext` extension | Infra | 2026-08-27 | ✅ | Added `20260826191437_init` with `CREATE EXTENSION citext`; verified against postgres:16 |
| B-03 | S3 | Landing cards invisible — `.reveal` stuck at `opacity:0` when the IntersectionObserver never fired | UI | 2026-08-29 | ✅ | `.reveal` is now visible by default with a guaranteed-terminating entrance animation |
| B-04 | S3 | Inline scripts blocked by CSP after the theme-stamp change | UI | 2026-08-29 | ✅ | Nonced the inline scripts (`c03fef9`) |
| **B-05** | **S2** | **`npm run build` fails from a clean checkout** — `.env` carries `ALLOW_INSECURE_COOKIES="true"` for dev, `next build` forces `NODE_ENV=production`, tripping the guard at `src/lib/env.ts:93` | Infra | 2026-08-29 | ✅ | Not a code defect — the guard is correct and should stay. Document it in `.env.example` and set the flag `false` in the Vercel/CI environment. Resolved 2026-08-29: `ALLOW_INSECURE_COOKIES=false` set on the deploy environment (that exact error failed `dep-da9cpouq1p3s738dafog` before it was set), documented in `.env.example`, and pinned in the CI workflow's build step |
| **B-06** | **S1** | **No cron job has ever run in production** — the four `/api/cron/*` schedules live in `vercel.json`, which Render does not read. Postings never expire, SLA never sweeps to `AT_RISK`, no deadline reminders, no digest. Endpoints and `CRON_SECRET` were correct the whole time; nothing called them | Infra | 2026-08-29 | 🟨 | `vercel.json` deleted (D-25). Four cron-job.org jobs to be created against the production origin — see docs/Remaining-Work-Plan.md §A6–A7 |
| **B-07** | **S2** | **No CI pipeline exists** — `.github/` was never created. T-34 was recorded as blocked on Actions billing (B-01), but the workflow file had not been written either | Infra | 2026-08-29 | 🟨 | `.github/workflows/ci.yml` added: install → `db:generate` → typecheck → test → production build. Inert until B-01 clears |
| **G-01** | **S1** | **No CI workflow exists** — `.github/` is absent entirely. `Rules.md` §1 requires "green before merge (lint → typecheck → test → migrate)"; nothing enforces it | Infra | 2026-08-29 | 🟨 | Blamed on B-01 billing, but the workflow file was never authored either. Write it now so it runs the moment billing clears → **T-34** |
| **G-02** | **S2** | **No integration or E2E tests.** `ImplementationPlan.md` §7 defines IT-01…IT-07 and E2E-1…E2E-3; `README.md` advertises Supertest + Playwright. Neither is installed. All 127 tests are unit tests | QA | 2026-08-29 | ⬜ | The SERIALIZABLE budget/seat logic and the RBAC route guards are exactly the code that unit tests cannot cover → **T-38** |
| **G-03** | **S2** | **Rate limiting is in-memory, not Redis (NFR-S4).** Per-instance only — on serverless it does not hold across invocations, so the auth brute-force guard is weaker than the PRD claims | Security | 2026-08-29 | ⬜ | The `RateLimiter` interface already isolates the swap → **T-41** |
| **G-04** | **S1** | **No email provider wired.** OTP is the only login path for alumni and the verification step for everyone. Without delivery, **no external pilot participant can sign in** | Infra | 2026-08-29 | 🟨 | Blocks T-29 and therefore the primary success metric → **T-42** |
| **G-05** | S2 | **The traceability matrix cited test IDs that do not exist** (`IT-01`, `IT-04`, `E2E-3`, `UT-*`) | Docs | 2026-08-29 | ✅ | Fixed in this rewrite — §4 names real files only, and §4.1(b) states the gap plainly |
| **G-06** | S2 | **The task board disagreed with the code in both directions** — T-20 (S2) and the S3 budget shipped but were marked ⬜; M2/M4/M8/M9 were marked ✅ with real gaps | Docs | 2026-08-29 | ✅ | Fixed in this rewrite; **D-20** sets the rule that prevents a recurrence |
| **G-07** | S3 | **10 of the 17 requirements tracked in §4 have no user story or acceptance criteria** in PRD §6 — including five Must-tier (M2, M4, M7, M8, M9) | Docs | 2026-08-29 | ⬜ | Their status is asserted against no written bar → **T-40** |
| **G-08** | S3 | **Empty skill taxonomy** — the `skills` table starts at 0 rows | Data | 2026-08-29 | 🟦 | **Mitigated:** the profile editor now lets members type skills (find-or-create, capped at 8, D-26), so the taxonomy self-populates from real usage; admin can still curate/merge. The pilot no longer blocks on a pre-seeded list |
| **G-09** | S3 | **Résumé storage configuration** — needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + a private `resumes` bucket | Infra | 2026-08-29 | ✅ | **Resolved (local):** bucket created, keys set in `.env`, verified with a live upload+sign+delete round-trip. **Still to do:** set the same two vars on the Vercel deploy |

---

## 11. Metric Snapshots

Targets from `PRD.md` §8. Populated once the pilot starts (`ImplementationPlan.md` §10).

| Date | Median TTA | Discovery time | Resolution rate | Match relevance | Status clarity | Attestation adoption | Uptime |
|---|---|---|---|---|---|---|---|
| **_target_** | **≤ 48 h** | < 2 min | ≥ 80% | ≥ 30% | ≥ 4.0 | ≥ 25% | ≥ 99% |
| _(pilot day)_ | — | — | — | — | — | — | — |

**Instrumentation readiness:**

| Metric | Can we compute it today? |
|---|---|
| Median TTA (**primary**) | ✅ Yes — `first_transition_at − applied_at`, straight from `application_events`. Fully attributable, never self-reported |
| Resolution rate | ✅ Yes — terminal-state count over `application_events` |
| Uptime | ✅ Yes — `/api/health` |
| Discovery time | 🟦 Needs session-start → first-detail-view instrumentation |
| Attestation adoption | ❌ **Blocked on S1** — the entity does not exist yet |
| Match relevance | ❌ **Blocked on S5** |
| Status clarity | ❌ A survey instrument — collect at the T-29 debrief |

> PRD §8.3 warns that instrumenting analytics late "never works". Three of seven metrics are currently uncomputable, and two of those are blocked on unbuilt Should-tier features. **The gap between _perceived_ wait and _measured_ TTA is itself a reportable finding** — the pre-pilot interview baseline must be captured before any participant touches the platform.

---

<div align="center">

[← ImplementationPlan](ImplementationPlan.md) &nbsp;·&nbsp; **Tracker** &nbsp;·&nbsp; [Rules →](Rules.md)

_Every row traces to a PRD identifier. A partial is written as a partial — that is where the marks, and the remaining work, actually live._

</div>
