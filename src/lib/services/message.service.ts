import { prisma } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import type { Principal } from "@/lib/iam/policy";
import { notify } from "./notification.service";

/**
 * Scoped messaging service (T-16; docs/PRD M7).
 *
 * A thread is bound to one application; the only participants are that
 * application's student and its opportunity's poster. Membership is checked on
 * every read and send - messaging can never be used to contact someone outside
 * an active application. Admins may read (moderation) but not post.
 */

interface Participants {
  applicationId: string;
  studentId: string;
  posterId: string;
}

async function resolveParticipants(applicationId: string): Promise<Participants | null> {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    select: { id: true, studentId: true, opportunity: { select: { posterId: true } } },
  });
  if (!app) return null;
  return { applicationId: app.id, studentId: app.studentId, posterId: app.opportunity.posterId };
}

function isParticipant(principal: Principal, p: Participants): boolean {
  return principal.userId === p.studentId || principal.userId === p.posterId;
}

export async function listMessages(principal: Principal, applicationId: string) {
  const parts = await resolveParticipants(applicationId);
  if (!parts) throw Errors.notFound();
  if (!isParticipant(principal, parts) && principal.role !== "ADMIN") {
    throw Errors.forbidden();
  }

  const thread = await prisma.messageThread.findUnique({
    where: { applicationId },
    select: { id: true },
  });
  const messages = thread
    ? await prisma.message.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, senderId: true, body: true, createdAt: true },
      })
    : [];
  return { messages };
}

export async function sendMessage(principal: Principal, applicationId: string, body: string) {
  const parts = await resolveParticipants(applicationId);
  if (!parts) throw Errors.notFound();
  // Only the two participants may post - an admin's read access does not extend
  // to speaking in the thread.
  if (!isParticipant(principal, parts)) throw Errors.forbidden();

  const message = await prisma.$transaction(async (tx) => {
    const thread = await tx.messageThread.upsert({
      where: { applicationId },
      create: { applicationId },
      update: {},
      select: { id: true },
    });
    return tx.message.create({
      data: { threadId: thread.id, senderId: principal.userId, body },
      select: { id: true, senderId: true, body: true, createdAt: true },
    });
  });

  const recipient = principal.userId === parts.studentId ? parts.posterId : parts.studentId;
  await notify(recipient, "message.received", { applicationId });
  return message;
}
