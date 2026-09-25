import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { AdminUserUpdateSchema } from "@/lib/validation/schemas";
import { updateUser } from "@/lib/services/admin.service";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/users/:id - change a member's role (`user:manage`) or
 * suspend/restore them (`user:suspend`, super admin only). Role can never be
 * set to an admin role, and admin accounts are refused (enforced in the service).
 */
export const PATCH = handler(async (req) => {
  const admin = await authorize(req, "user:manage");
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();

  const body = await req.json().catch(() => null);
  const parsed = AdminUserUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  // Suspending or restoring an account is the super admin's call alone.
  if (parsed.data.status) await authorize(req, "user:suspend");

  const user = await updateUser(admin, id, parsed.data);
  return ok({ user });
});
