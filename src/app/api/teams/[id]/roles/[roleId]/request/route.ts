import { handler, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { TeamJoinRequestSchema } from "@/lib/validation/schemas";
import { requestToJoin } from "@/lib/services/team.service";

export const runtime = "nodejs";

/** POST /api/teams/:id/roles/:roleId/request - a STUDENT requests a role slot (T-22). */

function roleIdFromPath(req: Request): string {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("roles");
  const id = idx >= 0 ? (segs[idx + 1] ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

export const POST = handler(async (req) => {
  const principal = await authorize(req, "team:join_request");
  const roleId = roleIdFromPath(req);

  const body = await req.json().catch(() => ({}));
  const parsed = TeamJoinRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const request = await requestToJoin(principal, roleId, parsed.data);
  return created({ request });
});
