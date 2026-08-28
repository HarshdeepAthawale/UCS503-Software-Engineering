import { handler, ok } from "@/lib/http/respond";
import { authorize } from "@/lib/iam/guard";
import { listPendingClaims } from "@/lib/services/alumni.service";

export const runtime = "nodejs";

/**
 * GET /api/admin/alumni-claims - the pending alumni claim queue.
 * Requires `alumni_claim:read`, which only ADMIN holds in the matrix. Any other
 * role is denied with a generic 403 (and the denial is audited).
 */
export const GET = handler(async (req) => {
  await authorize(req, "alumni_claim:read");
  const claims = await listPendingClaims();
  return ok({ claims });
});
