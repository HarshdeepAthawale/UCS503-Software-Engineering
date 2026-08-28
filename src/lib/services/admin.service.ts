import { prisma } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import { audit } from "@/lib/security/audit";
import { hashPassword } from "@/lib/security/password";
import type { Principal } from "@/lib/iam/policy";
import type {
  AdminProvisionAlumniInput,
  AdminUserUpdateInput,
  FacultyAllowlistAddInput,
} from "@/lib/validation/schemas";

/**
 * Admin console service (Identity v2; docs/Identity-and-Admin-Plan.md §4).
 *
 * Every mutation is audited with the acting admin's id. Invariants enforced here,
 * not just in the UI:
 *  • the single ADMIN account can never be modified, demoted, or deleted;
 *  • role can never be set to ADMIN;
 *  • alumni are provisioned with an unusable password (they log in via OTP).
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
  const [byRole, opps, atRisk, applications, pendingClaims] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: true }),
    prisma.opportunity.count({ where: { deletedAt: null, status: "LIVE" } }),
    prisma.opportunity.count({ where: { deletedAt: null, status: "AT_RISK" } }),
    prisma.application.count({ where: { deletedAt: null } }),
    prisma.alumniClaim.count({ where: { decision: null } }),
  ]);

  const roles: Record<string, number> = { STUDENT: 0, FACULTY: 0, ALUMNI: 0, ADMIN: 0 };
  for (const r of byRole) roles[r.role] = r._count;

  return {
    users: roles,
    opportunities: { live: opps, atRisk },
    applications,
    pendingClaims,
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

/** Load a target user, refusing any operation on the ADMIN account. */
async function loadMutableUser(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, role: true, status: true },
  });
  if (!user) throw Errors.notFound();
  if (user.role === "ADMIN") {
    throw Errors.forbidden("The administrator account cannot be modified.");
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
