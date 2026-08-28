import { handler, ok } from "@/lib/http/respond";
import { requireCronSecret } from "@/lib/http/cron-auth";
import { expirePastDeadline } from "@/lib/services/opportunity.service";

export const runtime = "nodejs";

/**
 * POST /api/cron/expire-opportunities - T-10 deadline expiry job.
 *
 * Flips every past-deadline LIVE/AT_RISK/DRAFT posting to EXPIRED. Idempotent,
 * so it is safe to run on any schedule (e.g. every 15 min). Guarded by
 * CRON_SECRET, not the RBAC matrix - there is no user principal for a job.
 */
export const POST = handler(async (req) => {
  requireCronSecret(req);
  const expired = await expirePastDeadline();
  return ok({ expired });
});
