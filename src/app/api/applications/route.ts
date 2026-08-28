import { handler, ok } from "@/lib/http/respond";
import { authorize } from "@/lib/iam/guard";
import { listMyApplications } from "@/lib/services/application.service";

export const runtime = "nodejs";

/**
 * GET /api/applications - the caller's own applications (student view, T-13).
 * Scoped to the principal in the service; `application:read` gates the route.
 */
export const GET = handler(async (req) => {
  const principal = await authorize(req, "application:read");
  const result = await listMyApplications(principal);
  return ok(result);
});
