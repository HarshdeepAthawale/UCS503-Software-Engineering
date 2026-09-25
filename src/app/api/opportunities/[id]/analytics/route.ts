import { isAdminRole } from "@/lib/domain/admin-portal";
import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { getOpportunityPosterId } from "@/lib/services/opportunity.service";
import { getOpportunityAnalytics } from "@/lib/services/analytics.service";

export const runtime = "nodejs";

/**
 * GET /api/opportunities/:id/analytics - pipeline analytics for one posting
 * (T-14): applicant/acknowledged counts, acknowledgement rate, median TTA.
 * Poster-owned or admin only - the counts are more than the public badge.
 */

function opportunityIdFromPath(req: Request): string {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("opportunities");
  const id = idx >= 0 ? (segs[idx + 1] ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

export const GET = handler(async (req) => {
  const principal = await authorize(req, "application:read");
  const id = opportunityIdFromPath(req);

  const posterId = await getOpportunityPosterId(id);
  if (!posterId) throw Errors.notFound();
  if (principal.userId !== posterId && !isAdminRole(principal.role)) {
    throw Errors.forbidden();
  }

  const analytics = await getOpportunityAnalytics(id);
  return ok({ analytics });
});
