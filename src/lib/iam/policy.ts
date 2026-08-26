import type { Role, UserStatus } from "@prisma/client";
import {
  OWNERSHIP_SCOPED,
  roleHasPermission,
  type Permission,
} from "./permissions";

/**
 * The authenticated principal, derived from a verified access token and (for
 * anything sensitive) re-checked against the database. Never build this from
 * unvalidated client input.
 */
export interface Principal {
  userId: string;
  role: Role;
  status: UserStatus;
}

export interface ResourceRef {
  /** Owner of the concrete resource, for ownership-scoped permissions. */
  ownerId?: string;
}

export type Decision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Central authorization decision (codeguard-0-authorization: centralize at the
 * boundary; deny by default). Layers, in order:
 *   1. Status gate — SUSPENDED never passes; UNVERIFIED/PENDING_ALUMNI are
 *      read-only.
 *   2. RBAC matrix — role must be granted the permission.
 *   3. Ownership — ownership-scoped permissions require actor === resource owner
 *      (prevents IDOR / horizontal privilege escalation).
 *
 * Admins bypass the ownership check ONLY for non-mutating reads; ownership-scoped
 * *mutations* are never silently granted to admins here (they use audited
 * override paths instead).
 */
export function decide(
  principal: Principal,
  permission: Permission,
  resource: ResourceRef = {},
): Decision {
  // 1. Account status gate.
  if (principal.status === "SUSPENDED") {
    return { allowed: false, reason: "account_suspended" };
  }
  const isMutating = !permission.endsWith(":read") && !permission.endsWith(":list");
  if (
    (principal.status === "UNVERIFIED" || principal.status === "PENDING_ALUMNI") &&
    isMutating
  ) {
    // Read-only until verified / approved.
    return { allowed: false, reason: "account_read_only" };
  }

  // 2. RBAC matrix — deny by default.
  if (!roleHasPermission(principal.role, permission)) {
    return { allowed: false, reason: "missing_permission" };
  }

  // 3. Ownership scoping.
  if (OWNERSHIP_SCOPED.has(permission)) {
    if (resource.ownerId === undefined) {
      // Caller forgot to pass the owner — fail closed rather than open.
      return { allowed: false, reason: "ownership_unresolved" };
    }
    if (resource.ownerId !== principal.userId) {
      return { allowed: false, reason: "not_owner" };
    }
  }

  return { allowed: true };
}

/** Boolean convenience wrapper. */
export function can(
  principal: Principal,
  permission: Permission,
  resource: ResourceRef = {},
): boolean {
  return decide(principal, permission, resource).allowed;
}
