import { prisma } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import { configuredOrigin } from "@/lib/http/origin";
import { audit } from "@/lib/security/audit";
import { mailer } from "@/lib/email/mailer";
import { alumniClaimDecisionEmail } from "@/lib/email/templates";
import type { Principal } from "@/lib/iam/policy";
import type { AlumniClaimInput } from "@/lib/validation/schemas";

/**
 * Alumni claim workflow (docs/PRD §4.5). Alumni lose their institute email,
 * so their identity is proven by a claim an admin reviews, not by the email
 * domain. An alumnus registers with any email, verifies it, and sits in
 * PENDING_ALUMNI (read-only, enforced by policy.ts) while their claim is
 * reviewed. Approval activates the account; a rejection carries a reason and
 * leaves them pending so they can correct the claim and resubmit.
 */

const CLAIM_SELECT = {
  id: true,
  rollNo: true,
  gradYear: true,
  degree: true,
  proofUrl: true,
  decision: true,
  decisionReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * A claim waiting for an admin: undecided, from an account that is still
 * pending. Shared by the queue and the console's count so the two agree.
 */
export const PENDING_CLAIM_WHERE = {
  decision: null,
  user: { deletedAt: null, status: "PENDING_ALUMNI" as const },
};

/** The signed-in alumnus's own claim, or null before they submit one. */
export async function getMyClaim(principal: Principal) {
  return prisma.alumniClaim.findUnique({ where: { userId: principal.userId }, select: CLAIM_SELECT });
}

/**
 * Submit, or after a rejection resubmit, the caller's own claim. One claim per
 * account (unique userId): a resubmission replaces the rejected details and
 * puts it back in the queue; the earlier decision stays in the audit log.
 */
export async function submitClaim(principal: Principal, input: AlumniClaimInput) {
  if (principal.role !== "ALUMNI") throw Errors.forbidden("Only alumni accounts submit an alumni claim.");
  if (principal.status !== "PENDING_ALUMNI") throw Errors.conflict("This account is already verified.");

  const existing = await prisma.alumniClaim.findUnique({ where: { userId: principal.userId }, select: { id: true, decision: true, decisionReason: true } });
  if (existing && existing.decision === null) throw Errors.conflict("Your claim is already being reviewed.");
  if (existing?.decision === "APPROVED") throw Errors.conflict("Your claim has already been approved.");

  const data = { rollNo: input.rollNo, gradYear: input.gradYear, degree: input.degree, proofUrl: input.proofUrl };
  const claim = existing
    ? await prisma.alumniClaim.update({
        where: { id: existing.id },
        data: { ...data, decision: null, decisionReason: null, reviewedById: null },
        select: CLAIM_SELECT,
      })
    : await prisma.alumniClaim.create({ data: { ...data, userId: principal.userId }, select: CLAIM_SELECT });

  await audit({
    action: existing ? "alumni.claim.resubmitted" : "alumni.claim.submitted",
    actorId: principal.userId,
    target: claim.id,
  });
  return claim;
}

/**
 * The review queue, oldest first. Each claim carries the other claims that use
 * the same roll number, so a reviewer sees a likely duplicate or impersonation.
 */
export async function listPendingClaims() {
  const claims = await prisma.alumniClaim.findMany({
    where: PENDING_CLAIM_WHERE,
    orderBy: { updatedAt: "asc" },
    select: { ...CLAIM_SELECT, user: { select: { id: true, name: true, email: true, createdAt: true } } },
  });
  if (claims.length === 0) return [];

  const rolls = [...new Set(claims.map((c) => c.rollNo.trim().toUpperCase()))];
  const sharing = await prisma.alumniClaim.findMany({
    where: { OR: rolls.map((r) => ({ rollNo: { equals: r, mode: "insensitive" as const } })) },
    select: { id: true, rollNo: true, decision: true, userId: true, user: { select: { name: true } } },
  });

  return claims.map((c) => ({
    ...c,
    sameRollNo: sharing
      .filter((s) => s.id !== c.id && s.rollNo.trim().toUpperCase() === c.rollNo.trim().toUpperCase())
      .map((s) => ({ userId: s.userId, name: s.user.name, decision: s.decision })),
  }));
}

export async function decideClaim(
  admin: Principal,
  claimId: string,
  decision: "APPROVED" | "REJECTED",
  reason?: string,
) {
  const why = reason?.trim() || null;
  if (decision === "REJECTED" && !why) throw Errors.validation("Give the alumnus a reason so they can fix their claim.", "reason");

  const claim = await prisma.alumniClaim.findUnique({
    where: { id: claimId },
    select: { id: true, userId: true, decision: true, user: { select: { name: true, email: true } } },
  });
  if (!claim) throw Errors.notFound();

  await prisma.$transaction(async (tx) => {
    // Conditional, so two admins deciding at once cannot both win.
    const res = await tx.alumniClaim.updateMany({
      where: { id: claimId, decision: null },
      data: { decision, decisionReason: why, reviewedById: admin.userId },
    });
    if (res.count === 0) throw Errors.conflict("This claim has already been decided.");
    // Approval activates the account; a rejection leaves it pending so the
    // alumnus can correct and resubmit (it never suspends them).
    if (decision === "APPROVED") {
      await tx.user.updateMany({ where: { id: claim.userId, status: "PENDING_ALUMNI" }, data: { status: "ACTIVE" } });
    }
  });

  await audit({
    action: "alumni.claim.decided",
    actorId: admin.userId,
    target: claimId,
    metadata: { decision },
  });

  try {
    await mailer.send({
      to: claim.user.email,
      ...alumniClaimDecisionEmail({ name: claim.user.name, decision, reason: why, origin: configuredOrigin() }),
    });
  } catch (e) {
    // The decision stands; the alumnus also sees it when they sign in.
    console.error("[alumni] decision email failed to send", e);
  }
  return { id: claimId, decision };
}
