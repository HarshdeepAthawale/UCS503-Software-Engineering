import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { removeFacultyAllowlist } from "@/lib/services/admin.service";

export const runtime = "nodejs";

/** DELETE /api/admin/faculty-allowlist/:id - remove a roster email (`faculty_allowlist:manage`). */
export const DELETE = handler(async (req) => {
  const admin = await authorize(req, "faculty_allowlist:manage");
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();

  const result = await removeFacultyAllowlist(admin, id);
  return ok(result);
});
