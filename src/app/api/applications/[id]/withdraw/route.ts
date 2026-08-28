import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import {
  getApplicationRefs,
  withdrawApplication,
} from "@/lib/services/application.service";

export const runtime = "nodejs";

/**
 * POST /api/applications/:id/withdraw — the STUDENT withdraws their own
 * application (T-13). `application:withdraw` is ownership-scoped to the student
 * who owns the application; a poster cannot withdraw on a student's behalf.
 */

function applicationIdFromPath(req: Request): string {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("applications");
  const id = idx >= 0 ? (segs[idx + 1] ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

export const POST = handler(async (req) => {
  const id = applicationIdFromPath(req);
  const refs = await getApplicationRefs(id);
  if (!refs) throw Errors.notFound();

  const principal = await authorize(req, "application:withdraw", { ownerId: refs.studentId });
  const application = await withdrawApplication(principal, id);
  return ok({ application });
});
