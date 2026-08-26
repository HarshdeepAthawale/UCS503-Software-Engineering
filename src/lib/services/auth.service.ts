import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { Errors } from "@/lib/http/errors";
import { hashPassword, verifyPassword, dummyVerify } from "@/lib/security/password";
import { generateOtp, hashOtp, verifyOtp } from "@/lib/security/otp";
import { signAccessToken } from "@/lib/security/access-token";
import { issueRefreshMaterial, hashToken, fingerprint } from "@/lib/security/tokens";
import { audit } from "@/lib/security/audit";
import type { Role } from "@prisma/client";

/**
 * Identity service. All authentication logic lives here so routes stay thin and
 * the security invariants are enforced in one place.
 *
 * Guiding rules:
 *  - Never reveal whether an email exists (uniform responses on register/login).
 *  - Passwords are scrypt-hashed; OTPs are hashed with a TTL + attempt cap.
 *  - Refresh tokens rotate on every use, with reuse detection (theft response).
 */

export interface IssuedSession {
  accessToken: string;
  refresh: { raw: string; expiresAt: Date };
  user: { id: string; role: Role; status: string; name: string };
}

// ── Registration ─────────────────────────────────────────────────────────────

/**
 * Register a user (role STUDENT/FACULTY/ALUMNI decided by caller policy, never
 * by the client). Returns nothing sensitive; the OTP is emailed out-of-band.
 * To avoid account enumeration, the route responds identically whether or not
 * the email already existed.
 */
export async function register(params: {
  name: string;
  email: string;
  password: string;
  role: Role;
  status: "UNVERIFIED" | "PENDING_ALUMNI";
}): Promise<{ otpForDelivery: string | null; userId: string | null }> {
  const existing = await prisma.user.findFirst({
    where: { email: params.email },
    select: { id: true },
  });
  if (existing) {
    // Do not create or leak; caller returns a generic 202.
    return { otpForDelivery: null, userId: null };
  }

  const passwordHash = await hashPassword(params.password);
  const otp = generateOtp();

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        name: params.name,
        email: params.email,
        passwordHash,
        role: params.role,
        status: params.status,
      },
      select: { id: true },
    });
    await tx.otpChallenge.create({
      data: {
        userId: u.id,
        codeHash: hashOtp(otp),
        purpose: "REGISTER_VERIFY",
        expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000),
      },
    });
    return u;
  });

  await audit({ action: "auth.register", actorId: user.id, metadata: { role: params.role } });
  // The route "delivers" the OTP (email in prod; returned only in dev/test).
  return { otpForDelivery: otp, userId: user.id };
}

// ── OTP verification ─────────────────────────────────────────────────────────

export async function verifyRegistrationOtp(params: {
  email: string;
  otp: string;
  userAgent: string | null;
}): Promise<IssuedSession> {
  const user = await prisma.user.findFirst({
    where: { email: params.email, deletedAt: null },
    select: { id: true, role: true, status: true, name: true },
  });
  // Generic failure — never disclose which of email/otp was wrong.
  const genericFail = Errors.validation("Invalid or expired code.");
  if (!user) throw genericFail;

  const challenge = await prisma.otpChallenge.findFirst({
    where: { userId: user.id, purpose: "REGISTER_VERIFY", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) throw genericFail;

  if (challenge.expiresAt <= new Date()) throw Errors.gone("Code expired. Request a new one.");
  if (challenge.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw Errors.rateLimited("Too many attempts. Request a new code.");
  }

  const good = verifyOtp(params.otp, challenge.codeHash);
  if (!good) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw genericFail;
  }

  // Success: consume the challenge and activate the account atomically.
  // PENDING_ALUMNI stays pending (admin must still approve); others become ACTIVE.
  const nextStatus = user.status === "PENDING_ALUMNI" ? "PENDING_ALUMNI" : "ACTIVE";
  const updated = await prisma.$transaction(async (tx) => {
    await tx.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    return tx.user.update({
      where: { id: user.id },
      data: { status: nextStatus },
      select: { id: true, role: true, status: true, name: true },
    });
  });

  await audit({ action: "auth.verify_otp", actorId: user.id });
  return issueSession(updated, params.userAgent);
}

// ── Login ────────────────────────────────────────────────────────────────────

export async function login(params: {
  email: string;
  password: string;
  userAgent: string | null;
}): Promise<IssuedSession> {
  const user = await prisma.user.findFirst({
    where: { email: params.email, deletedAt: null },
    select: {
      id: true,
      role: true,
      status: true,
      name: true,
      passwordHash: true,
    },
  });

  // Constant-ish work whether or not the user exists: verify the real hash, or
  // burn equivalent scrypt work via dummyVerify, so response timing does not
  // reveal account existence.
  const passwordOk = user
    ? await verifyPassword(user.passwordHash, params.password)
    : await dummyVerify(params.password);

  if (!user || !passwordOk) {
    await audit({ action: "auth.login.failed", metadata: { emailKnown: !!user } });
    throw Errors.unauthenticated("Invalid email or password.");
  }
  if (user.status === "SUSPENDED") {
    throw Errors.forbidden("This account has been suspended.");
  }
  if (user.status === "UNVERIFIED") {
    throw Errors.forbidden("Please verify your email before signing in.");
  }

  await audit({ action: "auth.login.success", actorId: user.id });
  return issueSession(user, params.userAgent);
}

// ── Refresh (rotation + reuse detection) ─────────────────────────────────────

export async function refresh(params: {
  rawToken: string;
  userAgent: string | null;
}): Promise<IssuedSession> {
  const tokenHash = hashToken(params.rawToken);
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { id: true, role: true, status: true, name: true, deletedAt: true } },
    },
  });

  if (!record || record.user.deletedAt) throw Errors.unauthenticated("Session expired.");

  // Reuse detection: a token presented after it was already rotated/revoked is a
  // strong theft signal. Invalidate the ENTIRE family and force re-auth.
  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: record.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await audit({
      action: "auth.refresh.reuse_detected",
      actorId: record.userId,
      metadata: { familyId: record.familyId },
    });
    throw Errors.unauthenticated("Session invalidated. Please sign in again.");
  }

  if (record.expiresAt <= new Date()) throw Errors.unauthenticated("Session expired.");
  if (record.user.status === "SUSPENDED") throw Errors.forbidden("Account suspended.");

  // Rotate: revoke the presented token and mint a fresh one in the same family.
  const next = issueRefreshMaterial();
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: record.userId,
        tokenHash: next.hash,
        familyId: record.familyId, // same lineage
        uaHash: fingerprint(params.userAgent),
        expiresAt: next.expiresAt,
      },
    }),
  ]);

  await audit({ action: "auth.refresh.rotated", actorId: record.userId });

  const accessToken = await signAccessToken({
    userId: record.userId,
    role: record.user.role,
    status: record.user.status,
  });
  return {
    accessToken,
    refresh: { raw: next.raw, expiresAt: next.expiresAt },
    user: {
      id: record.user.id,
      role: record.user.role,
      status: record.user.status,
      name: record.user.name,
    },
  };
}

// ── Logout ───────────────────────────────────────────────────────────────────

export async function logout(rawToken: string | null): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!record || record.revokedAt) return;
  // Revoke the whole family so all sibling sessions from this lineage end too.
  await prisma.refreshToken.updateMany({
    where: { familyId: record.familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await audit({ action: "auth.logout", actorId: record.userId });
}

// ── Session minting (shared) ─────────────────────────────────────────────────

async function issueSession(
  user: { id: string; role: Role; status: string; name: string },
  userAgent: string | null,
): Promise<IssuedSession> {
  const refreshMaterial = issueRefreshMaterial();
  // A fresh login starts a NEW family (a new rotation lineage).
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshMaterial.hash,
      familyId: crypto.randomUUID(),
      uaHash: fingerprint(userAgent),
      expiresAt: refreshMaterial.expiresAt,
    },
  });

  const accessToken = await signAccessToken({
    userId: user.id,
    role: user.role,
    status: user.status,
  });
  // Reconstruct a clean, allow-listed user object so no extra fields the caller
  // may have selected (e.g. passwordHash) can ever leak into the response.
  return {
    accessToken,
    refresh: { raw: refreshMaterial.raw, expiresAt: refreshMaterial.expiresAt },
    user: { id: user.id, role: user.role, status: user.status, name: user.name },
  };
}
