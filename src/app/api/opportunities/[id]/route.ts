import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { requireAuth, authorize } from "@/lib/iam/guard";
import { OpportunityUpdateSchema } from "@/lib/validation/schemas";
import {
  closeOpportunity,
  getOpportunity,
  getOpportunityPosterId,
  updateOpportunity,
} from "@/lib/services/opportunity.service";
import { getPosterResponsiveness } from "@/lib/services/analytics.service";

export const runtime = "nodejs";

/**
 * GET    /api/opportunities/:id - detail view (any authenticated role).
 * PATCH  /api/opportunities/:id - edit (owner only, `opportunity:update` OWN;
 *        refused past EXPIRED).
 * POST   /api/opportunities/:id/close - owner closes the posting (CLOSED).
 *
 * Ownership is resolved from the DB row BEFORE authorize() so the ownership-
 * scoped check runs against the real poster id (fail-closed by design). The
 * service then enforces business invariants (expired/closed refusals).
 */

async function resolveOwnedId(req: Request): Promise<{ id: string; principal: Awaited<ReturnType<typeof requireAuth>> }> {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();

  const principal = await requireAuth(req);
  const posterId = await getOpportunityPosterId(id);
  if (!posterId) throw Errors.notFound(); // generic 404 - no existence leak

  // Ownership-scoped authorization: actor must be the poster.
  await authorize(req, "opportunity:update", { ownerId: posterId });
  return { id, principal };
}

export const GET = handler(async (req) => {
  await authorize(req, "opportunity:read");
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  const opportunity = await getOpportunity(id);
  // Public responsiveness badge (T-14) so students can judge before applying.
  const responsiveness = await getPosterResponsiveness(opportunity.poster.id);
  return ok({ opportunity: { ...opportunity, poster: { ...opportunity.poster, responsiveness } } });
});

export const PATCH = handler(async (req) => {
  const { id, principal } = await resolveOwnedId(req);

  const body = await req.json().catch(() => null);
  const parsed = OpportunityUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const opportunity = await updateOpportunity(principal, id, parsed.data);
  return ok({ opportunity });
});

export const POST = handler(async (req) => {
  const { id, principal } = await resolveOwnedId(req);
  const result = await closeOpportunity(principal, id);
  return ok(result);
});
