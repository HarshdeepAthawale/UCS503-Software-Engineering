import { handler, ok, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { requireAuth, authorize } from "@/lib/iam/guard";
import { ProjectCreateSchema } from "@/lib/validation/schemas";
import { addOwnProject, listOwnProjects } from "@/lib/services/profile.service";

export const runtime = "nodejs";

/**
 * Own profile projects (T-37; docs/PRD M2).
 *
 * GET  /api/profiles/me/projects  - the caller's own projects, newest first.
 * POST /api/profiles/me/projects  - add one: {title, description?, repoUrl?, liveUrl?}.
 *
 * Both require `profile:read` / `profile:update` AND ownership. For the "me"
 * resource the owner is always the caller, so we resolve the principal first,
 * then authorize with the concrete owner id (fail-closed, mirroring profiles/me).
 */
export const GET = handler(async (req) => {
  const principal = await authorize(req, "profile:read");
  const projects = await listOwnProjects(principal);
  return ok({ projects });
});

export const POST = handler(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = ProjectCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const principal = await requireAuth(req);
  await authorize(req, "profile:update", { ownerId: principal.userId });

  const project = await addOwnProject(principal, parsed.data);
  return created({ project });
});
