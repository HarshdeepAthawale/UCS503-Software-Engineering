import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { resolveOrigin } from "@/lib/http/origin";
import { authorize } from "@/lib/iam/guard";
import { TeamInviteSchema } from "@/lib/validation/schemas";
import { getTeamLeadId, inviteToTeam } from "@/lib/services/team.service";

export const runtime = "nodejs";

function teamIdFromPath(req: Request): string {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("teams");
  const id = idx >= 0 ? (segs[idx + 1] ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

/** POST /api/teams/:id/invite — lead emails a join link + team code to a friend. */
export const POST = handler(async (req) => {
  const id = teamIdFromPath(req);
  const leadId = await getTeamLeadId(id);
  if (!leadId) throw Errors.notFound();

  const principal = await authorize(req, "team:manage", { ownerId: leadId });

  const body = await req.json().catch(() => null);
  const parsed = TeamInviteSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const result = await inviteToTeam(principal, id, parsed.data, resolveOrigin(req));
  return ok(result);
});
