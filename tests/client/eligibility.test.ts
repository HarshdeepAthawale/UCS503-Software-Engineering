import { describe, it, expect } from "vitest";
import { eligibility } from "@/lib/client/eligibility";

/**
 * Posting eligibility as the student sees it - mirrors the authoritative check
 * in application.service.ts (branch list, minimum CGPA, maximum backlogs).
 */

const open = { eligibleBranches: [], minCgpa: null, maxBacklogs: null };
const me = { branch: "COE", cgpa: 8.1, backlogs: 0 };

describe("eligibility", () => {
  it("is open to everyone when the posting sets no criteria", () => {
    const r = eligibility(open, null);
    expect(r).toMatchObject({ restricted: false, eligible: true, reasons: [] });
  });

  it("passes a student who meets every criterion", () => {
    const r = eligibility({ eligibleBranches: ["COE", "ENC"], minCgpa: 8, maxBacklogs: 0 }, me);
    expect(r).toMatchObject({ restricted: true, eligible: true, reasons: [] });
  });

  it("names each unmet criterion, short and in full", () => {
    const r = eligibility({ eligibleBranches: ["ECE"], minCgpa: 8.5, maxBacklogs: 0 }, { ...me, backlogs: 2 });
    expect(r.eligible).toBe(false);
    expect(r.reasons.map((x) => x.short)).toEqual(["for ECE", "needs CGPA 8.5+", "max 0 backlogs"]);
    expect(r.reasons[1]!.long).toBe("requires a minimum CGPA of 8.5");
  });

  it("treats missing profile data as not meeting the criterion (as the server does)", () => {
    const r = eligibility({ eligibleBranches: ["COE"], minCgpa: 7, maxBacklogs: null }, { branch: null, cgpa: null, backlogs: null });
    expect(r.eligible).toBe(false);
    expect(r.reasons).toHaveLength(2);
  });

  it("compares a CGPA the API sent as a string numerically", () => {
    const r = eligibility({ eligibleBranches: [], minCgpa: 7, maxBacklogs: null }, { ...me, cgpa: "10.00" as unknown as number });
    expect(r.eligible).toBe(true);
  });
});
