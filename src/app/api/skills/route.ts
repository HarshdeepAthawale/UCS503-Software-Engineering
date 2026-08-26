import { handler, ok } from "@/lib/http/respond";
import { authorize } from "@/lib/iam/guard";
import { listSkills } from "@/lib/services/skill.service";

export const runtime = "nodejs";

/**
 * GET /api/skills — the public skill taxonomy for profile editors and search.
 * Requires `skill_taxonomy:read`, granted to every role in the matrix. Skills
 * are admin-curated (NOT free text), so this is a controlled vocabulary.
 */
export const GET = handler(async (req) => {
  await authorize(req, "skill_taxonomy:read");
  const skills = await listSkills();
  return ok({ skills });
});
