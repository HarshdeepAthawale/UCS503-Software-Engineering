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
    branch: z.string().trim().max(80).optional(),
    year: z.coerce.number().int().gte(1).lte(6).optional(),
    cgpa: z.coerce.number().gte(0).lte(10).optional(),
    cgpaPublic: z.boolean().optional(),
    bio: z.string().trim().max(1000).optional(),
  })
  .strict(); // reject unknown keys → no mass assignment of role/status/etc.

export const AlumniClaimDecisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
