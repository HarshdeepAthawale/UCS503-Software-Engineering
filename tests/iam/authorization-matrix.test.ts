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
  // Team formation (T-22): peer-driven - students lead, faculty/alumni/admin
  // may only view. team:manage is ownership-scoped, asserted below.
  ["STUDENT", "team:create", true],
  ["STUDENT", "team:read", true],
  ["STUDENT", "team:join_request", true],
  ["FACULTY", "team:create", false],
  ["FACULTY", "team:read", true],
  ["FACULTY", "team:join_request", false], // faculty/alumni don't join teams
  ["ADMIN", "team:create", false],
  ["ADMIN", "team:read", true],
  // Meeting scheduling (Google Meet): meeting:create/cancel are ownership-
  // scoped, asserted below with an ownerId. meeting:read is a plain role
  // grant - the route itself checks membership (organizer/attendee), the same
  // pattern as message:read.
  ["STUDENT", "meeting:read", true],
  ["FACULTY", "meeting:read", true],
  ["ADMIN", "meeting:read", false], // admins don't organize or attend meetings
  ["STUDENT", "alumni_claim:approve", false], // not an admin
  ["STUDENT", "analytics:read", false],
  // Faculty
  ["FACULTY", "opportunity:create", true],
  // attestation:create is ownership-scoped (T-19) - asserted with an ownerId
  // in the ownership suite below, not here.
  ["FACULTY", "application:create", false], // faculty do not apply
  ["FACULTY", "alumni_claim:approve", false],
  // Alumni behave like faculty for posting/attesting
  ["ALUMNI", "opportunity:create", true],
  ["ALUMNI", "alumni_claim:approve", false],
  // Admin governance
  ["ADMIN", "alumni_claim:approve", true],
  ["ADMIN", "alumni_claim:read", true],
  ["ADMIN", "skill_taxonomy:manage", true],
  ["ADMIN", "analytics:read", true],
  ["ADMIN", "opportunity:create", false], // admins govern, they don't post
  // Skill taxonomy (T-07): everyone reads the controlled vocabulary;
  // only ADMIN can curate it.
  ["STUDENT", "skill_taxonomy:read", true],
  ["STUDENT", "skill_taxonomy:manage", false],
  ["FACULTY", "skill_taxonomy:read", true],
  ["FACULTY", "skill_taxonomy:manage", false],
  ["ALUMNI", "skill_taxonomy:read", true],
  ["ALUMNI", "skill_taxonomy:manage", false],
  // Opportunities (T-09): everyone can read/list; only faculty/alumni post.
  // `opportunity:update` is ownership-scoped and asserted in the ownership suite.
  ["STUDENT", "opportunity:list", true],
  ["STUDENT", "opportunity:update", false],
  ["FACULTY", "opportunity:list", true],
  ["ALUMNI", "opportunity:create", true],
  ["ADMIN", "opportunity:update", false], // admins govern, they don't post
  // Messaging (T-16): students & posters may message; membership is enforced in
  // the service. Admin may read (moderation) but not send.
  ["STUDENT", "message:send", true],
  ["STUDENT", "message:read", true],
  ["FACULTY", "message:send", true],
  ["ADMIN", "message:read", true],
  ["ADMIN", "message:send", false],
  // Notifications (T-17): every non-admin role manages its own feed.
  ["STUDENT", "notification:read", true],
  ["STUDENT", "notification:manage", true],
  ["FACULTY", "notification:manage", true],
  // Admin console (Identity v2): governance is ADMIN-only.
  ["ADMIN", "user:read", true],
  ["ADMIN", "user:manage", true],
  ["ADMIN", "faculty_allowlist:read", true],
  ["ADMIN", "faculty_allowlist:manage", true],
  ["STUDENT", "user:read", false],
  ["STUDENT", "user:manage", false],
  ["FACULTY", "user:manage", false],
  ["FACULTY", "faculty_allowlist:manage", false],
  ["ALUMNI", "user:manage", false],
  // Moderation flags (T-36, M9): any member reports; only ADMIN reads/resolves
  // the queue (and ADMIN governs, so does not itself raise flags).
  ["STUDENT", "flag:create", true],
  ["FACULTY", "flag:create", true],
  ["ALUMNI", "flag:create", true],
  ["STUDENT", "flag:read", false],
  ["STUDENT", "flag:resolve", false],
  ["FACULTY", "flag:resolve", false],
  ["ADMIN", "flag:create", false],
  ["ADMIN", "flag:read", true],
  ["ADMIN", "flag:resolve", true],
  // Resume visibility (T-44): the reviewing roles may open ANOTHER member's
  // resume; a student may not (their own is the ownership path in the service).
  ["FACULTY", "profile:read_resume", true],
  ["ALUMNI", "profile:read_resume", true],
  ["ADMIN", "profile:read_resume", true],
  ["STUDENT", "profile:read_resume", false],
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

  it("allows a faculty member to update their OWN posting (T-09)", () => {
    const poster = P("FACULTY");
    expect(can(poster, "opportunity:update", { ownerId: poster.userId })).toBe(true);
  });

  it("denies a faculty member updating ANOTHER poster's posting", () => {
    const poster = P("FACULTY");
    const r = decide(poster, "opportunity:update", { ownerId: "another-poster" });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("not_owner");
  });

  it("allows a faculty/alumni poster to issue an attestation on THEIR OWN posting (T-19)", () => {
    expect(can(P("FACULTY"), "attestation:create", { ownerId: "user-1" })).toBe(true);
    expect(can(P("ALUMNI"), "attestation:create", { ownerId: "user-1" })).toBe(true);
  });

  it("denies issuing an attestation via ANOTHER poster's application", () => {
    const poster = P("FACULTY");
    const r = decide(poster, "attestation:create", { ownerId: "another-poster" });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("not_owner");
  });

  it("fails closed when attestation ownership is unresolved", () => {
    const r = decide(P("FACULTY"), "attestation:create", {});
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("ownership_unresolved");
  });

  it("allows a team lead to manage (accept/reject/close) THEIR OWN team (T-22)", () => {
    const lead = P("STUDENT");
    expect(can(lead, "team:manage", { ownerId: lead.userId })).toBe(true);
  });

  it("denies managing ANOTHER student's team", () => {
    const r = decide(P("STUDENT"), "team:manage", { ownerId: "another-lead" });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("not_owner");
  });

  it("allows withdrawing YOUR OWN join request but not someone else's", () => {
    const me = P("STUDENT");
    expect(can(me, "team:join_request_withdraw", { ownerId: me.userId })).toBe(true);
    const r = decide(me, "team:join_request_withdraw", { ownerId: "another-student" });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("not_owner");
  });

  it("allows a poster/team-lead to schedule a meeting they organize", () => {
    expect(can(P("FACULTY"), "meeting:create", { ownerId: "user-1" })).toBe(true);
    expect(can(P("STUDENT"), "meeting:create", { ownerId: "user-1" })).toBe(true);
  });

  it("denies scheduling a meeting on someone else's application/team", () => {
    const r = decide(P("FACULTY"), "meeting:create", { ownerId: "another-poster" });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("not_owner");
  });

  it("allows the organizer, and only the organizer, to cancel a meeting", () => {
    const organizer = P("STUDENT");
    expect(can(organizer, "meeting:cancel", { ownerId: organizer.userId })).toBe(true);
    const r = decide(organizer, "meeting:cancel", { ownerId: "another-organizer" });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("not_owner");
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

  it("treats a qualified read (profile:read_resume) as a read, not a mutation", () => {
    expect(can(P("ALUMNI", "PENDING_ALUMNI"), "profile:read_resume")).toBe(true);
    expect(can(P("FACULTY", "UNVERIFIED"), "profile:read_resume")).toBe(true);
    expect(can(P("FACULTY", "SUSPENDED"), "profile:read_resume")).toBe(false);
  });
});
