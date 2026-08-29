import { handler, ok } from "@/lib/http/respond";
import { requireCronSecret } from "@/lib/http/cron-auth";
import { remindUpcomingDeadlines } from "@/lib/services/opportunity.service";

export const runtime = "nodejs";

/**
 * POST /api/cron/deadline-reminders - T-35 deadline reminder sweep (docs/PRD M8).
 *
 * Emits an in-app `opportunity.deadline_reminder` to each poster whose open
 * posting is entering the T−72h or T−24h window, at most once per posting per
 * tier. Idempotent, so it is safe to run frequently (e.g. hourly). Guarded by
 * CRON_SECRET, not the RBAC matrix - there is no user principal for a job.
 */
export const POST = handler(async (req) => {
  requireCronSecret(req);
  const counts = await remindUpcomingDeadlines();
  return ok(counts);
});

// Vercel Cron triggers jobs with a GET (carrying `Authorization: Bearer
// $CRON_SECRET`); POST stays for manual/authed invocation. Same guard, same work.
export const GET = POST;
