# Thapar Nexus — Master Plan

**Course:** UCS503 Software Engineering
**Team:** Harshdeep Athawale (1024031062), Aakriti Chauhan (1024031055), Sehaj Dhillon (1024030620)
**Institute:** Thapar Institute of Engineering & Technology, Patiala
**Document status:** Source of truth. All eight downstream documents derive from this file.

---

## 0. How to use this file

This is the parent document. The eight deliverables (PRD, TechSpec, AppFlow, Design, Schema, ImplementationPlan, Tracker, Rules) each expand one slice of this plan. Nothing in a child document should contradict this file. If something must change, change it here first, then propagate.

Section 12 contains a per-document brief telling you exactly what goes in each of the eight files.

---

## 1. One-line definition

**Thapar Nexus is a verified opportunity pipeline for the institute — it exists to make sure an application reaches a decision, and to make it visible when it doesn't.**

Not a network. Not a feed. A pipeline with accountability.

---

## 2. Positioning and differentiation

This matters because a similar-sounding campus project exists in the same cohort. The difference must be structural, not cosmetic, and must be visible in the schema and the metrics — not just the pitch.

### 2.1 The fundamental split

| Dimension | Social / feed app | Thapar Nexus |
|---|---|---|
| Atomic unit | Post | Opportunity + Application |
| Success metric | Engagement, time-on-app | Time-to-Acknowledgement, decision rate |
| Content lifetime | Permanent, accumulating | Deadline-bound, auto-expiring |
| Identity value | Follower count, popularity | Verified role + attested skills |
| Core loop | Browse → react → return | Discover → apply → track → resolve |
| Failure mode it fixes | Boredom | Ghosting and missed opportunities |
| Who holds power | The most-followed | The most-responsive |
| Optimal user behaviour | Use it more | Use it less, get a result faster |

That last row is the thesis. **Nexus is designed to reduce the time a student spends on it.** A feed app that users leave quickly has failed. Nexus succeeds when a student finds a posting in under two minutes, applies, and gets an answer in under 48 hours.

### 2.2 Hard exclusions — write these into the PRD as explicit non-goals

Nexus will **not** have: an infinite scrolling feed, likes or reactions, follower/following counts, stories, reels, public comment threads, DMs unattached to an opportunity, profile visit counters, or any vanity metric.

Justification to state in the PRD: every one of these optimises for attention capture, which is directly opposed to the stated success metric. Excluding them is a design decision, not a scope cut.

### 2.3 What only Nexus can do

Four capabilities that are structurally impossible in a social app, because they depend on the application record existing as a first-class entity:

1. **Attestation anchored to work** — an endorsement that requires a completed application between the two parties.
2. **Ghosting accountability** — a responsiveness metric computed from state-transition timestamps.
3. **Two-sided load control** — application budgets and posting capacity limits.
4. **Demand-side skill analytics** — telling a student what to learn based on aggregated live postings.

---

## 3. Problem statement (refined)

Opportunities inside the institute circulate through WhatsApp groups, noticeboards, and word of mouth. Four failures follow:

- **F1 — Discovery failure.** Postings are missed because circulation is channel-dependent. A student not in the right group never sees the opening.
- **F2 — Authenticity failure.** Forwarded messages lose provenance. Deadlines drift, details mutate, and there is no way to confirm who actually posted.
- **F3 — Resolution failure (the biggest).** Applications sent by email vanish. The student cannot distinguish "rejected", "still reading", and "never opened". There is no accountability for silence.
- **F4 — Competency failure.** Every profile is self-claimed. A poster has no way to verify that a claimed skill corresponds to real work.

Nexus targets F3 as the primary problem and F1, F2, F4 as enablers. State this ranking explicitly — a project with a ranked problem list reads far more mature than one with a flat list.

---

## 4. Roles

| Role | Verification | Primary capability |
|---|---|---|
| **Student** | `@thapar.edu` email | Skill-tagged profile, faceted search, apply, track status, join teams, request attestation |
| **Faculty** | `@thapar.edu` email + admin role grant | Publish research/project/TA openings, manage applicant pipeline, issue attestations, set SLA pledge |
| **Alumni** | Claim-and-approve flow (see 4.1) | Post internships and referrals, contribute interview experiences, mentor, issue attestations |
| **Administrator** | Seeded account | Verify alumni, moderate flags, manage role escalation, view institute analytics |

### 4.1 Alumni verification — a gap in the original proposal, now fixed

The original proposal restricts sign-up to `@thapar.edu`. Alumni typically lose that address after graduation, so the rule makes the alumni role unreachable. Fix:

**Alumni claim flow:** register with any email → submit roll number, graduation year, degree, and one proof artifact (degree certificate scan or LinkedIn URL) → account enters `PENDING_ALUMNI` state with read-only access → administrator reviews the claim queue → approve or reject with reason → on approval the account gains posting rights and a "Verified Alumni" badge.

This is a good thing to have caught. It shows requirements analysis that went past the happy path, and it gives the admin role real work to do rather than being decorative.

---

## 5. Feature set

Prioritised with MoSCoW. The Must tier alone is a complete, demonstrable, gradeable product. Everything above it is upside.

### 5.1 MUST — the spine (target: end of Week 2)

**M1. Institutional identity and roles**
Domain-restricted registration, email OTP verification, JWT access + refresh tokens, role-based authorisation middleware, alumni claim queue.

**M2. Structured profiles with a controlled skill vocabulary**
Skills come from an admin-curated taxonomy, not free text. Free text makes matching, faceting, and demand analytics all impossible. Profile holds: academic details, year, branch, CGPA (optional, private by default), projects with repository links, and skill tags with a self-declared proficiency level.

**M3. Structured opportunity postings**
Fields: title, type (Research / Internship / TA / Hackathon Team / Micro-task / Referral), domain, description, required skill tags, preferred skill tags, duration, stipend status, seat count, application deadline, and **SLA pledge** (see M6). Postings auto-transition to `EXPIRED` at deadline via a scheduled job.

**M4. Faceted discovery**
Full-text search across title and description plus filters on type, domain, skill tags, stipend, duration, and deadline window. Sort by deadline, recency, or match score. Discovery target: under two minutes to a relevant posting.

**M5. Application pipeline**
States: `APPLIED → RECEIVED → SHORTLISTED → INTERVIEW → SELECTED | REJECTED | WITHDRAWN`. Every transition writes an immutable row to `application_events` with actor, timestamp, and optional note. The student sees the full history. No transition is ever deleted or edited — corrections are new events.

**M6. Time-to-Acknowledgement and SLA pledges**
TTA = `first_transition_at − applied_at`, computed from database timestamps only, never self-reported. At posting time the poster selects an SLA pledge (24h / 48h / 1 week). The system auto-nudges at 80% of the pledge window and marks the posting `AT_RISK` on breach. A poster's rolling response rate and median TTA are shown on their postings as a computed **Responsiveness Badge** — a number, never a review, never a comment.

**M7. Scoped messaging**
A thread exists only in the context of an application or a team. There are no free-form DMs. This eliminates an entire class of harassment and moderation problems, and is worth saying out loud in the PRD as a safety-by-design decision.

**M8. Notification digest**
Batched, not real-time-per-event. Configurable frequency (immediate / daily / weekly) per category. Deadline reminders at T−72h and T−24h for saved and applied opportunities.

**M9. Admin console**
Alumni claim queue, flag queue with reason codes, role escalation, taxonomy management, institute analytics.

### 5.2 SHOULD — the differentiators (target: Week 3)

**S1. Skill attestations anchored to real work**
Faculty and alumni can attest to a specific skill for a specific student, but only where a closed application record exists between them with outcome `SELECTED`. The attestation carries a context string ("NLP research assistant, Aug–Nov 2026") and is permanently linked to that application. Attested skills render with a verified marker and rank above self-claimed skills in search.

Why it matters: it makes competency unfarmable. You cannot trade endorsements with friends because the system requires a completed engagement to exist first. This is the single strongest feature in the plan — lead with it in the PRD.

**S2. Structured rejection feedback**
When a poster moves an application to `REJECTED`, they select one reason code: `SKILL_MISMATCH`, `SEATS_FILLED`, `TIMING_CONFLICT`, `PROFILE_INCOMPLETE`, `STRONGER_APPLICANTS`, `OTHER`. One click for the poster, real signal for the student. Reason codes aggregate into domain-level insight ("62% of rejections in ML postings this month were skill mismatch").

**S3. Application budget**
A student may hold at most N (default 10) applications in a non-terminal state. Withdrawing frees a slot. One constraint solves two problems at once: it stops spray-and-pray applications, and it caps poster review load. Make the number admin-configurable and justify it in the PRD.

**S4. Saved searches and opportunity alerts**
Save a filter set, receive a digest entry when a matching posting appears. This is the correct replacement for a feed — pull-based and intentional rather than push-based and infinite.

**S5. Explainable matching**
Peer and opportunity matching uses Jaccard similarity over skill-tag sets. Critically, the UI always shows *why*: "matched on Python, PyTorch, Data Preprocessing — missing: CUDA". Explainability is cheap to build here and reads as genuine engineering maturity. Never show a bare score.

**S6. Team formation for hackathons**
A team posting declares required roles with slot counts (e.g. 1 backend, 1 ML, 1 design). Matching optimises for **complementarity**, not similarity — the opposite objective to peer matching, and worth calling out as a distinct algorithm. Students request to join a slot; the team lead accepts; the team locks when full.

**S7. Verified project artifacts**
Profile projects accept a public repository URL. A background job fetches public metadata (name, primary language, stars, last commit date) to confirm the repository exists and is live. Not a code-quality judgement — just proof the artifact is real.

### 5.3 COULD — stretch, only if the spine is stable

**C1. Readiness meter.** Aggregate required skill tags across all live postings in a domain, compare to the student's tag set, and surface the three skills that would unlock the largest number of currently-open opportunities. Turns the platform from reactive to advisory.

**C2. Interview experience archive.** Structured records: company, role, year, round type, question themes, difficulty, outcome. Searchable and filterable. Only submittable by users with a verified application or alumni status, which keeps it credible.

**C3. Referral tokens.** Each alumnus receives a small quota of referral tokens per cycle (e.g. 3 per semester). Spending a token creates a high-priority referral attached to a student's application. Scarcity is the entire point — it keeps referrals meaningful and prevents spam.

**C4. Transparency board.** Institute-wide anonymised statistics: median TTA by department, open positions by domain, overall response rate. Aggregate only, never per-individual shaming. Creates gentle structural pressure toward responsiveness.

**C5. Blind screening mode.** Optional per-posting toggle that hides name, photo, gender, and branch until shortlist. Strong ethics-and-design talking point in the viva.

**C6. Waitlist auto-fill.** If a selected candidate withdraws, the next shortlisted applicant is automatically notified and the seat reopens.

**C7. Calendar export.** `.ics` feed for deadlines and scheduled interviews.

**C8. QR bridge.** Each posting generates a QR code for physical noticeboards, bridging the offline channel rather than pretending it doesn't exist. Cheap to build, demos beautifully.

**C9. Recommendation letter workflow.** Structured LOR request with deadline tracking and reminder nudges.

### 5.4 WON'T — this cycle, stated to bound scope

Native mobile apps, institutional SSO/LDAP, video interviews or calls, payment or stipend disbursement, public feed of any kind, AI-generated profile or posting content, resume parsing, cross-institute federation.

Listing these explicitly is a scope-management artifact. It reads as deliberate rather than incomplete.

---

## 6. Architecture

### 6.1 Layers

```
Client            Next.js 15 (App Router), TypeScript, Tailwind CSS
                  Server Components for read paths, Client Components for interaction
                       │  HTTPS / JSON
API Gateway       Route handlers or Express — routing, Zod validation, rate limiting,
                  JWT verification, RBAC middleware, structured request logging
                       │
Services          Identity · Profile · Opportunity · Application · Matching ·
                  Messaging · Notification · Analytics · Moderation
                       │
Data              PostgreSQL (transactional, source of truth)
                  Redis (session, cache, rate limit counters, job queue)
                  Postgres FTS + pg_trgm (search)
                  S3-compatible object storage (attachments, avatars)
```

### 6.2 Two deliberate simplifications from the original proposal

**Elasticsearch → PostgreSQL full-text search + `pg_trgm`.** At pilot scale (tens of postings, low hundreds of users) a separate search cluster adds an operational failure mode and a sync-consistency problem for zero measurable benefit. Postgres `tsvector` with a GIN index plus trigram fuzzy matching covers faceted search comfortably. Document the migration trigger explicitly: *"if p95 search latency exceeds 300ms or the corpus passes ~50k documents, migrate to a dedicated index."* Naming the threshold is what makes this read as engineering judgement rather than avoidance.

**WebSockets → optimistic UI + polling for v1.** Scoped messaging in a pipeline app is not a real-time chat product; message volume is low and latency tolerance is high. Server-Sent Events or a 10-second poll is sufficient. Keep the transport behind an interface so upgrading to Socket.io is a swap, not a rewrite.

Both simplifications should appear in the TechSpec under a "Decisions and trade-offs" section with the reasoning above. Evaluators reward justified simplification far more than unjustified complexity.

### 6.3 Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 + TypeScript | One deployable unit, typed end to end, fast iteration |
| Styling | Tailwind CSS v4 | Utility-first, no naming overhead |
| ORM | Prisma | Typed queries, migration history as a version-controlled artifact |
| Database | PostgreSQL 16 | Relational integrity, FTS, JSONB where needed |
| Cache / queue | Redis + BullMQ | Sessions, rate limits, scheduled digest and expiry jobs |
| Auth | Custom JWT (access 15m + refresh 7d, rotating) | Course expects to see auth built, not delegated |
| Validation | Zod | One schema shared by client and server |
| Testing | Vitest (unit), Supertest (integration), Playwright (E2E) | Covers all three levels the syllabus asks for |
| CI/CD | GitHub Actions | Lint → typecheck → test → migrate → deploy on green |
| Hosting | Vercel (app) + Neon or Railway (Postgres) | Free tier, preview deployments per PR |

### 6.4 Cross-cutting concerns

- **Audit log.** Every privileged action (role change, moderation, attestation, admin override) writes to an append-only `audit_log` table.
- **Rate limiting.** Redis token bucket per user and per IP on auth, application submission, and messaging endpoints.
- **Idempotency.** Application submission and status transitions accept an idempotency key to prevent double-submit.
- **Soft deletion.** Nothing is hard-deleted. `deleted_at` everywhere, preserving analytics integrity.
- **Data privacy.** CGPA and contact details private by default. Field-level visibility controls on the profile.

---

## 7. Data model outline

Full DDL belongs in `Schema.md`. This is the entity map plus the non-obvious constraints.

### 7.1 Entities

**Identity:** `users`, `refresh_tokens`, `alumni_claims`
**Profile:** `profiles`, `skills`, `user_skills`, `projects`, `attestations`
**Opportunity:** `opportunities`, `opportunity_skills`, `saved_searches`, `saved_opportunities`
**Application:** `applications`, `application_events`, `rejection_reasons`
**Team:** `teams`, `team_roles`, `team_members`
**Communication:** `threads`, `messages`, `notifications`, `notification_preferences`
**Content:** `interview_experiences`, `referral_tokens`
**Governance:** `flags`, `audit_log`, `admin_actions`

### 7.2 Constraints that carry the design

These are the ones worth calling out in `Schema.md` — each encodes a product rule in the database rather than in application code, which is the correct place for it.

1. `applications` — `UNIQUE (opportunity_id, student_id) WHERE deleted_at IS NULL`. One live application per student per opportunity.
2. `application_events` — insert-only. Revoke UPDATE and DELETE at the role level. This is what makes TTA trustworthy.
3. `attestations` — `FOREIGN KEY (application_id)` is **NOT NULL**, with a check that the referenced application has `status = 'SELECTED'`. This one constraint is what makes attestations unfarmable, and it lives in the schema, not in a service method.
4. `opportunities.seats_filled <= opportunities.seat_count` — CHECK constraint.
5. Application budget — enforced by a partial-count query inside the same transaction as the insert, with `SERIALIZABLE` isolation or a row-level advisory lock to prevent a race.
6. `user_skills` — composite PK `(user_id, skill_id)`; proficiency as an enum, not an integer.
7. `threads` — `CHECK (application_id IS NOT NULL OR team_id IS NOT NULL)`. A thread cannot float free. Scoped messaging enforced structurally.
8. `opportunities.search_vector` — generated `tsvector` column with a GIN index, maintained by trigger.

### 7.3 Derived values — compute, never store

TTA, responsiveness score, match score, and readiness percentage are all computed from base tables. Materialise them into a nightly-refreshed view only if a query becomes slow; never let them drift as denormalised columns. Say this in `Schema.md`.

---

## 8. Metrics and evaluation

### 8.1 Primary

**Median Time-to-Acknowledgement ≤ 48 hours** across the pilot. Computed as `first_transition_at − applied_at` from `application_events`. Fully attributable, never self-reported.

### 8.2 Secondary

| Metric | Definition | Target |
|---|---|---|
| Discovery time | Session start → first opportunity detail view | < 2 min |
| Resolution rate | Applications reaching a terminal state before deadline + 7d | ≥ 80% |
| Match relevance | Suggested peers actually contacted / suggested | ≥ 30% |
| Status clarity | Self-reported, 5-point Likert | ≥ 4.0 |
| Attestation adoption | Selected applications resulting in an attestation | ≥ 25% |
| Availability | Uptime of login and submission paths | ≥ 99% |

### 8.3 Method

Pilot with 15–25 students and 3–5 faculty/alumni. Baseline established through structured pre-pilot interviews on the current informal workflow — capture perceived wait time and count of applications that never received a reply. The gap between *perceived* wait and *measured* TTA is itself an interesting finding and worth reporting.

Instrument analytics events from day one. Retrofitting instrumentation in Week 3 never works.

---

## 9. Three-week plan

### Week 1 — Foundation

- **D1–D2:** Requirements freeze, SRS, UML (use-case, class, activity, sequence), wireframes, ER diagram, repository and CI skeleton
- **D3–D4:** Database schema, Prisma migrations, seed data, auth service (register, verify, login, refresh, RBAC middleware)
- **D5–D6:** Profile CRUD, skill taxonomy, user-skill assignment, alumni claim flow
- **D7:** Integration tests for auth and profile; deploy to staging
- **Milestone:** a verified user can register, log in, and build a complete skill-tagged profile on a live URL.

### Week 2 — The spine

- **D8–D9:** Opportunity CRUD, structured fields, SLA pledge, deadline expiry job
- **D10:** Search and faceting — FTS, GIN index, filter API, results UI
- **D11–D12:** Application submission, budget enforcement, status pipeline, event log, poster applicant view
- **D13:** TTA computation, responsiveness badge, nudge job
- **D14:** Scoped messaging, notification digest, preferences
- **Milestone:** full loop closed end to end — post, discover, apply, transition, notify, measure. **This is the demoable product.** If Week 3 collapses entirely, you still pass on this.

### Week 3 — Differentiation and hardening

- **D15–D16:** Attestations, rejection reason codes, explainable matching
- **D17:** Team formation, saved searches and alerts
- **D18:** Admin console, moderation queue, analytics dashboard
- **D19:** Stretch tier — readiness meter and interview archive, in that order, cut without hesitation if behind
- **D20:** Test completion, accessibility pass, performance pass, seed the pilot dataset
- **D21:** Pilot run, metric collection, report, demonstration rehearsal
- **Milestone:** pilot executed, real TTA numbers in hand.

### Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Scope creep into Could tier | High | Week 2 milestone is the hard gate; Could tier is touched only after it passes |
| Pilot participants don't engage | Medium | Recruit before Week 3; seed realistic data; schedule a fixed 90-minute live pilot window |
| Search performance | Low | GIN index from day one; documented migration threshold |
| Team member unavailable | Medium | Ownership is per-module with a named backup; no single-owner critical path |
| Deployment failure at demo | Medium | Staging + production parity; recorded fallback demo video |

---

## 10. Ownership

| Area | Owner | Backup |
|---|---|---|
| Auth, RBAC, admin, moderation | Harshdeep | Sehaj |
| Opportunity, application, TTA, analytics | Aakriti | Harshdeep |
| Profile, matching, teams, messaging, UI system | Sehaj | Aakriti |
| CI/CD, schema migrations, test infrastructure | Shared, rotating weekly | — |

Adjust the split to your actual strengths, but keep three properties: every module has one named owner, every owner has a backup, and the shared infrastructure rotates so all three of you can defend the pipeline in the viva.

---

## 11. Software engineering artifacts required by the course

Map each to where it lives, so nothing gets missed:

| Artifact | Home document |
|---|---|
| SRS — functional + non-functional requirements | PRD.md |
| Use-case diagram and specifications | AppFlow.md |
| Class diagram | Schema.md |
| ER diagram | Schema.md |
| Activity diagrams (application lifecycle, attestation) | AppFlow.md |
| Sequence diagrams (login, apply, transition) | AppFlow.md |
| State transition diagram (application states) | AppFlow.md |
| Architecture diagram | TechSpecifications.md |
| Test plan and cases (unit / integration / acceptance) | ImplementationPlan.md |
| Traceability matrix (requirement → module → test) | Tracker.md |
| Version control and branching strategy | Rules.md |
| CI/CD pipeline definition | TechSpecifications.md |
| Risk register | ImplementationPlan.md |

The traceability matrix is disproportionately valuable for marks relative to the effort it costs. Build it as a table in `Tracker.md` and keep it current.

---

## 12. Briefs for the eight documents

### 1. `PRD.md`
Problem statement with the ranked F1–F4 failures. Vision and one-line definition. Positioning table from §2.1 and the explicit non-goals from §2.2 — the non-goals section is what stops anyone conflating this with a social app. Personas (student, faculty, alumni, admin) with a representative scenario each. User stories grouped by MoSCoW tier, each with acceptance criteria in Given/When/Then form. Non-functional requirements: performance, security, availability, accessibility (WCAG 2.1 AA), privacy. Success metrics from §8. Assumptions and dependencies. Out of scope.

### 2. `TechSpecifications.md`
Architecture diagram and layer responsibilities. Stack table with a justification column. **A "Decisions and trade-offs" section** covering the two simplifications in §6.2 with their migration triggers — this section is where engineering judgement is visible, so give it real space. API surface: every endpoint with method, path, auth requirement, request schema, response schema, error codes. Auth design: token lifetimes, rotation, revocation, RBAC matrix of role × resource × action. Cross-cutting concerns from §6.4. CI/CD pipeline stages. Environment and configuration management. Observability: logging, metrics, error tracking.

### 3. `AppFlow.md`
Use-case diagram plus per-use-case specifications (actor, precondition, main flow, alternate flows, postcondition). Screen-by-screen navigation map per role. Application state machine with the full transition table: from-state, to-state, allowed actor, side effects, notifications fired. Sequence diagrams for registration/verification, opportunity publication, application submission with budget check, status transition with TTA capture, and attestation issuance. Activity diagrams for the application lifecycle and the alumni claim flow. Error and empty states for every screen.

### 4. `Design.md`
Design principles derived from positioning — *information density over visual delight, status legibility above all, zero engagement mechanics*. Design tokens: colour (semantic status palette where each application state has one unambiguous colour), type scale, spacing, radius, elevation. Component inventory: opportunity card, status pill, pipeline stepper, skill tag (self-claimed vs attested variants), responsiveness badge, filter panel, empty state, notification row. Layout patterns per breakpoint. Accessibility rules: contrast ratios, focus order, keyboard navigation, ARIA on the pipeline stepper, and never encoding status through colour alone. Dark mode token mapping.

### 5. `Schema.md`
ER diagram. Class diagram. Full DDL per table: columns, types, nullability, defaults, indexes, foreign keys, check constraints. The §7.2 constraint list with a note on which product rule each one encodes — this is the strongest section in the document, so lead the constraint discussion with attestations. Enumerations. The derived-values policy from §7.3. Migration strategy and rollback. Seed data specification. Retention and soft-delete policy.

### 6. `ImplementationPlan.md`
Phase breakdown by day from §9 with deliverables and exit criteria per phase. Milestone gates with explicit go/no-go conditions. Dependency graph showing what blocks what. Test plan: unit coverage target, integration scenarios, E2E happy paths, acceptance criteria per Must feature. Risk register from §9. Rollback plan. Pilot execution protocol: recruitment, briefing script, task list, data collection method, debrief questions.

### 7. `Tracker.md`
Living document, updated daily. Task table: ID, title, module, owner, MoSCoW tier, status, blockers, estimate vs actual. Traceability matrix mapping requirement ID → user story → module → test case → status. Daily standup log: done, next, blocked. Decision log with date, decision, alternatives considered, rationale. Bug register with severity and resolution. Metric snapshots once the pilot starts.

### 8. `Rules.md`
Git strategy: branch naming (`feat/`, `fix/`, `chore/`), conventional commits, PR template, review requirement (one approval minimum), no direct pushes to `main`. Code standards: TypeScript strict mode, naming conventions, file and folder structure, import ordering, no `any`. API conventions: REST resource naming, status code usage, consistent error envelope, pagination format. Database conventions: `snake_case`, plural table names, timestamp columns on every table. Testing rules: what must have a test before merge. Definition of Done. Security rules: never commit secrets, validate every input at the boundary, parameterised queries only, rate-limit every mutation. Documentation rules: every module gets a README, every architectural decision gets a log entry.

---

## 13. What to lead with

When you present or defend this, lead in this order:

1. **The problem is ghosting**, not discovery. Everyone builds discovery. Almost nobody measures resolution.
2. **TTA is computed from immutable database timestamps**, so accountability is structural rather than social.
3. **Attestations require a completed application to exist**, so verified competency cannot be farmed.
4. **The application budget** solves student spam and poster overload with a single constraint.
5. **Everything the platform excludes** — no feed, no likes, no follower counts — is excluded on purpose, because engagement mechanics work against the metric the product is optimising.

That sequence makes the project impossible to mistake for a campus social network, which is exactly the outcome you need.
