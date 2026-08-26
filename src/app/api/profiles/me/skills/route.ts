import { handler, ok, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { requireAuth, authorize } from "@/lib/iam/guard";
import { UserSkillAddSchema, UserSkillsReplaceSchema } from "@/lib/validation/schemas";
import { addOwnSkill, replaceOwnSkills } from "@/lib/services/skill.service";

export const runtime = "nodejs";

/**
 * Own profile skill assignment (TechSpec §5.3, tracker T-07).
 *
 * PUT  /api/profiles/me/skills — replace the caller's WHOLE skill set:
 *      {skills: [{skillId, proficiency}]}. Every skillId is validated against
 *      the live taxonomy; the swap is atomic (one transaction).
 * POST /api/profiles/me/skills — add or upsert ONE skill: {skillId, proficiency}.
 *
 * Both require `profile:update` AND ownership. For the "me" resource the owner
 * is always the caller, so we resolve the principal first, then authorize with
 * the concrete owner id (fail-closed by design, mirroring profiles/me).
 */
export const PUT = handler(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = UserSkillsReplaceSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const principal = await requireAuth(req);
  await authorize(req, "profile:update", { ownerId: principal.userId });

  const result = await replaceOwnSkills(principal, parsed.data);
  return ok({ profile: result });
});

export const POST = handler(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = UserSkillAddSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const principal = await requireAuth(req);
  await authorize(req, "profile:update", { ownerId: principal.userId });

  const result = await addOwnSkill(principal, parsed.data);
  return created({ profile: { userId: principal.userId, skills: [result] } });
});
