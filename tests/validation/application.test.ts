import { describe, it, expect } from "vitest";
import {
  ApplicationCreateSchema,
  ApplicationTransitionSchema,
} from "@/lib/validation/schemas";

/**
 * Application DTO tests (T-12 / T-13). The create body carries only an optional
 * pitch; the transition body accepts only poster-legal targets and ties a
 * rejection code to REJECTED. studentId/status/seatsFilled can never be set.
 */

describe("ApplicationCreateSchema (T-12)", () => {
  it("accepts an empty body (apply with no note)", () => {
    expect(ApplicationCreateSchema.safeParse({}).success).toBe(true);
  });
  it("accepts a short pitch", () => {
    expect(ApplicationCreateSchema.safeParse({ note: "Keen on this." }).success).toBe(true);
  });
  it("rejects mass assignment (status/studentId)", () => {
    expect(
      ApplicationCreateSchema.safeParse({ status: "SELECTED", studentId: "x" }).success,
    ).toBe(false);
  });
});

describe("ApplicationTransitionSchema (T-13)", () => {
  it("accepts a legal poster target", () => {
    expect(ApplicationTransitionSchema.safeParse({ toState: "SHORTLISTED" }).success).toBe(true);
  });
  it("accepts REJECTED with a rejection code", () => {
    const r = ApplicationTransitionSchema.safeParse({
      toState: "REJECTED",
      rejectionCode: "STRONGER_APPLICANTS",
    });
    expect(r.success).toBe(true);
  });
  it("rejects a rejection code on a non-REJECTED transition", () => {
    const r = ApplicationTransitionSchema.safeParse({
      toState: "SELECTED",
      rejectionCode: "OTHER",
    });
    expect(r.success).toBe(false);
  });
  it("forbids WITHDRAWN as a poster target (student-only path)", () => {
    expect(ApplicationTransitionSchema.safeParse({ toState: "WITHDRAWN" }).success).toBe(false);
  });
  it("forbids APPLIED as a target (that is the initial state)", () => {
    expect(ApplicationTransitionSchema.safeParse({ toState: "APPLIED" }).success).toBe(false);
  });
  it("rejects unknown keys", () => {
    expect(
      ApplicationTransitionSchema.safeParse({ toState: "SHORTLISTED", foo: 1 }).success,
    ).toBe(false);
  });
  it("no longer offers RECEIVED as a poster target", () => {
    expect(ApplicationTransitionSchema.safeParse({ toState: "RECEIVED" }).success).toBe(false);
  });
});
