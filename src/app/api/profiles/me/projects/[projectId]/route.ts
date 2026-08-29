import { handler, ok, noContent } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { requireAuth, authorize } from "@/lib/iam/guard";
import { ProjectUpdateSchema } from "@/lib/validation/schemas";
import { updateOwnProject, removeOwnProject } from "@/lib/services/profile.service";

export const runtime = "nodejs";

function projectIdFrom(req: Request): string {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

/**
 * PATCH  /api/profiles/me/projects/:projectId - edit one of the caller's projects.
 * DELETE /api/profiles/me/projects/:projectId - soft-delete one (idempotent).
 *
 * Both require `profile:update` + ownership; the service additionally scopes the
 * project to the caller's userId, so another user's project id yields a generic
 * 404 (no existence leak), same fail-closed pattern as the skills sub-resource.
 */
export const PATCH = handler(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = ProjectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const principal = await requireAuth(req);
  await authorize(req, "profile:update", { ownerId: principal.userId });

  const project = await updateOwnProject(principal, projectIdFrom(req), parsed.data);
  return ok({ project });
});

export const DELETE = handler(async (req) => {
  const principal = await requireAuth(req);
  await authorize(req, "profile:update", { ownerId: principal.userId });

  await removeOwnProject(principal, projectIdFrom(req));
  return noContent();
});
