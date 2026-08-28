<div align="center">

# 🧠 Plan B — Phase 3 Backend
## Differentiation & hardening, UI in one later pass

`Thapar Nexus` · Option 2 · **Not selected (deferred)**

</div>

> **Goal:** keep building backend depth — the features that make Nexus more than
> a job board — and defer *all* UI to a single consolidated pass after the
> backend is feature-complete.

---

## 1. What it would cover (T-18 → T-27)

| ID | Feature | Tier | Notes |
|---|---|---|---|
| T-19 | **Attestations** anchored to `SELECTED` work | Should | Competency is unfarmable — enforced by a DB `CHECK`, not just the service |
| T-20 | **Rejection reason codes** surfaced structurally | Should | Field already exists; wire feedback into the pipeline |
| T-21 | **Explainable matching** (Jaccard over skills) | Should | Show matched + missing tags, never a black-box score |
| T-22 | **Team formation** by complementarity | Should | Fill missing roles from skill gaps |
| T-18 | **Admin console** — claims, flags, taxonomy | Must | Moderation queues + governance surfaces |
| T-23 | **Saved searches + alerts** | Should | Built on T-11 discovery |
| T-24 | **Verified project artifacts** (repo proof) | Should | Ties profiles to real work |
| T-25 | **Analytics dashboard** (institute TTA, resolution rate) | Must | Consumes the T-14 analytics service |
| T-26 | Readiness meter · T-27 Interview archive | Could | Stretch — cut without hesitation if behind |

---

## 2. Why one might choose this

- Keeps momentum on the **differentiators** (matching, attestations, teams) that
  distinguish the project for marks while the design language settles.
- A single UI pass at the end avoids reworking screens as models change.

## 3. Why we did NOT choose it now

- The spine already works but **cannot be seen or clicked** — a demo today means
  reading JSON. Reviewers and pilot users need a usable surface first.
- Building more backend widens the "invisible work" gap; a clickable product is
  the better risk position at the **G2 gate**.

---

## 4. Approach (if picked later)

1. Attestations: schema + DB `CHECK (application.status = 'SELECTED')`, service,
   routes, matrix cells, tests.
2. Matching: pure Jaccard module (tested), read endpoints, no writes.
3. Admin console + analytics: read-heavy governance/reporting endpoints on top of
   the existing audit log and analytics service.
4. Then a **consolidated UI pass** covering both Phase 2 and Phase 3 screens.

---

## 5. Sequencing note

Plan A (Phase 2 frontend) and Plan B are **complementary, not exclusive** — the
chosen path is **A first** (make the spine clickable), then **B** (Phase 3
backend), then a final UI pass for the Phase 3 surfaces.

---

<div align="center">

_Deferred. Selected direction is `Phase2-Frontend-Plan.md`._

</div>
