import { handler, ok } from "@/lib/http/respond";
import { authorize } from "@/lib/iam/guard";
import { listPendingClaims } from "@/lib/services/alumni.service";

export const runtime = "nodejs";

/**
 * GET /api/admin/alumni-claims - claims waiting for review, oldest first, each
 * with any other claim that uses the same roll number.
 * Requires `alumni_claim:read` (admins).
 */
export const GET = handler(async (req) => {
  await authorize(req, "alumni_claim:read");
  return ok({ claims: await listPendingClaims() });
});
