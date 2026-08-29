import { handler, ok } from "@/lib/http/respond";
import { authorize } from "@/lib/iam/guard";
import { getInstituteAnalytics } from "@/lib/services/analytics.service";

export const runtime = "nodejs";

/**
 * GET /api/admin/analytics - institute-wide analytics for the admin console
 * (T-25, M9). Requires `analytics:read` (ADMIN only). Figures derive from the
 * immutable application event stamps, so they cannot be gamed.
 */
export const GET = handler(async (req) => {
  await authorize(req, "analytics:read");
  const analytics = await getInstituteAnalytics();
  return ok({ analytics });
});
