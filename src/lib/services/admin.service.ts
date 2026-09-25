import { prisma } from "@/lib/db";
import { isAdminRole } from "@/lib/domain/admin-portal";
import { mailer } from "@/lib/email/mailer";
import { adminInviteEmail } from "@/lib/email/templates";
import { Errors } from "@/lib/http/errors";
import { configuredOrigin } from "@/lib/http/origin";
import { audit } from "@/lib/security/audit";
import { hashPassword } from "@/lib/security/password";
import type { Principal } from "@/lib/iam/policy";
import type {
  AdminCreateInput,
  AdminProvisionAlumniInput,
  AdminUserUpdateInput,
  FacultyAllowlistAddInput,
} from "@/lib/validation/schemas";

/**
 * Admin console service (Identity v2; docs/Identity-and-Admin-Plan.md §4).
 *
 * Every mutation is audited with the acting admin's id. Invariants enforced here,
 * not just in the UI:
 *  • admin accounts are never touched by member management (role/status);
 *  • admins are created and removed only through createAdmin/removeAdmin (the
 *    super admin's powers - the routes gate them on `user:manage_admins`);
 *  • the one SUPER_ADMIN is never modified from the app at all;
 *  • alumni and admins get an unusable password (they sign in via email code).
 */

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

// ── Overview ─────────────────────────────────────────────────────────────────

export async function getOverview() {
  const [byRole, opps, atRisk, applications, pendingClaims, openFlags] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: true }),
    prisma.opportunity.count({ where: { deletedAt: null, status: "LIVE" } }),
    prisma.opportunity.count({ where: { deletedAt: null, status: "AT_RISK" } }),
    prisma.application.count({ where: { deletedAt: null } }),
    prisma.alumniClaim.count({ where: { decision: null } }),
    prisma.flag.count({ where: { status: "OPEN" } }),
  ]);

  const roles: Record<string, number> = { STUDENT: 0, FACULTY: 0, ALUMNI: 0, ADMIN: 0, SUPER_ADMIN: 0 };
  for (const r of byRole) roles[r.role] = r._count;

  return {
    users: roles,
    opportunities: { live: opps, atRisk },
    applications,
    pendingClaims,
    openFlags,
  };
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function listUsers(opts: { q?: string; role?: string; status?: string }) {
  const where: Record<string, unknown> = { deletedAt: null };
  if (opts.role) where.role = opts.role;
  if (opts.status) where.status = opts.status;
  if (opts.q) {
    where.OR = [
      { email: { contains: opts.q, mode: "insensitive" } },
      { name: { contains: opts.q, mode: "insensitive" } },
    ];
  }
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: USER_SELECT,
  });
  return { users };
}

/** Load a member for role/status changes; admin accounts are managed elsewhere. */
async function loadMutableUser(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, role: true, status: true },
  });
  if (!user) throw Errors.notFound();
  if (isAdminRole(user.role)) {
    throw Errors.forbidden("Admin accounts are managed from the Admins tab.");
  }
  return user;
}

export async function updateUser(admin: Principal, id: string, input: AdminUserUpdateInput) {
  if (id === admin.userId) {
    throw Errors.forbidden("You cannot change your own admin account.");
  }
  await loadMutableUser(id);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.role ? { role: input.role } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    select: USER_SELECT,
  });

  if (input.role) {
    await audit({ action: "user.role_changed", actorId: admin.userId, target: id, metadata: { to: input.role } });
  }
  if (input.status) {
    await audit({ action: "user.status_changed", actorId: admin.userId, target: id, metadata: { to: input.status } });
  }
  return updated;
}

// ── Admins (super admin only) ────────────────────────────────────────────────

/** Every live admin account, the super admin first. */
export async function listAdmins() {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, deletedAt: null },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: USER_SELECT,
  });
  return { admins };
}

/**
 * Create an admin account and email the new admin how to sign in. The address
 * must not belong to a member: turning a student or faculty account into an
 * admin would mix the two sign-in doors. A previously removed admin with the
 * same email is restored rather than duplicated (emails are unique).
 *
 * The email is best-effort: the account exists either way, and `invited` tells
 * the console whether to ask the super admin to pass the sign-in link on.
 */
export async function createAdmin(superAdmin: Principal, input: AdminCreateInput) {
  const existing = await prisma.user.findFirst({
    where: { email: input.email },
    select: { id: true, role: true, deletedAt: true },
  });
  const restorable = existing?.role === "ADMIN" && existing.deletedAt !== null;
  if (existing && !restorable) {
    throw Errors.conflict("An account with that email already exists.");
  }

  const admin = restorable
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { deletedAt: null, status: "ACTIVE", name: input.name },
        select: USER_SELECT,
      })
    : await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          // Unusable - admins sign in at /admin with an emailed one-time code.
          passwordHash: await hashPassword(`${crypto.randomUUID()}${crypto.randomUUID()}Aa1!`),
          role: "ADMIN",
          status: "ACTIVE",
        },
        select: USER_SELECT,
      });

  await audit({
    action: "admin.created",
    actorId: superAdmin.userId,
    target: admin.id,
    metadata: { restored: restorable },
  });

  const inviter = await prisma.user.findUnique({
    where: { id: superAdmin.userId },
    select: { name: true },
  });
  let invited = true;
  try {
    await mailer.send({
      to: admin.email,
      ...adminInviteEmail({
        name: admin.name,
        invitedBy: inviter?.name ?? "The super admin",
        origin: configuredOrigin(),
      }),
    });
  } catch (e) {
    invited = false;
    console.error("[admin] invite email failed", e);
  }
  return { ...admin, invited };
}

/**
 * Remove an admin: soft-delete the account and end every session it holds.
 * Only ADMIN rows qualify - the super admin and members are "not found" here.
 */
export async function removeAdmin(superAdmin: Principal, id: string) {
  const admin = await prisma.user.findFirst({
    where: { id, role: "ADMIN", deletedAt: null },
    select: { id: true },
  });
  if (!admin) throw Errors.notFound();

  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { deletedAt: now } }),
    prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);
  await audit({ action: "admin.removed", actorId: superAdmin.userId, target: id });
  return { id };
}

// ── Provision alumni ─────────────────────────────────────────────────────────

export async function provisionAlumni(admin: Principal, input: AdminProvisionAlumniInput) {
  const existing = await prisma.user.findFirst({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw Errors.conflict("An account with that email already exists.");
  }

  // Unusable password - alumni authenticate via passwordless email-OTP login.
  const unusable = await hashPassword(`${crypto.randomUUID()}${crypto.randomUUID()}Aa1!`);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: unusable,
        role: "ALUMNI",
        status: "ACTIVE",
      },
      select: USER_SELECT,
    });
    // Store proof-of-graduation as an approved claim, if provided.
    if (input.rollNo && input.gradYear && input.degree && input.proofUrl) {
      await tx.alumniClaim.create({
        data: {
          userId: u.id,
          rollNo: input.rollNo,
          gradYear: input.gradYear,
          degree: input.degree,
          proofUrl: input.proofUrl,
          decision: "APPROVED",
          reviewedById: admin.userId,
        },
      });
    }
    return u;
  });

  await audit({
    action: "user.provisioned",
    actorId: admin.userId,
    target: user.id,
    metadata: { role: "ALUMNI" },
  });
  return user;
}

// ── Faculty allowlist ────────────────────────────────────────────────────────

export async function listFacultyAllowlist() {
  const entries = await prisma.facultyAllowlist.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, note: true, createdAt: true },
  });
  return { entries };
}

export async function addFacultyAllowlist(admin: Principal, input: FacultyAllowlistAddInput) {
  const existing = await prisma.facultyAllowlist.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) throw Errors.conflict("That email is already on the allowlist.");

  const entry = await prisma.facultyAllowlist.create({
    data: { email: input.email, note: input.note ?? null },
    select: { id: true, email: true, note: true, createdAt: true },
  });

  // Promote an existing STUDENT account with this email immediately.
  await prisma.user.updateMany({
    where: { email: input.email, role: "STUDENT", deletedAt: null },
    data: { role: "FACULTY" },
  });

  await audit({ action: "faculty_allowlist.added", actorId: admin.userId, metadata: { email: input.email } });
  return entry;
}

export async function removeFacultyAllowlist(admin: Principal, id: string) {
  const entry = await prisma.facultyAllowlist.findUnique({ where: { id }, select: { id: true, email: true } });
  if (!entry) throw Errors.notFound();
  await prisma.facultyAllowlist.delete({ where: { id } });
  await audit({ action: "faculty_allowlist.removed", actorId: admin.userId, metadata: { email: entry.email } });
  return { id };
}
