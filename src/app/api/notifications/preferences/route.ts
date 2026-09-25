import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { NotificationPrefSchema } from "@/lib/validation/schemas";
import { getPreference, setPreference } from "@/lib/services/notification.service";

export const runtime = "nodejs";

/**
 * GET /api/notifications/preferences - the caller's email cadence (T-17).
 * PUT /api/notifications/preferences - set it: IMMEDIATE (one email per event),
 * DAILY or WEEKLY (one batched digest). Always scoped to the principal.
 */
export const GET = handler(async (req) => {
  const principal = await authorize(req, "notification:read");
  const { frequency } = await getPreference(principal.userId);
  return ok({ frequency });
});

export const PUT = handler(async (req) => {
  const principal = await authorize(req, "notification:manage");

  const body = await req.json().catch(() => null);
  const parsed = NotificationPrefSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const { frequency } = await setPreference(principal.userId, parsed.data.frequency);
  return ok({ frequency });
});
