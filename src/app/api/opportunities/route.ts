import { handler, ok, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { OpportunityCreateSchema } from "@/lib/validation/schemas";
import { createOpportunity, listOpportunities } from "@/lib/services/opportunity.service";

export const runtime = "nodejs";

/**
 * GET /api/opportunities — faceted list (type/domain/stipend), cursor-paginated,
 * excludes expired & deleted by default. Requires `opportunity:list` (all roles).
 * POST /api/opportunities — publish a structured, SLA-pledged posting.
 * Requires `opportunity:create` (FACULTY / approved ALUMNI only in the matrix).
 */
export const GET = handler(async (req) => {
  await authorize(req, "opportunity:list");
  const url = new URL(req.url);
  const result = await listOpportunities({
    type: url.searchParams.get("type") ?? undefined,
    domain: url.searchParams.get("domain") ?? undefined,
    stipend: url.searchParams.get("stipend") ?? undefined,
    includeExpired: url.searchParams.get("includeExpired") === "true",
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  });
  return ok(result);
});

export const POST = handler(async (req) => {
  const principal = await authorize(req, "opportunity:create");

  const body = await req.json().catch(() => null);
  const parsed = OpportunityCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const opportunity = await createOpportunity(principal, parsed.data);
  return created({ opportunity });
});
