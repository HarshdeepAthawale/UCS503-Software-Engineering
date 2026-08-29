import { handler, ok } from "@/lib/http/respond";
import { requireCronSecret } from "@/lib/http/cron-auth";
import { runDigest } from "@/lib/services/notification.service";

export const runtime = "nodejs";

/**
 * POST /api/cron/notification-digest - T-17 digest job.
 *
 * Batches each user's undelivered notifications according to their cadence
 * (IMMEDIATE / DAILY / WEEKLY) and marks them delivered. Idempotent within a
 * window. Guarded by CRON_SECRET.
 */
export const POST = handler(async (req) => {
  requireCronSecret(req);
  const result = await runDigest();
  return ok(result);
});

// Vercel Cron triggers jobs with a GET (carrying `Authorization: Bearer
// $CRON_SECRET`); POST stays for manual/authed invocation. Same guard, same work.
export const GET = POST;
