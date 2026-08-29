# Remaining Work — execution plan

**Written** 2026-08-29 · **Branch** `feat/google-oauth-prod` → `main`

The Must-tier backend (M1–M9, 48 routes) is complete and 201 tests pass. Nothing
below is backend feature work except **C3**. What remains is deployment, the CI
pipeline that was never written, and the tail of the tracker.

**Decisions taken** (2026-08-29, with HA):
- **Production host → Vercel.** Render (`srv-da9cg71srm7s73btsjig`) is currently
  live and healthy; it becomes standby, then is retired once Vercel is verified.
- **Cron trigger → cron-job.org**, not Vercel Cron. Vercel Hobby caps crons at
  two and daily-only; we need four, hourly. An external pinger is also
  host-independent, which is the mistake we are correcting here in the first
  place.

---

## Phase A — Deployment: finish the Vercel move

The reason this phase exists: `vercel.json` declares four cron schedules, Render
does not read that file, and nobody noticed. In production today opportunities
never expire, SLA never sweeps to `AT_RISK`, and no reminders or digests send.
The endpoints are correct and `CRON_SECRET` is set — nothing calls them.

| # | Task | Blocked by | Status |
|---|---|---|---|
| **A1** | Strip `crons` from `vercel.json` — 4 jobs exceeds the Hobby cap and would fail the deploy; cron-job.org owns scheduling now | — | ✅ |
| **A2** | Connect the Vercel project `ucs-503-software-engineering` to the GitHub repo, production branch `main` | HA (dashboard) | ⬜ |
| **A3** | Port all 23 env vars Render carries → Vercel, with `ALLOW_INSECURE_COOKIES=false` and `NODE_ENV` **omitted** (Vercel sets it; our build script pins it anyway) | A2 | ⬜ |
| **A4** | Set `APP_ORIGIN` to the Vercel production URL, and register that origin + `/api/auth/google/callback` in Google Cloud Console — OAuth breaks byte-for-byte otherwise | A3 | ⬜ |
| **A5** | Verify the Vercel deploy: `/api/health`, a real login, a résumé signed-URL fetch | A4 | ⬜ |
| **A6** | Create 4 cron-job.org jobs against the Vercel origin, `Authorization: Bearer $CRON_SECRET`, hourly at :00 / :15 / :30 / :45 | A5 | ⬜ |
| **A7** | Confirm each job returns 200 and does work (seed one past-deadline posting, watch it flip to `EXPIRED`) | A6 | ⬜ |
| **A8** | Retire Render: suspend the service, delete `.vercel` staleness, keep the DB untouched | A7 | ⬜ |
| **A9** | **Rotate the Render API token** `rnd_6Hu…` — it was pasted into a chat transcript | — | ⬜ |

## Phase B — CI/CD (T-34)

`.github/` does not exist. There is no pipeline at all; the ticket was recorded
as blocked on Actions billing, but the workflow was never authored either.

| # | Task | Note | Status |
|---|---|---|---|
| **B1** | Write `.github/workflows/ci.yml`: install → `db:generate` → `typecheck` → `test` → `build` on push/PR to `main` | `npm run lint` is excluded — `next lint` is interactive and deprecated in 15.x, it would hang the runner | ✅ |
| **B2** | Unblock GitHub Actions billing (**G-01**) — external, HA only | Workflow is inert until this clears | ⬜ |
| **B3** | Add a `main`-branch protection rule requiring CI green | B2 | ⬜ |

## Phase C — Tracker tail

Ordered cheapest-first, except C3 which is the only real feature left.

| # | ID | Task | Tier | Est | Status |
|---|---|---|---|---|---|
| **C1** | T-43 | Reconcile README / TechSpec stack claims with reality (they still say Vercel-only, Neon, and omit Supabase Storage) | Must | 0.25d | ✅ |
| **C2** | T-40 | Back-fill user stories into PRD §6 for M2, M4, M7, M8, M9 | Must | 0.5d | ⬜ |
| **C3** | T-19 | **Attestations**, `SELECTED`-gated by a DB `CHECK` constraint | Should | 1d | ⬜ |
| **C4** | T-38 | Integration + E2E harness (Supertest / Playwright) | Must | 1d | ⬜ |
| **C5** | T-41 | Redis token-bucket rate limiter (NFR-S4) — needs a Redis instance | Should | 0.5d | ⬜ |
| **C6** | T-28 | A11y (WCAG 2.1 AA) + perf + hardening pass | Must | 1d | ⬜ |
| **C7** | T-29 | Pilot run + report | Must | 1d | ⬜ |

Deferred, not scheduled: T-24 verified project artifacts, T-22 team formation,
T-26 readiness meter — all Should/Could and none block the pilot.

---

## Order of execution

A1 → A2–A4 (HA, dashboard) → A5 → A6–A7 → B1 → C1 → C2 → C3 → …

A8, A9, B2, B3 are HA-side and can happen whenever. Phase C proceeds
independently of Phase A once A1 and B1 are committed.
