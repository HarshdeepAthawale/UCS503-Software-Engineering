import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { FlagResolveSchema } from "@/lib/validation/schemas";
import { resolveFlag } from "@/lib/services/flag.service";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/flags/:id - resolve or dismiss a flag (M9).
 * Requires `flag:resolve` (any admin). RESOLVED upholds it (and, with
 * removePosting - super admin only, `opportunity:remove` - soft-removes the
 * posting and closes its sibling open flags);
 * DISMISSED closes it as no-violation. Audited with the reviewer id.
 */
export const PATCH = handler(async (req) => {
  const admin = await authorize(req, "flag:resolve");

  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();

  const body = await req.json().catch(() => null);
  const parsed = FlagResolveSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  if (parsed.data.removePosting) await authorize(req, "opportunity:remove");

  const result = await resolveFlag(admin, id, parsed.data);
  return ok(result);
});
