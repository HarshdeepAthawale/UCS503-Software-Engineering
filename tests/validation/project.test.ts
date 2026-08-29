import { describe, it, expect } from "vitest";
import { ProjectCreateSchema, ProjectUpdateSchema } from "@/lib/validation/schemas";

/** Portfolio-project DTOs (T-37; docs/PRD M2). Strict allow-lists, URL-checked. */

describe("ProjectCreateSchema", () => {
  it("accepts a title-only project (repo optional)", () => {
    const r = ProjectCreateSchema.safeParse({ title: "My project" });
    expect(r.success).toBe(true);
  });

  it("accepts a full project with repo + live links", () => {
    const r = ProjectCreateSchema.safeParse({
      title: "Cache",
      description: "A tiny LRU cache",
      repoUrl: "https://github.com/me/cache",
      liveUrl: "https://cache.example.com",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a title under 2 characters", () => {
    const r = ProjectCreateSchema.safeParse({ title: "x" });
    expect(r.success).toBe(false);
  });

  it("rejects a missing title", () => {
    const r = ProjectCreateSchema.safeParse({ repoUrl: "https://github.com/me/x" });
    expect(r.success).toBe(false);
  });

  it("rejects a non-URL repo link", () => {
    const r = ProjectCreateSchema.safeParse({ title: "Ok", repoUrl: "not-a-url" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown keys (no mass assignment)", () => {
    const r = ProjectCreateSchema.safeParse({ title: "Ok", userId: "attacker" });
    expect(r.success).toBe(false);
  });

  it("allows an explicit null repo to clear the link", () => {
    const r = ProjectCreateSchema.safeParse({ title: "Ok", repoUrl: null });
    expect(r.success).toBe(true);
  });

  it("trims the title", () => {
    const r = ProjectCreateSchema.safeParse({ title: "  Trimmed  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.title).toBe("Trimmed");
  });
});

describe("ProjectUpdateSchema", () => {
  it("accepts a single-field update", () => {
    const r = ProjectUpdateSchema.safeParse({ title: "Renamed" });
    expect(r.success).toBe(true);
  });

  it("rejects an empty update (nothing to change)", () => {
    const r = ProjectUpdateSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects a bad live URL on update", () => {
    const r = ProjectUpdateSchema.safeParse({ liveUrl: "javascript:alert(1)" });
    expect(r.success).toBe(false);
  });
});
