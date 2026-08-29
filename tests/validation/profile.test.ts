import { describe, it, expect } from "vitest";
import { ProfileUpdateSchema } from "@/lib/validation/schemas";

/**
 * Profile DTO (docs/PRD M2, structured profiles). Strict allow-list: the schema
 * is the only thing standing between a PATCH body and the profile row, so it
 * must reject unknown keys and refuse link schemes that would become XSS once
 * rendered as an <a href>.
 */

describe("ProfileUpdateSchema — identity fields", () => {
  it("accepts a headline, links, availability and hours together", () => {
    const r = ProfileUpdateSchema.safeParse({
      headline: "Security researcher · binary exploitation",
      githubUrl: "https://github.com/someone",
      linkedinUrl: "https://linkedin.com/in/someone",
      websiteUrl: "https://example.com",
      openTo: ["RESEARCH", "INTERNSHIP"],
      hoursPerWeek: 10,
    });
    expect(r.success).toBe(true);
  });

  it("accepts an empty update (every field optional)", () => {
    expect(ProfileUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("lets the owner CLEAR a headline or link with null", () => {
    const r = ProfileUpdateSchema.safeParse({
      headline: null,
      githubUrl: null,
      hoursPerWeek: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a headline over 120 characters", () => {
    const r = ProfileUpdateSchema.safeParse({ headline: "x".repeat(121) });
    expect(r.success).toBe(false);
  });

  it("rejects a javascript: link (XSS via href)", () => {
    // eslint-disable-next-line no-script-url
    const r = ProfileUpdateSchema.safeParse({ githubUrl: "javascript:alert(1)" });
    expect(r.success).toBe(false);
  });

  it("rejects a data: link", () => {
    const r = ProfileUpdateSchema.safeParse({
      websiteUrl: "data:text/html;base64,PHNjcmlwdD4=",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a link that is not a URL at all", () => {
    expect(ProfileUpdateSchema.safeParse({ linkedinUrl: "me on linkedin" }).success).toBe(false);
  });
});

describe("ProfileUpdateSchema — openTo", () => {
  it("rejects a value outside the posting vocabulary", () => {
    const r = ProfileUpdateSchema.safeParse({ openTo: ["FULL_TIME_JOB"] });
    expect(r.success).toBe(false);
  });

  it("dedupes repeated values", () => {
    const r = ProfileUpdateSchema.safeParse({ openTo: ["TA", "TA", "RESEARCH"] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.openTo).toEqual(["TA", "RESEARCH"]);
  });

  it("accepts an empty list (clears availability)", () => {
    const r = ProfileUpdateSchema.safeParse({ openTo: [] });
    expect(r.success).toBe(true);
  });
});

describe("ProfileUpdateSchema — hours and mass assignment", () => {
  it("rejects hours outside 1-80", () => {
    expect(ProfileUpdateSchema.safeParse({ hoursPerWeek: 0 }).success).toBe(false);
    expect(ProfileUpdateSchema.safeParse({ hoursPerWeek: 81 }).success).toBe(false);
  });

  it("rejects a fractional hours value", () => {
    expect(ProfileUpdateSchema.safeParse({ hoursPerWeek: 7.5 }).success).toBe(false);
  });

  it("rejects unknown keys — role/status can never be mass-assigned", () => {
    expect(ProfileUpdateSchema.safeParse({ role: "ADMIN" }).success).toBe(false);
    expect(ProfileUpdateSchema.safeParse({ status: "ACTIVE" }).success).toBe(false);
    expect(ProfileUpdateSchema.safeParse({ resumeKey: "someone-else.pdf" }).success).toBe(false);
  });
});
