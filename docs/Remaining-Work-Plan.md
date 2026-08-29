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

## Phase A — Split deployment: frontend on Vercel, backend on Render

**Topology** (decided 2026-08-29, supersedes the earlier "move everything to Vercel"):

```
browser ──► thapar-nexus.vercel.app ──rewrite /api/*──► ucs503-…onrender.com
                (frontend)                          (backend + DB + storage)
                                    ▲
            cron-job.org ───────────┘  (hits Render DIRECTLY, skips the proxy)
```

One codebase, deployed twice. `BACKEND_ORIGIN` decides which half a deployment
plays: blank on Render and locally, the Render URL on Vercel.

**Why a proxy and not direct cross-origin calls.** The refresh token is HttpOnly
`SameSite=Strict` (`src/lib/security/cookies.ts:18`), there is no CORS layer
anywhere in the codebase, and CSP is `connect-src 'self'`. A browser on
`*.vercel.app` calling `*.onrender.com` is cross-site, so the refresh cookie
would never be sent and every session would die at the 15-minute access-token
expiry. `SameSite=None` would make it a third-party cookie across two different
registrable domains — blocked by default in Safari and Firefox. Behind the
rewrite the browser sees one origin, so cookie flags, CSP and the client's
relative fetches are all unchanged. Cost: one extra hop per API call.

The reason B-06 happened — cron schedules in `vercel.json` that the actual host
never read — is also fixed here: cron-job.org calls Render directly, so it does
not depend on the frontend being up or on any host's cron feature.

| # | Task | Blocked by | Status |
|---|---|---|---|
| **A1** | Delete `vercel.json`; scheduling leaves the repo (D-27) | — | ✅ |
| **A2** | `next.config.ts`: `beforeFiles` rewrite `/api/:path*` → `$BACKEND_ORIGIN`, with https + bare-origin validation. `beforeFiles` is required — a bare rewrites array runs only *after* filesystem routes, so the local /api handlers would win and the proxy would never fire | — | ✅ |
| **A3** | Connect Vercel project `ucs-503-software-engineering` to the repo, production branch `main` | — | ✅ (done 2026-08-29, domain `thapar-nexus.vercel.app`) |
| **A3b** | `prisma generate` in `postinstall` + `build` — Vercel's cached `node_modules` served a client predating the `Flag` model (B-08) | — | ✅ |
| **A4** | Vercel env: **`BACKEND_ORIGIN=https://ucs503-software-engineering.onrender.com`**, `ALLOW_INSECURE_COOKIES=false`, `NODE_ENV` **omitted**. The rest of the vars are still needed — `src/lib/env.ts` validates at boot even though Vercel's own /api copy is never reached | A3 | ⬜ |
| **A5** ✅ | Done — verified: the start endpoint emits `redirect_uri=https://thapar-nexus.vercel.app/api/auth/google/callback`, and both that URI and the origin are registered in Google Cloud Console. ~~On **Render**, set `APP_ORIGIN=https://thapar-nexus.vercel.app`~~ — the **Vercel** URL, not Render's own. The browser sits on Vercel, so that is the `redirect_uri` Google must return to; the callback then proxies through. Register `${APP_ORIGIN}` and `${APP_ORIGIN}/api/auth/google/callback` in Google Cloud Console | A3 | ⬜ |
| **A6** | Verify through the proxy: `/api/health`, a real login **and a page refresh 15+ min later** (proves the refresh cookie survives), a résumé signed-URL fetch, and the Google flow end to end | A5 | ⬜ |
| **A7** | Four cron-job.org jobs against the **Render** origin, `Authorization: Bearer $CRON_SECRET`, hourly at :00 / :15 / :30 / :45 | — | ⬜ |
| **A8** | Confirm each job returns 200 and does work — seed one past-deadline posting, watch it flip to `EXPIRED` | A7 | ⬜ |
| **A9b** | Set `SUPABASE_URL` on Vercel — résumé previews are CSP-blocked without it (B-11) | — | ⬜ |
| **A9** | **Rotate the Render API token** `rnd_6Hu…` — pasted into a chat transcript | — | ⬜ |

**Render is not retired.** It is the backend. Keep `autoDeploy` on `main`.

> **Proxy headroom — do not raise `MAX_RESUME_BYTES` past ~4.4 MB.** Résumé
> uploads now traverse a Vercel function, whose request-body limit is 4.5 MB.
> `src/lib/domain/resume.ts:11` caps résumés at 4 MB, so a max-size PDF plus
> multipart overhead clears it — but only just. Raising the cap would fail
> uploads at the proxy, before any of our own validation runs, and the error
> would come from Vercel rather than `resumeErrorMessage`.

> **T-41 is no longer optional-ish.** `InMemoryRateLimiter`
> (`src/lib/security/rate-limit.ts`) holds its `Map` in process memory. That
> works on Render, which runs a persistent Node server — so this topology
> *preserves* brute-force protection where an all-Vercel serverless move would
> have quietly destroyed it. Keep auth endpoints on Render and the limiter stays
> real; it is still per-instance, so T-41 matters the moment Render scales past
> one instance.

## Phase D — Docker

Local development parity: one command for a teammate with nothing installed but
Docker. Render's deploy is deliberately NOT switched — it builds from source and
works, and swapping a live green deploy while A6 is still unverified would mean
debugging two changes at once.

| # | Task | Status |
|---|---|---|
| **D1** | `Dockerfile` — multi-stage, Node 22 Alpine, `deps → dev → build → runner` | ✅ |
| **D2** | `docker-compose.yml` — app + Postgres 16, healthcheck-gated startup | ✅ |
| **D3** | `output: "standalone"` behind `DOCKER_BUILD=1` so Vercel/Render builds are untouched | ✅ |
| **D4** | Verified: image builds, migrations apply, `/api/health` 200, login round-trips to Postgres | ✅ |
| **D5** | Switch Render to deploy the image (Settings → Build & Deploy → Docker) | ⬜ **deferred until A6 passes** |

**Why two build targets.** The production image pins `NODE_ENV=production`, and
`src/lib/env.ts:118` then refuses to boot with `ALLOW_INSECURE_COOKIES=true`
(B-05). But a browser will not store a `Secure` cookie from `http://localhost`,
so a production build served over plain HTTP can never hold a session — no one
could sign in. Both settings fail, in opposite directions. A `dev` stage
resolves it honestly; weakening a guard that has already caught two real
misconfigurations would not.

`runner` is the final stage, so plain `docker build .` still produces the
production image. Compose uses `target: dev`.

**Five defects, each found only by running it** — the argument for executing a
Dockerfile rather than reviewing one:

| Symptom | Cause |
|---|---|
| `SecretsUsedInArgOrEnv` | build placeholders in `ENV` persist into image metadata → moved inline to `RUN` |
| stack dies on a bind error | host port hardcoded → `${APP_PORT:-3000}` |
| `node: .env: not found` | `db:migrate:apply` passes `--env-file=.env`; a container has none → added `db:migrate:deploy` |
| `MODULE_NOT_FOUND` on the migration runner | runtime image shipped `prisma/` but not `scripts/` |
| 500 on every request | compose set `NODE_ENV=production` **and** `ALLOW_INSECURE_COOKIES=true` — the exact pair B-05 forbids |

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
