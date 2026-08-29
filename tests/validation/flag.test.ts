import { describe, it, expect } from "vitest";
import { FlagCreateSchema, FlagResolveSchema } from "@/lib/validation/schemas";

/** Moderation flag DTOs (T-36; docs/PRD M9). Strict allow-lists. */

describe("FlagCreateSchema", () => {
  it("accepts a valid reason with no detail", () => {
    expect(FlagCreateSchema.safeParse({ reason: "SPAM" }).success).toBe(true);
  });

  it("accepts a reason with detail", () => {
    expect(
      FlagCreateSchema.safeParse({ reason: "MISLEADING", detail: "Stipend is fake." }).success,
    ).toBe(true);
  });

  it("rejects an unknown reason", () => {
    expect(FlagCreateSchema.safeParse({ reason: "NONSENSE" }).success).toBe(false);
  });

  it("rejects a missing reason", () => {
    expect(FlagCreateSchema.safeParse({ detail: "bad" }).success).toBe(false);
  });

  it("rejects unknown keys (no mass assignment)", () => {
    expect(
      FlagCreateSchema.safeParse({ reason: "SPAM", reporterId: "x" }).success,
    ).toBe(false);
  });
});

describe("FlagResolveSchema", () => {
  it("accepts RESOLVED with removePosting", () => {
    expect(
      FlagResolveSchema.safeParse({ decision: "RESOLVED", removePosting: true }).success,
    ).toBe(true);
  });

  it("accepts DISMISSED without removal", () => {
    expect(FlagResolveSchema.safeParse({ decision: "DISMISSED" }).success).toBe(true);
  });

  it("rejects removing a posting while DISMISSING (only upheld flags remove)", () => {
    expect(
      FlagResolveSchema.safeParse({ decision: "DISMISSED", removePosting: true }).success,
    ).toBe(false);
  });

  it("rejects an unknown decision", () => {
    expect(FlagResolveSchema.safeParse({ decision: "MAYBE" }).success).toBe(false);
  });
});
