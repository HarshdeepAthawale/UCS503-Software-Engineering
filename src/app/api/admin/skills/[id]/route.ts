import { handler, ok, noContent } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { SkillUpdateSchema } from "@/lib/validation/schemas";
import { softDeleteSkill, updateSkill } from "@/lib/services/skill.service";

export const runtime = "nodejs";

/**
 * Admin skill-taxonomy item.
 *
 * PATCH  /api/admin/skills/:id — rename / re-domain a taxonomy entry.
 * DELETE /api/admin/skills/:id — SOFT delete (sets deletedAt); the row and any
 *        user_skills history survive for analytics (Rules.md: nothing
 *        hard-deleted). Both require `skill_taxonomy:manage` and are audited.
 */
export const PATCH = handler(async (req) => {
  const admin = await authorize(req, "skill_taxonomy:manage");

  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();

  const body = await req.json().catch(() => null);
  const parsed = SkillUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const skill = await updateSkill(admin, id, parsed.data);
  return ok({ skill });
});

export const DELETE = handler(async (req) => {
  const admin = await authorize(req, "skill_taxonomy:manage");

  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();

  await softDeleteSkill(admin, id);
  return noContent();
});
