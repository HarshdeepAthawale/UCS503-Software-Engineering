import { handler, ok } from "@/lib/http/respond";
import { requireCronSecret } from "@/lib/http/cron-auth";
import { sweepSlaBreaches } from "@/lib/services/opportunity.service";

export const runtime = "nodejs";

/**
 * POST /api/cron/sla-sweep — T-15 SLA breach sweep.
 *
 * Flips LIVE postings with overdue unacknowledged applications to AT_RISK and
 * returns their ids (the hook where T-17 will nudge each poster). Idempotent;
 * safe to run frequently. Guarded by CRON_SECRET, not the RBAC matrix.
 */
export const POST = handler(async (req) => {
  requireCronSecret(req);
  const { atRisk } = await sweepSlaBreaches();
  return ok({ atRisk: atRisk.length });
});
