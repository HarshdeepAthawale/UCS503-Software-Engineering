# Thapar Nexus — PPT Content (7 slides)

Course: **UCS503 Software Engineering** · Thapar Institute of Engineering & Technology, Patiala
Team: **Harshdeep Athawale (1024031062) · Aakriti Chauhan (1024031055) · Sehaj Dhillon (1024030620)**

Covers exactly what's required: problem statement → why we chose it → target audience → solution → completion status (feature-wise + engineering-wise). Content pulled from `docs/PRD.md`, `docs/Tracker.md`, and a live repo/test check on 2026-09-04.

---

## Slide 1 — Title

**Title:** Thapar Nexus
**Subtitle:** A verified opportunity pipeline for the institute
**Content:**
- UCS503 Software Engineering · Thapar Institute of Engineering & Technology, Patiala
- Harshdeep Athawale · Aakriti Chauhan · Sehaj Dhillon

**Speaker notes:** Open with the one-liner: *"Thapar Nexus exists to make sure a student's application reaches a decision — and to make it visible when it doesn't."* Not a network. Not a feed. A pipeline with accountability.

---

## Slide 2 — Problem Statement

**Title:** Opportunities inside the institute die of silence
**Content:**
- Research assistantships, TA roles, internships, hackathon teams, referrals — all circulate through **WhatsApp groups, noticeboards, word of mouth**.
- Four failures result, ranked:
  | # | Failure | What actually happens |
  |---|---|---|
  | **F3 — Primary** | **Resolution failure** | An application sent by email vanishes. Can't tell *rejected* from *still reading* from *never opened*. No accountability for silence. |
  | F1 | Discovery failure | Miss the posting if you're not in the right group |
  | F2 | Authenticity failure | Forwarded messages lose provenance — deadlines drift |
  | F4 | Competency failure | Every skill on a profile is self-claimed, unverifiable |

**Speaker notes:** Say the ranking out loud. The disease is ghosting (F3); the other three are enablers we fix along the way, not the headline.

---

## Slide 3 — Why We Chose This

**Title:** Why this problem, and why this shape of solution
**Content:**
- It's the failure every one of us has actually lived: emailing 5–6 professors, hearing back from none, no way to tell if the email was even opened.
- It's **solvable with a database, not a UX trick** — the fix is structural: immutable state transitions + measured timestamps. That made it a real software-engineering problem, not a CRUD app with a chat feature bolted on.
- A structurally similar campus project exists in the same cohort — we made the difference **visible in the schema and the metrics**, not just the pitch:
  | Dimension | Social / feed app | Thapar Nexus |
  |---|---|---|
  | Success metric | Engagement, time-on-app | **Time-to-Acknowledgement** |
  | Content lifetime | Permanent | **Deadline-bound, auto-expiring** |
  | Optimal behavior | Use it more | **Use it less, get a result faster** |
- Deliberately excluded: no feed, no likes, no follower counts, no DMs unattached to an opportunity — every one of those optimizes for attention capture, the opposite of the goal.

**Speaker notes:** The last table row is the thesis — a feed app that's abandoned quickly has failed by its own metric; Nexus succeeds the same way.

---

## Slide 4 — Target Audience

**Title:** Who it's for
**Content:**
1. **👩‍🎓 Student** — verified via `@thapar.edu` + OTP. Applies within a budget, tracks every status change, gets an attested skill on selection.
2. **👨‍🏫 Faculty** — verified via `@thapar.edu` + role grant. Publishes structured postings with an SLA pledge, reviews a ranked pipeline, issues attestations.
3. **🎓 Alumni** — no institute email anymore, so verified via a **claim-and-approve flow** (submit roll no. + grad year + proof → admin approves). Posts referrals, mentors, shares interview experience.
4. **🛡️ Administrator** — keeps the pipeline trustworthy: approves alumni, resolves flags, curates the skill taxonomy, watches institute-wide analytics.

**Speaker notes:** The alumni flow is worth one sentence — the naive `@thapar.edu`-only rule makes the alumni role unreachable after graduation, and catching that is a requirements-analysis win, not just a feature.

---

## Slide 5 — The Solution

**Title:** What we built
**Content:**
- **Identity & roles** — domain-restricted signup, OTP + Google OAuth, 4-layer deny-by-default RBAC
- **Structured profiles** — admin-curated skill taxonomy (no free text), projects with repo links, CGPA private by default
- **Structured postings** — typed fields, required/preferred skills, eligibility filters (branch/CGPA/backlogs), auto-expiry, **SLA pledge**
- **Faceted discovery** — full-text search + filters + sort, target: a relevant posting in under 2 minutes
- **Application pipeline** — `APPLIED → SHORTLISTED/REJECTED → INTERVIEW → SELECTED/WITHDRAWN`, every transition an **immutable, timestamped event**
- **Time-to-Acknowledgement** — computed from real DB timestamps, never self-reported; auto-nudge at 80% of the SLA window; poster gets a public **Responsiveness Badge**
- **Scoped messaging** — threads exist only inside an application, no free-form DMs (safety by design)
- **Notification digest + admin console** — batched alerts, deadline reminders, flag queue, institute-wide analytics
- **Flagship differentiator (in progress):** skill **attestations** — an endorsement that requires a completed, `SELECTED` engagement to exist first, so competency can't be farmed

---

## Slide 6 — Completion Status: Feature-Wise

**Title:** What's done, in plain terms
**Content:**
- **Login & Accounts** — Thapar email + OTP signup, Google login, role-based access (Student/Faculty/Alumni/Admin), a special "prove you graduated" flow for alumni
- **Profile** — branch, year, CGPA (private by default), skills (from a controlled list, not free text), projects with GitHub links
- **Posting Opportunities** — faculty/alumni post internships, RA/TA roles, hackathon teams, referrals; set required skills, deadline, seats, a response-time promise, and who's even eligible to apply; old posts auto-expire
- **Finding Opportunities** — search + filters (type, domain, skills, stipend) + sorting; loads in under a second
- **Applying & Tracking** — apply, then watch it move Applied → Shortlisted → Interview → Selected/Rejected; every change is timestamped and visible, nothing hidden or edited; a selected student can withdraw and free the seat; capped applications per student (no spamming)
- **The "No More Ghosting" Feature** — tracks exactly how long a poster took to respond; auto-nudges slow posters; fast responders get a visible "responsiveness score" on their posts
- **Messaging & Notifications** — chat tied only to a real application (no random DMs), one inbox for all conversations, deadline reminders, batched notifications instead of spam
- **Admin Panel** — approve/reject alumni, handle flagged posts, manage the skills list, see platform-wide stats (resolution rate, average response time)

**Missing / incomplete:**
- **Skill Attestations** (professor/alumni verifying a skill after working with a student) — not built, was meant to be the standout feature
- **Explainable Matching**, **Team Formation**, **Saved Searches/Alerts**, **Verified Project Links** — none of these exist yet, all "nice to have" bonus features
- **Rate limiting** works but is a basic version, not production-grade

**Speaker notes:** Everything a student or faculty member needs day-to-day — signup, profile, posting, searching, applying, tracking, messaging, notifications, admin oversight — is fully built and working. What's missing is the bonus layer on top, not the core product.

---

## Slide 7 — Completion Status: Engineering-Wise

**Title:** Built and verified, not just claimed
**Content:**
- **19** database models, **13** enums — one live PostgreSQL (Supabase) schema, all migrations applied
- **17** application pages, **48** API routes
- **205 automated tests passing**, 14 test files (RBAC authorization matrix alone: 69 cases)
- `npm run typecheck` clean — strict TypeScript, zero `any`; production build green
- **Security:** deny-by-default RBAC at 4 layers, role/status reloaded from DB on every request, append-only audit log, parameterized queries only
- **Deployment:** split architecture live — frontend on Vercel, backend on Render, one origin via rewrite (no CORS, cookies stay same-site); Dockerized for local dev parity
- **Search performance measured, not assumed:** p95 ≈ 74 ms (budget was 300 ms)
- **Zero mock data** — every record in the system was created by a real user action, kept deliberately honest for pilot metrics
- **Named gaps, stated openly:** attestations not yet built, CI blocked on billing (workflow already written), integration/E2E tests not yet added, pilot not yet run

**Speaker notes:** Close on the honesty point — the team's own tracker treats "a partial marked as done" as worse than "a gap stated plainly." That's the engineering culture of the project, worth saying explicitly.
