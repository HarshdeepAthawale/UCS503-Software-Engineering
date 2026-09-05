import { handler, ok, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { MeetingCreateSchema } from "@/lib/validation/schemas";
import {
  getApplicationMeetingRefs,
  listApplicationMeetings,
  scheduleApplicationMeeting,
} from "@/lib/services/meeting.service";

export const runtime = "nodejs";

/**
 * POST /api/applications/:id/meetings - the POSTER schedules a Meet interview
 * while the application is SHORTLISTED/INTERVIEW.
 * GET /api/applications/:id/meetings - poster or student view their meetings.
 */

function applicationIdFromPath(req: Request): string {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("applications");
  const id = idx >= 0 ? (segs[idx + 1] ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

export const GET = handler(async (req) => {
  const id = applicationIdFromPath(req);
  const refs = await getApplicationMeetingRefs(id);
  if (!refs) throw Errors.notFound();

  const principal = await authorize(req, "meeting:read");
  if (principal.userId !== refs.posterId && principal.userId !== refs.studentId) {
    throw Errors.forbidden();
  }
  const { meetings } = await listApplicationMeetings(id);
  return ok({ meetings });
});

export const POST = handler(async (req) => {
  const id = applicationIdFromPath(req);
  const refs = await getApplicationMeetingRefs(id);
  if (!refs) throw Errors.notFound();

  const principal = await authorize(req, "meeting:create", { ownerId: refs.posterId });

  const body = await req.json().catch(() => null);
  const parsed = MeetingCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const meeting = await scheduleApplicationMeeting(principal, id, parsed.data);
  return created({ meeting });
});
