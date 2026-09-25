import { Prisma, type NotifFreq } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isDue } from "@/lib/domain/digest";
import { mailer } from "@/lib/email/mailer";
import { notificationEmail } from "@/lib/email/templates";
import { configuredOrigin } from "@/lib/http/origin";

/**
 * Notification service (T-17; docs/PRD M8).
 *
 * Every notification lands in the in-app feed AND leaves the app by email - a
 * poster who never opens Nexus must still hear that an applicant is waiting.
 * `delivered_at` means "emailed" (or deliberately not - see deliverNotifications);
 * NULL means still owed. IMMEDIATE recipients are emailed at once, DAILY/WEEKLY
 * ones by the digest job in one batched message.
 *
 * `notify()` NEVER throws into the caller's path - a failed notification must
 * not roll back the business action that triggered it. A failed send leaves the
 * rows owed, so the next digest run retries them.
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
    await deliverNotifications(userId);
  } catch (e) {
    console.error("notify failed", e);
  }
}

/**
 * Email a user everything they are owed, if their cadence says it is time.
 * Returns how many notifications were delivered (0 when not due or on failure).
 *
 * The rows are CLAIMED first - one UPDATE ... RETURNING stamps delivered_at on
 * exactly the rows this call will send - so a concurrent notify() and digest run
 * can never email the same notification twice. A failed send releases the claim.
 *
 * An account that cannot receive mail (suspended, unverified, soft-deleted) has
 * its rows marked delivered without a send: they stay in the in-app feed, and
 * the digest job does not retry them forever.
 */
export async function deliverNotifications(userId: string, now = new Date()): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, status: true, deletedAt: true },
  });
  const reachable = user !== null && user.deletedAt === null && user.status === "ACTIVE";
  const { frequency, lastDigestAt } = await getPreference(userId);
  if (reachable && !isDue(frequency, lastDigestAt, now)) return 0;

  const claimed = await prisma.$queryRaw<{ id: string; type: string; payload: unknown; created_at: Date }[]>(
    Prisma.sql`
      UPDATE notifications
      SET delivered_at = ${now}
      WHERE user_id = ${userId}::uuid AND delivered_at IS NULL
      RETURNING id, type, payload, created_at
    `,
  );
  if (claimed.length === 0 || !user || !reachable) return claimed.length;

  claimed.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  try {
    await mailer.send({ to: user.email, ...notificationEmail(claimed, configuredOrigin()) });
  } catch (e) {
    console.error("[notify] email delivery failed; will retry on the next digest run", e);
    await prisma.notification.updateMany({
      where: { id: { in: claimed.map((n) => n.id) } },
      data: { deliveredAt: null },
    });
    return 0;
  }

  if (frequency !== "IMMEDIATE") {
    await prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, frequency, lastDigestAt: now },
      update: { lastDigestAt: now },
    });
  }
  return claimed.length;
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
    frequency: pref?.frequency ?? ("IMMEDIATE" as NotifFreq),
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
 * Digest job (T-17). Delivers to every user still owed notifications whose
 * cadence window has elapsed - the DAILY/WEEKLY batch, plus a retry of any
 * IMMEDIATE send that failed. Idempotent within a window.
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
    const n = await deliverNotifications(userId, now);
    if (n > 0) {
      users += 1;
      delivered += n;
    }
  }
  return { users, delivered };
}
