import { describe, it, expect } from "vitest";
import { can, decide, type Principal } from "@/lib/iam/policy";
import type { Permission } from "@/lib/iam/permissions";

/**
 * Authorization matrix tests (codeguard-0-authorization: "authorization matrix
 * drives CI tests; failures block merges"). Each case pins an expected allow/deny
 * so a future change to the matrix that widens access fails loudly here.
 */

type Role = Principal["role"];
type Status = Principal["status"];

const P = (role: Role, status: Status = "ACTIVE"): Principal => ({
  userId: "user-1",
  role,
  status,
});

// [role, permission, expected] — non-ownership cases.
const CASES: Array<[Role, Permission, boolean]> = [
  // Students
  ["STUDENT", "opportunity:read", true],
  ["STUDENT", "application:create", true],
  ["STUDENT", "opportunity:create", false], // students cannot post
  ["STUDENT", "attestation:create", false], // cannot attest
  ["STUDENT", "alumni_claim:approve", false], // not an admin
  ["STUDENT", "analytics:read", false],
  // Faculty
  ["FACULTY", "opportunity:create", true],
  ["FACULTY", "attestation:create", true],
  ["FACULTY", "application:create", false], // faculty do not apply
  ["FACULTY", "alumni_claim:approve", false],
  // Alumni behave like faculty for posting/attesting
  ["ALUMNI", "opportunity:create", true],
  ["ALUMNI", "attestation:create", true],
  ["ALUMNI", "alumni_claim:approve", false],
  // Admin governance
  ["ADMIN", "alumni_claim:approve", true],
  ["ADMIN", "alumni_claim:read", true],
  ["ADMIN", "skill_taxonomy:manage", true],
  ["ADMIN", "analytics:read", true],
  ["ADMIN", "opportunity:create", false], // admins govern, they don't post
];

describe("RBAC matrix (deny-by-default)", () => {
  for (const [role, permission, expected] of CASES) {
    it(`${role} ${expected ? "CAN" : "CANNOT"} ${permission}`, () => {
      expect(can(P(role), permission)).toBe(expected);
    });
  }

  it("denies an unknown permission for every role", () => {
    for (const role of ["STUDENT", "FACULTY", "ALUMNI", "ADMIN"] as Role[]) {
      expect(can(P(role), "opportunity:nuke" as Permission)).toBe(false);
    }
  });
});

describe("Ownership scoping (prevents IDOR / horizontal escalation)", () => {
  it("allows editing your OWN profile", () => {
    const me = P("STUDENT");
    expect(can(me, "profile:update", { ownerId: me.userId })).toBe(true);
  });

  it("denies editing SOMEONE ELSE'S profile", () => {
    const me = P("STUDENT");
    const r = decide(me, "profile:update", { ownerId: "another-user" });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("not_owner");
  });

  it("fails closed when ownership is unresolved", () => {
    const me = P("STUDENT");
    const r = decide(me, "profile:update", {});
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("ownership_unresolved");
  });
});

describe("Account status gate", () => {
  it("SUSPENDED can do nothing, not even read", () => {
    expect(can(P("ADMIN", "SUSPENDED"), "analytics:read")).toBe(false);
    expect(can(P("STUDENT", "SUSPENDED"), "opportunity:read")).toBe(false);
  });

  it("UNVERIFIED is read-only", () => {
    expect(can(P("STUDENT", "UNVERIFIED"), "opportunity:read")).toBe(true);
    expect(can(P("STUDENT", "UNVERIFIED"), "application:create")).toBe(false);
  });

  it("PENDING_ALUMNI is read-only until approved", () => {
    expect(can(P("ALUMNI", "PENDING_ALUMNI"), "opportunity:read")).toBe(true);
    expect(can(P("ALUMNI", "PENDING_ALUMNI"), "opportunity:create")).toBe(false);
  });
});
