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
| **A5** | On **Render**, set `APP_ORIGIN=https://thapar-nexus.vercel.app` — the **Vercel** URL, not Render's own. The browser sits on Vercel, so that is the `redirect_uri` Google must return to; the callback then proxies through. Register `${APP_ORIGIN}` and `${APP_ORIGIN}/api/auth/google/callback` in Google Cloud Console | A3 | ⬜ |
| **A6** | Verify through the proxy: `/api/health`, a real login **and a page refresh 15+ min later** (proves the refresh cookie survives), a résumé signed-URL fetch, and the Google flow end to end | A5 | ⬜ |
| **A7** | Four cron-job.org jobs against the **Render** origin, `Authorization: Bearer $CRON_SECRET`, hourly at :00 / :15 / :30 / :45 | — | ⬜ |
| **A8** | Confirm each job returns 200 and does work — seed one past-deadline posting, watch it flip to `EXPIRED` | A7 | ⬜ |
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
