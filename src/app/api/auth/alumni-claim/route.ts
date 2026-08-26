import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { AlumniRegisterSchema, AlumniClaimSchema } from "@/lib/validation/schemas";
import { authRateLimiter, clientIp } from "@/lib/security/rate-limit";
import { env } from "@/lib/env";
import { register } from "@/lib/services/auth.service";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

/**
 * POST /api/auth/alumni-claim
 * Alumni register with ANY email (they no longer hold an institute address) plus
 * proof-of-graduation details. The account is created as PENDING_ALUMNI — which
 * policy.ts treats as read-only — until an admin approves the claim. Role is set
 * to ALUMNI server-side; the client cannot request a different role.
 */
export const POST = handler(async (req) => {
  if (!(await authRateLimiter.consume(`alumni:${clientIp(req)}`))) {
    throw Errors.rateLimited();
  }

  const body = await req.json().catch(() => null);
  const account = AlumniRegisterSchema.safeParse(body);
  const claim = AlumniClaimSchema.safeParse(body);
  if (!account.success || !claim.success) {
    throw Errors.validation("Please complete all account and proof-of-graduation fields.");
  }

  const result = await register({
    name: account.data.name,
    email: account.data.email,
    password: account.data.password,
    role: "ALUMNI",
    status: "PENDING_ALUMNI",
  });

  // Only attach the claim if a new account was actually created (uniform response
  // otherwise, to avoid revealing that the email already exists).
  if (result.userId) {
    await prisma.alumniClaim.create({
      data: {
        userId: result.userId,
        rollNo: claim.data.rollNo,
        gradYear: claim.data.gradYear,
        degree: claim.data.degree,
        proofUrl: claim.data.proofUrl,
      },
    });
    await audit({ action: "alumni.claim.submitted", actorId: result.userId });
  }

  const devOtp =
    env.NODE_ENV !== "production" && result.otpForDelivery
      ? { devOtp: result.otpForDelivery }
      : {};

  return ok(
    {
      message:
        "Claim received. Verify your email, then an administrator will review your proof.",
      ...devOtp,
    },
    202,
  );
});
