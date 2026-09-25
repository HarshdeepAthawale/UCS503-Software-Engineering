import { isAdminRole } from "@/lib/domain/admin-portal";
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
  const app = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    select: {
      id: true,
      status: true,
      studentId: true,
      student: { select: { id: true, name: true } },
      opportunity: {
        select: {
          id: true,
          title: true,
          posterId: true,
          poster: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!app) throw Errors.notFound();

  const parts = {
    applicationId: app.id,
    studentId: app.studentId,
    posterId: app.opportunity.posterId,
  };
  if (!isParticipant(principal, parts) && !isAdminRole(principal.role)) {
    throw Errors.forbidden();
  }

  const names = new Map<string, string>([
    [app.student.id, app.student.name],
    [app.opportunity.poster.id, app.opportunity.poster.name],
  ]);

  const thread = await prisma.messageThread.findUnique({
    where: { applicationId },
    select: { id: true },
  });
  const rows = thread
    ? await prisma.message.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, senderId: true, body: true, createdAt: true },
      })
    : [];

  const messages = rows.map((m) => ({
    ...m,
    senderName: names.get(m.senderId) ?? "Unknown",
  }));

  return {
    messages,
    context: {
      applicationId: app.id,
      status: app.status,
      opportunity: { id: app.opportunity.id, title: app.opportunity.title },
      student: app.student,
      poster: app.opportunity.poster,
    },
  };
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

  const sender = await prisma.user.findFirst({
    where: { id: principal.userId },
    select: { name: true },
  });

  const recipient = principal.userId === parts.studentId ? parts.posterId : parts.studentId;
  await notify(recipient, "message.received", { applicationId });
  return { ...message, senderName: sender?.name ?? "Unknown" };
}

// ── Inbox (all of the caller's conversations) ────────────────────────────────

/**
 * Every conversation the caller is part of, across every application - as a
 * student, one row per professor they've messaged; as a poster (faculty/
 * alumni), one row per applicant. Scoped to the principal via the OR clause
 * below (never a matrix-wide grant), so `message:read` is safe for every role.
 *
 * Only applications whose thread has at least one message are returned - an
 * application with no messages yet isn't a "conversation".
 */
export async function listMyThreads(principal: Principal) {
  const applications = await prisma.application.findMany({
    where: {
      deletedAt: null,
      OR: [{ studentId: principal.userId }, { opportunity: { posterId: principal.userId } }],
    },
    select: {
      id: true,
      status: true,
      student: { select: { id: true, name: true, role: true } },
      opportunity: {
        select: {
          id: true,
          title: true,
          poster: { select: { id: true, name: true, role: true } },
        },
      },
      thread: {
        select: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, createdAt: true, senderId: true },
          },
        },
      },
    },
  });

  const threads = applications
    .filter((a) => a.thread && a.thread.messages.length > 0)
    .map((a) => {
      const isStudent = principal.userId === a.student.id;
      const counterpart = isStudent ? a.opportunity.poster : a.student;
      const lastRow = a.thread!.messages[0]!;
      const senderName =
        lastRow.senderId === a.student.id ? a.student.name : a.opportunity.poster.name;
      const lastMessage = { ...lastRow, senderName };
      return {
        applicationId: a.id,
        opportunity: { id: a.opportunity.id, title: a.opportunity.title },
        status: a.status,
        student: a.student,
        poster: a.opportunity.poster,
        counterpart,
        lastMessage,
      };
    })
    .sort(
      (x, y) => new Date(y.lastMessage.createdAt).getTime() - new Date(x.lastMessage.createdAt).getTime(),
    );

  return { threads };
}
