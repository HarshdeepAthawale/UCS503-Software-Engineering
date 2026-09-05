import { handler, ok, created } from "@/lib/http/respond";
import { Errors } from "@/lib/http/errors";
import { authorize } from "@/lib/iam/guard";
import { prisma } from "@/lib/db";
import { MeetingCreateSchema } from "@/lib/validation/schemas";
import {
  getTeamMeetingRefs,
  listTeamMeetings,
  scheduleTeamMeeting,
} from "@/lib/services/meeting.service";

export const runtime = "nodejs";

/**
 * POST /api/teams/:id/meetings - the LEAD schedules a Meet team sync.
 * GET /api/teams/:id/meetings - the lead or any member views the team's meetings.
 */

function teamIdFromPath(req: Request): string {
  const segs = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segs.indexOf("teams");
  const id = idx >= 0 ? (segs[idx + 1] ?? "") : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound();
  return id;
}

export const GET = handler(async (req) => {
  const id = teamIdFromPath(req);
  const refs = await getTeamMeetingRefs(id);
  if (!refs) throw Errors.notFound();

  const principal = await authorize(req, "meeting:read");
  if (principal.userId !== refs.leadId) {
    const isMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: id, userId: principal.userId } },
      select: { userId: true },
    });
    if (!isMember) throw Errors.forbidden();
  }
  const { meetings } = await listTeamMeetings(id);
  return ok({ meetings });
});

export const POST = handler(async (req) => {
  const id = teamIdFromPath(req);
  const refs = await getTeamMeetingRefs(id);
  if (!refs) throw Errors.notFound();

  const principal = await authorize(req, "meeting:create", { ownerId: refs.leadId });

  const body = await req.json().catch(() => null);
  const parsed = MeetingCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw Errors.validation(first?.message ?? "Invalid input.", first?.path.join(".") ?? null);
  }

  const meeting = await scheduleTeamMeeting(principal, id, parsed.data);
  return created({ meeting });
});
