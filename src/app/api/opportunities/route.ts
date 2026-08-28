import { handler, ok, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import {
  OpportunityCreateSchema,
  OpportunityListQuerySchema,
} from "@/lib/validation/schemas";
import { createOpportunity, listOpportunities } from "@/lib/services/opportunity.service";

export const runtime = "nodejs";

/**
 * GET /api/opportunities — faceted discovery: full-text `q`, type/domain/stipend/
 * skill facets, keyset-paginated, excludes expired & deleted by default. Requires
 * `opportunity:list` (all roles).
 * POST /api/opportunities — publish a structured, SLA-pledged posting.
 * Requires `opportunity:create` (FACULTY / approved ALUMNI only in the matrix).
 */
export const GET = handler(async (req) => {
  await authorize(req, "opportunity:list");

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = OpportunityListQuerySchema.safeParse(params);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid query.", first?.path.join(".") ?? null);
  }

  const result = await listOpportunities({
    q: parsed.data.q,
    type: parsed.data.type,
    domain: parsed.data.domain,
    stipend: parsed.data.stipend,
    skillId: parsed.data.skillId,
    includeExpired: parsed.data.includeExpired === "true",
    cursor: parsed.data.cursor,
    limit: parsed.data.limit,
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
