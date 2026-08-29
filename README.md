<div align="center">

# Thapar Nexus

### A verified opportunity pipeline for the institute

**UCS503 Software Engineering** · Thapar Institute of Engineering & Technology, Patiala

</div>

---

> **Thapar Nexus exists to make sure an application reaches a decision — and to make it visible when it doesn't.**
> Not a network. Not a feed. A pipeline with accountability.

The platform targets **ghosting** as its primary problem: applications sent by email vanish, and a student cannot tell "rejected" from "still reading" from "never opened". Nexus makes acknowledgement time (**TTA**) measurable from immutable database timestamps, anchors skill attestations to completed engagements so competency cannot be farmed, and excludes every engagement mechanic (no feed, no likes, no follower counts) on purpose.

## 📚 Documentation

Full documentation lives in [`docs/`](docs/):

| Document | Purpose |
|---|---|
| [MasterPlan](docs/MasterPlan.md) | Source of truth — all other docs derive from it |
| [PRD](docs/PRD.md) | Problem, positioning, personas, features, requirements |
| [TechSpecifications](docs/TechSpecifications.md) | Architecture, stack, API, auth, CI/CD |
| [AppFlow](docs/AppFlow.md) | Use cases, state machine, sequence & activity diagrams |
| [Design](docs/Design.md) | Design system — tokens, status palette, components |
| [Schema](docs/Schema.md) | ER + class diagrams, DDL, constraints |
| [ImplementationPlan](docs/ImplementationPlan.md) | Phased plan, gates, tests, pilot protocol |
| [Tracker](docs/Tracker.md) | Tasks, traceability matrix, standups, decisions |
| [Rules](docs/Rules.md) | Git, code, API, DB conventions & Definition of Done |

## 🛠️ Stack

**Shipped:** Next.js 15 (App Router) · TypeScript · a hand-authored CSS design system (`src/app/globals.css`, CSP-safe, light/dark) · Supabase PostgreSQL 16 via Prisma + `@prisma/adapter-pg` · Supabase Storage (résumé PDFs) · `jose` JWT auth · Zod · Resend (email) · Vitest (201 tests)

**Planned, not yet installed:** Redis token-bucket rate limiting (T-41 — today's limiter is in-memory and therefore per-instance) · Supertest + Playwright (T-38) · GitHub Actions (workflow committed, inert until the account's Actions billing clears — B-01)

> Earlier drafts of this README listed Tailwind CSS, Redis + BullMQ, Supertest and Playwright as though they were in use. None are installed. See D-20 in the Tracker: a partial item is recorded with its gap, never rounded up.

## 🚀 Development (Phase 1 — Identity & IAM)

```bash
# 1. Install
npm install

# 2. Configure — copy the template and fill in real values
cp .env.example .env      # set DATABASE_URL and strong JWT secrets

# 3. Database
npm run db:generate       # generate the Prisma client
npm run db:migrate        # create the schema (needs a live Postgres)

# 4. Provision the single admin (no mock data is ever seeded)
ADMIN_EMAIL=you@thapar.edu ADMIN_PASSWORD='<strong-secret>' npm run bootstrap:admin

# 5. Run
npm run dev               # http://localhost:3000  (API under /api)
npm test                  # RBAC matrix + security unit tests
npm run typecheck
```

**Security model:** see [docs/Security.md](docs/Security.md). RBAC is deny-by-default and enforced at four layers (edge middleware → route guard → service → database). The database starts empty — every record is created by a real user.

## 👥 Team

| Member | Roll No |
|---|---|
| Harshdeep Athawale | 1024031062 |
| Aakriti Chauhan | 1024031055 |
| Sehaj Dhillon | 1024030620 |
