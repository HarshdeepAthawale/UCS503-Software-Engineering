import { prisma } from "@/lib/db";
import type { NotifFreq } from "@prisma/client";
import { isDue } from "@/lib/domain/digest";

/**
 * Notification service (T-17; docs/PRD M8).
 *
 * `notify()` is fire-and-forget and NEVER throws into the caller's path - a
 * failed notification must not roll back the business action that triggered it.
 * The digest job batches undelivered notifications per the recipient's cadence.
 */

export type NotificationType =
  | "application.received" // → poster: a new application arrived
  | "application.status_changed" // → student: pipeline advanced
  | "application.withdrawn" // → poster: an applicant withdrew
  | "message.received" // → the other thread participant
  | "opportunity.at_risk" // → poster: SLA breach nudge
  | "opportunity.deadline_reminder" // → poster: deadline at T−72h / T−24h (T-35)
  | "attestation.received" // → student: a poster verified one of their skills (T-19)
  | "team.join_requested" // → team lead: a student requested a role slot (T-22)
  | "team.request_accepted" // → student: their role-slot request was accepted
  | "team.request_rejected" // → student: their role-slot request was rejected
  | "team.locked" // → lead + members: every role slot is now filled
  | "meeting.scheduled" // → attendee: a Meet interview/team sync was scheduled
  | "meeting.cancelled"; // → attendee: a scheduled meeting was cancelled

export async function notify(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, payload: payload as object },
    });
  } catch (e) {
    console.error("notify failed", e);
  }
}

export async function listNotifications(userId: string) {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, type: true, payload: true, readAt: true, createdAt: true },
  });
  const unread = await prisma.notification.count({ where: { userId, readAt: null } });
  return { notifications, unread };
}

/** Mark the caller's notifications read - all, or a specific set. Scoped to userId. */
export async function markRead(userId: string, ids?: string[]): Promise<number> {
  const where =
    ids && ids.length
      ? { userId, id: { in: ids }, readAt: null }
      : { userId, readAt: null };
  const r = await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
  return r.count;
}

export async function getPreference(userId: string) {
  const pref = await prisma.notificationPreference.findUnique({ where: { userId } });
  return {
    frequency: pref?.frequency ?? ("DAILY" as NotifFreq),
    lastDigestAt: pref?.lastDigestAt ?? null,
  };
}

export async function setPreference(userId: string, frequency: NotifFreq) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, frequency },
    update: { frequency },
    select: { frequency: true, updatedAt: true },
  });
}

/**
 * Digest job (T-17). For every user with undelivered notifications whose cadence
 * window has elapsed, mark their pending notifications delivered and stamp the
 * digest time. Delivery here is the in-app feed; an email channel plugs in at
 * this seam. Idempotent within a window.
 */
export async function runDigest(now = new Date()): Promise<{ users: number; delivered: number }> {
  const pending = await prisma.notification.findMany({
    where: { deliveredAt: null },
    distinct: ["userId"],
    select: { userId: true },
  });

  let users = 0;
  let delivered = 0;
  for (const { userId } of pending) {
    const { frequency, lastDigestAt } = await getPreference(userId);
    if (!isDue(frequency, lastDigestAt, now)) continue;

    const marked = await prisma.notification.updateMany({
      where: { userId, deliveredAt: null },
      data: { deliveredAt: now },
    });
    await prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, frequency, lastDigestAt: now },
      update: { lastDigestAt: now },
    });
    users += 1;
    delivered += marked.count;
  }
  return { users, delivered };
}
