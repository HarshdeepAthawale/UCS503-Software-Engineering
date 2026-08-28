import { handler, ok, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { SkillCreateSchema } from "@/lib/validation/schemas";
import { createSkill, listAllSkills } from "@/lib/services/skill.service";

export const runtime = "nodejs";

/**
 * Admin skill-taxonomy console.
 *
 * GET  /api/admin/skills - full list, including soft-deleted rows (so restores
 *      and history are visible). Requires `skill_taxonomy:manage` (ADMIN only).
 * POST /api/admin/skills - create a taxonomy entry {name, domain}. Same
 *      permission; the create is audited with the acting admin's id.
 */
export const GET = handler(async (req) => {
  await authorize(req, "skill_taxonomy:manage");
  const skills = await listAllSkills();
  return ok({ skills });
});

export const POST = handler(async (req) => {
  const admin = await authorize(req, "skill_taxonomy:manage");

  const body = await req.json().catch(() => null);
  const parsed = SkillCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const skill = await createSkill(admin, parsed.data);
  return created({ skill });
});
