<div align="center">

# 🎨 Plan A — Phase 2 Frontend
## Put a clickable face on the spine

`Thapar Nexus` · Option 1 · **Selected & in progress**

</div>

> **Goal:** turn the 30 backend endpoints into a real, clickable demo in the
> warm-dark editorial style. Nothing new on the backend — this is the UI layer
> that makes the post → discover → apply → decide → message loop visible.

---

## 1. Why this first

Phase 2's backend (T-09 → T-17) is complete and pushed, but **only 4 pages
exist** (landing, register, login, profile). The product is demoable via curl,
not by clicking. The highest-value next move is a face on the spine so a marker,
a pilot user, or a teammate can *use* it.

---

## 2. Scope — pages to build

| Route | Who | What it does | Endpoints |
|---|---|---|---|
| `/opportunities` | all | Feed + full-text search + facets (type/domain/stipend) | `GET /api/opportunities` |
| `/opportunities/new` | faculty/alumni | Post a structured, SLA-pledged opportunity | `POST /api/opportunities`, `GET /api/skills` |
| `/opportunities/[id]` | all | Detail; **Apply** (student) / **Manage** (poster); poster responsiveness badge | `GET /api/opportunities/:id`, `POST …/applications` |
| `/opportunities/[id]/applicants` | poster | Pipeline board; move APPLIED→…→SELECTED/REJECTED | `GET/PATCH` applications |
| `/applications` | student | "My applications" with live status + rejection reason | `GET /api/applications` |
| `/applications/[id]` | participants | Event timeline + **scoped messaging** thread | `GET/POST …/messages` |
| `/notifications` | all | Feed + unread + digest cadence preference | `GET/POST notifications`, prefs |

Plus a shared **authenticated app shell** (top nav: Feed · Applications ·
Notifications · Profile · Sign out; role-aware "Post" button).

---

## 3. Approach

1. **Extend `src/lib/client/api.ts`** with typed functions for every Phase 2
   endpoint (reusing the existing in-memory access token + silent-refresh
   `request<T>()`). No token ever touches `localStorage`.
2. **Reuse the design system** — tokens already include the 9 status colours
   (`--st-applied` … `--st-atrisk`) that map 1:1 to `AppState`/`OppStatus`.
   Add only the new component classes (feed card, facet bar, pipeline column,
   chat bubble, notification row).
3. **Build page by page**, keeping `tsc` + `next build` green after each.
4. **Guard every page** with `bootstrapSession()`; role-gate actions in the UI
   (the API still enforces RBAC — the UI just hides what it can't do).

---

## 4. Order of build

1. API client extension + shared `<AppNav>` shell → foundation
2. `/opportunities` feed (search + facets) — the front door
3. `/opportunities/[id]` detail + apply — the student's core action
4. `/opportunities/new` post form — the poster's core action
5. `/opportunities/[id]/applicants` pipeline — the poster's decision surface
6. `/applications` + `/applications/[id]` timeline + messaging
7. `/notifications` feed + preferences
8. Polish: empty states, loading skeletons, responsive, a11y pass

---

## 5. Definition of done

- Every page renders and is reachable from the nav.
- The full loop is clickable end to end against a live Postgres.
- `tsc --noEmit` clean · `next build` clean · existing tests still green.
- Warm-dark + light themes both correct; keyboard-navigable.

---

## 6. Out of scope (deferred to Phase 3)

Attestations UI, explainable-matching UI, team formation, admin console,
analytics dashboard. Those pair with **Plan B** (Phase 3 backend) and get their
own UI pass later.

---

<div align="center">

_Selected direction. See `Phase3-Backend-Plan.md` for the alternative._

</div>
