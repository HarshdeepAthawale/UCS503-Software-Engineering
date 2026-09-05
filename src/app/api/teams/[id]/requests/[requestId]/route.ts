import { handler, ok, noContent } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { TeamRequestDecisionSchema } from "@/lib/validation/schemas";
import {
  decideJoinRequest,
  getJoinRequestRefs,
  withdrawJoinRequest,
} from "@/lib/services/team.service";

export const runtime = "nodejs";

/**
 * PATCH /api/teams/:id/requests/:requestId - the LEAD accepts or rejects.
 * DELETE /api/teams/:id/requests/:requestId - the STUDENT withdraws their own.
 */

function requestIdFromPath(req: Request): string {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("requests");
  const id = idx >= 0 ? (segs[idx + 1] ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

export const PATCH = handler(async (req) => {
  const id = requestIdFromPath(req);
  const refs = await getJoinRequestRefs(id);
  if (!refs) throw Errors.notFound();

  const principal = await authorize(req, "team:manage", { ownerId: refs.leadId });

  const body = await req.json().catch(() => null);
  const parsed = TeamRequestDecisionSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const request = await decideJoinRequest(principal, id, parsed.data);
  return ok({ request });
});

export const DELETE = handler(async (req) => {
  const id = requestIdFromPath(req);
  const refs = await getJoinRequestRefs(id);
  if (!refs) throw Errors.notFound();

  const principal = await authorize(req, "team:join_request_withdraw", { ownerId: refs.studentId });
  await withdrawJoinRequest(principal, id);
  return noContent();
});
