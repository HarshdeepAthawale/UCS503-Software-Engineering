<div align="center">

# 🛡️ Identity v2 & Admin Console Plan
## One admin, thapar-only signup, allowlisted faculty, admin-provisioned alumni

`Thapar Nexus` · Governance phase · **In progress**

</div>

> Refines the identity model to match real institutional constraints (revoked
> alumni emails, a finite faculty roster, a single operator) and builds the admin
> console that makes it all governable.

---

## 1. Identity model (v2)

| Role | How you get it | Auth methods | Verification |
|---|---|---|---|
| **STUDENT** | Default for every `@thapar.edu` self-signup | Email+password+OTP · Google OAuth | Thapar email ownership (OTP or Google) |
| **FACULTY** | Email is on the **faculty allowlist**, or admin promotes | Same as student | Admin curates the allowlist / roster |
| **ALUMNI** | **Admin-provisioned only** (personal email) | Passwordless email-OTP login | Admin reviews proof (roll no, grad year, degree) |
| **ADMIN** | **One**, from env bootstrap; never self-registered, never grantable in-panel | Email+password · Google (if thapar) | Operator holds the env secret |

### Hard rules
1. **Only `@thapar.edu` may self-register.** Any other email is rejected on both the email and Google paths. (Alumni are the sole non-thapar accounts, and only the admin can create them.)
2. **Default role is STUDENT** for every incoming self-signup.
3. **Google OAuth** is restricted to `@thapar.edu` and yields an ACTIVE STUDENT (Google already proved the email). Email signup stays UNVERIFIED → OTP → ACTIVE.
4. **Exactly one ADMIN.** The panel can set STUDENT / FACULTY / ALUMNI, **never ADMIN**, and cannot modify or demote the admin account.

---

## 2. Faculty — allowlist + panel

- New table **`faculty_allowlist`** (`email` unique, `note`, timestamps), managed in the admin panel.
- On **every login** (password, OTP, Google), if a user is STUDENT and their email is on the allowlist, they are **promoted to FACULTY** and the change is audited. So the admin can pre-load the professor roster before deployment; each professor becomes FACULTY the moment they first sign in.
- The admin can also **directly toggle** any user's role in the Users table (promote/demote), independent of the allowlist.

---

## 3. Alumni — admin-provisioned

Because the `@thapar.edu` address is revoked, alumni **cannot self-register** (rule 1). Instead:

1. An alum submits proof out-of-band (roll no, graduation year, degree, a proof URL / certificate).
2. The admin, in the panel, **provisions an alumni account**: personal email + name → creates `User(role=ALUMNI, status=ACTIVE)` and stores the proof in `alumni_claims`.
3. The account has **no password**; the alum signs in with **passwordless email-OTP** (a code sent to their personal email).

This keeps alumni identity **human-verified** (impractical to automate for ex-students) and fully under the single admin's control.

### Passwordless OTP login (new, also a convenience for everyone)
- `POST /api/auth/otp-login/request` `{email}` → if an ACTIVE account exists, a `LOGIN`-purpose OTP is sent (uniform response otherwise — no enumeration).
- `POST /api/auth/otp-login/verify` `{email, otp}` → issues the same rotating session as any login (with faculty-allowlist promotion applied).

---

## 4. Admin console (single-operator dashboard)

Route `/admin` (ADMIN only; link shown in nav only for ADMIN). Full CRUD:

| Section | Capabilities | Endpoints |
|---|---|---|
| **Overview** | Counts: users by role, live/at-risk opportunities, applications, pending claims | `GET /api/admin/overview` |
| **Users** | Search/filter; change role (not ADMIN); suspend/reactivate; soft-delete | `GET /api/admin/users`, `PATCH /api/admin/users/:id` |
| **Alumni** | Provision an alumni account (email + name + proof) | `POST /api/admin/users` (kind=alumni) |
| **Faculty allowlist** | Add / remove professor emails | `GET/POST /api/admin/faculty-allowlist`, `DELETE …/:id` |
| **Skills taxonomy** | Create / rename / soft-delete (already built) | `GET/POST/PATCH/DELETE /api/admin/skills` |
| **Alumni claims** | Review + approve/reject (already built) | `GET/PATCH /api/admin/alumni-claims` |

### Guardrails (enforced server-side)
- Deny-by-default RBAC: every admin route requires `user:manage` / `user:read` / `faculty_allowlist:*`, all ADMIN-only.
- The admin account is **immutable from the panel** (no role change, no suspend, no delete).
- Role can never be set to `ADMIN`. Every privileged action is **audited**.

---

## 5. Build order (committed increments)

1. **Schema**: `faculty_allowlist` + migration.
2. **Faculty allowlist promotion** applied in all login paths (+ tests).
3. **Remove public alumni self-registration**; keep `AlumniClaim` for admin proof storage.
4. **Passwordless OTP login** (request + verify).
5. **Admin backend**: overview, users list/patch, provision alumni, allowlist CRUD (+ RBAC cells + tests).
6. **Admin frontend**: `/admin` dashboard; `Admin` nav link for ADMIN.
7. **Docs**: update `Security.md`, `Tracker.md`; keep `tsc` + tests + build green throughout.

---

## 6. Non-goals (for now)

Multi-admin, SSO/SAML, automated alumni verification (LinkedIn/DigiLocker), password reset flow (superseded by OTP login), and email delivery (OTPs are returned in dev; a real mailer plugs in at the existing seam).

---

<div align="center">

_Decisions confirmed with the operator: admin-provisioned alumni · faculty allowlist + panel._

</div>
