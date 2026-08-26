import { prisma } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import { audit } from "@/lib/security/audit";
import type { Principal } from "@/lib/iam/policy";

/**
 * Alumni claim workflow (docs/PRD §4.5). A claimant submits proof; the account
 * sits in PENDING_ALUMNI (read-only, enforced by policy.ts) until an admin
 * approves. Approval is a privileged action and is audited with the reviewer id.
 */

export async function listPendingClaims() {
  return prisma.alumniClaim.findMany({
    where: { decision: null },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export async function decideClaim(
  admin: Principal,
  claimId: string,
  decision: "APPROVED" | "REJECTED",
  reason?: string,
) {
  const claim = await prisma.alumniClaim.findUnique({ where: { id: claimId } });
  if (!claim) throw Errors.notFound();
  if (claim.decision) throw Errors.conflict("This claim has already been decided.");

  const nextUserStatus = decision === "APPROVED" ? "ACTIVE" : "SUSPENDED";

  await prisma.$transaction([
    prisma.alumniClaim.update({
      where: { id: claimId },
      data: {
        decision,
        decisionReason: reason ?? null,
        reviewedById: admin.userId,
      },
    }),
    prisma.user.update({
      where: { id: claim.userId },
      data: { status: nextUserStatus },
    }),
  ]);

  await audit({
    action: "alumni.claim.decided",
    actorId: admin.userId,
    target: claimId,
    metadata: { decision },
  });
  return { id: claimId, decision };
}
