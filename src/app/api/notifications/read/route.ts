import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { NotificationsReadSchema } from "@/lib/validation/schemas";
import { markRead } from "@/lib/services/notification.service";

export const runtime = "nodejs";

/**
 * POST /api/notifications/read — mark the caller's notifications read (T-17).
 * Body `{ ids? }`; omit to mark all. Always scoped to the principal.
 */
export const POST = handler(async (req) => {
  const principal = await authorize(req, "notification:manage");

  const body = await req.json().catch(() => ({}));
  const parsed = NotificationsReadSchema.safeParse(body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const marked = await markRead(principal.userId, parsed.data.ids);
  return ok({ marked });
});
