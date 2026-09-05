import { prisma } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import { audit } from "@/lib/security/audit";
import {
  cancelCalendarEvent,
  createCalendarEvent,
  googleCalendarConfigured,
  refreshCalendarAccessToken,
  revokeCalendarAccess,
} from "@/lib/security/google-calendar";
import { decryptSecret, encryptSecret } from "@/lib/security/token-crypto";
import { notify } from "./notification.service";
import type { Principal } from "@/lib/iam/policy";
import type { MeetingCreateInput } from "@/lib/validation/schemas";

/**
 * Meeting scheduling service (Google Meet integration).
 *
 * Only the organizer (a poster scheduling an interview, or a team lead
 * scheduling a team sync) needs a stored Google Calendar credential -
 * attendees are added by email on the organizer's own event and Google
 * emails them the invite directly, so they never need to connect anything.
 */

const MEETING_SELECT = {
  id: true,
  title: true,
  scheduledAt: true,
  durationMinutes: true,
  meetLink: true,
  status: true,
  createdAt: true,
  organizer: { select: { id: true, name: true } },
} as const;

/** A fresh access token for this user's stored calendar grant, or a clean "please connect" error. */
async function getAccessTokenFor(userId: string): Promise<string> {
  const cred = await prisma.googleCalendarCredential.findUnique({
    where: { userId },
    select: { encryptedRefreshToken: true, revokedAt: true },
  });
  if (!cred || cred.revokedAt) {
    throw Errors.conflict("Connect Google Calendar before scheduling a meeting.");
  }
  try {
    return await refreshCalendarAccessToken(decryptSecret(cred.encryptedRefreshToken));
  } catch (e) {
    // Google reports the grant as revoked (the user disconnected it on their
    // side) - reflect that locally so the next attempt asks to reconnect
    // instead of failing the same opaque way every time.
    await prisma.googleCalendarCredential.update({
      where: { userId },
      data: { revokedAt: new Date() },
    });
    throw e;
  }
}

export function calendarSchedulingEnabled(): boolean {
  return googleCalendarConfigured();
}

export async function hasCalendarConnected(userId: string): Promise<boolean> {
  const cred = await prisma.googleCalendarCredential.findUnique({
    where: { userId },
    select: { revokedAt: true },
  });
  return !!cred && !cred.revokedAt;
}

export async function disconnectCalendar(principal: Principal): Promise<{ disconnected: true }> {
  const cred = await prisma.googleCalendarCredential.findUnique({
    where: { userId: principal.userId },
    select: { encryptedRefreshToken: true },
  });
  if (cred) {
    await revokeCalendarAccess(decryptSecret(cred.encryptedRefreshToken));
    await prisma.googleCalendarCredential.delete({ where: { userId: principal.userId } });
  }
  await audit({ action: "calendar.disconnected", actorId: principal.userId });
  return { disconnected: true };
}

// ── Application (interview) meetings ─────────────────────────────────────────

export async function getApplicationMeetingRefs(
  applicationId: string,
): Promise<{ posterId: string; studentId: string; status: string } | null> {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    select: { status: true, studentId: true, opportunity: { select: { posterId: true } } },
  });
  if (!app) return null;
  return { posterId: app.opportunity.posterId, studentId: app.studentId, status: app.status };
}

export async function scheduleApplicationMeeting(
  principal: Principal,
  applicationId: string,
  input: MeetingCreateInput,
) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    select: {
      status: true,
      student: { select: { id: true, name: true, email: true } },
      opportunity: { select: { posterId: true, poster: { select: { email: true } }, title: true } },
    },
  });
  if (!app) throw Errors.notFound();
  if (app.status !== "SHORTLISTED" && app.status !== "INTERVIEW") {
    throw Errors.domainRule("A meeting can only be scheduled while the application is being reviewed.");
  }

  const accessToken = await getAccessTokenFor(principal.userId);
  const event = await createCalendarEvent({
    accessToken,
    title: input.title,
    description: input.description,
    startTime: input.scheduledAt,
    durationMinutes: input.durationMinutes,
    attendeeEmails: [app.opportunity.poster.email, app.student.email],
  });

  const meeting = await prisma.meeting.create({
    data: {
      organizerId: principal.userId,
      applicationId,
      title: input.title,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      googleEventId: event.googleEventId,
      meetLink: event.meetLink,
    },
    select: MEETING_SELECT,
  });

  await audit({
    action: "meeting.scheduled",
    actorId: principal.userId,
    target: meeting.id,
    metadata: { applicationId },
  });
  await notify(app.student.id, "meeting.scheduled", { meetingId: meeting.id, applicationId });
  return meeting;
}

export async function listApplicationMeetings(applicationId: string) {
  const meetings = await prisma.meeting.findMany({
    where: { applicationId },
    orderBy: { scheduledAt: "desc" },
    select: MEETING_SELECT,
  });
  return { meetings };
}

// ── Team meetings ────────────────────────────────────────────────────────────

export async function getTeamMeetingRefs(teamId: string): Promise<{ leadId: string } | null> {
  const team = await prisma.team.findFirst({
    where: { id: teamId, deletedAt: null },
    select: { leadId: true },
  });
  return team ? { leadId: team.leadId } : null;
}

export async function scheduleTeamMeeting(
  principal: Principal,
  teamId: string,
  input: MeetingCreateInput,
) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, deletedAt: null },
    select: {
      leadId: true,
      lead: { select: { id: true, email: true } },
      members: { select: { userId: true, user: { select: { email: true } } } },
    },
  });
  if (!team) throw Errors.notFound();

  const accessToken = await getAccessTokenFor(principal.userId);
  const attendeeEmails = [team.lead.email, ...team.members.map((m) => m.user.email)];
  const event = await createCalendarEvent({
    accessToken,
    title: input.title,
    description: input.description,
    startTime: input.scheduledAt,
    durationMinutes: input.durationMinutes,
    attendeeEmails,
  });

  const meeting = await prisma.meeting.create({
    data: {
      organizerId: principal.userId,
      teamId,
      title: input.title,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      googleEventId: event.googleEventId,
      meetLink: event.meetLink,
    },
    select: MEETING_SELECT,
  });

  await audit({
    action: "meeting.scheduled",
    actorId: principal.userId,
    target: meeting.id,
    metadata: { teamId },
  });
  const recipients = new Set([team.leadId, ...team.members.map((m) => m.userId)]);
  recipients.delete(principal.userId);
  for (const userId of recipients) {
    await notify(userId, "meeting.scheduled", { meetingId: meeting.id, teamId });
  }
  return meeting;
}

export async function listTeamMeetings(teamId: string) {
  const meetings = await prisma.meeting.findMany({
    where: { teamId },
    orderBy: { scheduledAt: "desc" },
    select: MEETING_SELECT,
  });
  return { meetings };
}

// ── Cancel (either kind) ──────────────────────────────────────────────────────

export async function getMeetingRefs(
  meetingId: string,
): Promise<{ organizerId: string; applicationId: string | null; teamId: string | null } | null> {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId },
    select: { organizerId: true, applicationId: true, teamId: true },
  });
  return meeting;
}

export async function cancelMeeting(principal: Principal, meetingId: string) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId },
    select: {
      status: true,
      organizerId: true,
      googleEventId: true,
      applicationId: true,
      teamId: true,
      application: { select: { studentId: true } },
      team: { select: { leadId: true, members: { select: { userId: true } } } },
    },
  });
  if (!meeting) throw Errors.notFound();
  if (meeting.status === "CANCELLED") return { id: meetingId, status: "CANCELLED" as const };

  const accessToken = await getAccessTokenFor(meeting.organizerId);
  await cancelCalendarEvent({ accessToken, googleEventId: meeting.googleEventId });

  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: "CANCELLED" },
    select: { id: true, status: true },
  });

  await audit({ action: "meeting.cancelled", actorId: principal.userId, target: meetingId });
  const recipients = new Set(
    meeting.application
      ? [meeting.application.studentId]
      : [meeting.team!.leadId, ...(meeting.team?.members.map((m) => m.userId) ?? [])],
  );
  recipients.delete(principal.userId);
  for (const userId of recipients) {
    await notify(userId, "meeting.cancelled", {
      meetingId,
      applicationId: meeting.applicationId,
      teamId: meeting.teamId,
    });
  }
  return updated;
}

// ── Reminders (cron) ──────────────────────────────────────────────────────────

const REMINDER_WINDOW_LOWER_H = 23;
const REMINDER_WINDOW_UPPER_H = 25;

/**
 * Reminder sweep: notify every attendee of a SCHEDULED meeting entering the
 * ~24h-before window, at most once per meeting (dedup via `remindedAt`,
 * mirroring deadline-reminder.ts's approach). Meeting volume is small enough
 * that a per-meeting loop is simpler and clear enough - unlike the
 * opportunity deadline sweep, this doesn't need a set-based SQL insert.
 */
export async function remindUpcomingMeetings(now = new Date()): Promise<number> {
  const lower = new Date(now.getTime() + REMINDER_WINDOW_LOWER_H * 3_600_000);
  const upper = new Date(now.getTime() + REMINDER_WINDOW_UPPER_H * 3_600_000);

  const due = await prisma.meeting.findMany({
    where: { status: "SCHEDULED", remindedAt: null, scheduledAt: { gt: lower, lte: upper } },
    select: {
      id: true,
      organizerId: true,
      applicationId: true,
      teamId: true,
      application: { select: { studentId: true } },
      team: { select: { leadId: true, members: { select: { userId: true } } } },
    },
  });

  let count = 0;
  for (const meeting of due) {
    const recipients = new Set(
      meeting.application
        ? [meeting.organizerId, meeting.application.studentId]
        : [meeting.organizerId, meeting.team!.leadId, ...(meeting.team?.members.map((m) => m.userId) ?? [])],
    );
    for (const userId of recipients) {
      await notify(userId, "meeting.scheduled", {
        meetingId: meeting.id,
        applicationId: meeting.applicationId,
        teamId: meeting.teamId,
        reminder: true,
      });
    }
    await prisma.meeting.update({ where: { id: meeting.id }, data: { remindedAt: now } });
    count += 1;
  }
  return count;
}
