import { handler, ok } from "@/lib/http/respond";
import { authorize } from "@/lib/iam/guard";
import { teamSuggestions } from "@/lib/services/team.service";

export const runtime = "nodejs";

/**
 * GET /api/teams/suggestions - hackathons with a team recruiting right now and
 * the most-used role names, for the filter chips and the create-team form.
 * Derived from real teams, so the suggestions never go stale.
 */
export const GET = handler(async (req) => {
  await authorize(req, "team:list");
  return ok(await teamSuggestions());
});
