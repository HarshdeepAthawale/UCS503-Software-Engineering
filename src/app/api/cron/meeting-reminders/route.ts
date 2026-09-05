import { handler, ok } from "@/lib/http/respond";
import { requireCronSecret } from "@/lib/http/cron-auth";
import { remindUpcomingMeetings } from "@/lib/services/meeting.service";

export const runtime = "nodejs";

/**
 * POST /api/cron/meeting-reminders - reminds every attendee of a scheduled
 * Google Meet meeting ~24h before it starts. Idempotent (remindedAt dedup),
 * so safe to run frequently. Guarded by CRON_SECRET, same as the other jobs.
 */
export const POST = handler(async (req) => {
  requireCronSecret(req);
  const count = await remindUpcomingMeetings();
  return ok({ reminded: count });
});

// Vercel Cron triggers with GET; POST stays for manual/authed invocation.
export const GET = POST;
