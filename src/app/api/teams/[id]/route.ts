import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { TeamUpdateSchema } from "@/lib/validation/schemas";
import { getTeam, getTeamLeadId, updateTeam } from "@/lib/services/team.service";

export const runtime = "nodejs";

/**
 * GET /api/teams/:id - anyone with `team:read` (every role).
 * PATCH /api/teams/:id - the lead updates or closes their own team (T-22).
 */

function teamIdFromPath(req: Request): string {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("teams");
  const id = idx >= 0 ? (segs[idx + 1] ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

export const GET = handler(async (req) => {
  const principal = await authorize(req, "team:read");
  const id = teamIdFromPath(req);
  const team = await getTeam(id, principal.role === "STUDENT" ? principal.userId : undefined);
  return ok({ team });
});

export const PATCH = handler(async (req) => {
  const id = teamIdFromPath(req);
  const leadId = await getTeamLeadId(id);
  if (!leadId) throw Errors.notFound();

  const principal = await authorize(req, "team:manage", { ownerId: leadId });

  const body = await req.json().catch(() => null);
  const parsed = TeamUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const team = await updateTeam(principal, id, parsed.data);
  return ok({ team });
});
