import type { Role } from "@prisma/client";

/**
 * ── The authorization matrix (single source of truth for RBAC) ───────────────
 *
 * Permissions are `resource:action` strings. Access is DENY-BY-DEFAULT
 * (codeguard-0-authorization: when no allow rule matches → 403). A role can do
 * only what is explicitly granted here; there is no "deny" list to get wrong.
 *
 * Ownership- and status-scoped rules (e.g. "edit *your own* profile") are marked
 * as `OWN` and additionally checked against the concrete resource in policy.ts -
 * a grant here is necessary but not sufficient.
 *
 * This matrix is mirrored by the tests in tests/iam/authorization-matrix.test.ts,
 * which iterate every (role × permission) cell and assert allow/deny.
 */

export const RESOURCES = [
  "profile",
  "opportunity",
  "application",
  "attestation",
  "team",
  "meeting",
  "alumni_claim",
  "skill_taxonomy",
  "message",
  "notification",
  "flag",
  "analytics",
  "user",
  "faculty_allowlist",
] as const;
export type Resource = (typeof RESOURCES)[number];

export type Permission = `${Resource}:${string}`;

/** Permissions that only apply to resources the actor owns. */
export const OWNERSHIP_SCOPED: ReadonlySet<Permission> = new Set<Permission>([
  "profile:update",
  "application:withdraw",
  "opportunity:update",
  "opportunity:transition",
  "attestation:create",
  "team:manage",
  "team:join_request_withdraw",
  "meeting:create",
  "meeting:cancel",
]);

/**
 * Grants per role. Kept forward-looking (opportunity/application/attestation
 * appear here now) so the matrix is stable as later phases add the routes.
 */
const STUDENT: Permission[] = [
  "profile:read",
  "profile:update", // OWN
  // NOT `profile:read_resume` - a student sees only their OWN resume, which is
  // the ownership path in the service, not a matrix grant.
  "opportunity:read",
  "opportunity:list",
  "application:create",
  "application:read", // OWN (scoped in policy)
  "application:withdraw", // OWN
  "attestation:read",
  // Team formation (T-22) is peer-driven: any STUDENT may lead a team.
  "team:create",
  "team:read",
  "team:list",
  "team:join_request", // request a role slot (no existing resource to own yet)
  "team:join_request_withdraw", // OWN - withdraw your own pending request
  // Meeting scheduling: a team lead schedules team syncs (OWN, scoped to
  // teams they lead); every participant reads their own meetings.
  "meeting:create",
  "meeting:cancel",
  "meeting:read",
  "team:manage", // OWN - accept/reject requests, close a team (only as its lead)
  "skill_taxonomy:read",
  "message:read", // membership-scoped in the service
  "message:send", // membership-scoped in the service
  "notification:read", // own feed (scoped in the service)
  "notification:manage", // own read-state & prefs (scoped in the service)
  "flag:create", // report a posting for moderation (M9)
];

const FACULTY: Permission[] = [
  "profile:read",
  "profile:read_resume", // any member's resume, for reviewing candidates (T-44)
  "profile:update", // OWN
  "opportunity:read",
  "opportunity:list",
  "opportunity:create",
  "opportunity:update", // OWN
  "opportunity:transition", // OWN (owns the posting)
  "application:read", // applicants to own postings (scoped in policy)
  "attestation:create", // gated further by SELECTED application (Phase 3 + DB CHECK)
  "attestation:read",
  // Hackathon teams are student-only (peer formation); faculty/alumni use the
  // opportunity pipeline, not team formation.
  "meeting:create",
  "meeting:cancel",
  "meeting:read",
  "skill_taxonomy:read",
  "message:read", // membership-scoped in the service
  "message:send", // membership-scoped in the service
  "notification:read", // own feed (scoped in the service)
  "notification:manage", // own read-state & prefs (scoped in the service)
  "flag:create",
];

// Approved alumni behave like faculty for posting/attesting. A pending
// alumnus may also submit their own claim (the policy lets that one write
// through while the account is read-only; the service scopes it to self).
const ALUMNI: Permission[] = [...FACULTY, "alumni_claim:submit"];

// Admins run the governance console (/admin). Still explicit - no silent
// wildcard on ownership-scoped actions, which must go through the owner or an
// admin override that is separately audited.
const ADMIN: Permission[] = [
  "profile:read",
  "profile:read_resume", // governance / moderation
  "opportunity:read",
  "opportunity:list",
  "application:read",
  "attestation:read",
  "team:read",
  "team:list",
  "skill_taxonomy:read",
  "skill_taxonomy:manage",
  "message:read", // moderation
  "notification:read", // own feed
  "notification:manage", // own read-state & prefs
  "alumni_claim:read",
  "alumni_claim:approve",
  "flag:read",
  "flag:resolve",
  "analytics:read",
  "user:read", // admin console: list/search users
  "user:manage", // admin console: member role changes, alumni provisioning
  "faculty_allowlist:read",
];

// The one super admin: everything an admin can do, plus the powers that change
// who governs or who may use the platform at all.
const SUPER_ADMIN: Permission[] = [
  ...ADMIN,
  "user:manage_admins", // create / remove admin accounts
  "user:suspend", // suspend / restore any member
  "faculty_allowlist:manage",
  "opportunity:remove", // uphold a flag by taking the posting down
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  STUDENT: new Set(STUDENT),
  FACULTY: new Set(FACULTY),
  ALUMNI: new Set(ALUMNI),
  ADMIN: new Set(ADMIN),
  SUPER_ADMIN: new Set(SUPER_ADMIN),
};

/** True iff the role is granted the permission in the matrix (ignores ownership). */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
