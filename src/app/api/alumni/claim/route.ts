import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { AlumniClaimSchema } from "@/lib/validation/schemas";
import { getMyClaim, submitClaim } from "@/lib/services/alumni.service";

export const runtime = "nodejs";

/**
 * GET  /api/alumni/claim - the signed-in alumnus's own claim (or null).
 * POST /api/alumni/claim - submit it, or resubmit after a rejection. Allowed
 * while the account is PENDING_ALUMNI (the one write a pending account may
 * make - see policy.ts); always scoped to the caller's own claim.
 */
export const GET = handler(async (req) => {
  const principal = await authorize(req, "profile:read");
  if (principal.role !== "ALUMNI") throw Errors.forbidden("Only alumni accounts have an alumni claim.");
  return ok({ claim: await getMyClaim(principal) });
});

export const POST = handler(async (req) => {
  const principal = await authorize(req, "alumni_claim:submit");
  const body = await req.json().catch(() => null);
  const parsed = AlumniClaimSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }
  return ok({ claim: await submitClaim(principal, parsed.data) }, 201);
});
