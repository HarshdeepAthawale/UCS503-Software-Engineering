import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { Errors } from "@/lib/http/errors";
import { hashPassword, verifyPassword, dummyVerify } from "@/lib/security/password";
import { generateOtp, hashOtp, verifyOtp } from "@/lib/security/otp";
import { signAccessToken } from "@/lib/security/access-token";
import { issueRefreshMaterial, hashToken, fingerprint } from "@/lib/security/tokens";
import { audit } from "@/lib/security/audit";
import type { Role } from "@prisma/client";
import { portalForRole, type Portal } from "@/lib/domain/admin-portal";

/**
 * Identity service. All authentication logic lives here so routes stay thin and
 * the security invariants are enforced in one place.
 *
 * Guiding rules:
 *  - Never reveal whether an email exists (uniform responses on register/login).
 *  - Passwords are scrypt-hashed; OTPs are hashed with a TTL + attempt cap.
 *  - Refresh tokens rotate on every use, with reuse detection (theft response).
 */

/**
 * How long a just-rotated refresh token may be presented again and be treated
 * as a race (parallel tabs, an aborted reload) rather than theft. Short on
 * purpose: long enough for a slow response, too short to be useful to replay.
 */
const REFRESH_REUSE_GRACE_MS = 10_000;

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
  // Generic failure - never disclose which of email/otp was wrong.
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
  const role = await resolveRoleWithAllowlist(updated.id, params.email, updated.role);
  return issueSession({ ...updated, role }, params.userAgent);
}

// ── Login ────────────────────────────────────────────────────────────────────

export async function login(params: {
  email: string;
  password: string;
  userAgent: string | null;
  /** The sign-in door used: admins only at /admin, members only at /. */
  portal?: Portal;
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
  assertPortal(user.role, params.portal ?? "member");

  await audit({ action: "auth.login.success", actorId: user.id });
  const role = await resolveRoleWithAllowlist(user.id, params.email, user.role);
  return issueSession({ ...user, role }, params.userAgent);
}

// ── Google sign-in (OAuth) ───────────────────────────────────────────────────

/**
 * Sign in (or provision) a user from a Google-verified profile. Google has
 * proven email ownership, so no OTP is needed - the account is ACTIVE. Restricted
 * to the institutional domain; alumni (non-institute email) use the claim flow.
 *
 * If the email already exists, this LINKS to it (issues a session) rather than
 * creating a duplicate. A newly provisioned Google user gets an unusable random
 * password hash - they authenticate via Google, not a password.
 */
export async function loginWithGoogle(params: {
  email: string;
  name: string;
  userAgent: string | null;
}): Promise<IssuedSession> {
  const email = params.email.toLowerCase();
  if (!email.endsWith(`@${env.ALLOWED_EMAIL_DOMAIN}`)) {
    throw Errors.forbidden(
      `Google sign-in is restricted to @${env.ALLOWED_EMAIL_DOMAIN} accounts. Alumni: please register and submit an alumni claim.`,
    );
  }

  let user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, role: true, status: true, name: true },
  });

  if (user) {
    if (user.status === "SUSPENDED") throw Errors.forbidden("This account has been suspended.");
    // Google sign-in is the member door; admins use /admin (no Google there).
    assertPortal(user.role, "member");
    // Google proves ownership - promote an unverified account to ACTIVE.
    if (user.status === "UNVERIFIED") {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { status: "ACTIVE" },
        select: { id: true, role: true, status: true, name: true },
      });
    }
  } else {
    const unusable = await hashPassword(`${crypto.randomUUID()}${crypto.randomUUID()}Aa1!`);
    user = await prisma.user.create({
      data: {
        email,
        name: params.name.trim() || email.split("@")[0] || email,
        passwordHash: unusable,
        role: "STUDENT",
        status: "ACTIVE",
      },
      select: { id: true, role: true, status: true, name: true },
    });
    await audit({ action: "auth.register", actorId: user.id, metadata: { via: "google" } });
  }

  await audit({ action: "auth.login.success", actorId: user.id, metadata: { via: "google" } });
  const role = await resolveRoleWithAllowlist(user.id, email, user.role);
  return issueSession({ ...user, role }, params.userAgent);
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

  // A token presented again moments after it was rotated, while its session
  // still holds a live successor, is an ordinary race - two tabs refreshing at
  // once, or a reload that aborted the response carrying the new cookie. Treat
  // it as a normal refresh (a fresh sibling in the same family) instead of
  // theft, which used to sign the member out everywhere.
  const benignRace =
    record.revokedAt !== null &&
    Date.now() - record.revokedAt.getTime() < REFRESH_REUSE_GRACE_MS &&
    (await prisma.refreshToken.count({
      where: { familyId: record.familyId, revokedAt: null, expiresAt: { gt: new Date() } },
    })) > 0;

  // Reuse detection: any other presentation of a rotated/revoked token is a
  // strong theft signal. Invalidate the ENTIRE family and force re-auth.
  if (record.revokedAt && !benignRace) {
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
  // Only stamp revokedAt the first time - re-stamping an already-rotated token
  // would restart its grace window and let it be replayed indefinitely.
  const next = issueRefreshMaterial();
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
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

// ── Faculty allowlist promotion (Identity v2) ────────────────────────────────

/**
 * If a STUDENT's email is on the admin-curated faculty allowlist, promote them to
 * FACULTY and audit it. Runs on every login path, so adding an email to the
 * allowlist takes effect the next time that professor signs in. Never demotes.
 */
async function resolveRoleWithAllowlist(
  userId: string,
  email: string,
  currentRole: Role,
): Promise<Role> {
  if (currentRole !== "STUDENT") return currentRole;
  const listed = await prisma.facultyAllowlist.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!listed) return currentRole;
  await prisma.user.update({ where: { id: userId }, data: { role: "FACULTY" } });
  await audit({
    action: "user.role_changed",
    actorId: userId,
    metadata: { to: "FACULTY", via: "allowlist" },
  });
  return "FACULTY";
}

// ── Passwordless email-OTP login (alumni + convenience) ──────────────────────

/**
 * Request a one-time login code for an ACTIVE account. Returns the code for the
 * caller to deliver (email in prod; dev returns it). Uniform behaviour when the
 * account is missing/inactive is handled by the route - no enumeration.
 */
export async function requestLoginOtp(
  email: string,
  portal: Portal = "member",
): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, status: true, role: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  // Wrong door: behave exactly as for an unknown address (no enumeration).
  if (portalForRole(user.role) !== portal) return null;

  const otp = generateOtp();
  await prisma.otpChallenge.create({
    data: {
      userId: user.id,
      codeHash: hashOtp(otp),
      purpose: "LOGIN",
      expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000),
    },
  });
  await audit({ action: "auth.login_otp.requested", actorId: user.id });
  return otp;
}

export async function verifyLoginOtp(params: {
  email: string;
  otp: string;
  userAgent: string | null;
  portal?: Portal;
}): Promise<IssuedSession> {
  const user = await prisma.user.findFirst({
    where: { email: params.email, deletedAt: null },
    select: { id: true, role: true, status: true, name: true },
  });
  const genericFail = Errors.validation("Invalid or expired code.");
  if (!user) throw genericFail;
  if (user.status === "SUSPENDED") throw Errors.forbidden("This account has been suspended.");
  if (user.status !== "ACTIVE") throw genericFail;
  if (portalForRole(user.role) !== (params.portal ?? "member")) throw genericFail;

  const challenge = await prisma.otpChallenge.findFirst({
    where: { userId: user.id, purpose: "LOGIN", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) throw genericFail;
  if (challenge.expiresAt <= new Date()) throw Errors.gone("Code expired. Request a new one.");
  if (challenge.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw Errors.rateLimited("Too many attempts. Request a new code.");
  }
  if (!verifyOtp(params.otp, challenge.codeHash)) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw genericFail;
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });
  await audit({ action: "auth.login.success", actorId: user.id, metadata: { via: "otp" } });

  const role = await resolveRoleWithAllowlist(user.id, params.email, user.role);
  return issueSession({ ...user, role }, params.userAgent);
}

// ── Sign-in doors ────────────────────────────────────────────────────────────

/**
 * Admins sign in only at /admin, members only at /. Runs AFTER the credential
 * check, so it reveals nothing to someone who does not hold the password. An
 * admin at the member door is told where to go; a member at the admin door gets
 * the same answer as a wrong password.
 */
function assertPortal(role: Role, portal: Portal): void {
  if (portalForRole(role) === portal) return;
  if (portal === "member") throw Errors.forbidden("Admin accounts sign in at /admin.");
  throw Errors.unauthenticated("Invalid email or password.");
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
