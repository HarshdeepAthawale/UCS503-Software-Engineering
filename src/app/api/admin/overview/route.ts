import { handler, ok } from "@/lib/http/respond";
import { authorize } from "@/lib/iam/guard";
import { getOverview } from "@/lib/services/admin.service";

export const runtime = "nodejs";

/** GET /api/admin/overview — dashboard counts. ADMIN only (`user:read`). */
export const GET = handler(async (req) => {
  await authorize(req, "user:read");
  const overview = await getOverview();
  return ok({ overview });
});
