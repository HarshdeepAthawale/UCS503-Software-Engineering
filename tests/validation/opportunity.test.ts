import { describe, it, expect } from "vitest";
import {
  OpportunityCreateSchema,
  OpportunityUpdateSchema,
} from "@/lib/validation/schemas";

/**
 * Opportunity validation tests (T-09). The DTO is a strict allow-list: posterId,
 * status and seatsFilled can never be mass-assigned, skills must come from the
 * taxonomy shape, and the SLA pledge is mandatory at create (docs/PRD M3).
 */

const UUID = "6f7c3c1e-2a4b-4c5d-9e8f-0a1b2c3d4e5f";
const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const PAST = new Date(Date.now() - 3600 * 1000).toISOString();

const valid = {
  type: "RESEARCH",
  title: "NLP Research Assistant",
  description: "Help build and evaluate retrieval models for Indian languages.",
  domain: "Machine Learning",
  seatCount: 2,
  deadline: FUTURE,
  slaPledge: "H48",
  skills: [{ skillId: UUID, requirement: "REQUIRED" }],
};

describe("OpportunityCreateSchema (T-09)", () => {
  it("accepts a valid posting with SLA pledge", () => {
    const r = OpportunityCreateSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("rejects a past deadline", () => {
    const r = OpportunityCreateSchema.safeParse({ ...valid, deadline: PAST });
    expect(r.success).toBe(false);
  });

  it("rejects missing SLA pledge (mandatory at create)", () => {
    const { slaPledge: _omit, ...rest } = valid;
    const r = OpportunityCreateSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  it("rejects mass assignment of posterId / status / seatsFilled", () => {
    const r = OpportunityCreateSchema.safeParse({
      ...valid,
      posterId: UUID,
      status: "LIVE",
      seatsFilled: 99,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a skill outside the taxonomy shape (free text)", () => {
    const r = OpportunityCreateSchema.safeParse({
      ...valid,
      skills: [{ skillId: UUID, requirement: "REQUIRED", name: "Free text!" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a non-uuid skillId", () => {
    const r = OpportunityCreateSchema.safeParse({
      ...valid,
      skills: [{ skillId: "not-a-uuid", requirement: "REQUIRED" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown OppType", () => {
    const r = OpportunityCreateSchema.safeParse({ ...valid, type: "SOCIAL_MEDIA" });
    expect(r.success).toBe(false);
  });
});

describe("OpportunityUpdateSchema (T-09)", () => {
  it("accepts a partial update", () => {
    const r = OpportunityUpdateSchema.safeParse({ title: "Better title" });
    expect(r.success).toBe(true);
  });

  it("rejects an empty update", () => {
    const r = OpportunityUpdateSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects past-deadline edits (deadline must stay in the future)", () => {
    const r = OpportunityUpdateSchema.safeParse({ deadline: PAST });
    expect(r.success).toBe(false);
  });

  it("rejects unknown keys", () => {
    const r = OpportunityUpdateSchema.safeParse({ title: "x", posterId: UUID });
    expect(r.success).toBe(false);
  });
});
