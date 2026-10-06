# Thapar Nexus

The institute's **opportunity pipeline**: structured postings, timestamped applications, and accountability for silence. It exists so an application reaches a **decision**, and so ghosting is visible. It is not a campus social network.

## Language

**Opportunity pipeline**:
The product. A posting → application → decision path with immutable events. Success is a faster result, not more time-on-app.
_Avoid_: network, feed, portal, community app, LinkedIn for campus

**Ghosting**:
The primary failure (F3): an application that cannot be distinguished as rejected, still reading, or never opened.
_Avoid_: "poor communication", "slow hiring"

**Opportunity** / **posting**:
A deadline-bound, typed opening (research, internship, TA, hackathon team, micro-task, referral) published by a poster with an SLA pledge.
_Avoid_: job, listing, gig, announcement

**Poster**:
The faculty or alumni member who owns a posting and owes acknowledgement inside the SLA window.
_Avoid_: recruiter, employer, hiring manager, OP

**Applicant**:
A student with a live application on a posting.
_Avoid_: candidate (except in poster-facing copy), user

**Application**:
The first-class record of one student applying to one posting. States: APPLIED → SHORTLISTED / REJECTED → INTERVIEW → SELECTED / WITHDRAWN. Every change is an immutable, timestamped event.
_Avoid_: submission, request, interest

**Decision**:
A terminal application state the student can see: SELECTED, REJECTED, or WITHDRAWN. Silence is not a decision.
_Avoid_: outcome (too vague), result

**Time-to-Acknowledgement** / **TTA**:
`first_transition_at − applied_at`, computed from the event log. Never self-reported.
_Avoid_: response time (unless you mean the SLA window), latency

**SLA pledge**:
The poster's committed acknowledgement window on a posting: 24h, 48h, or one week.
_Avoid_: SLA (alone), response promise, TAT

**At-risk posting**:
A live posting where an applicant is waiting past the SLA window; the poster is auto-nudged and the posting is marked.
_Avoid_: overdue, stale, expired (expired means the deadline passed)

**Responsiveness Badge**:
A poster's rolling median TTA plus response rate, shown on their postings. A number, not a review.
_Avoid_: rating, stars, reputation score, review

**Application budget**:
Cap on a student's simultaneous non-terminal applications (default 10). Withdrawal frees a slot.
_Avoid_: quota, throttle, spam limit

**Scoped messaging**:
A thread that exists only inside one application. No DMs unattached to a posting.
_Avoid_: chat, inbox DM, messages (when you mean free-form)

**Attestation**:
A skill endorsement that can exist only after a completed SELECTED engagement between the two people. Competency cannot be farmed.
_Avoid_: endorsement (LinkedIn sense), badge, verified skill (when self-claimed)

**Self-claimed skill**:
A skill on a profile that has not been attested. Typed from (or into) the taxonomy, capped at eight.
_Avoid_: skill (unqualified, when attestation status matters)

**Skill taxonomy**:
The controlled `Skill` list. Members may type-to-create; admin can still merge. Matching and faceted search key off this table, never free-text strings.
_Avoid_: tags, keywords

**Faceted discovery**:
Full-text search plus structured filters (type, domain, skills, stipend) and sort. Target: a relevant posting in under two minutes.
_Avoid_: feed, browse, search (when you mean the whole discovery path)

**Alumni claim**:
The prove-you-graduated path: roll number, grad year, proof → admin approve. Needed because alumni no longer have `@thapar.edu`. An alumnus registers with any email at `/register/alumni`, confirms it, and stays **Pending alumni** (read-only, can only submit the claim) until an admin verifies it in the console's Alumni claims queue. A claim that can't be verified comes back with a reason and can be resubmitted; it never suspends the account. Admins can still create an alumni account directly.
_Avoid_: alumni signup (implies self-serve), verification (too generic)

**Faculty allowlist**:
Admin-curated institute emails promoted to FACULTY on next sign-in.
_Avoid_: faculty register, invite list

**Flag**:
A report against a posting (spam, misleading, etc.). One open flag per reporter per posting. Uphold may soft-delete the posting.
_Avoid_: report (when you mean the Flag record), takedown

**Member**:
Any signed-in Student, Faculty or Alumni account. Signs in at `/`.
_Avoid_: user (in domain writing), account (when you mean the person)

**Admin**:
An account that runs the governance console at `/admin` and signs in only there. Admins govern; they never post, apply or message.
_Avoid_: moderator, staff

**Super admin**:
The one admin (database-enforced) who also adds and removes admins, curates the faculty allowlist, suspends or restores members, and takes flagged postings down.
_Avoid_: root, owner, head admin

**Pilot honesty**:
Every row in the system comes from a real action. No mock users, no seeded demo applications. TTA stays honest.
_Avoid_: fixtures, seed data (for people/applications)
