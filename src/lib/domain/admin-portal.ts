import type { Role } from "@prisma/client";

/**
 * Admin accounts have their own sign-in door (/admin); members use the main
 * page (/). Each door accepts only its own accounts. Pure so the rule is shared
 * by the auth service and the client, and unit-tested once.
 */
export type Portal = "admin" | "member";

export function isAdminRole(role: Role): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function portalForRole(role: Role): Portal {
  return isAdminRole(role) ? "admin" : "member";
}
