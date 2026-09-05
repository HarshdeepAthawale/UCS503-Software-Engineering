import { handler, ok, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { TeamCreateSchema } from "@/lib/validation/schemas";
import { createTeam, listTeams } from "@/lib/services/team.service";

export const runtime = "nodejs";

/**
 * GET /api/teams - browse open teams (or `?mine=1` for the caller's own, led
 * or joined, every status included).
 * POST /api/teams - a STUDENT stands up a new team as its lead (T-22).
 */

export const GET = handler(async (req) => {
  const principal = await authorize(req, "team:list");
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "1";
  const { teams, nextCursor } = await listTeams({
    hackathon: url.searchParams.get("hackathon") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    mineUserId: mine ? principal.userId : undefined,
    // Only a STUDENT can join a role, so only they get the skillFit hint.
    viewerUserId: principal.role === "STUDENT" ? principal.userId : undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
  });
  return ok({ teams, nextCursor });
});

export const POST = handler(async (req) => {
  const principal = await authorize(req, "team:create");

  const body = await req.json().catch(() => null);
  const parsed = TeamCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const team = await createTeam(principal, parsed.data);
  return created({ team });
});
