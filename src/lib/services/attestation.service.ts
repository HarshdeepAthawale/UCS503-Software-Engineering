import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import { audit } from "@/lib/security/audit";
import type { Principal } from "@/lib/iam/policy";
import { notify } from "./notification.service";
import type { AttestationCreateInput } from "@/lib/validation/schemas";

/**
 * Attestation service (T-19; docs/PRD S1).
 *
 * The database itself refuses an attestation against a non-SELECTED
 * application (constraint trigger, migration 20260906000000_attestations) -
 * the checks here are defense-in-depth so a bad request fails with a clean
 * 422 instead of a raw constraint-violation error, and so a skill outside the
 * student's claimed set is rejected with a specific message.
 */

/** The poster who may attest on this application, for the route's ownership check. */
export async function getAttestationRefs(
  applicationId: string,
): Promise<{ posterId: string; studentId: string } | null> {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    select: { studentId: true, opportunity: { select: { posterId: true } } },
  });
  if (!app) return null;
  return { posterId: app.opportunity.posterId, studentId: app.studentId };
}

export async function issueAttestation(
  principal: Principal,
  applicationId: string,
  input: AttestationCreateInput,
) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    select: { status: true, studentId: true, opportunity: { select: { posterId: true } } },
  });
  if (!app) throw Errors.notFound();
  if (app.status !== "SELECTED") {
    throw Errors.domainRule(
      "An attestation requires a SELECTED application - this engagement has not concluded in an offer.",
    );
  }

  // An attestation verifies a skill the student has already claimed; it does
  // not let a poster introduce a new skill on someone else's behalf.
  const claimed = await prisma.userSkill.findUnique({
    where: { userId_skillId: { userId: app.studentId, skillId: input.skillId } },
    select: { skillId: true },
  });
  if (!claimed) {
    throw Errors.validation(
      "This student has not listed that skill on their profile.",
      "skillId",
    );
  }

  try {
    const attestation = await prisma.attestation.create({
      data: {
        applicationId,
        skillId: input.skillId,
        issuerId: principal.userId,
        context: input.context,
      },
      select: { id: true, skillId: true, context: true, createdAt: true },
    });

    await audit({
      action: "attestation.issued",
      actorId: principal.userId,
      target: attestation.id,
      metadata: { applicationId, skillId: input.skillId },
    });
    await notify(app.studentId, "attestation.received", {
      applicationId,
      skillId: input.skillId,
      issuerId: principal.userId,
      context: input.context,
    });
    return attestation;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw Errors.conflict("You have already attested this skill for this engagement.");
    }
    throw e;
  }
}
