import { handler, ok } from "@/lib/http/respond";
import { authorize } from "@/lib/iam/guard";
import { listNotifications } from "@/lib/services/notification.service";

export const runtime = "nodejs";

/**
 * GET /api/notifications - the caller's own notification feed + unread count
 * (T-17). Scoped to the principal in the service; `notification:read` gates it.
 */
export const GET = handler(async (req) => {
  const principal = await authorize(req, "notification:read");
  const result = await listNotifications(principal.userId);
  return ok(result);
});
