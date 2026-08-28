import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { Errors } from "@/lib/http/errors";
import { audit } from "@/lib/security/audit";
import type { Principal } from "@/lib/iam/policy";
import {
  ACTIVE_STATES,
  canPosterTransition,
  canWithdraw,
} from "@/lib/domain/application-state";
import type {
  ApplicationCreateInput,
  ApplicationTransitionInput,
} from "@/lib/validation/schemas";

/**
 * Application pipeline service (T-12 / T-13; docs/PRD M5, S3).
 *
 * Guarantees, in order of the layer that enforces them:
 *  • one application per student per opportunity — DB partial-unique index;
 *  • application budget — counted inside a SERIALIZABLE tx (no over-budget race);
 *  • seat allocation — a conditional UPDATE that can never exceed seat_count;
 *  • every state change appends an INSERT-only ApplicationEvent (the TTA source);
 *  • `first_transition_at` is stamped exactly once, on the poster's first action.
 *
 * `studentId`/`status`/`seatsFilled` are never client-supplied.
 */

const SERIALIZABLE = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

/** Translate a Postgres serialization failure into a retryable 409. */
function isSerializationFailure(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === "P2034" || e.code === "40001")
  );
}

// ── Ownership resolution (used by routes before authorize) ───────────────────

/** The student who owns the application and the poster of its opportunity. */
export async function getApplicationRefs(
  id: string,
): Promise<{ studentId: string; posterId: string } | null> {
  const app = await prisma.application.findFirst({
    where: { id, deletedAt: null },
    select: { studentId: true, opportunity: { select: { posterId: true } } },
  });
  if (!app) return null;
  return { studentId: app.studentId, posterId: app.opportunity.posterId };
}

// ── Apply (student) ──────────────────────────────────────────────────────────

export async function applyToOpportunity(
  principal: Principal,
  opportunityId: string,
  input: ApplicationCreateInput,
) {
  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, deletedAt: null },
    select: { id: true, status: true, deadline: true, posterId: true },
  });
  if (!opp) throw Errors.notFound();
  if (opp.posterId === principal.userId) {
    throw Errors.domainRule("You cannot apply to your own posting.");
  }
  if (opp.status !== "LIVE" && opp.status !== "AT_RISK") {
    throw Errors.conflict("This opportunity is not open for applications.");
  }
  if (opp.deadline <= new Date()) {
    throw Errors.gone("The application deadline has passed.");
  }

  try {
    const application = await prisma.$transaction(async (tx) => {
      const active = await tx.application.count({
        where: {
          studentId: principal.userId,
          status: { in: [...ACTIVE_STATES] },
          deletedAt: null,
        },
      });
      if (active >= env.APPLICATION_BUDGET) {
        throw Errors.domainRule(
          `You have reached your application budget of ${env.APPLICATION_BUDGET}. Withdraw an open application to free a slot.`,
        );
      }
      return tx.application.create({
        data: {
          opportunityId,
          studentId: principal.userId,
          status: "APPLIED",
          events: {
            create: {
              actorId: principal.userId,
              fromState: null,
              toState: "APPLIED",
              note: input.note ?? null,
            },
          },
        },
        select: { id: true, status: true, appliedAt: true, opportunityId: true },
      });
    }, SERIALIZABLE);

    await audit({
      action: "application.created",
      actorId: principal.userId,
      target: application.id,
      metadata: { opportunityId },
    });
    return application;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw Errors.conflict("You have already applied to this opportunity.");
    }
    if (isSerializationFailure(e)) {
      throw Errors.conflict("Please retry — a concurrent update interfered.");
    }
    throw e;
  }
}

// ── Transition (poster) ──────────────────────────────────────────────────────

export async function transitionApplication(
  principal: Principal,
  applicationId: string,
  input: ApplicationTransitionInput,
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const app = await tx.application.findFirst({
        where: { id: applicationId, deletedAt: null },
        select: {
          status: true,
          opportunityId: true,
          firstTransitionAt: true,
          opportunity: { select: { seatCount: true } },
        },
      });
      if (!app) throw Errors.notFound();

      if (!canPosterTransition(app.status, input.toState)) {
        throw Errors.conflict(
          `Cannot move an application from ${app.status} to ${input.toState}.`,
        );
      }

      // Seat allocation is race-safe: increment only while a seat remains. If no
      // row matches, seats are full and the selection is refused.
      if (input.toState === "SELECTED") {
        const seat = await tx.opportunity.updateMany({
          where: { id: app.opportunityId, seatsFilled: { lt: app.opportunity.seatCount } },
          data: { seatsFilled: { increment: 1 } },
        });
        if (seat.count === 0) {
          throw Errors.conflict("All seats for this opportunity are filled.");
        }
      }

      const updated = await tx.application.update({
        where: { id: applicationId },
        data: {
          status: input.toState,
          firstTransitionAt: app.firstTransitionAt ?? new Date(),
          rejectionCode:
            input.toState === "REJECTED" ? (input.rejectionCode ?? "OTHER") : null,
          events: {
            create: {
              actorId: principal.userId,
              fromState: app.status,
              toState: input.toState,
              note: input.note ?? null,
            },
          },
        },
        select: {
          id: true,
          status: true,
          firstTransitionAt: true,
          rejectionCode: true,
        },
      });
      return { updated, from: app.status };
    }, SERIALIZABLE);

    await audit({
      action: "application.transitioned",
      actorId: principal.userId,
      target: applicationId,
      metadata: { from: result.from, to: input.toState },
    });
    return result.updated;
  } catch (e) {
    if (isSerializationFailure(e)) {
      throw Errors.conflict("Please retry — a concurrent update interfered.");
    }
    throw e;
  }
}

// ── Withdraw (student) ───────────────────────────────────────────────────────

export async function withdrawApplication(principal: Principal, applicationId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      select: { status: true, studentId: true },
    });
    if (!app) throw Errors.notFound();
    if (app.studentId !== principal.userId) throw Errors.forbidden();
    if (!canWithdraw(app.status)) {
      throw Errors.conflict("This application can no longer be withdrawn.");
    }
    const updated = await tx.application.update({
      where: { id: applicationId },
      data: {
        status: "WITHDRAWN",
        events: {
          create: {
            actorId: principal.userId,
            fromState: app.status,
            toState: "WITHDRAWN",
          },
        },
      },
      select: { id: true, status: true },
    });
    return { updated, from: app.status };
  });

  await audit({
    action: "application.withdrawn",
    actorId: principal.userId,
    target: applicationId,
    metadata: { from: result.from },
  });
  return result.updated;
}

// ── Views ────────────────────────────────────────────────────────────────────

/** The caller's own applications (student view). */
export async function listMyApplications(principal: Principal) {
  const applications = await prisma.application.findMany({
    where: { studentId: principal.userId, deletedAt: null },
    orderBy: { appliedAt: "desc" },
    select: {
      id: true,
      status: true,
      appliedAt: true,
      firstTransitionAt: true,
      rejectionCode: true,
      opportunity: {
        select: { id: true, title: true, type: true, status: true, deadline: true },
      },
    },
  });
  return { applications };
}

/**
 * Applicants to one opportunity (poster view). The route has already verified
 * the caller owns the opportunity (or is admin); this returns the pipeline with
 * each application's full immutable event timeline.
 */
export async function listApplicantsForOpportunity(opportunityId: string) {
  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, deletedAt: null },
    select: { id: true },
  });
  if (!opp) throw Errors.notFound();

  const applicants = await prisma.application.findMany({
    where: { opportunityId, deletedAt: null },
    orderBy: { appliedAt: "asc" },
    select: {
      id: true,
      status: true,
      appliedAt: true,
      firstTransitionAt: true,
      rejectionCode: true,
      student: { select: { id: true, name: true } },
      events: {
        orderBy: { createdAt: "asc" },
        select: { fromState: true, toState: true, note: true, createdAt: true },
      },
    },
  });
  return { applicants };
}
