import type { Role } from "@prisma/client";

/**
 * ── The authorization matrix (single source of truth for RBAC) ───────────────
 *
 * Permissions are `resource:action` strings. Access is DENY-BY-DEFAULT
 * (codeguard-0-authorization: when no allow rule matches → 403). A role can do
 * only what is explicitly granted here; there is no "deny" list to get wrong.
 *
 * Ownership- and status-scoped rules (e.g. "edit *your own* profile") are marked
 * as `OWN` and additionally checked against the concrete resource in policy.ts —
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
  "alumni_claim",
  "skill_taxonomy",
  "message",
  "notification",
  "flag",
  "analytics",
  "user",
] as const;
export type Resource = (typeof RESOURCES)[number];

export type Permission = `${Resource}:${string}`;

/** Permissions that only apply to resources the actor owns. */
export const OWNERSHIP_SCOPED: ReadonlySet<Permission> = new Set<Permission>([
  "profile:update",
  "application:withdraw",
  "opportunity:update",
  "opportunity:transition",
]);

/**
 * Grants per role. Kept forward-looking (opportunity/application/attestation
 * appear here now) so the matrix is stable as later phases add the routes.
 */
const STUDENT: Permission[] = [
  "profile:read",
  "profile:update", // OWN
  "opportunity:read",
  "opportunity:list",
  "application:create",
  "application:read", // OWN (scoped in policy)
  "application:withdraw", // OWN
  "attestation:read",
  "skill_taxonomy:read",
  "message:read", // membership-scoped in the service
  "message:send", // membership-scoped in the service
  "notification:read", // own feed (scoped in the service)
  "notification:manage", // own read-state & prefs (scoped in the service)
];

const FACULTY: Permission[] = [
  "profile:read",
  "profile:update", // OWN
  "opportunity:read",
  "opportunity:list",
  "opportunity:create",
  "opportunity:update", // OWN
  "opportunity:transition", // OWN (owns the posting)
  "application:read", // applicants to own postings (scoped in policy)
  "attestation:create", // gated further by SELECTED application (Phase 3 + DB CHECK)
  "attestation:read",
  "skill_taxonomy:read",
  "message:read", // membership-scoped in the service
  "message:send", // membership-scoped in the service
  "notification:read", // own feed (scoped in the service)
  "notification:manage", // own read-state & prefs (scoped in the service)
  "flag:create",
];

// Approved alumni behave like faculty for posting/attesting.
const ALUMNI: Permission[] = [...FACULTY];

// Admin holds every governance capability; still explicit (no silent wildcard
// on ownership-scoped actions, which must go through the owner or an admin
// override that is separately audited).
const ADMIN: Permission[] = [
  "profile:read",
  "opportunity:read",
  "opportunity:list",
  "application:read",
  "attestation:read",
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
  "user:manage",
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  STUDENT: new Set(STUDENT),
  FACULTY: new Set(FACULTY),
  ALUMNI: new Set(ALUMNI),
  ADMIN: new Set(ADMIN),
};

/** True iff the role is granted the permission in the matrix (ignores ownership). */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
