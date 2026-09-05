import { describe, it, expect } from "vitest";
import {
  TeamCreateSchema,
  TeamUpdateSchema,
  TeamJoinRequestSchema,
  TeamRequestDecisionSchema,
} from "@/lib/validation/schemas";

/** Team formation DTO tests (T-22). leadId/status/slotsFilled are never client-set. */

const SKILL_ID = "11111111-1111-1111-1111-111111111111";

describe("TeamCreateSchema (T-22)", () => {
  it("accepts a minimal team with one role", () => {
    const r = TeamCreateSchema.safeParse({
      name: "Team Nightowls",
      hackathon: "Smart India Hackathon",
      roles: [{ label: "Backend", slotCount: 2, skillIds: [SKILL_ID] }],
    });
    expect(r.success).toBe(true);
  });
  it("rejects a team with no roles", () => {
    const r = TeamCreateSchema.safeParse({
      name: "Team Nightowls",
      hackathon: "SIH",
      roles: [],
    });
    expect(r.success).toBe(false);
  });
  it("rejects a role with zero slots", () => {
    const r = TeamCreateSchema.safeParse({
      name: "Team Nightowls",
      hackathon: "SIH",
      roles: [{ label: "Backend", slotCount: 0, skillIds: [] }],
    });
    expect(r.success).toBe(false);
  });
  it("rejects mass assignment (leadId/status)", () => {
    const r = TeamCreateSchema.safeParse({
      name: "Team Nightowls",
      hackathon: "SIH",
      roles: [{ label: "Backend", slotCount: 1, skillIds: [] }],
      leadId: "x",
      status: "LOCKED",
    });
    expect(r.success).toBe(false);
  });
});

describe("TeamUpdateSchema (T-22)", () => {
  it("accepts closing a team", () => {
    expect(TeamUpdateSchema.safeParse({ status: "CLOSED" }).success).toBe(true);
  });
  it("rejects an illegal status (only CLOSED is client-driven)", () => {
    expect(TeamUpdateSchema.safeParse({ status: "LOCKED" }).success).toBe(false);
  });
  it("accepts clearing the description", () => {
    expect(TeamUpdateSchema.safeParse({ description: null }).success).toBe(true);
  });
});

describe("TeamJoinRequestSchema (T-22)", () => {
  it("accepts an empty body", () => {
    expect(TeamJoinRequestSchema.safeParse({}).success).toBe(true);
  });
  it("accepts an optional message", () => {
    expect(TeamJoinRequestSchema.safeParse({ message: "I'd love to join" }).success).toBe(true);
  });
});

describe("TeamRequestDecisionSchema (T-22)", () => {
  it("accepts ACCEPTED with no rejection code", () => {
    expect(TeamRequestDecisionSchema.safeParse({ status: "ACCEPTED" }).success).toBe(true);
  });
  it("accepts REJECTED with a rejection code", () => {
    const r = TeamRequestDecisionSchema.safeParse({ status: "REJECTED", rejectionCode: "SEATS_FILLED" });
    expect(r.success).toBe(true);
  });
  it("rejects a rejection code on ACCEPTED", () => {
    const r = TeamRequestDecisionSchema.safeParse({ status: "ACCEPTED", rejectionCode: "OTHER" });
    expect(r.success).toBe(false);
  });
});
