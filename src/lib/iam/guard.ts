import { Errors } from "@/lib/http/errors";
import { audit } from "@/lib/security/audit";
import { getPrincipal } from "./context";
import { decide, type Principal, type ResourceRef } from "./policy";
import type { Permission } from "./permissions";

/**
 * Route-level authorization guards - the second enforcement layer after edge
 * middleware. Every protected handler calls one of these; the matrix and
 * ownership rules are applied uniformly (codeguard-0-authorization: validate
 * permissions on every request via centralized middleware/policies).
 */

/** Require a valid, authenticated principal or throw 401. */
export async function requireAuth(req: Request): Promise<Principal> {
  const principal = await getPrincipal(req);
  if (!principal) throw Errors.unauthenticated();
  return principal;
}

/**
 * Require a permission (and, for ownership-scoped permissions, ownership of the
 * resource). Throws 401 if unauthenticated, 403 if denied. Denials are audited
 * with a non-PII rationale code.
 */
export async function authorize(
  req: Request,
  permission: Permission,
  resource: ResourceRef = {},
): Promise<Principal> {
  const principal = await requireAuth(req);
  const result = decide(principal, permission, resource);
  if (!result.allowed) {
    await audit({
      action: "authz.denied",
      actorId: principal.userId,
      target: permission,
      metadata: { reason: result.reason, role: principal.role },
    });
    // Generic 403 - do not reveal whether the resource exists.
    throw Errors.forbidden();
  }
  return principal;
}
