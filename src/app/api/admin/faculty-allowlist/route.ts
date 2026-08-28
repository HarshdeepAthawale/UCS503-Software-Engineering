import { handler, ok, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { FacultyAllowlistAddSchema } from "@/lib/validation/schemas";
import { addFacultyAllowlist, listFacultyAllowlist } from "@/lib/services/admin.service";

export const runtime = "nodejs";

/**
 * GET  /api/admin/faculty-allowlist — list roster emails (`faculty_allowlist:read`).
 * POST /api/admin/faculty-allowlist — add one (`faculty_allowlist:manage`);
 *      immediately promotes any existing STUDENT with that email to FACULTY.
 */
export const GET = handler(async (req) => {
  await authorize(req, "faculty_allowlist:read");
  const result = await listFacultyAllowlist();
  return ok(result);
});

export const POST = handler(async (req) => {
  const admin = await authorize(req, "faculty_allowlist:manage");

  const body = await req.json().catch(() => null);
  const parsed = FacultyAllowlistAddSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const entry = await addFacultyAllowlist(admin, parsed.data);
  return created({ entry });
});
