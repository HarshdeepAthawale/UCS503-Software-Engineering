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

## 🐳 Docker

One command for a teammate with nothing installed but Docker — app plus a real
Postgres 16, no local Node, no local database, no version matching.

```bash
docker compose up --build                                # start the stack
docker compose run --rm app npm run db:migrate:deploy    # apply migrations (once)
docker compose down -v                                   # stop, delete the volume
```

**UI looks stale after a pull?** Dev compose keeps `.next` and `node_modules` in
anonymous volumes that survive `docker compose up --build`. Recreate just those
(the database volume is kept):

```bash
docker compose up --build --renew-anon-volumes
```

App on http://localhost:3000, Postgres on 5432 (exposed so `npm run db:studio`
and psql work from the host).

`docker compose` runs the Dockerfile's **`dev`** stage. `docker build .` (no
`--target`) still produces the production image — that is the one Render would
deploy.

Notes that are not obvious from the files:

- **Why two targets.** The production image pins `NODE_ENV=production`, and
  `src/lib/env.ts` then refuses to boot with `ALLOW_INSECURE_COOKIES=true`
  (B-05). But a browser will not store a `Secure` cookie from
  `http://localhost`, so a production build served over plain HTTP can never
  hold a session and nobody could sign in. The dev stage resolves that honestly
  rather than weakening the guard.

- `db:migrate:deploy` rather than `db:migrate:apply`: the latter passes
  `--env-file=.env`, and a container has no `.env` — its environment comes from
  compose. Same script, same migrations, just no file to read.
- **Migrations do not run on container boot**, by design. Several replicas
  starting at once would race on the schema, and a web container should not hold
  schema authority. Run the command above deliberately.
- **`output: "standalone"` is opt-in** via `DOCKER_BUILD=1` (see
  `next.config.ts`). The Vercel and Render builds are unchanged by any of this.
- **Alpine is safe here** only because `engineType = "client"` (D-18) puts Prisma
  on the WASM query compiler — there is no native engine to link, so the usual
  musl/openssl problems do not arise.
- **The Prisma `.wasm` is copied explicitly.** Standalone traces `import`s, but
  the client loads that file by path at runtime, so tracing never sees it.
  Omitting it is how production once died with `ENOENT query_compiler_bg.wasm`.
- **The compose secrets are development values.** `ALLOW_INSECURE_COOKIES=true`
  is set there because the container serves plain HTTP on localhost, where a
  Secure cookie would never be stored — `src/lib/env.ts` still refuses to boot
  with it on in a real production environment (B-05).
- Résumé storage, email and Google sign-in are left unconfigured; each reports
  cleanly rather than failing. Add the keys to `docker-compose.yml` to exercise
  them.

Render can deploy this image directly (Settings → Build & Deploy → change the
runtime to Docker). That switch has **not** been made — Render currently builds
from source and works. See `docs/Remaining-Work-Plan.md`.

## 🚀 Development (Phase 1 — Identity & IAM)

```bash
# 1. Install
npm install

# 2. Configure — copy the template and fill in real values
cp .env.example .env      # set DATABASE_URL and strong JWT secrets

# 3. Database
npm run db:generate       # generate the Prisma client
npm run db:migrate        # create the schema (needs a live Postgres)

# 4. Provision the super admin (no mock data is ever seeded); it signs in at /admin
ADMIN_EMAIL=you@thapar.edu ADMIN_PASSWORD='<strong-secret>' npm run bootstrap:admin

# 5. Run
npm run dev               # http://localhost:3000  (API under /api)
npm test                  # RBAC matrix + security unit tests
npm run typecheck
```

**Security model:** see [docs/Security.md](docs/Security.md). RBAC is deny-by-default and enforced at four layers (edge middleware → route guard → service → database). The database starts empty — every record is created by a real user.

### Demo database (made-up data, separate from the real one)

To see the product at institute scale without breaking pilot honesty, a
separate local database, `nexus_demo`, can be filled with made-up
`@example.test` accounts (~900 members, 320 postings, ~3,600 applications with
realistic poster behaviour, teams, messages). The real database is never touched.

```bash
docker compose up -d db
# .env.demo.local (gitignored) needs:
#   DATABASE_URL="postgresql://nexus:nexus@localhost:5432/nexus_demo?schema=public"
#   DEMO_PASSWORD="<12+ chars, shared by every demo account>"
npm run demo:setup        # drop + recreate nexus_demo, migrate, seed (~10 s)
npm run dev:demo          # the app on the demo data; outgoing email is disabled
```

The seed script refuses any database not named `nexus_demo`, and prints a
sample sign-in for each role (super admin and admins sign in at `/admin`).

## 👥 Team

| Member | Roll No |
|---|---|
| Harshdeep Athawale | 1024031062 |
| Aakriti Chauhan | 1024031055 |
| Sehaj Dhillon | 1024030620 |
