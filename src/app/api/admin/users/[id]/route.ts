import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { AdminUserUpdateSchema } from "@/lib/validation/schemas";
import { updateUser } from "@/lib/services/admin.service";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/users/:id - change a user's role/status (`user:manage`).
 * Role can never be ADMIN; the admin's own account and any ADMIN are immutable
 * (enforced in the service).
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

  const user = await updateUser(admin, id, parsed.data);
  return ok({ user });
});
