import { describe, it, expect } from "vitest";
import { AttestationCreateSchema } from "@/lib/validation/schemas";

/**
 * Attestation DTO tests (T-19). applicationId comes from the route path, not
 * the body - the SELECTED gate and skill-ownership check live in the service.
 */

const VALID_SKILL_ID = "11111111-1111-1111-1111-111111111111";

describe("AttestationCreateSchema (T-19)", () => {
  it("accepts a skillId and context", () => {
    const r = AttestationCreateSchema.safeParse({
      skillId: VALID_SKILL_ID,
      context: "NLP research assistant, Aug-Nov 2026",
    });
    expect(r.success).toBe(true);
  });
  it("rejects a missing context", () => {
    expect(AttestationCreateSchema.safeParse({ skillId: VALID_SKILL_ID }).success).toBe(false);
  });
  it("rejects an empty context", () => {
    expect(
      AttestationCreateSchema.safeParse({ skillId: VALID_SKILL_ID, context: "" }).success,
    ).toBe(false);
  });
  it("rejects a non-uuid skillId", () => {
    expect(
      AttestationCreateSchema.safeParse({ skillId: "not-a-uuid", context: "x" }).success,
    ).toBe(false);
  });
  it("rejects mass assignment (applicationId/issuerId)", () => {
    const r = AttestationCreateSchema.safeParse({
      skillId: VALID_SKILL_ID,
      context: "x",
      applicationId: VALID_SKILL_ID,
      issuerId: VALID_SKILL_ID,
    });
    expect(r.success).toBe(false);
  });
});
