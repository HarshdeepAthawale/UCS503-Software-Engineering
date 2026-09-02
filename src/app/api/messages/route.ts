import { handler, ok } from "@/lib/http/respond";
import { authorize } from "@/lib/iam/guard";
import { listMyThreads } from "@/lib/services/message.service";

export const runtime = "nodejs";

/**
 * GET /api/messages - every conversation the caller is part of (T-16 inbox).
 * `message:read` is membership-scoped inside the service (see message.service.ts),
 * so every role that holds the grant only ever sees its own threads.
 */
export const GET = handler(async (req) => {
  const principal = await authorize(req, "message:read");
  const result = await listMyThreads(principal);
  return ok(result);
});
