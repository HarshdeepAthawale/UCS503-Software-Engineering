import { z } from "zod";
import { env } from "@/lib/env";

/**
 * Shared Zod schemas — the single validation boundary for the API
 * (codeguard-0-input-validation-injection: validate and normalise all input).
 * These are the *only* fields ever accepted; everything else is dropped, which
 * also prevents mass-assignment of privileged fields like `role`/`status`
 * (codeguard-0-authorization: DTO allow-lists).
 */

// Strong-ish password policy. Length is the dominant factor; we require 12+.
const password = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .max(200, "Password is too long.")
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), {
    message: "Password must include upper, lower, and a digit.",
  });

const institutionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .refine((v) => v.endsWith(`@${env.ALLOWED_EMAIL_DOMAIN}`), {
    message: `Registration is restricted to @${env.ALLOWED_EMAIL_DOMAIN} addresses.`,
  });

// Alumni register with any email (they no longer hold an institute address).
const anyEmail = z.string().trim().toLowerCase().email("Enter a valid email address.");

export const RegisterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: institutionalEmail,
  password,
});

export const AlumniRegisterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: anyEmail,
  password,
});

export const VerifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const AlumniClaimSchema = z.object({
  rollNo: z.string().trim().min(3).max(30),
  gradYear: z.coerce
    .number()
    .int()
    .gte(1960)
    .lte(new Date().getFullYear()),
  degree: z.string().trim().min(2).max(120),
  proofUrl: z.string().trim().url().max(500),
});

export const ProfileUpdateSchema = z
  .object({
    // Nullable so the owner can explicitly CLEAR a field (not just leave it
    // untouched). `.optional()` alone would reject `null` and make fields
    // un-clearsable.
    branch: z.string().trim().max(80).nullable().optional(),
    year: z.coerce.number().int().gte(1).lte(6).nullable().optional(),
    cgpa: z.coerce.number().gte(0).lte(10).nullable().optional(),
    cgpaPublic: z.boolean().optional(),
    bio: z.string().trim().max(1000).nullable().optional(),
  })
  .strict(); // reject unknown keys → no mass assignment of role/status/etc.

export const AlumniClaimDecisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

// ── Skill taxonomy (admin-curated, NOT free text — docs/PRD M2) ──────────────

const proficiency = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]);
const skillName = z
  .string()
  .trim()
  .min(1, "Skill name is required.")
  .max(80, "Skill name is too long.");
const domain = z
  .string()
  .trim()
  .min(1, "Domain is required.")
  .max(80, "Domain is too long.");
const skillId = z
  .string()
  .trim()
  .uuid("Invalid skill id.");

export const SkillCreateSchema = z
  .object({ name: skillName, domain })
  .strict(); // reject unknown keys

export const SkillUpdateSchema = z
  .object({
    name: skillName.optional(),
    domain: domain.optional(),
  })
  .strict()
  .refine((v) => v.name !== undefined || v.domain !== undefined, {
    message: "Provide at least one field to update.",
  });

export const UserSkillAddSchema = z
  .object({ skillId, proficiency })
  .strict();

// Replace the caller's whole skill set in one call (profile editor).
export const UserSkillsReplaceSchema = z
  .object({
    skills: z
      .array(z.object({ skillId, proficiency }).strict())
      .max(50, "A profile can hold at most 50 skills."),
  })
  .strict();

export type SkillCreateInput = z.infer<typeof SkillCreateSchema>;
export type SkillUpdateInput = z.infer<typeof SkillUpdateSchema>;
export type UserSkillAddInput = z.infer<typeof UserSkillAddSchema>;
export type UserSkillsReplaceInput = z.infer<typeof UserSkillsReplaceSchema>;

// ── Opportunity (T-09; docs/PRD M3, TechSpec §5.4) ───────────────────────────

const oppType = z.enum([
  "RESEARCH",
  "INTERNSHIP",
  "TA",
  "HACKATHON_TEAM",
  "MICRO_TASK",
  "REFERRAL",
]);
const slaPledge = z.enum(["H24", "H48", "WEEK"]);
const skillRequirement = z.enum(["REQUIRED", "PREFERRED"]);

export const OpportunityCreateSchema = z
  .object({
    type: oppType,
    title: z.string().trim().min(3, "Title must be at least 3 characters.").max(140),
    description: z.string().trim().min(20, "Description must be at least 20 characters.").max(5000),
    domain: z.string().trim().min(1, "Domain is required.").max(80),
    duration: z.string().trim().max(80).nullable().optional(),
    stipend: z.boolean().optional(),
    seatCount: z.coerce.number().int().gte(1).lte(500).default(1),
    deadline: z.coerce.date().refine((d) => d > new Date(), {
      message: "Deadline must be in the future.",
    }),
    slaPledge,
    skills: z
      .array(
        z
          .object({
            skillId: z.string().trim().uuid("Invalid skill id."),
            requirement: skillRequirement,
          })
          .strict(),
      )
      .max(30)
      .optional(),
  })
  .strict(); // no mass assignment of posterId/status/seatsFilled

export const OpportunityUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(140).optional(),
    description: z.string().trim().min(20).max(5000).optional(),
    domain: z.string().trim().min(1).max(80).optional(),
    duration: z.string().trim().max(80).nullable().optional(),
    stipend: z.boolean().optional(),
    seatCount: z.coerce.number().int().gte(1).lte(500).optional(),
    deadline: z.coerce
      .date()
      .refine((d) => d > new Date(), { message: "Deadline must be in the future." })
      .optional(),
    slaPledge: slaPledge.optional(),
    skills: z
      .array(
        z
          .object({
            skillId: z.string().trim().uuid("Invalid skill id."),
            requirement: skillRequirement,
          })
          .strict(),
      )
      .max(30)
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update." });

export type OpportunityCreateInput = z.infer<typeof OpportunityCreateSchema>;
export type OpportunityUpdateInput = z.infer<typeof OpportunityUpdateSchema>;

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
