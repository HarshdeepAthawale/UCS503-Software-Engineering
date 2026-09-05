import { handler, ok } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { cancelMeeting, getMeetingRefs } from "@/lib/services/meeting.service";

export const runtime = "nodejs";

/** DELETE /api/meetings/:id - the organizer cancels their own scheduled meeting. */

function meetingIdFromPath(req: Request): string {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("meetings");
  const id = idx >= 0 ? (segs[idx + 1] ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

export const DELETE = handler(async (req) => {
  const id = meetingIdFromPath(req);
  const refs = await getMeetingRefs(id);
  if (!refs) throw Errors.notFound();

  const principal = await authorize(req, "meeting:cancel", { ownerId: refs.organizerId });
  const meeting = await cancelMeeting(principal, id);
  return ok({ meeting });
});
