import { isAdminRole } from "@/lib/domain/admin-portal";
import type { SessionUser } from "@/lib/client/api";

/**
 * The app's navigation, defined once. The desktop bar and the phone tab bar
 * both render `primaryNav`, so the two can never disagree about where a role
 * may go. Role-aware for convenience only - the API enforces access.
 */

export type NavIcon = "opportunities" | "applications" | "postings" | "teams" | "messages" | "console" | "profile";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** True when `path` belongs to this destination (drives the active state). */
  match: (path: string) => boolean;
}

const under = (base: string) => (p: string) => p === base || p.startsWith(`${base}/`);

/** A poster's own management pages, which belong under "My postings". */
const POSTER_PAGE = /^\/opportunities\/(mine(\/|$)|new$|[^/]+\/(edit|applicants|shortlisted)$)/;

/** /opportunities and a posting's public page - not a poster's management pages. */
function opportunitiesMatch(p: string): boolean {
  if (p === "/opportunities") return true;
  return p.startsWith("/opportunities/") && !POSTER_PAGE.test(p);
}

const OPPORTUNITIES: NavItem = { href: "/opportunities", label: "Opportunities", icon: "opportunities", match: opportunitiesMatch };
const MESSAGES: NavItem = { href: "/messages", label: "Messages", icon: "messages", match: under("/messages") };
const PROFILE: NavItem = { href: "/profile", label: "Profile", icon: "profile", match: (p) => p === "/profile" };

/** Faculty and verified alumni post; a pending alumnus cannot until approved. */
export function canPost(user: SessionUser): boolean {
  return user.role === "FACULTY" || (user.role === "ALUMNI" && user.status !== "PENDING_ALUMNI");
}

/** The main destinations for a role, in order. */
export function primaryNav(user: SessionUser): NavItem[] {
  if (isAdminRole(user.role)) {
    return [{ href: "/admin", label: "Console", icon: "console", match: under("/admin") }, OPPORTUNITIES];
  }
  if (user.role === "ALUMNI" && user.status === "PENDING_ALUMNI") {
    return [OPPORTUNITIES, { href: "/alumni", label: "Verification", icon: "applications", match: under("/alumni") }];
  }
  if (canPost(user)) {
    return [
      OPPORTUNITIES,
      { href: "/opportunities/mine", label: "My postings", icon: "postings", match: (p) => POSTER_PAGE.test(p) },
      MESSAGES,
    ];
  }
  return [
    OPPORTUNITIES,
    { href: "/applications", label: "Applications", icon: "applications", match: under("/applications") },
    { href: "/teams", label: "Teams", icon: "teams", match: under("/teams") },
    MESSAGES,
  ];
}

/** Phone bottom bar: the primary destinations plus Profile. */
export function tabNav(user: SessionUser): NavItem[] {
  return [...primaryNav(user), PROFILE];
}

export function roleLabel(role: SessionUser["role"]): string {
  return { STUDENT: "Student", FACULTY: "Faculty", ALUMNI: "Alumni", ADMIN: "Admin", SUPER_ADMIN: "Super admin" }[role];
}

/** Up to two initials for the account avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** Where someone lands after signing in: admins at the console, a pending alumnus at their claim. */
export function homeFor(user: SessionUser | null): string {
  if (user && isAdminRole(user.role)) return "/admin";
  if (user?.role === "ALUMNI" && user.status === "PENDING_ALUMNI") return "/alumni";
  return "/opportunities";
}

export type PostingAccess = "ok" | "signed-out" | "pending" | "not-poster";

/** Why a person can or cannot post, so a posting page can say the right thing. */
export function postingAccess(user: SessionUser | null): PostingAccess {
  if (!user) return "signed-out";
  if (canPost(user)) return "ok";
  if (user.role === "ALUMNI" && user.status === "PENDING_ALUMNI") return "pending";
  return "not-poster";
}
