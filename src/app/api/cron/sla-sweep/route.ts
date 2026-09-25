import { handler, ok } from "@/lib/http/respond";
import { requireCronSecret } from "@/lib/http/cron-auth";
import { sweepSlaBreaches } from "@/lib/services/opportunity.service";

export const runtime = "nodejs";

/**
 * POST /api/cron/sla-sweep - T-15 SLA breach sweep.
 *
 * Flips LIVE postings with overdue unacknowledged applications to AT_RISK (and
 * nudges each poster), and returns caught-up AT_RISK postings to LIVE. Idempotent;
 * safe to run frequently. Guarded by CRON_SECRET, not the RBAC matrix.
 */
export const POST = handler(async (req) => {
  requireCronSecret(req);
  const { atRisk, recovered } = await sweepSlaBreaches();
  return ok({ atRisk: atRisk.length, recovered: recovered.length });
});

// Vercel Cron triggers jobs with a GET (carrying `Authorization: Bearer
// $CRON_SECRET`); POST stays for manual/authed invocation. Same guard, same work.
export const GET = POST;
