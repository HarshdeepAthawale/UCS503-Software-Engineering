<div align="center">

# 🔄 Application Flow & Behaviour
## Thapar Nexus — Use Cases, State Machine & Diagrams

`UCS503 Software Engineering` · **Document 3 of 8** · Derived from `MasterPlan.md`

</div>

---

## Table of Contents

1. [Use-Case Diagram](#1-use-case-diagram)
2. [Use-Case Specifications](#2-use-case-specifications)
3. [Screen Navigation Map (per role)](#3-screen-navigation-map-per-role)
4. [Application State Machine](#4-application-state-machine)
5. [Transition Table](#5-transition-table)
6. [Sequence Diagrams](#6-sequence-diagrams)
7. [Activity Diagrams](#7-activity-diagrams)
8. [Error & Empty States](#8-error--empty-states)

---

## 1. Use-Case Diagram

```mermaid
flowchart LR
    Student([👩‍🎓 Student])
    Faculty([👨‍🏫 Faculty])
    Alumni([🎓 Alumni])
    Admin([🛡️ Admin])

    subgraph Nexus["Thapar Nexus"]
        UC1((Register &<br/>Verify))
        UC2((Build Profile))
        UC3((Search &<br/>Discover))
        UC4((Apply to<br/>Opportunity))
        UC5((Track<br/>Application))
        UC6((Publish<br/>Opportunity))
        UC7((Manage<br/>Pipeline))
        UC8((Issue<br/>Attestation))
        UC9((Scoped<br/>Messaging))
        UC10((Claim Alumni<br/>Status))
        UC11((Approve<br/>Claims))
        UC12((Moderate<br/>Flags))
        UC13((View<br/>Analytics))
    end

    Student --- UC1 & UC2 & UC3 & UC4 & UC5 & UC9
    Faculty --- UC1 & UC2 & UC6 & UC7 & UC8 & UC9
    Alumni --- UC10 & UC2 & UC6 & UC8 & UC9
    Admin --- UC11 & UC12 & UC13
```

---

## 2. Use-Case Specifications

### UC-04 — Apply to Opportunity

| Field | Detail |
|---|---|
| **Actor** | Student |
| **Precondition** | Authenticated; opportunity is live (not `EXPIRED`); student below application budget |
| **Main flow** | 1. Student opens opportunity detail → 2. Clicks *Apply* → 3. System checks budget in a `SERIALIZABLE` txn → 4. Inserts `applications` row + `APPLIED` event → 5. Shows pipeline stepper at `APPLIED` |
| **Alternate A1** | Budget full → refuse with *"Withdraw one to apply"* |
| **Alternate A2** | Duplicate apply (same `Idempotency-Key`) → return the original application |
| **Alternate A3** | Deadline passed between load and submit → refuse; posting is `EXPIRED` |
| **Postcondition** | One live application exists; `applied_at` timestamped for TTA |

### UC-07 — Manage Applicant Pipeline

| Field | Detail |
|---|---|
| **Actor** | Faculty / Alumni (owner) |
| **Precondition** | Owns the opportunity; applicants exist |
| **Main flow** | 1. Open applicant list → 2. Select applicant → 3. Choose next state → 4. System writes immutable event with actor+timestamp → 5. First transition captures TTA → 6. Notification fired to student |
| **Alternate A1** | Move to `REJECTED` → owner must pick a reason code (S2) |
| **Alternate A2** | SLA window at 80% → system had already auto-nudged owner |
| **Postcondition** | New immutable `application_events` row; nothing edited or deleted |

### UC-08 — Issue Attestation

| Field | Detail |
|---|---|
| **Actor** | Faculty / Alumni |
| **Precondition** | A `SELECTED` application exists between actor and student |
| **Main flow** | 1. Open the selected application → 2. Choose skill + write context string → 3. System validates `SELECTED` via DB `CHECK` → 4. Attestation linked permanently to that application |
| **Alternate A1** | No `SELECTED` application → DB rejects; UI never offered the action |
| **Postcondition** | Attested skill renders with verified marker, ranks above self-claimed |

### UC-10 — Claim Alumni Status

| Field | Detail |
|---|---|
| **Actor** | Alumni |
| **Precondition** | Registered with any email |
| **Main flow** | 1. Submit roll no, grad year, degree, 1 proof artifact → 2. Account enters `PENDING_ALUMNI` (read-only) → 3. Admin reviews → 4. Approve → posting rights + badge |
| **Alternate A1** | Admin rejects with reason → account stays read-only, may resubmit |
| **Postcondition** | Approved alumni can post, attest, spend referral tokens |

---

## 3. Screen Navigation Map (per role)

```mermaid
flowchart TD
    Login[/Login · Register/] --> OTP[/OTP Verify/]
    OTP --> Dash{Role?}

    Dash -->|Student| SD[Student Dashboard]
    SD --> Srch[Search / Discovery]
    SD --> MyApps[My Applications]
    Srch --> OppDetail[Opportunity Detail]
    OppDetail --> Apply[Apply · Pipeline Stepper]
    MyApps --> Track[Application Track + Messages]

    Dash -->|Faculty/Alumni| PD[Poster Dashboard]
    PD --> NewOpp[Publish Opportunity]
    PD --> Pipe[Applicant Pipeline]
    Pipe --> Attest[Issue Attestation]

    Dash -->|Admin| AD[Admin Console]
    AD --> Claims[Alumni Claim Queue]
    AD --> Flags[Flag Queue]
    AD --> Tax[Taxonomy Manager]
    AD --> An[Analytics]
```

---

## 4. Application State Machine

```mermaid
stateDiagram-v2
    [*] --> APPLIED: student applies
    APPLIED --> RECEIVED: poster opens (TTA captured)
    RECEIVED --> SHORTLISTED: poster shortlists
    SHORTLISTED --> INTERVIEW: schedule interview
    INTERVIEW --> SELECTED: offer
    INTERVIEW --> REJECTED: decline (+reason code)
    SHORTLISTED --> REJECTED: decline (+reason code)
    RECEIVED --> REJECTED: decline (+reason code)
    APPLIED --> WITHDRAWN: student withdraws
    RECEIVED --> WITHDRAWN: student withdraws
    SHORTLISTED --> WITHDRAWN: student withdraws
    INTERVIEW --> WITHDRAWN: student withdraws
    SELECTED --> [*]
    REJECTED --> [*]
    WITHDRAWN --> [*]

    note right of RECEIVED
        First transition out of APPLIED
        stamps first_transition_at → TTA
    end note
```

> **Non-terminal states** (`APPLIED`, `RECEIVED`, `SHORTLISTED`, `INTERVIEW`) count against the student's application budget. **Terminal states** (`SELECTED`, `REJECTED`, `WITHDRAWN`) free a slot.

---

## 5. Transition Table

| From | To | Allowed actor | Side effects | Notification |
|---|---|---|---|---|
| — | `APPLIED` | Student | Insert application + event; stamp `applied_at`; consume 1 budget slot | Poster: "new application" |
| `APPLIED` | `RECEIVED` | Owner | Stamp `first_transition_at`; **compute TTA** | Student: "acknowledged" |
| `RECEIVED` | `SHORTLISTED` | Owner | Event row | Student: "shortlisted" |
| `SHORTLISTED` | `INTERVIEW` | Owner | Event row; optional interview note | Student: "interview" |
| `INTERVIEW` | `SELECTED` | Owner | Event row; unlocks attestation; may fill seat | Student: "selected" |
| any active | `REJECTED` | Owner | Event row + **reason code (S2)**; free budget slot | Student: "rejected + reason" |
| any active | `WITHDRAWN` | Student | Event row; free budget slot; may trigger waitlist auto-fill (C6) | Poster: "withdrawn" |
| any | `EXPIRED`* | System | Posting-level auto-transition at deadline | Saved/applied students |

_\*`EXPIRED` is an opportunity state, shown here for completeness — applications on an expired posting are resolved per their current state._

---

## 6. Sequence Diagrams

### 6.1 Registration & Verification

```mermaid
sequenceDiagram
    participant U as User
    participant G as Gateway
    participant I as Identity Svc
    participant M as Mail
    participant DB as PostgreSQL
    U->>G: POST /auth/register {email@thapar.edu}
    G->>G: Zod validate + domain check
    G->>I: create user (UNVERIFIED)
    I->>DB: insert user
    I->>M: send OTP
    M-->>U: OTP email
    U->>G: POST /auth/verify-otp {otp}
    G->>I: verify OTP within window
    I->>DB: set ACTIVE
    I-->>U: 200 {access(15m), refresh(7d)}
```

### 6.2 Application Submission with Budget Check

```mermaid
sequenceDiagram
    participant S as Student
    participant G as Gateway
    participant A as Application Svc
    participant DB as PostgreSQL
    S->>G: POST /applications {oppId} + Idempotency-Key
    G->>G: Zod + rate-limit + JWT/RBAC
    G->>A: submit
    A->>DB: BEGIN SERIALIZABLE
    A->>DB: COUNT non-terminal apps for student
    alt budget < 10
        A->>DB: INSERT application + APPLIED event
        A->>DB: COMMIT
        A-->>S: 201 {status: APPLIED}
    else budget full
        A->>DB: ROLLBACK
        A-->>S: 409 APPLICATION_BUDGET_EXCEEDED
    end
```

### 6.3 Status Transition with TTA Capture

```mermaid
sequenceDiagram
    participant P as Poster
    participant G as Gateway
    participant A as Application Svc
    participant N as Notification Svc
    participant DB as PostgreSQL
    P->>G: POST /applications/:id/transition {to: RECEIVED}
    G->>A: transition (owner-only)
    A->>DB: INSERT immutable event (actor, ts)
    A->>DB: is this first transition? → stamp first_transition_at
    A->>A: TTA = first_transition_at - applied_at
    A->>N: enqueue digest entry
    N-->>P: 200 ok
    N-->>Student: "Your application was acknowledged"
```

### 6.4 Attestation Issuance

```mermaid
sequenceDiagram
    participant P as Poster
    participant G as Gateway
    participant T as Profile/Attestation Svc
    participant DB as PostgreSQL
    P->>G: POST /attestations {applicationId, skillId, context}
    G->>T: issue
    T->>DB: INSERT attestation (FK application_id NOT NULL)
    DB->>DB: CHECK application.status = 'SELECTED'
    alt SELECTED
        DB-->>T: ok
        T-->>P: 201 attestation linked
    else not SELECTED
        DB-->>T: constraint violation
        T-->>P: 422 ATTESTATION_REQUIRES_SELECTION
    end
```

---

## 7. Activity Diagrams

### 7.1 Application Lifecycle

```mermaid
flowchart TD
    Start([Student finds opportunity]) --> Budget{Budget<br/>available?}
    Budget -->|no| Refuse[Prompt to withdraw one]
    Budget -->|yes| Apply[Apply → APPLIED]
    Apply --> Wait{Poster acts<br/>within SLA?}
    Wait -->|no, 80% window| Nudge[Auto-nudge poster]
    Nudge --> Wait
    Wait -->|breach| AtRisk[Mark posting AT_RISK]
    Wait -->|yes| Ack[RECEIVED → TTA captured]
    Ack --> Review{Decision}
    Review -->|shortlist| Short[SHORTLISTED → INTERVIEW]
    Short --> Outcome{Outcome}
    Outcome -->|offer| Sel[SELECTED → attestation unlocked]
    Outcome -->|decline| Rej[REJECTED + reason code]
    Review -->|decline early| Rej
    Sel --> End([Terminal · slot freed])
    Rej --> End
    Refuse --> End
```

### 7.2 Alumni Claim Flow

```mermaid
flowchart TD
    A([Register any email]) --> B[Submit rollNo, gradYear,<br/>degree, proof artifact]
    B --> C[Account → PENDING_ALUMNI<br/>read-only]
    C --> D{Admin review}
    D -->|approve| E[Grant posting rights<br/>+ Verified Alumni badge]
    D -->|reject + reason| F[Stay read-only]
    F --> G{Resubmit?}
    G -->|yes| B
    G -->|no| H([End])
    E --> H
```

---

## 8. Error & Empty States

| Screen | Empty state | Error state |
|---|---|---|
| Search / Discovery | "No opportunities match — widen filters or save this search for alerts" | "Search temporarily unavailable — showing recent postings" |
| My Applications | "You haven't applied yet — discover opportunities" | "Couldn't load your pipeline — retry" |
| Applicant Pipeline | "No applicants yet — share the QR (C8) on a noticeboard" | "Pipeline failed to load — retry" |
| Profile | "Add skills from the taxonomy to appear in matches" | "Skill taxonomy unavailable — try again" |
| Attestation | "Attestations unlock when an application is SELECTED" | "Attestation requires a completed engagement" |
| Notifications | "You're all caught up" | "Digest unavailable" |
| Admin claim queue | "No pending alumni claims" | "Queue unavailable" |

---

<div align="center">

[← TechSpecifications](TechSpecifications.md) &nbsp;·&nbsp; **AppFlow** &nbsp;·&nbsp; [Design →](Design.md)

</div>
