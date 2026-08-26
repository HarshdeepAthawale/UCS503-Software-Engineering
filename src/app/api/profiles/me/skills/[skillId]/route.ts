import { handler, noContent } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { requireAuth, authorize } from "@/lib/iam/guard";
import { removeOwnSkill } from "@/lib/services/skill.service";

export const runtime = "nodejs";

/**
 * DELETE /api/profiles/me/skills/:skillId — remove one skill from the caller's
 * profile. Idempotent (removing an absent skill is a no-op success). Requires
 * `profile:update` + ownership, same fail-closed pattern as profiles/me.
 */
export const DELETE = handler(async (req) => {
  const principal = await requireAuth(req);
  await authorize(req, "profile:update", { ownerId: principal.userId });

  const skillId = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(skillId)) throw Errors.notFound();

  await removeOwnSkill(principal, skillId);
  return noContent();
});
