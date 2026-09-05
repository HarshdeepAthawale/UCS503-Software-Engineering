import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { getTeamLeadId, listJoinRequestsForTeam } from "@/lib/services/team.service";

export const runtime = "nodejs";

/** GET /api/teams/:id/requests - the LEAD's inbox of join requests (T-22). */

function teamIdFromPath(req: Request): string {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("teams");
  const id = idx >= 0 ? (segs[idx + 1] ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

export const GET = handler(async (req) => {
  const id = teamIdFromPath(req);
  const leadId = await getTeamLeadId(id);
  if (!leadId) throw Errors.notFound();

  await authorize(req, "team:manage", { ownerId: leadId });
  const { requests } = await listJoinRequestsForTeam(id);
  return ok({ requests });
});
