import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { ApplicationTransitionSchema } from "@/lib/validation/schemas";
import {
  getApplicationRefs,
  transitionApplication,
} from "@/lib/services/application.service";

export const runtime = "nodejs";

/**
 * PATCH /api/applications/:id - the POSTER moves an application through the
 * pipeline (T-13). Ownership is the opportunity's poster; `opportunity:transition`
 * is ownership-scoped, so only the poster (never another faculty member) passes.
 */

function applicationIdFromPath(req: Request): string {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("applications");
  const id = idx >= 0 ? (segs[idx + 1] ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

export const PATCH = handler(async (req) => {
  const id = applicationIdFromPath(req);
  const refs = await getApplicationRefs(id);
  if (!refs) throw Errors.notFound(); // generic 404 before authorize - no leak

  const principal = await authorize(req, "opportunity:transition", { ownerId: refs.posterId });

  const body = await req.json().catch(() => null);
  const parsed = ApplicationTransitionSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const application = await transitionApplication(principal, id, parsed.data);
  return ok({ application });
});
