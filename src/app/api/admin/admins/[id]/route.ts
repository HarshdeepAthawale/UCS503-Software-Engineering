import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { removeAdmin } from "@/lib/services/admin.service";

export const runtime = "nodejs";

/**
 * DELETE /api/admin/admins/:id - remove an admin (`user:manage_admins`, super
 * admin only): soft-deletes the account and revokes its sessions. The super
 * admin itself cannot be removed.
 */
export const DELETE = handler(async (req) => {
  const superAdmin = await authorize(req, "user:manage_admins");
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();

  return ok(await removeAdmin(superAdmin, id));
});
