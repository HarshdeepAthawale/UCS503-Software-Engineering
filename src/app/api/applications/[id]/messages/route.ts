import { handler, ok, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { MessageSendSchema } from "@/lib/validation/schemas";
import { listMessages, sendMessage } from "@/lib/services/message.service";

export const runtime = "nodejs";

/**
 * GET  /api/applications/:id/messages - read the application's thread (T-16).
 * POST /api/applications/:id/messages - post a message.
 *
 * Membership (student ↔ poster) is enforced in the service; the matrix only
 * grants the capability. Admins may read (moderation) but not send.
 */

function applicationIdFromPath(req: Request): string {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("applications");
  const id = idx >= 0 ? (segs[idx + 1] ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

export const GET = handler(async (req) => {
  const principal = await authorize(req, "message:read");
  const id = applicationIdFromPath(req);
  const result = await listMessages(principal, id);
  return ok(result);
});

export const POST = handler(async (req) => {
  const principal = await authorize(req, "message:send");
  const id = applicationIdFromPath(req);

  const body = await req.json().catch(() => null);
  const parsed = MessageSendSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const message = await sendMessage(principal, id, parsed.data.body);
  return created({ message });
});
