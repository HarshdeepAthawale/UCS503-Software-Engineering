import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import { audit } from "@/lib/security/audit";
import type { Principal } from "@/lib/iam/policy";
import type { FlagCreateInput, FlagResolveInput } from "@/lib/validation/schemas";

/**
 * Moderation flag queue (T-36; docs/PRD M9).
 *
 * Any member (student/faculty/alumni via `flag:create`) can report a posting.
 * A partial-unique index blocks a second OPEN flag from the same reporter on the
 * same posting, so the DB — not the service — is the arbiter of "no duplicates".
 * Admins (`flag:read`/`flag:resolve`) work the queue: uphold (RESOLVED, with an
 * optional removal of the posting) or DISMISS. Every action is audited.
 */

// ── Create (member) ──────────────────────────────────────────────────────────

export async function createFlag(
  reporter: Principal,
  opportunityId: string,
  input: FlagCreateInput,
) {
  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, deletedAt: null },
    select: { id: true },
  });
  if (!opp) throw Errors.notFound();

  try {
    const flag = await prisma.flag.create({
      data: {
        opportunityId,
        reporterId: reporter.userId,
        reason: input.reason,
        detail: input.detail ?? null,
      },
      select: { id: true, reason: true, status: true, createdAt: true },
    });
    await audit({
      action: "flag.created",
      actorId: reporter.userId,
      target: opportunityId,
      metadata: { reason: input.reason, flagId: flag.id },
    });
    return flag;
  } catch (e) {
    // Partial-unique violation → this reporter already has an OPEN flag here.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw Errors.conflict("You have already reported this posting.");
    }
    throw e;
  }
}

// ── Queue (admin) ────────────────────────────────────────────────────────────

/** The OPEN flag queue, oldest first, with posting + reporter context. */
export async function listOpenFlags() {
  const flags = await prisma.flag.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      reason: true,
      detail: true,
      createdAt: true,
      reporter: { select: { id: true, name: true } },
      opportunity: {
        select: { id: true, title: true, status: true, deletedAt: true, poster: { select: { name: true } } },
      },
    },
  });
  return { flags };
}

export async function countOpenFlags() {
  return prisma.flag.count({ where: { status: "OPEN" } });
}

// ── Resolve / dismiss (admin) ────────────────────────────────────────────────

export async function resolveFlag(admin: Principal, flagId: string, input: FlagResolveInput) {
  const flag = await prisma.flag.findUnique({
    where: { id: flagId },
    select: { id: true, status: true, opportunityId: true },
  });
  if (!flag) throw Errors.notFound();
  if (flag.status !== "OPEN") throw Errors.conflict("This flag has already been reviewed.");

  const now = new Date();
  const removePosting = input.decision === "RESOLVED" && input.removePosting === true;

  await prisma.$transaction(async (tx) => {
    if (removePosting) {
      // Soft-remove the posting (drops it from all listings, keeps analytics),
      // and close EVERY open flag on it in one sweep — they are now moot.
      await tx.opportunity.update({
        where: { id: flag.opportunityId },
        data: { deletedAt: now },
      });
      await tx.flag.updateMany({
        where: { opportunityId: flag.opportunityId, status: "OPEN" },
        data: {
          status: "RESOLVED",
          resolutionNote: input.note ?? "Posting removed.",
          reviewedById: admin.userId,
          resolvedAt: now,
        },
      });
    } else {
      await tx.flag.update({
        where: { id: flagId },
        data: {
          status: input.decision,
          resolutionNote: input.note ?? null,
          reviewedById: admin.userId,
          resolvedAt: now,
        },
      });
    }
  });

  if (removePosting) {
    await audit({
      action: "opportunity.removed",
      actorId: admin.userId,
      target: flag.opportunityId,
      metadata: { via: "flag", flagId },
    });
  }
  await audit({
    action: input.decision === "RESOLVED" ? "flag.resolved" : "flag.dismissed",
    actorId: admin.userId,
    target: flagId,
    metadata: { removePosting },
  });
  return { id: flagId, status: input.decision, removedPosting: removePosting };
}
