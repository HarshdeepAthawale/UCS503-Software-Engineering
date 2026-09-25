import { handler, ok, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { AdminCreateSchema } from "@/lib/validation/schemas";
import { createAdmin, listAdmins } from "@/lib/services/admin.service";

export const runtime = "nodejs";

/**
 * GET  /api/admin/admins - every admin account, the super admin first.
 * POST /api/admin/admins - create an admin and email them how to sign in.
 * Both are the super admin's alone (`user:manage_admins`).
 */
export const GET = handler(async (req) => {
  await authorize(req, "user:manage_admins");
  return ok(await listAdmins());
});

export const POST = handler(async (req) => {
  const superAdmin = await authorize(req, "user:manage_admins");

  const body = await req.json().catch(() => null);
  const parsed = AdminCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const admin = await createAdmin(superAdmin, parsed.data);
  return created({ admin });
});
