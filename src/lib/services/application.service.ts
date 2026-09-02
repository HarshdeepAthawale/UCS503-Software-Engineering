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
import { notify } from "./notification.service";
import type {
  ApplicationCreateInput,
  ApplicationTransitionInput,
} from "@/lib/validation/schemas";

/**
 * Application pipeline service (T-12 / T-13; docs/PRD M5, S3).
 *
 * Guarantees, in order of the layer that enforces them:
 *  • one application per student per opportunity - DB partial-unique index;
 *  • application budget - counted inside a SERIALIZABLE tx (no over-budget race);
 *  • seat allocation - a conditional UPDATE that can never exceed seat_count;
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
    select: {
      id: true,
      status: true,
      deadline: true,
      posterId: true,
      eligibleBranches: true,
      minCgpa: true,
      maxBacklogs: true,
    },
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

  // Eligibility filters (docs/PRD M3). The client hides "Apply" for a student
  // who doesn't qualify, but that's UX only - this is the authoritative check,
  // since nothing stops a direct POST here.
  if (opp.eligibleBranches.length > 0 || opp.minCgpa !== null || opp.maxBacklogs !== null) {
    const profile = await prisma.profile.findUnique({
      where: { userId: principal.userId },
      select: { branch: true, cgpa: true, backlogs: true },
    });
    if (opp.eligibleBranches.length > 0) {
      if (!profile?.branch || !opp.eligibleBranches.includes(profile.branch)) {
        throw Errors.domainRule(
          `This opportunity is only open to: ${opp.eligibleBranches.join(", ")}.`,
        );
      }
    }
    if (opp.minCgpa !== null) {
      if (profile?.cgpa == null || Number(profile.cgpa) < Number(opp.minCgpa)) {
        throw Errors.domainRule(`This opportunity requires a minimum CGPA of ${opp.minCgpa}.`);
      }
    }
    if (opp.maxBacklogs !== null) {
      if (profile?.backlogs == null || profile.backlogs > opp.maxBacklogs) {
        throw Errors.domainRule(
          `This opportunity requires ${opp.maxBacklogs} or fewer active backlogs.`,
        );
      }
    }
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
    // Notify the poster that a new application arrived (T-17).
    await notify(opp.posterId, "application.received", {
      opportunityId,
      applicationId: application.id,
    });
    return application;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw Errors.conflict("You have already applied to this opportunity.");
    }
    if (isSerializationFailure(e)) {
      throw Errors.conflict("Please retry - a concurrent update interfered.");
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
          studentId: true,
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
      return { updated, from: app.status, studentId: app.studentId };
    }, SERIALIZABLE);

    await audit({
      action: "application.transitioned",
      actorId: principal.userId,
      target: applicationId,
      metadata: { from: result.from, to: input.toState },
    });
    // Notify the applicant that their pipeline advanced (T-17).
    await notify(result.studentId, "application.status_changed", {
      applicationId,
      from: result.from,
      to: input.toState,
    });
    return result.updated;
  } catch (e) {
    if (isSerializationFailure(e)) {
      throw Errors.conflict("Please retry - a concurrent update interfered.");
    }
    throw e;
  }
}

// ── Withdraw (student) ───────────────────────────────────────────────────────

export async function withdrawApplication(principal: Principal, applicationId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      select: {
        status: true,
        studentId: true,
        opportunityId: true,
        opportunity: { select: { posterId: true } },
      },
    });
    if (!app) throw Errors.notFound();
    if (app.studentId !== principal.userId) throw Errors.forbidden();
    if (!canWithdraw(app.status)) {
      throw Errors.conflict("This application can no longer be withdrawn.");
    }

    // Withdrawing an ACCEPTED offer frees the seat it held, so the poster can
    // select someone else. Conditional on seatsFilled > 0 so a concurrent
    // release can never take it negative (mirrors the allocation guard in
    // transitionApplication).
    if (app.status === "SELECTED") {
      await tx.opportunity.updateMany({
        where: { id: app.opportunityId, seatsFilled: { gt: 0 } },
        data: { seatsFilled: { decrement: 1 } },
      });
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
    return { updated, from: app.status, posterId: app.opportunity.posterId };
  });

  await audit({
    action: "application.withdrawn",
    actorId: principal.userId,
    target: applicationId,
    metadata: { from: result.from, seatReleased: result.from === "SELECTED" },
  });
  // Notify the poster that an applicant withdrew (T-17) - including a selected
  // one declining the offer, which is the case they most need to see promptly.
  await notify(result.posterId, "application.withdrawn", { applicationId });
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
 *
 * `branch`/`cgpa` are returned regardless of the student's `cgpaPublic` flag -
 * unlike a profile page view, this list is scoped to people who chose to apply
 * to THIS poster's own posting (the same consent boundary `profile:read_resume`
 * already relies on for résumés), so the poster can shortlist by the same CGPA
 * criteria they set on the posting.
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
      student: {
        select: {
          id: true,
          name: true,
          profile: { select: { branch: true, cgpa: true, backlogs: true } },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: { fromState: true, toState: true, note: true, createdAt: true },
      },
    },
  });
  return {
    applicants: applicants.map((a) => ({
      ...a,
      student: {
        id: a.student.id,
        name: a.student.name,
        branch: a.student.profile?.branch ?? null,
        cgpa: a.student.profile?.cgpa == null ? null : Number(a.student.profile.cgpa),
        backlogs: a.student.profile?.backlogs ?? null,
      },
    })),
  };
}
