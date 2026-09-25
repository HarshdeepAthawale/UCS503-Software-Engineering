import { isAdminRole } from "@/lib/domain/admin-portal";
import { handler, ok, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { ApplicationCreateSchema } from "@/lib/validation/schemas";
import { getOpportunityPosterId } from "@/lib/services/opportunity.service";
import {
  applyToOpportunity,
  listApplicantsForOpportunity,
} from "@/lib/services/application.service";

export const runtime = "nodejs";

/**
 * POST /api/opportunities/:id/applications - a student applies (T-12).
 * GET  /api/opportunities/:id/applications - the POSTER views applicants (T-13).
 *
 * The poster view requires `application:read` AND that the caller owns the
 * opportunity (or is admin). `application:read` is not ownership-scoped in the
 * matrix, so ownership is checked explicitly here - a faculty member cannot read
 * another poster's pipeline.
 */

function opportunityIdFromPath(req: Request): string {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("opportunities");
  const id = idx >= 0 ? (segs[idx + 1] ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

export const POST = handler(async (req) => {
  const principal = await authorize(req, "application:create");
  const opportunityId = opportunityIdFromPath(req);

  const body = await req.json().catch(() => null);
  const parsed = ApplicationCreateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const application = await applyToOpportunity(principal, opportunityId, parsed.data);
  return created({ application });
});

export const GET = handler(async (req) => {
  const principal = await authorize(req, "application:read");
  const opportunityId = opportunityIdFromPath(req);

  const posterId = await getOpportunityPosterId(opportunityId);
  if (!posterId) throw Errors.notFound(); // generic 404 - no existence leak
  if (principal.userId !== posterId && !isAdminRole(principal.role)) {
    throw Errors.forbidden();
  }

  const result = await listApplicantsForOpportunity(opportunityId);
  return ok(result);
});
