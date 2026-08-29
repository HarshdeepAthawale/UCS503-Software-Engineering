import { handler, ok } from "@/lib/http/respond";
import { authorize } from "@/lib/iam/guard";
import { listOpenFlags } from "@/lib/services/flag.service";

export const runtime = "nodejs";

/**
 * GET /api/admin/flags - the open moderation queue.
 * Requires `flag:read` (ADMIN only). Any other role gets a generic, audited 403.
 */
export const GET = handler(async (req) => {
  await authorize(req, "flag:read");
  const result = await listOpenFlags();
  return ok(result);
});
