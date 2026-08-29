import { handler, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { FlagCreateSchema } from "@/lib/validation/schemas";
import { createFlag } from "@/lib/services/flag.service";

export const runtime = "nodejs";

/**
 * POST /api/opportunities/:id/flag - report a posting for moderation (M9).
 * Requires `flag:create` (student/faculty/alumni; ADMIN governs instead). One
 * OPEN flag per reporter per posting — a duplicate is a 409.
 */
export const POST = handler(async (req) => {
  const principal = await authorize(req, "flag:create");

  // /api/opportunities/<id>/flag → id is the second-to-last segment.
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 2] ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();

  const body = await req.json().catch(() => null);
  const parsed = FlagCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const flag = await createFlag(principal, id, parsed.data);
  return created({ flag });
});
