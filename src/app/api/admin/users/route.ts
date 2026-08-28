import { handler, ok, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { AdminProvisionAlumniSchema } from "@/lib/validation/schemas";
import { listUsers, provisionAlumni } from "@/lib/services/admin.service";

export const runtime = "nodejs";

/**
 * GET  /api/admin/users — search/filter users (`user:read`).
 * POST /api/admin/users — provision an ALUMNI account (`user:manage`).
 */
export const GET = handler(async (req) => {
  await authorize(req, "user:read");
  const url = new URL(req.url);
  const result = await listUsers({
    q: url.searchParams.get("q") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  return ok(result);
});

export const POST = handler(async (req) => {
  const admin = await authorize(req, "user:manage");

  const body = await req.json().catch(() => null);
  const parsed = AdminProvisionAlumniSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const user = await provisionAlumni(admin, parsed.data);
  return created({ user });
});
