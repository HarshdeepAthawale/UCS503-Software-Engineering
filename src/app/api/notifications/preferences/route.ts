import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { NotificationPrefSchema } from "@/lib/validation/schemas";
import { getPreference, setPreference } from "@/lib/services/notification.service";

export const runtime = "nodejs";

/**
 * GET /api/notifications/preferences - the caller's digest cadence (T-17).
 * PUT /api/notifications/preferences - set it (IMMEDIATE | DAILY | WEEKLY).
 * Always the caller's own preference; no id is ever accepted from the client.
 */
export const GET = handler(async (req) => {
  const principal = await authorize(req, "notification:manage");
  const preference = await getPreference(principal.userId);
  return ok({ preference });
});

export const PUT = handler(async (req) => {
  const principal = await authorize(req, "notification:manage");

  const body = await req.json().catch(() => null);
  const parsed = NotificationPrefSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const preference = await setPreference(principal.userId, parsed.data.frequency);
  return ok({ preference });
});
