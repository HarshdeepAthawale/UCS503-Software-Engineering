import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { AlumniClaimDecisionSchema } from "@/lib/validation/schemas";
import { decideClaim } from "@/lib/services/alumni.service";

export const runtime = "nodejs";

/**
 * POST /api/admin/alumni-claims/:id - approve or reject a claim.
 * Requires `alumni_claim:approve` (ADMIN only). Approval flips the account to
 * ACTIVE; rejection SUSPENDS it. The decision is audited with the reviewer id.
 */
export const POST = handler(async (req) => {
  const admin = await authorize(req, "alumni_claim:approve");

  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();

  const body = await req.json().catch(() => null);
  const parsed = AlumniClaimDecisionSchema.safeParse(body);
  if (!parsed.success) throw Errors.validation("Provide a decision (APPROVED or REJECTED).");

  const result = await decideClaim(admin, id, parsed.data.decision, parsed.data.reason);
  return ok(result);
});
