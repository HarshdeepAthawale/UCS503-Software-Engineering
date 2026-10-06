import { describe, it, expect } from "vitest";
import { can, type Principal } from "@/lib/iam/policy";

/**
 * A pending alumnus is read-only - except for the one action that gets them
 * out of pending: submitting their own alumni claim.
 */

const P = (role: Principal["role"], status: Principal["status"]): Principal => ({ userId: "u1", role, status });

describe("alumni claim submission", () => {
  it("lets a pending alumnus submit a claim, and nothing else that writes", () => {
    expect(can(P("ALUMNI", "PENDING_ALUMNI"), "alumni_claim:submit")).toBe(true);
    expect(can(P("ALUMNI", "PENDING_ALUMNI"), "opportunity:create")).toBe(false);
    expect(can(P("ALUMNI", "PENDING_ALUMNI"), "message:send")).toBe(false);
    expect(can(P("ALUMNI", "PENDING_ALUMNI"), "opportunity:read")).toBe(true);
  });

  it("does not open claim submission to anyone else", () => {
    expect(can(P("STUDENT", "ACTIVE"), "alumni_claim:submit")).toBe(false);
    expect(can(P("FACULTY", "ACTIVE"), "alumni_claim:submit")).toBe(false);
    expect(can(P("ALUMNI", "UNVERIFIED"), "alumni_claim:submit")).toBe(false);
    expect(can(P("ALUMNI", "SUSPENDED"), "alumni_claim:submit")).toBe(false);
  });
});
