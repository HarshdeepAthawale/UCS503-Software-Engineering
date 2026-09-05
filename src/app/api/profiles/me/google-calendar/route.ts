import { handler, ok, noContent } from "@/lib/http/respond";
import { requireAuth } from "@/lib/iam/guard";
import { calendarSchedulingEnabled, disconnectCalendar, hasCalendarConnected } from "@/lib/services/meeting.service";

export const runtime = "nodejs";

/**
 * GET /api/profiles/me/google-calendar - whether the caller has a live
 * calendar.events grant (drives the "Connect"/"Connected" UI state).
 * DELETE /api/profiles/me/google-calendar - revoke it.
 */

export const GET = handler(async (req) => {
  const principal = await requireAuth(req);
  const connected = calendarSchedulingEnabled() && (await hasCalendarConnected(principal.userId));
  return ok({ connected, enabled: calendarSchedulingEnabled() });
});

export const DELETE = handler(async (req) => {
  const principal = await requireAuth(req);
  await disconnectCalendar(principal);
  return noContent();
});
