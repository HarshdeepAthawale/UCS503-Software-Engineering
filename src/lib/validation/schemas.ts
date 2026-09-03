import { z } from "zod";
import { env } from "@/lib/env";
import { BRANCHES } from "@/lib/domain/branch";

/**
 * Shared Zod schemas - the single validation boundary for the API
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

// Passwordless login (alumni + convenience). Any valid email; the service only
// issues a code to an ACTIVE account and responds uniformly otherwise.
export const OtpLoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
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

// The posting-type vocabulary. Declared here rather than in the opportunity
// block below because a profile's `openTo` reuses it — one list, so "open to
// research" is the same token a posting carries.
const oppType = z.enum([
  "RESEARCH",
  "INTERNSHIP",
  "TA",
  "HACKATHON_TEAM",
  "MICRO_TASK",
  "REFERRAL",
]);

// Same http(s)-only rule as `projectUrl` below: these are rendered as <a href>,
// and Zod's .url() would happily accept `javascript:` (codeguard-0-xss).
// Fixed branch vocabulary (src/lib/domain/branch.ts) - shared by a profile's
// own branch and an opportunity's `eligibleBranches` so the two are matchable.
const branch = z.enum(BRANCHES);

const profileLink = z
  .string()
  .trim()
  .url("Enter a valid URL.")
  .max(500)
  .refine((v) => /^https?:\/\//i.test(v), { message: "Link must start with http:// or https://." })
  .nullable()
  .optional();

export const ProfileUpdateSchema = z
  .object({
    // Nullable so the owner can explicitly CLEAR a field (not just leave it
    // untouched). `.optional()` alone would reject `null` and make fields
    // un-clearsable.
    branch: branch.nullable().optional(),
    year: z.coerce.number().int().gte(1).lte(6).nullable().optional(),
    cgpa: z.coerce.number().gte(0).lte(10).nullable().optional(),
    cgpaPublic: z.boolean().optional(),
    // Active/current backlogs (self-reported), matched against an opportunity's
    // `maxBacklogs` filter.
    backlogs: z.coerce.number().int().gte(0).lte(50).nullable().optional(),
    bio: z.string().trim().max(1000).nullable().optional(),
    headline: z.string().trim().max(120).nullable().optional(),
    githubUrl: profileLink,
    linkedinUrl: profileLink,
    websiteUrl: profileLink,
    // Reuses the posting vocabulary; deduped so the same token cannot be sent
    // twice, and capped at the number of types that actually exist.
    openTo: z
      .array(oppType)
      .max(6)
      .transform((v) => Array.from(new Set(v)))
      .optional(),
    hoursPerWeek: z.coerce.number().int().gte(1).lte(80).nullable().optional(),
  })
  .strict(); // reject unknown keys → no mass assignment of role/status/etc.

export const AlumniClaimDecisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

// ── Skill taxonomy (admin-curated, NOT free text - docs/PRD M2) ──────────────

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

// Replace the caller's whole skill set in one call (profile editor). Skills are
// entered by NAME (typed or picked); the service resolves each to a taxonomy row
// (creating it if new), so referential integrity — and skill-based matching /
// faceted search — is preserved. Capped at 8 per profile.
export const PROFILE_SKILL_LIMIT = 8;
export const UserSkillsReplaceSchema = z
  .object({
    skills: z
      .array(z.object({ name: skillName, proficiency }).strict())
      .max(PROFILE_SKILL_LIMIT, `A profile can hold at most ${PROFILE_SKILL_LIMIT} skills.`),
  })
  .strict();

// ── Portfolio projects (T-37; docs/PRD M2) ───────────────────────────────────

const projectTitle = z
  .string()
  .trim()
  .min(2, "Project title must be at least 2 characters.")
  .max(140, "Project title is too long.");
// Nullable so the owner can CLEAR a link; validated as a URL only when present.
// Restricted to http(s): Zod's .url() accepts `javascript:`/`data:` schemes,
// which would be an XSS vector once rendered as an <a href> (codeguard-0-xss).
const projectUrl = z
  .string()
  .trim()
  .url("Enter a valid URL.")
  .max(500)
  .refine((v) => /^https?:\/\//i.test(v), { message: "Link must start with http:// or https://." })
  .nullable()
  .optional();

export const ProjectCreateSchema = z
  .object({
    title: projectTitle,
    description: z.string().trim().max(2000).nullable().optional(),
    repoUrl: projectUrl,
    liveUrl: projectUrl,
  })
  .strict();

export const ProjectUpdateSchema = z
  .object({
    title: projectTitle.optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    repoUrl: projectUrl,
    liveUrl: projectUrl,
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "Provide at least one field to update.",
  });

export type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateSchema>;

export type SkillCreateInput = z.infer<typeof SkillCreateSchema>;
export type SkillUpdateInput = z.infer<typeof SkillUpdateSchema>;
export type UserSkillAddInput = z.infer<typeof UserSkillAddSchema>;
export type UserSkillsReplaceInput = z.infer<typeof UserSkillsReplaceSchema>;

// ── Opportunity (T-09; docs/PRD M3, TechSpec §5.4) ───────────────────────────

// `oppType` is declared above, next to ProfileUpdateSchema: a profile's `openTo`
// draws on the same vocabulary as a posting's type, and a `const` cannot be used
// before its declaration is evaluated.
const slaPledge = z.enum(["H24", "H48", "WEEK"]);
const skillRequirement = z.enum(["REQUIRED", "PREFERRED"]);

// Eligibility filters (docs/PRD M3): empty branch list / null minCgpa = open to
// everyone. Deduped so the same branch can't be sent twice.
const eligibleBranches = z
  .array(branch)
  .max(BRANCHES.length)
  .transform((v) => Array.from(new Set(v)));
const minCgpa = z.coerce.number().gte(0).lte(10);
const maxBacklogs = z.coerce.number().int().gte(0).lte(50);

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
    eligibleBranches: eligibleBranches.optional(),
    minCgpa: minCgpa.nullable().optional(),
    maxBacklogs: maxBacklogs.nullable().optional(),
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
    eligibleBranches: eligibleBranches.optional(),
    minCgpa: minCgpa.nullable().optional(),
    maxBacklogs: maxBacklogs.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update." });

// Faceted discovery query (T-11). Parsed from URL search params; unknown params
// are ignored (clients may append cache-busters). All values are validated and
// then passed to the service as bound parameters (never string-interpolated).
export const OpportunityListQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  type: oppType.optional(),
  domain: z.string().trim().min(1).max(80).optional(),
  stipend: z.enum(["true", "false"]).optional(),
  skillId: z.string().trim().uuid("Invalid skill id.").optional(),
  sort: z.enum(["recent", "deadline", "seats"]).optional(),
  includeExpired: z.enum(["true", "false"]).optional(),
  // "My postings" (docs/PRD M9-adjacent poster dashboard): the caller's own
  // id, resolved server-side from the session - never a client-supplied
  // posterId, so a faculty member can't page through anyone else's postings
  // via this endpoint.
  mine: z.enum(["true"]).optional(),
  cursor: z.string().trim().max(300).optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
});

export type OpportunityCreateInput = z.infer<typeof OpportunityCreateSchema>;
export type OpportunityUpdateInput = z.infer<typeof OpportunityUpdateSchema>;
export type OpportunityListQuery = z.infer<typeof OpportunityListQuerySchema>;

// ── Application pipeline (T-12 / T-13; docs/PRD M5, S3) ──────────────────────

const rejectionCode = z.enum([
  "SKILL_MISMATCH",
  "SEATS_FILLED",
  "TIMING_CONFLICT",
  "PROFILE_INCOMPLETE",
  "STRONGER_APPLICANTS",
  "OTHER",
]);

// Student applies. Optional short pitch; posterId/status/etc. are never client-set.
export const ApplicationCreateSchema = z
  .object({
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

// Poster-driven transitions. The legal target set is a subset of AppState; the
// full state-machine (which source states may reach which targets) is enforced
// in the service, not here. A rejection code is only meaningful on REJECTED.
export const ApplicationTransitionSchema = z
  .object({
    // RECEIVED is deliberately absent: no longer an offered poster transition
    // (APPLIED goes straight to SHORTLISTED/REJECTED) - see application-state.ts.
    toState: z.enum(["SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED"]),
    note: z.string().trim().max(1000).optional(),
    rejectionCode: rejectionCode.optional(),
  })
  .strict()
  .refine((v) => v.toState === "REJECTED" || v.rejectionCode === undefined, {
    message: "A rejection code is only valid when rejecting an application.",
    path: ["rejectionCode"],
  });

export type ApplicationCreateInput = z.infer<typeof ApplicationCreateSchema>;
export type ApplicationTransitionInput = z.infer<typeof ApplicationTransitionSchema>;

// ── Messaging (T-16) & notifications (T-17) ──────────────────────────────────

export const MessageSendSchema = z
  .object({ body: z.string().trim().min(1, "Message cannot be empty.").max(4000) })
  .strict();

export const NotificationsReadSchema = z
  .object({
    // Omit / empty → mark ALL of the caller's notifications read.
    ids: z.array(z.string().trim().uuid()).max(200).optional(),
  })
  .strict();

export const NotificationPrefSchema = z
  .object({ frequency: z.enum(["IMMEDIATE", "DAILY", "WEEKLY"]) })
  .strict();

// ── Moderation flags (T-36; docs/PRD M9) ─────────────────────────────────────

export const FlagCreateSchema = z
  .object({
    reason: z.enum(["SPAM", "MISLEADING", "INAPPROPRIATE", "DUPLICATE", "OTHER"]),
    detail: z.string().trim().max(500).optional(),
  })
  .strict();

// Admin resolution. RESOLVED upholds the report (optionally removing the
// posting); DISMISSED closes it as no-violation. `note` is an optional rationale.
export const FlagResolveSchema = z
  .object({
    decision: z.enum(["RESOLVED", "DISMISSED"]),
    note: z.string().trim().max(500).optional(),
    removePosting: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.decision === "RESOLVED" || !v.removePosting, {
    message: "A posting can only be removed when the flag is upheld.",
    path: ["removePosting"],
  });

export type FlagCreateInput = z.infer<typeof FlagCreateSchema>;
export type FlagResolveInput = z.infer<typeof FlagResolveSchema>;

export type MessageSendInput = z.infer<typeof MessageSendSchema>;
export type NotificationsReadInput = z.infer<typeof NotificationsReadSchema>;
export type NotificationPrefInput = z.infer<typeof NotificationPrefSchema>;

// ── Admin console (Identity v2) ──────────────────────────────────────────────

// Change a user's role/status. ADMIN is never a settable role, and the admin's
// own account is protected in the service. Both fields optional (partial update).
export const AdminUserUpdateSchema = z
  .object({
    role: z.enum(["STUDENT", "FACULTY", "ALUMNI"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  })
  .strict()
  .refine((v) => v.role !== undefined || v.status !== undefined, {
    message: "Provide a role or status to change.",
  });

// Provision an alumni account (admin only). Personal email allowed (alumni have
// no institute address). Optional proof-of-graduation is stored as a claim.
export const AdminProvisionAlumniSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    rollNo: z.string().trim().min(3).max(30).optional(),
    gradYear: z.coerce.number().int().gte(1960).lte(new Date().getFullYear()).optional(),
    degree: z.string().trim().min(2).max(120).optional(),
    proofUrl: z.string().trim().url().max(500).optional(),
  })
  .strict();

export const FacultyAllowlistAddSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address."),
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export type AdminUserUpdateInput = z.infer<typeof AdminUserUpdateSchema>;
export type AdminProvisionAlumniInput = z.infer<typeof AdminProvisionAlumniSchema>;
export type FacultyAllowlistAddInput = z.infer<typeof FacultyAllowlistAddSchema>;

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
