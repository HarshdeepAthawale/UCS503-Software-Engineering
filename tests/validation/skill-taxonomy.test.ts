import { describe, it, expect } from "vitest";
import {
  SkillCreateSchema,
  SkillUpdateSchema,
  UserSkillAddSchema,
  UserSkillsReplaceSchema,
} from "@/lib/validation/schemas";

/**
 * Skill taxonomy validation tests (T-07). The taxonomy is admin-curated and the
 * DTOs are strict allow-lists, so a client can never inject free-text skills,
 * unknown proficiencies, or mass-assign fields (codeguard-0-input-validation).
 */

const UUID = "6f7c3c1e-2a4b-4c5d-9e8f-0a1b2c3d4e5f";

describe("SkillCreateSchema (admin curation)", () => {
  it("accepts a name + domain", () => {
    const r = SkillCreateSchema.safeParse({ name: "PyTorch", domain: "ML" });
    expect(r.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const r = SkillCreateSchema.safeParse({ name: "   ", domain: "ML" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown keys (no mass assignment)", () => {
    const r = SkillCreateSchema.safeParse({ name: "PyTorch", domain: "ML", role: "ADMIN" });
    expect(r.success).toBe(false);
  });
});

describe("SkillUpdateSchema", () => {
  it("accepts a partial update", () => {
    const r = SkillUpdateSchema.safeParse({ domain: "NLP" });
    expect(r.success).toBe(true);
  });

  it("rejects an empty update", () => {
    const r = SkillUpdateSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe("UserSkillAddSchema (assignment)", () => {
  it("accepts a valid taxonomy skillId + proficiency", () => {
    const r = UserSkillAddSchema.safeParse({ skillId: UUID, proficiency: "INTERMEDIATE" });
    expect(r.success).toBe(true);
  });

  it("rejects a non-uuid skillId", () => {
    const r = UserSkillAddSchema.safeParse({ skillId: "not-a-uuid", proficiency: "INTERMEDIATE" });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown proficiency", () => {
    const r = UserSkillAddSchema.safeParse({ skillId: UUID, proficiency: "GURU" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown keys", () => {
    const r = UserSkillAddSchema.safeParse({
      skillId: UUID,
      proficiency: "BEGINNER",
      deletedAt: null,
    });
    expect(r.success).toBe(false);
  });
});

describe("UserSkillsReplaceSchema (profile editor — typed names)", () => {
  it("accepts an empty set (clears skills)", () => {
    const r = UserSkillsReplaceSchema.safeParse({ skills: [] });
    expect(r.success).toBe(true);
  });

  it("accepts typed skill names with a proficiency", () => {
    const r = UserSkillsReplaceSchema.safeParse({
      skills: [
        { name: "Python", proficiency: "ADVANCED" },
        { name: "Rust", proficiency: "EXPERT" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects more than 8 skills (the per-profile cap)", () => {
    const skills = Array.from({ length: 9 }, (_, i) => ({
      name: `Skill ${i}`,
      proficiency: "BEGINNER" as const,
    }));
    const r = UserSkillsReplaceSchema.safeParse({ skills });
    expect(r.success).toBe(false);
  });

  it("accepts exactly 8 skills", () => {
    const skills = Array.from({ length: 8 }, (_, i) => ({
      name: `Skill ${i}`,
      proficiency: "BEGINNER" as const,
    }));
    expect(UserSkillsReplaceSchema.safeParse({ skills }).success).toBe(true);
  });

  it("rejects an empty skill name", () => {
    const r = UserSkillsReplaceSchema.safeParse({
      skills: [{ name: "   ", proficiency: "BEGINNER" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown keys (no mass assignment)", () => {
    const r = UserSkillsReplaceSchema.safeParse({
      skills: [{ name: "Python", proficiency: "BEGINNER", skillId: UUID }],
    });
    expect(r.success).toBe(false);
  });
});
